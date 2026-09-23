import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import { parseJournalFields, parseJournalValues } from '$lib/shared/journalTemplates.js';
import type { JournalValues } from '$lib/shared/schemas.js';
import type {
	JournalEntryKey,
	JournalEntryRow,
	PublicJournalEntry,
	PublicJournalTemplate
} from '$lib/shared/types.js';

// Only SQL for the journal_entries table lives here (SPEC 16, 4.2). userId
// comes first and filters every query (SPEC 6.6).
//
// `fields_snapshot` freezes the field definitions of the template at entry
// time and `template_name` the name, so an entry stays readable after the
// template was edited or deactivated (AC14). values_json is validated against
// that snapshot by the caller (AC13).

export function toPublicJournalEntry(row: JournalEntryRow): PublicJournalEntry {
	return {
		id: row.id,
		templateId: row.template_id,
		templateName: row.template_name,
		entryDate: row.entry_date,
		slot: row.slot,
		fields: parseJournalFields(row.fields_snapshot),
		values: parseJournalValues(row.values_json),
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function getJournalEntryRow(userId: string, id: string): JournalEntryRow | null {
	const row = getDb()
		.prepare('SELECT * FROM journal_entries WHERE id = ? AND user_id = ?')
		.get(id, userId) as JournalEntryRow | undefined;
	return row ?? null;
}

export function getJournalEntry(userId: string, id: string): PublicJournalEntry | null {
	const row = getJournalEntryRow(userId, id);
	return row ? toPublicJournalEntry(row) : null;
}

// History list (SPEC 7: GET /api/journal/entries?from,to); newest day first,
// inside a day the scheduled slots in ascending order, manual entries last.
export function listJournalEntries(
	userId: string,
	range: { from?: string; to?: string } = {}
): PublicJournalEntry[] {
	const conditions = ['user_id = @userId'];
	const params: Record<string, string> = { userId };
	if (range.from) {
		conditions.push('entry_date >= @from');
		params.from = range.from;
	}
	if (range.to) {
		conditions.push('entry_date <= @to');
		params.to = range.to;
	}
	const rows = getDb()
		.prepare(
			`SELECT * FROM journal_entries WHERE ${conditions.join(' AND ')}
			 ORDER BY entry_date DESC, (slot IS NULL), slot ASC, created_at ASC`
		)
		.all(params) as unknown as JournalEntryRow[];
	return rows.map(toPublicJournalEntry);
}

// Slot identities of one day, the input of the due check (SPEC 5.7).
export function listEntryKeys(userId: string, entryDate: string): JournalEntryKey[] {
	const rows = getDb()
		.prepare(
			'SELECT template_id, entry_date, slot FROM journal_entries WHERE user_id = ? AND entry_date = ?'
		)
		.all(userId, entryDate) as Array<{
		template_id: string | null;
		entry_date: string;
		slot: string | null;
	}>;
	return rows.map((row) => ({
		templateId: row.template_id,
		entryDate: row.entry_date,
		slot: row.slot
	}));
}

// Entry of exactly one slot; NULL slots are excluded, they may repeat (AC13).
export function findJournalEntry(
	userId: string,
	templateId: string,
	entryDate: string,
	slot: string
): PublicJournalEntry | null {
	const row = getDb()
		.prepare(
			`SELECT * FROM journal_entries
			 WHERE user_id = ? AND template_id = ? AND entry_date = ? AND slot = ?
			 LIMIT 1`
		)
		.get(userId, templateId, entryDate, slot) as JournalEntryRow | undefined;
	return row ? toPublicJournalEntry(row) : null;
}

export type JournalEntryCreateResult =
	| { ok: true; entry: PublicJournalEntry }
	// AC13: the (template, entryDate, slot) triple already exists.
	| { ok: false; reason: 'slotTaken' };

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof (error as { code: unknown }).code === 'string' &&
		(error as { code: string }).code.startsWith('SQLITE_CONSTRAINT')
	);
}

// Creates one entry and freezes the template's field definitions and name in
// the row (AC14). The values are expected to be validated against the very
// same definitions by the caller. A repeated slot is refused up front and,
// should two requests race, by the unique index uq_je_slot (AC13).
export function createJournalEntry(
	userId: string,
	template: PublicJournalTemplate,
	input: { entryDate: string; slot: string | null; values: JournalValues }
): JournalEntryCreateResult {
	if (input.slot !== null) {
		const existing = findJournalEntry(userId, template.id, input.entryDate, input.slot);
		if (existing) return { ok: false, reason: 'slotTaken' };
	}
	const now = new Date().toISOString();
	const row: JournalEntryRow = {
		id: randomUUID(),
		user_id: userId,
		template_id: template.id,
		template_name: template.name,
		entry_date: input.entryDate,
		slot: input.slot,
		fields_snapshot: JSON.stringify(template.fields),
		values_json: JSON.stringify(input.values),
		created_at: now,
		updated_at: now
	};
	try {
		getDb()
			.prepare(
				`INSERT INTO journal_entries (
					id, user_id, template_id, template_name, entry_date, slot,
					fields_snapshot, values_json, created_at, updated_at
				) VALUES (
					@id, @user_id, @template_id, @template_name, @entry_date, @slot,
					@fields_snapshot, @values_json, @created_at, @updated_at
				)`
			)
			.run(row);
	} catch (error) {
		if (isUniqueViolation(error)) return { ok: false, reason: 'slotTaken' };
		throw error;
	}
	return { ok: true, entry: toPublicJournalEntry(row) };
}

// Editing an entry only ever touches the answers; date and slot are its
// identity (SPEC 7).
export function updateJournalEntryValues(
	userId: string,
	id: string,
	values: JournalValues
): PublicJournalEntry | null {
	const current = getJournalEntryRow(userId, id);
	if (!current) return null;
	getDb()
		.prepare(
			'UPDATE journal_entries SET values_json = @values_json, updated_at = @updated_at WHERE id = @id AND user_id = @user_id'
		)
		.run({
			values_json: JSON.stringify(values),
			updated_at: new Date().toISOString(),
			id,
			user_id: userId
		});
	const updated = getJournalEntryRow(userId, id);
	return updated ? toPublicJournalEntry(updated) : null;
}
