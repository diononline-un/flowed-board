import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as usersRepo from './users.js';
import * as templatesRepo from './journalTemplates.js';
import * as entriesRepo from './journalEntries.js';
import { validateJournalValues } from '$lib/shared/journalTemplates.js';
import type { JournalField } from '$lib/shared/schemas.js';
import type { UserRow } from '$lib/shared/types.js';

// CRUD, slot uniqueness (AC13), snapshot behaviour (AC14) and tenant
// separation (SPEC 6.6) against :memory: with the real migrations.

let db: SqliteDatabase;

function makeUser(username: string): UserRow {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	return usersRepo.getById(user.id)!;
}

const FIELDS: JournalField[] = [
	{
		id: 'mood',
		type: 'scale',
		label: 'Stimmung',
		required: true,
		min: 1,
		max: 5,
		style: 'faces'
	},
	{ id: 'note', type: 'text', label: 'Notiz', required: false, maxLength: 200 }
];

function makeTemplate(userId: string, name = 'Morgen'): ReturnType<typeof templatesRepo.createJournalTemplate> {
	return templatesRepo.createJournalTemplate(userId, {
		name,
		emoji: '🌅',
		fields: FIELDS,
		schedule: { times: ['08:00'], days: [1] }
	});
}

const MONDAY = '2026-09-21';
const TUESDAY = '2026-09-22';

