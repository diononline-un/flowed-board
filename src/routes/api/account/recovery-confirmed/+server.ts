import type { RequestHandler } from './$types';
import { ok, unauthorized } from '$lib/server/http.js';
import * as usersRepo from '$lib/server/repo/users.js';

// Marks the recovery phrase as confirmed (SPEC 6.3, 7).
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const updated = usersRepo.setRecoveryConfirmed(
		user.id,
		new Date().toISOString()
	);
	return ok({ user: updated });
};
