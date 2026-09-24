import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import { parseJournalFields, parseJournalSchedule } from '$lib/shared/journalTemplates.js';
import type { JournalField, JournalSchedule } from '$lib/shared/schemas.js';
import type { JournalTemplateRow, PublicJournalTemplate } from '$lib/shared/types.js';

// Only SQL for the journal_templates table lives here (SPEC 16, 5.7). userId
// comes first and filters every query (SPEC 6.6); foreign ids yield null.
//
// The JSON columns (`fields`, `schedule`) are TEXT in SQLite and parsed with
// zod on read (SPEC 4.1) — via the shared helpers, which fall back to an empty
// field list / "manual only" instead of throwing.

export function toPublicJournalTemplate(row: JournalTemplateRow): PublicJournalTemplate {
	return {
		id: row.id,
		name: row.name,
		emoji: row.emoji,
		fields: parseJournalFields(row.fields),
		schedule: parseJournalSchedule(row.schedule),
		active: row.active === 1,
		seedKey: row.seed_key,
		position: row.position,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function nextPosition(userId: string): number {
	const row = getDb()
		.prepare(
			'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM journal_templates WHERE user_id = ?'
		)
		.get(userId) as { next: number };
	return row.next;
}

export function createJournalTemplate(
	userId: string,
	input: {
		name: string;
		emoji?: string | null;
		fields: JournalField[];
		schedule?: JournalSchedule | null;
		active?: boolean;
		seedKey?: string | null;
		position?: number;
	}
): PublicJournalTemplate {
	const now = new Date().toISOString();
	const row: JournalTemplateRow = {
		id: randomUUID(),
		user_id: userId,
		name: input.name,
		emoji: input.emoji ?? null,
		fields: JSON.stringify(input.fields),
		schedule: input.schedule ? JSON.stringify(input.schedule) : null,
		active: input.active === false ? 0 : 1,
		seed_key: input.seedKey ?? null,
		position: input.position ?? nextPosition(userId),
		created_at: now,
		updated_at: now,
		deleted_at: null
	};
	getDb()
		.prepare(
			`INSERT INTO journal_templates (
				id, user_id, name, emoji, fields, schedule, active, seed_key,
				position, created_at, updated_at, deleted_at
			) VALUES (
				@id, @user_id, @name, @emoji, @fields, @schedule, @active, @seed_key,
				@position, @created_at, @updated_at, @deleted_at
			)`
		)
		.run(row);
	return toPublicJournalTemplate(row);
}

// Includes soft-deleted rows so callers can tell "gone" from "never existed".
export function getJournalTemplateRow(userId: string, id: string): JournalTemplateRow | null {
	const row = getDb()
		.prepare('SELECT * FROM journal_templates WHERE id = ? AND user_id = ?')
		.get(id, userId) as JournalTemplateRow | undefined;
	return row ?? null;
}

export function getJournalTemplate(userId: string, id: string): PublicJournalTemplate | null {
	const row = getJournalTemplateRow(userId, id);
	if (!row || row.deleted_at !== null) return null;
	return toPublicJournalTemplate(row);
}

export interface JournalTemplateListFilter {
	// true also returns deactivated templates (the management list, AC14).
	includeInactive?: boolean;
	// true returns only deactivated ones.
	inactiveOnly?: boolean;
}

export function listJournalTemplates(
	userId: string,
	filter: JournalTemplateListFilter = {}
): PublicJournalTemplate[] {
	const conditions = ['user_id = @userId', 'deleted_at IS NULL'];
	if (filter.inactiveOnly) conditions.push('active = 0');
	else if (!filter.includeInactive) conditions.push('active = 1');
	const rows = getDb()
		.prepare(
			`SELECT * FROM journal_templates WHERE ${conditions.join(' AND ')} ORDER BY position, created_at`
		)
		.all({ userId }) as unknown as JournalTemplateRow[];
	return rows.map(toPublicJournalTemplate);
}

// Standard template by seed key (SPEC 8.7); used to seed and to update the
// onboarding rhythm without duplicating definitions.
export function getBySeedKey(userId: string, seedKey: string): PublicJournalTemplate | null {
	const row = getDb()
		.prepare(
			'SELECT * FROM journal_templates WHERE user_id = ? AND seed_key = ? AND deleted_at IS NULL LIMIT 1'
		)
		.get(userId, seedKey) as JournalTemplateRow | undefined;
	return row ? toPublicJournalTemplate(row) : null;
}

export function updateJournalTemplate(
	userId: string,
	id: string,
	patch: {
		name?: string;
		emoji?: string | null;
		fields?: JournalField[];
		schedule?: JournalSchedule | null;
		active?: boolean;
		position?: number;
	}
): PublicJournalTemplate | null {
	const current = getJournalTemplateRow(userId, id);
	if (!current || current.deleted_at !== null) return null;
	const now = new Date().toISOString();
	getDb()
		.prepare(
			`UPDATE journal_templates SET
				name = @name, emoji = @emoji, fields = @fields, schedule = @schedule,
				active = @active, position = @position, updated_at = @updated_at
			WHERE id = @id AND user_id = @user_id`
		)
		.run({
			name: patch.name ?? current.name,
			emoji: patch.emoji !== undefined ? patch.emoji : current.emoji,
			fields: patch.fields !== undefined ? JSON.stringify(patch.fields) : current.fields,
			schedule:
				patch.schedule !== undefined
					? patch.schedule
						? JSON.stringify(patch.schedule)
						: null
					: current.schedule,
			active: patch.active === undefined ? current.active : patch.active ? 1 : 0,
			position: patch.position ?? current.position,
			updated_at: now,
			id,
			user_id: userId
		});
	const updated = getJournalTemplateRow(userId, id);
	return updated ? toPublicJournalTemplate(updated) : null;
}

// SPEC 6.8 purge: hard-deletes every soft-deleted journal template older than
// the retention cutoff. Entries survive (template_id goes NULL) because they
// carry their own name and field snapshot (AC14).
export function purgeDeleted(olderThanIso: string): number {
	const result = getDb()
		.prepare('DELETE FROM journal_templates WHERE deleted_at IS NOT NULL AND deleted_at < ?')
		.run(olderThanIso);
	return result.changes;
}