describe('journal entries repo', () => {
	it('creates an entry with a snapshot of fields and template name', () => {
		db = useTestDb();
		const user = makeUser('je-a');
		const template = makeTemplate(user.id);
		const result = entriesRepo.createJournalEntry(user.id, template, {
			entryDate: MONDAY,
			slot: '08:00',
			values: { mood: 4 }
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.entry.templateId).toBe(template.id);
		expect(result.entry.templateName).toBe('Morgen');
		expect(result.entry.entryDate).toBe(MONDAY);
		expect(result.entry.slot).toBe('08:00');
		expect(result.entry.fields).toEqual(FIELDS);
		expect(result.entry.values).toEqual({ mood: 4 });
		expect(result.entry.createdAt).not.toBe('');
	});

	it('allows several slots per day but only one entry per slot (AC13)', () => {
		db = useTestDb();
		const user = makeUser('je-b');
		const template = makeTemplate(user.id);
		const morning = entriesRepo.createJournalEntry(user.id, template, {
			entryDate: MONDAY,
			slot: '08:00',
			values: { mood: 3 }
		});
		const evening = entriesRepo.createJournalEntry(user.id, template, {
			entryDate: MONDAY,
			slot: '20:00',
			values: { mood: 5 }
		});
		expect(morning.ok && evening.ok).toBe(true);

		const duplicate = entriesRepo.createJournalEntry(user.id, template, {
			entryDate: MONDAY,
			slot: '08:00',
			values: { mood: 1 }
		});
		expect(duplicate).toEqual({ ok: false, reason: 'slotTaken' });
		expect(entriesRepo.findJournalEntry(user.id, template.id, MONDAY, '08:00')?.values).toEqual({
			mood: 3
		});

		// NULL slots may repeat: manual entries are not slot bound.
		const manualFirst = entriesRepo.createJournalEntry(user.id, template, {
			entryDate: MONDAY,
			slot: null,
			values: { mood: 2 }
		});
		const manualSecond = entriesRepo.createJournalEntry(user.id, template, {
			entryDate: MONDAY,
			slot: null,
			values: { mood: 4 }
		});
		expect(manualFirst.ok && manualSecond.ok).toBe(true);

		// Same slot on another day is fine too.
		expect(
			entriesRepo.createJournalEntry(user.id, template, {
				entryDate: TUESDAY,
				slot: '08:00',
				values: { mood: 3 }
			}).ok
		).toBe(true);
		expect(entriesRepo.listJournalEntries(user.id)).toHaveLength(5);
	});

	it('is backed by the unique index uq_je_slot at the database level', () => {
		db = useTestDb();
		const user = makeUser('je-index');
		const template = makeTemplate(user.id);
		entriesRepo.createJournalEntry(user.id, template, {
			entryDate: MONDAY,
			slot: '08:00',
			values: { mood: 3 }
		});
		const insert = () =>
			db
				.prepare(
					`INSERT INTO journal_entries (
						id, user_id, template_id, template_name, entry_date, slot,
						fields_snapshot, values_json, created_at, updated_at
					) VALUES (?, ?, ?, 'Morgen', ?, '08:00', '[]', '{}', ?, ?)`
				)
				.run(randomUUID(), user.id, template.id, MONDAY, 'x', 'x');
		expect(insert).toThrowError(/UNIQUE/i);
	});

	it('lists entries by range, newest day first and slots ascending', () => {
		db = useTestDb();
		const user = makeUser('je-c');
		const template = makeTemplate(user.id);
		for (const [entryDate, slot] of [
			[MONDAY, '08:00'],
			[MONDAY, '20:00'],
			[MONDAY, null],
			[TUESDAY, '08:00']
		] as Array<[string, string | null]>) {
			entriesRepo.createJournalEntry(user.id, template, {
				entryDate,
				slot,
				values: { mood: 3 }
			});
		}
		const all = entriesRepo.listJournalEntries(user.id);
		expect(all.map((entry) => `${entry.entryDate} ${entry.slot ?? '-'}`)).toEqual([
			`${TUESDAY} 08:00`,
			`${MONDAY} 08:00`,
			`${MONDAY} 20:00`,
			`${MONDAY} -`
		]);
		expect(entriesRepo.listJournalEntries(user.id, { from: TUESDAY })).toHaveLength(1);
		expect(entriesRepo.listJournalEntries(user.id, { to: MONDAY })).toHaveLength(3);
		expect(entriesRepo.listJournalEntries(user.id, { from: MONDAY, to: MONDAY })).toHaveLength(3);
		expect(entriesRepo.listJournalEntries(user.id, { from: '2027-01-01' })).toHaveLength(0);
		expect(entriesRepo.listEntryKeys(user.id, MONDAY).map((key) => key.slot)).toEqual([
			'08:00',
			'20:00',
			null
		]);
	});

	it('updates only the values, never date, slot or snapshot', () => {
		db = useTestDb();
		const user = makeUser('je-d');
		const template = makeTemplate(user.id);
		const created = entriesRepo.createJournalEntry(user.id, template, {
			entryDate: MONDAY,
			slot: '08:00',
			values: { mood: 3 }
		});
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		const updated = entriesRepo.updateJournalEntryValues(user.id, created.entry.id, {
			mood: 5,
			note: 'war gut'
		});
		expect(updated?.values).toEqual({ mood: 5, note: 'war gut' });
		expect(updated?.entryDate).toBe(MONDAY);
		expect(updated?.slot).toBe('08:00');
		expect(updated?.fields).toEqual(FIELDS);
		expect(updated?.createdAt).toBe(created.entry.createdAt);
		expect(entriesRepo.updateJournalEntryValues(user.id, 'gibtsnicht', { mood: 1 })).toBeNull();
	});

	it('keeps entries readable after the template changed or was deactivated (AC14)', () => {
		db = useTestDb();
		const user = makeUser('je-e');
		const template = makeTemplate(user.id);
		const created = entriesRepo.createJournalEntry(user.id, template, {
			entryDate: MONDAY,
			slot: '08:00',
			values: { mood: 4 }
		});
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		// Template edited: new label, new scale, extra required field.
		templatesRepo.updateJournalTemplate(user.id, template.id, {
			name: 'Abend',
			fields: [
				{ id: 'stimmung', type: 'yesno', label: 'Gute Stimmung?', required: true }
			]
		});
		templatesRepo.updateJournalTemplate(user.id, template.id, { active: false });

		const entries = entriesRepo.listJournalEntries(user.id);
		expect(entries).toHaveLength(1);
		const entry = entries[0]!;
		expect(entry.templateName).toBe('Morgen');
		expect(entry.fields).toEqual(FIELDS);
		expect(entry.values).toEqual({ mood: 4 });
		// The frozen snapshot still validates the stored answers, while the
		// edited template does not (the entry keeps its own field set).
		expect(validateJournalValues(entry.fields, entry.values).ok).toBe(true);
		const currentFields = templatesRepo.getJournalTemplate(user.id, template.id)!.fields;
		expect(validateJournalValues(currentFields, entry.values).ok).toBe(false);
		// The deactivated template is gone from "Heute", the entry is not.
		expect(templatesRepo.listJournalTemplates(user.id)).toHaveLength(0);
		expect(entriesRepo.listEntryKeys(user.id, MONDAY)).toHaveLength(1);
	});

	it('keeps users apart: B cannot read, list or change A entries', () => {
		db = useTestDb();
		const userA = makeUser('je-user-a');
		const userB = makeUser('je-user-b');
		const templateA = makeTemplate(userA.id, 'A-Vorlage');
		const created = entriesRepo.createJournalEntry(userA.id, templateA, {
			entryDate: MONDAY,
			slot: '08:00',
			values: { mood: 3 }
		});
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		expect(entriesRepo.getJournalEntry(userB.id, created.entry.id)).toBeNull();
		expect(entriesRepo.getJournalEntryRow(userB.id, created.entry.id)).toBeNull();
		expect(entriesRepo.listJournalEntries(userB.id)).toHaveLength(0);
		expect(entriesRepo.listEntryKeys(userB.id, MONDAY)).toHaveLength(0);
		expect(entriesRepo.findJournalEntry(userB.id, templateA.id, MONDAY, '08:00')).toBeNull();
		expect(entriesRepo.updateJournalEntryValues(userB.id, created.entry.id, { mood: 1 })).toBeNull();
		// B cannot squat A's slot either — the row belongs to A.
		const templateB = makeTemplate(userB.id);
		expect(
			entriesRepo.createJournalEntry(userB.id, templateB, {
				entryDate: MONDAY,
				slot: '08:00',
				values: { mood: 1 }
			}).ok
		).toBe(true);

		expect(entriesRepo.getJournalEntry(userA.id, created.entry.id)?.values).toEqual({ mood: 3 });
		expect(entriesRepo.listJournalEntries(userA.id)).toHaveLength(1);
	});
});
