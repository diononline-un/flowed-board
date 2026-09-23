import type { RequestHandler } from './$types';
import { notFound, ok, parseJson, unauthorized, withXp } from '$lib/server/http.js';
import * as keyResultsRepo from '$lib/server/repo/keyResults.js';
import { awardContextFor, awardKeyResultDone, badgeOnlyResponse } from '$lib/server/xp.js';
import { keyResultTargetReachedPublic } from '$lib/shared/progress.js';
import { keyResultPatchSchema } from '$lib/shared/schemas.js';

// PATCH: update a key result. Both ids must belong to the user and the key
// result to the goal — everything else is 404 (SPEC 6.6).
//
// SPEC 5.6: reaching the target awards `kr_done` exactly once (the ref_id is
// the key result id, and the guard below only fires on the crossing), and a
// key result at 50 % unlocks the `halfway` badge.
export const PATCH: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(keyResultPatchSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const existing = keyResultsRepo.getKeyResult(user.id, event.params.krId);
	if (!existing || existing.goal_id !== event.params.id) return notFound();
	const wasReached = keyResultTargetReachedPublic({
		kind: existing.kind,
		targetValue: existing.target_value,
		currentValue: existing.current_value
	});
	const keyResult = keyResultsRepo.updateKeyResult(user.id, event.params.krId, parsed.data);
	if (!keyResult) return notFound();
	const reachedNow =
		!wasReached &&
		keyResultTargetReachedPublic({
			kind: keyResult.kind,
			targetValue: keyResult.targetValue,
			currentValue: keyResult.currentValue
		});
	const context = awardContextFor(user);
	const xp = reachedNow
		? awardKeyResultDone(user.id, keyResult.id, context)
		: badgeOnlyResponse(user.id, 'keyResult', context);
	return ok(withXp({ keyResult }, xp));
};

// DELETE: soft delete (SPEC 4.2 deleted_at; no restore endpoint in SPEC 7).
export const DELETE: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const existing = keyResultsRepo.getKeyResult(user.id, event.params.krId);
	if (!existing || existing.goal_id !== event.params.id) return notFound();
	const keyResult = keyResultsRepo.softDeleteKeyResult(user.id, event.params.krId);
	if (!keyResult) return notFound();
	return ok({ keyResult });
};
