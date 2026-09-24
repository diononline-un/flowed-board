import type { RequestHandler } from './$types';
import { notFound, ok, parseJson, unauthorized, validationError } from '$lib/server/http.js';
import * as journalEntriesRepo from '$lib/server/repo/journalEntries.js';
import { copy } from '$lib/shared/copy.js';
import { mergeJournalValues, validateJournalValues } from '$lib/shared/journalTemplates.js';
import { journalEntryPatchSchema } from '$lib/shared/schemas.js';

// PATCH /api/journal/entries/:id {values} (SPEC 7). Editing an entry never
// changes date or slot — they are its identity (AC13). The answers are
// validated against the entry's own `fields_snapshot`, so entries written
// before a template change stay editable even after the template was edited
// or deactivated (AC14). Foreign ids are 404 (SPEC 6.6).
export const PATCH: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(journalEntryPatchSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const existing = journalEntriesRepo.getJournalEntry(user.id, event.params.id);
	if (!existing) return notFound();

	const merged = mergeJournalValues(existing.values, parsed.data.values);
	const checked = validateJournalValues(existing.fields, merged);
	if (!checked.ok) {
		const fields: Record<string, string> = {};
		for (const issue of checked.errors) {
			if (!(issue.fieldId in fields)) fields[issue.fieldId] = issue.message;
		}
		return validationError(copy.errors.invalidInput, fields);
	}

	const entry = journalEntriesRepo.updateJournalEntryValues(user.id, event.params.id, checked.values);
	if (!entry) return notFound();
	return ok({ entry });
};
