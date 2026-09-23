import type { RequestHandler } from './$types';
import { ok, parseJson, unauthorized, validationError } from '$lib/server/http.js';
import * as goalsRepo from '$lib/server/repo/goals.js';
import * as habitsRepo from '$lib/server/repo/habits.js';
import { copy } from '$lib/shared/copy.js';
import { habitCreateSchema, habitsQuerySchema } from '$lib/shared/schemas.js';

// GET: list habits (SPEC 7). Default is the active bar for the calendar
// (archived excluded, SPEC 8.4); `?archived=1` adds them for the management
// list. POST: create.
export const GET: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const query = habitsQuerySchema.safeParse(
		Object.fromEntries(event.url.searchParams.entries())
	);
	if (!query.success) return validationError(copy.errors.invalidInput);
	return ok({ items: habitsRepo.listHabits(user.id, { includeArchived: query.data.archived === '1' }) });
};

// A goalId pointing at another user's row (or at a soft-deleted one) is a 422
// validation error (SPEC M4 brief), never a 403 (SPEC 6.6).
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(habitCreateSchema, event.request);
	if (!parsed.ok) return parsed.response;
	if (parsed.data.goalId && !goalsRepo.getLiveGoal(user.id, parsed.data.goalId)) {
		return validationError(copy.errors.invalidInput, {
			goalId: copy.plans.errors.foreignRef
		});
	}
	const habit = habitsRepo.createHabit(user.id, parsed.data);
	return ok({ habit }, 201);
};
