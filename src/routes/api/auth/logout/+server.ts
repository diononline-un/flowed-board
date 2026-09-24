import type { RequestHandler } from './$types';
import { ok } from '$lib/server/http.js';
import { SESSION_COOKIE, destroyByToken } from '$lib/server/session.js';

// Logout (SPEC 7): deletes the current session and clears the cookie.
export const POST: RequestHandler = async (event) => {
	if (event.locals.sessionToken) {
		destroyByToken(event.locals.sessionToken);
	}
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
	return ok({ ok: true });
};
