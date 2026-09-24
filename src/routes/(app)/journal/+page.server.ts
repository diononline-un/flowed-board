import { redirect } from '@sveltejs/kit';
import * as journalEntriesRepo from '$lib/server/repo/journalEntries.js';
import * as journalTemplatesRepo from '$lib/server/repo/journalTemplates.js';
import { addDays, nowTimeIn, todayIn } from '$lib/shared/date.js';
import { dueTemplates } from '$lib/shared/journalTemplates.js';
import type { PageServerLoad } from './$types';

// Journal data (SPEC 3.1: reads go through the repo layer, never the API).
// The server computes "today" and "now" in the user's timezone (SPEC 5.1) and
// ships the due templates of SPEC 5.7 plus the history window, so the "Heute"
// card can render without a client round trip.
//
// The history is bounded to the last 90 days (DECISIONS.md); the API keeps
// `from`/`to`, so a wider window is a parameter away.
const HISTORY_DAYS = 90;

export const load: PageServerLoad = ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(303, '/login');

	const today = todayIn(user.tz);
	const nowTime = nowTimeIn(user.tz);
	// Deactivated templates stay in the payload: the history needs their name
	// and emoji, and the management sheet edits them (AC14).
	const templates = journalTemplatesRepo.listJournalTemplates(user.id, { includeInactive: true });
	const activeTemplates = templates.filter((template) => template.active);
	const from = addDays(today, -HISTORY_DAYS);
	const entries = journalEntriesRepo.listJournalEntries(user.id, { from, to: today });
	const due = dueTemplates(
		activeTemplates,
		today,
		nowTime,
		entries.map((entry) => ({
			templateId: entry.templateId,
			entryDate: entry.entryDate,
			slot: entry.slot
		}))
	);

	return {
		today,
		nowTime,
		historyFrom: from,
		historyDays: HISTORY_DAYS,
		templates,
		activeTemplates,
		entries,
		due
	};
};
