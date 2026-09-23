import type { RequestHandler } from './$types';
import { notFound, ok, unauthorized } from '$lib/server/http.js';
import * as habitsRepo from '$lib/server/repo/habits.js';

// POST: undo for a habit delete (SPEC 7 "POST /:id/restore", P5). Logs are
// untouched by the soft delete, so restoring brings the counters back as they
// were.
export const POST: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const habit = habitsRepo.restoreHabit(user.id, event.params.id);
	if (!habit) return notFound();
	return ok({ habit });
};
