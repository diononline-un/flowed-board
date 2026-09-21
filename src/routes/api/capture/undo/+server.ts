import type { RequestHandler } from './$types';
import { undoCapture } from '$lib/server/capture.js';
import { ok, parseJson, unauthorized } from '$lib/server/http.js';
import { captureUndoSchema } from '$lib/shared/schemas.js';

// SPEC 7 (AC3): soft-deletes exactly the post-its of one batch, nothing
// else. Returns the deleted rows like every mutation (SPEC 7 convention).
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(captureUndoSchema, event.request);
	if (!parsed.ok) return parsed.response;

	return ok({ items: undoCapture(user, parsed.data.batchId) });
};
