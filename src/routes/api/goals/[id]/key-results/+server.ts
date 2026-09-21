import type { RequestHandler } from './$types';
import { notFound, ok, parseJson, unauthorized } from '$lib/server/http.js';
import * as keyResultsRepo from '$lib/server/repo/keyResults.js';
import { keyResultCreateSchema } from '$lib/shared/schemas.js';

// Create a key result under a goal. A foreign goal id is 404 (SPEC 6.6).
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(keyResultCreateSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const keyResult = keyResultsRepo.createKeyResult(user.id, event.params.id, parsed.data);
	if (!keyResult) return notFound();
	return ok({ keyResult }, 201);
};
