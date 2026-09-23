import type { RequestHandler } from './$types';
import {
	conflict,
	ok,
	parseJson,
	unauthorized,
	validationError,
	withXp
} from '$lib/server/http.js';
import * as journalEntriesRepo from '$lib/server/repo/journalEntries.js';
import * as journalTemplatesRepo from '$lib/server/repo/journalTemplates.js';
import { awardContextFor, awardJournalEntry } from '$lib/server/xp.js';
import { copy } from '$lib/shared/copy.js';
import { todayIn } from '$lib/shared/date.js';
import { validateJournalValues } from '$lib/shared/journalTemplates.js';
import { journalEntriesQuerySchema, journalEntryCreateSchema } from '$lib/shared/schemas.js';

// GET: entry history, optional ?from,to (SPEC 7).
export const GET: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const query = journalEntriesQuerySchema.safeParse(
		Object.fromEntries(event.url.searchParams.entries())
	);
	if (!query.success) return validationError(copy.errors.invalidInput);
	return ok({ items: journalEntriesRepo.listJournalEntries(user.id, query.data) });
};

// POST {templateId, entryDate, slot?, values} (SPEC 7, 5.7):
// - unknown or foreign template -> 422 (SPEC 6.6, no existence leak),
// - deactivated template or a date in the future -> 422 (DECISIONS.md),
// - values are validated against the template's fields, the result is frozen
//   as `fields_snapshot` (AC14),
// - the same (template, entryDate, slot) twice -> 409 with the hint to edit
//   the existing entry (AC13); NULL slots may repeat.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(journalEntryCreateSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const template = journalTemplatesRepo.getJournalTemplate(user.id, parsed.data.templateId);
	if (!template) {
		return validationError(copy.errors.invalidInput, {
			templateId: copy.journal.errors.templateUnknown
		});
	}
	if (!template.active) {
		return validationError(copy.errors.invalidInput, {
			templateId: copy.journal.errors.templateInactive
		});
	}
	if (parsed.data.entryDate > todayIn(user.tz)) {
		return validationError(copy.errors.invalidInput, {
			entryDate: copy.journal.errors.futureDate
		});
	}

	// The response carries one entry per field id so the form can mark the
	// offending input (SPEC 7 `{error, fields?}`).
	const checked = validateJournalValues(template.fields, parsed.data.values);
	if (!checked.ok) {
		const fields: Record<string, string> = {};
		for (const issue of checked.errors) {
			if (!(issue.fieldId in fields)) fields[issue.fieldId] = issue.message;
		}
		return validationError(copy.errors.invalidInput, fields);
	}

	const result = journalEntriesRepo.createJournalEntry(user.id, template, {
		entryDate: parsed.data.entryDate,
		slot: parsed.data.slot ?? null,
		values: checked.values
	});
	if (!result.ok) return conflict(copy.journal.errors.slotTaken);
	// SPEC 5.6 `journal_entry`: 15 XP per (template, day, slot) — the schedule
	// slot is part of the ref_id, a manual entry uses `none`.
	const xp = awardJournalEntry(
		user.id,
		{
			templateId: result.entry.templateId,
			entryDate: result.entry.entryDate,
			slot: result.entry.slot
		},
		awardContextFor(user)
	);
	return ok(withXp({ entry: result.entry }, xp), 201);
};
