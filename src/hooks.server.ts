import type { Handle } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';

// Server start: open the database and run pending migrations (SPEC 3).
getDb();

// Auth (cookie -> locals.user, group redirects, CSRF) arrives with M1 (SPEC 6).
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	// Security headers (SPEC 6.5). CSP comes from kit.csp in svelte.config.js.
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
	response.headers.set('X-Frame-Options', 'DENY');
	return response;
};
