import type { RequestHandler } from './$types';
import { ok, parseJson, unauthorized } from '$lib/server/http.js';
import * as postitsRepo from '$lib/server/repo/postits.js';
import { postitReorderSchema } from '$lib/shared/schemas.js';

// Batch position update for drag-and-drop (SPEC 7). Returns the updated
// resources so the client can reconcile its optimistic state.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(postitReorderSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const items = postitsRepo.reorderPostits(user.id, parsed.data.postits);
	return ok({ items });
};
