import type { RequestHandler } from './$types';
import { getDummyHash, verifySecret } from '$lib/server/auth.js';
import {
	clientIp,
	ok,
	parseJson,
	rateLimited,
	unauthorized
} from '$lib/server/http.js';
import { loginIpLimiter, loginUserLimiter } from '$lib/server/ratelimit.js';
import * as usersRepo from '$lib/server/repo/users.js';
import {
	SESSION_COOKIE,
	createSession,
	sessionCookieOptions
} from '$lib/server/session.js';
import { copy } from '$lib/shared/copy.js';
import { loginSchema, normalizeUsername } from '$lib/shared/schemas.js';

// Login (SPEC 6.1, 6.5, 7): generic error message, dummy-hash timing for
// unknown usernames, rate limits per IP and per username+IP.
export const POST: RequestHandler = async (event) => {
	const parsed = await parseJson(loginSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const username = normalizeUsername(parsed.data.username);
	const ip = clientIp(event);
	const ipLimit = loginIpLimiter.check(ip);
	if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfterSec);
	const userLimit = loginUserLimiter.check(`${username}:${ip}`);
	if (!userLimit.allowed) return rateLimited(userLimit.retryAfterSec);

	const row = usersRepo.getByUsername(username);
	if (!row) {
		// Same scrypt work as a real verification (SPEC 6.3).
		await verifySecret(await getDummyHash(), parsed.data.password);
		return unauthorized(copy.auth.errors.invalidCredentials);
	}
	const match = await verifySecret(row.password_hash, parsed.data.password);
	if (!match) {
		return unauthorized(copy.auth.errors.invalidCredentials);
	}

	const { token } = createSession(row.id, event.request.headers.get('user-agent'));
	event.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
	usersRepo.touchActivity(row.id, 0);
	return ok({ user: usersRepo.toPublicUser(row) });
};
