import type { RequestHandler } from './$types';
import { notFound, ok, parseJson, unauthorized, validationError } from '$lib/server/http.js';
import * as goalsRepo from '$lib/server/repo/goals.js';
import * as habitsRepo from '$lib/server/repo/habits.js';
import { copy } from '$lib/shared/copy.js';
import { habitPatchSchema } from '$lib/shared/schemas.js';

// PATCH: update a habit, set/clear the archive flag (SPEC 7). Foreign or
// unknown ids are 404 (SPEC 6.6, no existence leak); a foreign goalId is 422.
export const PATCH: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(habitPatchSchema, event.request);
	if (!parsed.ok) return parsed.response;
	if (
		parsed.data.goalId !== undefined &&
		parsed.data.goalId !== null &&
		!goalsRepo.getLiveGoal(user.id, parsed.data.goalId)
	) {
		return validationError(copy.errors.invalidInput, {
			goalId: copy.plans.errors.foreignRef
		});
	}
	const habit = habitsRepo.updateHabit(user.id, event.params.id, parsed.data);
	if (!habit) return notFound();
	return ok({ habit });
};

// DELETE: soft delete, returns the updated resource so the client can offer a
// restore (SPEC 7: no 204). Habit logs stay in the database and go with the
// account export; the purge job cleans soft-deleted rows after 14 days.
export const DELETE: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const habit = habitsRepo.softDeleteHabit(user.id, event.params.id);
	if (!habit) return notFound();
	return ok({ habit });
};
