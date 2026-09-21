import type { RequestHandler } from './$types';
import { notFound, ok, unauthorized } from '$lib/server/http.js';
import * as goalsRepo from '$lib/server/repo/goals.js';

// Undo for the soft delete (SPEC 7).
export const POST: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const goal = goalsRepo.restoreGoal(user.id, event.params.id);
	if (!goal) return notFound();
	return ok({ goal });
};
