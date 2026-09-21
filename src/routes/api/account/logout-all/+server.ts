import type { RequestHandler } from './$types';
import { ok, unauthorized } from '$lib/server/http.js';
import * as usersRepo from '$lib/server/repo/users.js';
import { destroyOthersForUser } from '$lib/server/session.js';

// Logout-all (SPEC 7): deletes every session except the current one.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user || !event.locals.sessionToken) return unauthorized();
	destroyOthersForUser(user.id, event.locals.sessionToken);
	return ok({ user: usersRepo.getPublicById(user.id) });
};
