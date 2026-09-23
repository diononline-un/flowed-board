import type { RequestHandler } from './$types';
import {
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
import { postitCreateSchema, postitsQuerySchema } from '$lib/shared/schemas.js';

// GET: list with query from/to/horizon/goalId (SPEC 7). The horizon filter
// runs against the server-computed today of the user's timezone (SPEC 5.1).
export const GET: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const query = postitsQuerySchema.safeParse(
		Object.fromEntries(event.url.searchParams.entries())
	);
	if (!query.success) return validationError(copy.errors.invalidInput);
	return ok({
		items: postitsRepo.listPostits(user.id, {
			...query.data,
			today: todayIn(user.tz)
		})
	});
};

// POST: create. A goalId/habitId pointing at another user's row — or at a
// soft-deleted own row — is a 422 validation error (SPEC M2 brief), never a
// 403 (SPEC 6.6).
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(postitCreateSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const fields: Record<string, string> = {};
	if (parsed.data.goalId && !goalsRepo.getLiveGoal(user.id, parsed.data.goalId)) {
		fields.goalId = copy.plans.errors.foreignRef;
	}
	if (parsed.data.habitId && !habitsRepo.getHabit(user.id, parsed.data.habitId)) {
		fields.habitId = copy.plans.errors.foreignRef;
	}
	if (Object.keys(fields).length > 0) {
		return validationError(copy.errors.invalidInput, fields);
	}
	const postit = postitsRepo.createPostit(user.id, parsed.data);
	return ok({ postit }, 201);
};
