import type { RequestHandler } from './$types';
import { ok, parseJson, unauthorized } from '$lib/server/http.js';
import * as postitsRepo from '$lib/server/repo/postits.js';
import { todayIn } from '$lib/shared/date.js';
import { postitCleanupSchema } from '$lib/shared/schemas.js';

// Aufräumen sheet (SPEC 8.2): {ids, action} with action today | plusWeek |
// done | delete (payload form chosen here, see DECISIONS.md). Returns the
// touched post-its so the client can reconcile.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(postitCleanupSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const items = postitsRepo.cleanupPostits(
		user.id,
		parsed.data.ids,
		parsed.data.action,
		todayIn(user.tz)
	);
	return ok({ items });
};
