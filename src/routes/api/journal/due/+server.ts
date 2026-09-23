import type { RequestHandler } from './$types';
import { ok, unauthorized } from '$lib/server/http.js';
import * as journalEntriesRepo from '$lib/server/repo/journalEntries.js';
import * as journalTemplatesRepo from '$lib/server/repo/journalTemplates.js';
import { todayIn, nowTimeIn } from '$lib/shared/date.js';
import { dueTemplates } from '$lib/shared/journalTemplates.js';

// GET /api/journal/due (SPEC 5.7): templates that are due right now.
// Active template, today's weekday in `days`, `time <= nowTime < time + 6 h`
// and no entry for (template, today, slot). "Today" and "now" are computed
// server-side in the user's timezone (SPEC 5.1); the in-app reminder of SPEC
// 8.5 is the "Heute" card rendered from this list. `today`/`nowTime` are
// additive to the SPEC-7 `{items}` shape (DECISIONS.md).
export const GET: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const today = todayIn(user.tz);
	const nowTime = nowTimeIn(user.tz);
	const templates = journalTemplatesRepo.listJournalTemplates(user.id);
	const entries = journalEntriesRepo.listEntryKeys(user.id, today);
	return ok({ today, nowTime, items: dueTemplates(templates, today, nowTime, entries) });
};
