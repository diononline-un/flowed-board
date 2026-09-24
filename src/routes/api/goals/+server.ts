import type { RequestHandler } from './$types';
import { ok, parseJson, unauthorized, withXp } from '$lib/server/http.js';
import * as goalsRepo from '$lib/server/repo/goals.js';
import { awardContextFor, badgeOnlyResponse } from '$lib/server/xp.js';
import { goalCreateSchema } from '$lib/shared/schemas.js';

// GET: all non-deleted goals of the user (SPEC 7 list shape {items}).
export const GET: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	return ok({ items: goalsRepo.listGoals(user.id) });
};

// POST: create a goal, 201 with the created resource (SPEC 7). Creating a goal
// awards no XP; it is the `goal_setter` badge trigger (SPEC 5.6).
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(goalCreateSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const goal = goalsRepo.createGoal(user.id, parsed.data);
	const xp = badgeOnlyResponse(user.id, 'goal', awardContextFor(user));
	return ok(withXp({ goal }, xp), 201);
};
