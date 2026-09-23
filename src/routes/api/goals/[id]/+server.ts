import type { RequestHandler } from './$types';
import { notFound, ok, parseJson, unauthorized, withXp } from '$lib/server/http.js';
import * as goalsRepo from '$lib/server/repo/goals.js';
import { awardContextFor, awardGoalDone, NO_XP } from '$lib/server/xp.js';
import { goalPatchSchema } from '$lib/shared/schemas.js';

// PATCH: update a goal (incl. status and position, SPEC 7). Foreign or
// unknown ids are 404 — never 403 (SPEC 6.6). Marking a goal as done awards
// `goal_done` once per goal (SPEC 5.6); switching back to active or archived
// changes nothing, because XP never decrease and the event is not re-created.
export const PATCH: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(goalPatchSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const before = goalsRepo.getGoal(user.id, event.params.id);
	const goal = goalsRepo.updateGoal(user.id, event.params.id, parsed.data);
	if (!goal) return notFound();
	const becameDone = parsed.data.status === 'done' && before?.status !== 'done';
	const xp = becameDone ? awardGoalDone(user.id, goal.id, awardContextFor(user)) : NO_XP;
	return ok(withXp({ goal }, xp));
};

// DELETE: soft delete, returns the updated resource (SPEC 7: no 204).
export const DELETE: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const goal = goalsRepo.softDeleteGoal(user.id, event.params.id);
	if (!goal) return notFound();
	return ok({ goal });
};
