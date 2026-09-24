import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as usersRepo from './users.js';
import * as templatesRepo from './journalTemplates.js';
import { standardJournalTemplates } from '$lib/shared/journalTemplates.js';
import type { JournalField } from '$lib/shared/schemas.js';
import type { UserRow } from '$lib/shared/types.js';

// CRUD, JSON columns, active flag and tenant separation (SPEC 6.6, 5.7)
// against :memory: with the real migrations.

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

const FEELING: JournalField[] = [
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

describe('journal templates repo', () => {
	it('creates templates with defaults and per-user positions', () => {
		db = useTestDb();
		const user = makeUser('jt-a');
		const first = templatesRepo.createJournalTemplate(user.id, {
			name: 'Morgen',
			emoji: '🌅',
			fields: FEELING,
			schedule: { times: ['08:00'], days: [1, 2, 3, 4, 5] }
		});
		const second = templatesRepo.createJournalTemplate(user.id, {
			name: 'Kurz',
			fields: [{ id: 'text', type: 'text', label: 'Text', required: true, maxLength: 500 }]
		});
		expect(first.position).toBe(1);
		expect(second.position).toBe(2);
		expect(first.active).toBe(true);
		expect(first.seedKey).toBeNull();
		expect(second.schedule).toBeNull();
		// JSON roundtrip through the zod parsers (SPEC 4.1).
		expect(first.fields).toEqual(FEELING);
		expect(first.schedule).toEqual({ times: ['08:00'], days: [1, 2, 3, 4, 5] });
		expect(templatesRepo.listJournalTemplates(user.id).map((entry) => entry.name)).toEqual([
			'Morgen',
			'Kurz'
		]);
	});

	it('updates name, emoji, fields, schedule and the active flag', () => {
		db = useTestDb();
		const user = makeUser('jt-b');
		const template = templatesRepo.createJournalTemplate(user.id, {
			name: 'Morgen',
			fields: FEELING,
			schedule: { times: ['08:00'], days: [1] }
		});

		const renamed = templatesRepo.updateJournalTemplate(user.id, template.id, {
			name: 'Früher Morgen',
			emoji: '☀️'
		});
		expect(renamed?.name).toBe('Früher Morgen');
		expect(renamed?.emoji).toBe('☀️');
		expect(renamed?.schedule).toEqual({ times: ['08:00'], days: [1] });

		// schedule: null switches back to "manual only" (SPEC 5.7).
		const manual = templatesRepo.updateJournalTemplate(user.id, template.id, { schedule: null });
		expect(manual?.schedule).toBeNull();
		expect(
			db.prepare('SELECT schedule FROM journal_templates WHERE id = ?').get(template.id)
		).toEqual({ schedule: null });

		const replaced = templatesRepo.updateJournalTemplate(user.id, template.id, {
			fields: [{ id: 'energy', type: 'yesno', label: 'Energie?', required: false }]
		});
		expect(replaced?.fields).toEqual([
			{ id: 'energy', type: 'yesno', label: 'Energie?', required: false }
		]);

		// Deactivation is active=0, not a delete (SPEC M5 brief, AC14).
		const deactivated = templatesRepo.updateJournalTemplate(user.id, template.id, {
			active: false
		});
		expect(deactivated?.active).toBe(false);
		expect(templatesRepo.listJournalTemplates(user.id)).toHaveLength(0);
		expect(templatesRepo.listJournalTemplates(user.id, { includeInactive: true })).toHaveLength(1);
		expect(templatesRepo.listJournalTemplates(user.id, { inactiveOnly: true })).toHaveLength(1);
		expect(templatesRepo.getJournalTemplate(user.id, template.id)?.active).toBe(false);

		const reactivated = templatesRepo.updateJournalTemplate(user.id, template.id, { active: true });
		expect(reactivated?.active).toBe(true);
		expect(templatesRepo.listJournalTemplates(user.id)).toHaveLength(1);
	});

	it('finds standard templates by seed key', () => {
		db = useTestDb();
		const user = makeUser('jt-c');
		for (const definition of standardJournalTemplates('morning')) {
			templatesRepo.createJournalTemplate(user.id, {
				name: definition.name,
				emoji: definition.emoji,
				fields: definition.fields,
				schedule: definition.schedule,
				seedKey: definition.seedKey
			});
		}
		expect(templatesRepo.getBySeedKey(user.id, 'morning')?.schedule?.times).toEqual(['08:00']);
		expect(templatesRepo.getBySeedKey(user.id, 'quick')?.schedule).toBeNull();
		expect(templatesRepo.getBySeedKey(user.id, 'evening')?.seedKey).toBe('evening');
		expect(templatesRepo.getBySeedKey(user.id, 'gibtsnicht')).toBeNull();
	});

	it('survives corrupt JSON columns with conservative defaults (SPEC 4.1)', () => {
		db = useTestDb();
		const user = makeUser('jt-d');
		const now = new Date().toISOString();
		db.prepare(
			`INSERT INTO journal_templates (
				id, user_id, name, emoji, fields, schedule, active, seed_key,
				position, created_at, updated_at
			) VALUES ('broken', ?, 'Kaputt', NULL, 'kein json', '{"times":["25:00"]}', 1, NULL, 1, ?, ?)`
		).run(user.id, now, now);
		const template = templatesRepo.getJournalTemplate(user.id, 'broken');
		expect(template?.fields).toEqual([]);
		expect(template?.schedule).toBeNull();
	});

	it('keeps users apart: B cannot read or change A templates', () => {
		db = useTestDb();
		const userA = makeUser('jt-user-a');
		const userB = makeUser('jt-user-b');
		const templateA = templatesRepo.createJournalTemplate(userA.id, {
			name: 'A-Vorlage',
			fields: FEELING
		});

		expect(templatesRepo.getJournalTemplate(userB.id, templateA.id)).toBeNull();
		expect(templatesRepo.getJournalTemplateRow(userB.id, templateA.id)).toBeNull();
		expect(templatesRepo.listJournalTemplates(userB.id, { includeInactive: true })).toHaveLength(0);
		expect(templatesRepo.getBySeedKey(userB.id, 'morning')).toBeNull();
		expect(
			templatesRepo.updateJournalTemplate(userB.id, templateA.id, { name: 'gekapert', active: false })
		).toBeNull();
		expect(templatesRepo.getJournalTemplate(userA.id, templateA.id)?.name).toBe('A-Vorlage');
		expect(templatesRepo.getJournalTemplate(userA.id, templateA.id)?.active).toBe(true);
	});
});
