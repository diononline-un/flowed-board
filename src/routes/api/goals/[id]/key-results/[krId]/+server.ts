import type { RequestHandler } from './$types';
import { notFound, ok, parseJson, unauthorized } from '$lib/server/http.js';
import * as keyResultsRepo from '$lib/server/repo/keyResults.js';
import { keyResultPatchSchema } from '$lib/shared/schemas.js';

// PATCH: update a key result. Both ids must belong to the user and the key
// result to the goal — everything else is 404 (SPEC 6.6).
export const PATCH: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(keyResultPatchSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const existing = keyResultsRepo.getKeyResult(user.id, event.params.krId);
	if (!existing || existing.goal_id !== event.params.id) return notFound();
	const keyResult = keyResultsRepo.updateKeyResult(user.id, event.params.krId, parsed.data);
	if (!keyResult) return notFound();
	return ok({ keyResult });
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
