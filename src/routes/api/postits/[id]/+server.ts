import type { RequestHandler } from './$types';
import {
	notFound,
	ok,
	parseJson,
	unauthorized,
	validationError
} from '$lib/server/http.js';
import * as goalsRepo from '$lib/server/repo/goals.js';
import * as habitsRepo from '$lib/server/repo/habits.js';
import * as postitsRepo from '$lib/server/repo/postits.js';
import { todayIn } from '$lib/shared/date.js';
import { copy } from '$lib/shared/copy.js';
import { postitPatchSchema } from '$lib/shared/schemas.js';

// PATCH: update (incl. date, position, done set/clear — SPEC 7). Foreign
// goal/habit ids in the body are 422, unknown post-it ids are 404.
export const PATCH: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(postitPatchSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const fields: Record<string, string> = {};
	if (
		parsed.data.goalId !== undefined &&
		parsed.data.goalId !== null &&
		!goalsRepo.getGoal(user.id, parsed.data.goalId)
	) {
		fields.goalId = copy.plans.errors.foreignRef;
	}
	if (
		parsed.data.habitId !== undefined &&
		parsed.data.habitId !== null &&
		!habitsRepo.getHabit(user.id, parsed.data.habitId)
	) {
		fields.habitId = copy.plans.errors.foreignRef;
	}
	if (Object.keys(fields).length > 0) {
		return validationError(copy.errors.invalidInput, fields);
	}
	const postit = postitsRepo.updatePostit(
		user.id,
		event.params.id,
		parsed.data,
		todayIn(user.tz)
	);
	if (!postit) return notFound();
	return ok({ postit });
};

// DELETE: soft delete, returns the updated resource (SPEC 7: no 204).
export const DELETE: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const postit = postitsRepo.softDeletePostit(user.id, event.params.id, todayIn(user.tz));
	if (!postit) return notFound();
	return ok({ postit });
};
