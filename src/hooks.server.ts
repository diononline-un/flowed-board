import { json, redirect, type Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { env } from '$lib/server/env.js';
import { purgeJobAllowed, startPurgeJob } from '$lib/server/purge.js';
import * as usersRepo from '$lib/server/repo/users.js';
import {
	SESSION_COOKIE,
	resolveSessionToken,
	sessionCookieOptions
} from '$lib/server/session.js';
import { copy } from '$lib/shared/copy.js';

// Server start: open the database and run pending migrations (SPEC 3).
getDb();

// SPEC 6.8: purge at server start and then every 6 h. Only a real server run
// starts the timer — unit tests and any VITEST process skip it.
if (purgeJobAllowed()) {
	startPurgeJob();
}

// Auth endpoints that must stay reachable without a session.
const PUBLIC_API_PATHS = new Set([
	'/api/auth/register',
	'/api/auth/login',
	'/api/auth/recover'
]);

// Legal pages stay readable for logged-in users (DECISIONS.md); every other
// (public) page redirects them to /plans (SPEC 6.4).
const PUBLIC_PATHS_FOR_LOGGED_IN = new Set([
	'/(public)/impressum',
	'/(public)/datenschutz'
]);

export const handle: Handle = async ({ event, resolve }) => {
	const { method } = event.request;
	const path = event.url.pathname;
	const started = performance.now();

	// CSRF (SPEC 6.5): non-GET/HEAD on /api/* requires Origin == ORIGIN or
	// Sec-Fetch-Site: same-origin, independent of kit.csrf.
	if (path.startsWith('/api/') && method !== 'GET' && method !== 'HEAD') {
		const origin = event.request.headers.get('origin');
		const fetchSite = event.request.headers.get('sec-fetch-site');
		if (origin !== env.ORIGIN && fetchSite !== 'same-origin') {
			return logAndRespond(event, json({ error: copy.errors.forbidden }, { status: 403 }), started);
		}
	}

	// Session cookie -> event.locals.user (SPEC 6.4).
	event.locals.user = null;
	event.locals.sessionToken = null;
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const auth = resolveSessionToken(token);
		if (auth) {
			event.locals.user = auth.user;
			event.locals.sessionToken = token;
			if (auth.renewed) {
				event.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
			}
		} else {
			event.cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	}

	const routeId = event.route.id ?? '';

	// /api/* without a session -> 401 JSON (SPEC 6.4).
	if (
		path.startsWith('/api/') &&
		!event.locals.user &&
		!PUBLIC_API_PATHS.has(path)
	) {
		return logAndRespond(
			event,
			json({ error: copy.errors.unauthorized }, { status: 401 }),
			started
		);
	}

	// Group guards (SPEC 6.4).
	if (routeId.startsWith('/(app)') && !event.locals.user) {
		redirect(303, '/login');
	}
	if (
		routeId.startsWith('/(public)') &&
		event.locals.user &&
		!PUBLIC_PATHS_FOR_LOGGED_IN.has(routeId)
	) {
		redirect(303, '/plans');
	}

	// Activity timestamp on authenticated mutations (max 1/min, SPEC 6.4).
	if (event.locals.user && method !== 'GET' && method !== 'HEAD') {
		usersRepo.touchActivity(event.locals.user.id);
	}

	const response = await resolve(event);

	// Security headers (SPEC 6.5). CSP comes from kit.csp in svelte.config.js.
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), geolocation=(), microphone=(self)'
	);
	response.headers.set('X-Frame-Options', 'DENY');

	return logAndRespond(event, response, started);
};

// Logging (SPEC 6.5): method, path, status, duration only — never bodies,
// cookies, phrases or passwords.
function logAndRespond(
	event: Parameters<Handle>[0]['event'],
	response: Response,
	started: number
): Response {
	const durationMs = Math.round(performance.now() - started);
	console.log(
		`${event.request.method} ${event.url.pathname} ${response.status} ${durationMs}ms`
	);
	return response;
}
