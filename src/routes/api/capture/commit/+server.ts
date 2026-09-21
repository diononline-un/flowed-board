import type { RequestHandler } from './$types';
import { commitCapture } from '$lib/server/capture.js';
import { ok, parseJson, unauthorized } from '$lib/server/http.js';
import { captureCommitSchema } from '$lib/shared/schemas.js';

// SPEC 7: creates the confirmed preview rows as post-its with a shared
// batch_id. Suggested goals/habits are matched by exact title against
// existing own rows only — never auto-created.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(captureCommitSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const { batchId, created } = commitCapture(user, parsed.data.items);
	return ok({ batchId, created }, 201);
};
