import type { RequestHandler } from './$types';
import { commitCapture } from '$lib/server/capture.js';
import { ok, parseJson, unauthorized, withXp } from '$lib/server/http.js';
import { awardCaptureUsed, awardContextFor } from '$lib/server/xp.js';
import { captureCommitSchema } from '$lib/shared/schemas.js';

// SPEC 7: creates the confirmed preview rows as post-its with a shared
// batch_id. Suggested goals/habits are matched by exact title against
// existing own rows only — never auto-created.
//
// SPEC 5.6 `capture_used`: one award per batch (3 XP) and the `quick_writer`
// badge for the first one.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(captureCommitSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const { batchId, created } = commitCapture(user, parsed.data.items);
	const xp = awardCaptureUsed(user.id, batchId, awardContextFor(user));
	return ok(withXp({ batchId, created }, xp), 201);
};
