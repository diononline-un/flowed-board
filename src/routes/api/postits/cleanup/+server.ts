import type { RequestHandler } from './$types';
import { ok, parseJson, unauthorized, withXp } from '$lib/server/http.js';
import * as postitsRepo from '$lib/server/repo/postits.js';
import { award, awardCleanup, awardContextFor } from '$lib/server/xp.js';
import { todayIn } from '$lib/shared/date.js';
import { makeEvent } from '$lib/shared/xp.js';
import { postitCleanupSchema } from '$lib/shared/schemas.js';

// Aufräumen sheet (SPEC 8.2): {ids, action} with action today | plusWeek |
// done | delete (payload form chosen here, see DECISIONS.md). Returns the
// touched post-its so the client can reconcile.
//
// Gamification (SPEC 5.6): running the sheet is the `tidy_up` badge trigger,
// and every post-it the sheet completes awards `postit_done` like any other
// completion (repeats are ignored by the event's unique ref_id).
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(postitCleanupSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const today = todayIn(user.tz);
	const wasDone = new Set(
		postitsRepo
			.listPostits(user.id)
			.filter((postit) => postit.doneAt !== null)
			.map((postit) => postit.id)
	);
	const items = postitsRepo.cleanupPostits(user.id, parsed.data.ids, parsed.data.action, today);

	const context = awardContextFor(user);
	const doneNow = items
		.filter((item) => item.doneAt !== null && !wasDone.has(item.id))
		.map((item) => item.id);
	if (doneNow.length === 0) {
		// Nothing completed, but the sheet ran: only the badge check matters.
		return ok(withXp({ items }, awardCleanup(user.id, context)));
	}
	return ok(
		withXp(
			{ items },
			award(user.id, doneNow.map((id) => makeEvent('postit_done', id)), 'cleanup', context)
		)
	);
};
