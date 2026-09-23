import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import type { HabitCadence, HabitRow, PostitColor, PublicHabit } from '$lib/shared/types.js';

// Only SQL for the habits table lives here (SPEC 16). Every function takes
// userId first and filters by it (SPEC 6.6); foreign ids yield null, never an
// error that would leak existence (no 403, no existence leak).

export function toPublicHabit(row: HabitRow): PublicHabit {
	return {
		id: row.id,
		goalId: row.goal_id,
		title: row.title,
		emoji: row.emoji,
		color: row.color as PostitColor,
		cadence: row.cadence,
		targetCount: row.target_count,
		rangeStart: row.range_start,
		rangeEnd: row.range_end,
		maxPerDay: row.max_per_day,
		position: row.position,
		isExample: row.is_example === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at,
		deletedAt: row.deleted_at
	};
}

function nextPosition(userId: string): number {
	const row = getDb()
		.prepare(
			'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM habits WHERE user_id = ? AND deleted_at IS NULL'
		)
		.get(userId) as { next: number };
	return row.next;
}

export function createHabit(
	userId: string,
	input: {
		title: string;
		emoji?: string | null;
		color?: PostitColor;
		cadence: HabitCadence;
		targetCount: number;
		rangeStart?: string | null;
		rangeEnd?: string | null;
		maxPerDay?: number;
		goalId?: string | null;
		position?: number;
		isExample?: boolean;
	}
): PublicHabit {
	const now = new Date().toISOString();
	const row: HabitRow = {
		id: randomUUID(),
		user_id: userId,
		goal_id: input.goalId ?? null,
		title: input.title,
		emoji: input.emoji ?? null,
		color: input.color ?? 'mint',
		cadence: input.cadence,
		target_count: input.targetCount,
		range_start: input.cadence === 'range' ? (input.rangeStart ?? null) : null,
		range_end: input.cadence === 'range' ? (input.rangeEnd ?? null) : null,
		max_per_day: input.maxPerDay ?? 1,
		position: input.position ?? nextPosition(userId),
		is_example: input.isExample ? 1 : 0,
		created_at: now,
		updated_at: now,
		archived_at: null,
		deleted_at: null
	};
	getDb()
		.prepare(
			`INSERT INTO habits (
				id, user_id, goal_id, title, emoji, color, cadence, target_count,
				range_start, range_end, max_per_day, position, is_example,
				created_at, updated_at, archived_at, deleted_at
			) VALUES (
				@id, @user_id, @goal_id, @title, @emoji, @color, @cadence, @target_count,
				@range_start, @range_end, @max_per_day, @position, @is_example,
				@created_at, @updated_at, @archived_at, @deleted_at
			)`
		)
		.run(row);
	return toPublicHabit(row);
}

// Includes soft-deleted rows so callers can tell "gone" from "never existed".
export function getHabitRow(userId: string, id: string): HabitRow | null {
	const row = getDb()
		.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?')
		.get(id, userId) as HabitRow | undefined;
	return row ?? null;
}

// Live habit (not soft-deleted), used by every ownership check.
export function getHabit(userId: string, id: string): PublicHabit | null {
	const row = getHabitRow(userId, id);
	if (!row || row.deleted_at !== null) return null;
	return toPublicHabit(row);
}

export interface HabitListFilter {
	// true includes archived habits, false (default) returns the active bar.
	includeArchived?: boolean;
	archivedOnly?: boolean;
}

export function listHabits(userId: string, filter: HabitListFilter = {}): PublicHabit[] {
	const conditions = ['user_id = @userId', 'deleted_at IS NULL'];
	if (filter.archivedOnly) conditions.push('archived_at IS NOT NULL');
	else if (!filter.includeArchived) conditions.push('archived_at IS NULL');
	const rows = getDb()
		.prepare(
			`SELECT * FROM habits WHERE ${conditions.join(' AND ')} ORDER BY position, created_at`
		)
		.all({ userId }) as unknown as HabitRow[];
	return rows.map(toPublicHabit);
}

// Habits linked to a goal (SPEC 8.3 goal detail page); archived ones stay out.
export function listByGoal(userId: string, goalId: string): PublicHabit[] {
	const rows = getDb()
		.prepare(
			'SELECT * FROM habits WHERE user_id = ? AND goal_id = ? AND deleted_at IS NULL ORDER BY position'
		)
		.all(userId, goalId) as HabitRow[];
	return rows.map(toPublicHabit);
}

// Exact title match, case-insensitive (capture commit, SPEC 7): assigns a
// suggested habit only when an active one with that title already exists.
export function findByTitle(userId: string, title: string): PublicHabit | null {
	const row = getDb()
		.prepare(
			'SELECT * FROM habits WHERE user_id = ? AND deleted_at IS NULL AND archived_at IS NULL AND lower(title) = lower(?) ORDER BY position LIMIT 1'
		)
		.get(userId, title) as HabitRow | undefined;
	return row ? toPublicHabit(row) : null;
}

export function updateHabit(
	userId: string,
	id: string,
	patch: {
		title?: string;
		emoji?: string | null;
		color?: PostitColor;
		cadence?: HabitCadence;
		targetCount?: number;
		rangeStart?: string | null;
		rangeEnd?: string | null;
		maxPerDay?: number;
		goalId?: string | null;
		archived?: boolean;
		position?: number;
	}
): PublicHabit | null {
	const current = getHabitRow(userId, id);
	if (!current || current.deleted_at !== null) return null;
	const now = new Date().toISOString();
	const cadence = patch.cadence ?? current.cadence;
	// Switching away from `range` drops the range columns (SPEC 4.2 CHECK);
	// switching to `range` keeps whatever start/end the patch supplies.
	const rangeStart =
		cadence === 'range'
			? patch.rangeStart !== undefined
				? patch.rangeStart
				: (current.range_start ?? null)
			: null;
	const rangeEnd =
		cadence === 'range'
			? patch.rangeEnd !== undefined
				? patch.rangeEnd
				: (current.range_end ?? null)
			: null;
	getDb()
		.prepare(
			`UPDATE habits SET
				title = @title, emoji = @emoji, color = @color, cadence = @cadence,
				target_count = @target_count, range_start = @range_start,
				range_end = @range_end, max_per_day = @max_per_day, goal_id = @goal_id,
				position = @position, updated_at = @updated_at, archived_at = @archived_at
			WHERE id = @id AND user_id = @user_id`
		)
		.run({
			title: patch.title ?? current.title,
			emoji: patch.emoji !== undefined ? patch.emoji : current.emoji,
			color: patch.color ?? current.color,
			cadence,
			target_count: patch.targetCount ?? current.target_count,
			range_start: rangeStart,
			range_end: rangeEnd,
			max_per_day: patch.maxPerDay ?? current.max_per_day,
			goal_id: patch.goalId !== undefined ? patch.goalId : current.goal_id,
			position: patch.position ?? current.position,
			updated_at: now,
			archived_at:
				patch.archived === undefined
					? current.archived_at
					: patch.archived
						? (current.archived_at ?? now)
						: null,
			id,
			user_id: userId
		});
	const updated = getHabitRow(userId, id);
	return updated ? toPublicHabit(updated) : null;
}

// Soft delete (SPEC 7 "archivieren (soft-delete)"): the row stays for export
// and purge, the API returns the updated resource so undo can restore it.
export function softDeleteHabit(userId: string, id: string): PublicHabit | null {
	const current = getHabitRow(userId, id);
	if (!current || current.deleted_at !== null) return null;
	const now = new Date().toISOString();
	getDb()
		.prepare('UPDATE habits SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?')
		.run(now, now, id, userId);
	const updated = getHabitRow(userId, id);
	return updated ? toPublicHabit(updated) : null;
}

export function restoreHabit(userId: string, id: string): PublicHabit | null {
	const current = getHabitRow(userId, id);
	if (!current || current.deleted_at === null) return null;
	const now = new Date().toISOString();
	getDb()
		.prepare('UPDATE habits SET deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?')
		.run(now, id, userId);
	const updated = getHabitRow(userId, id);
	return updated ? toPublicHabit(updated) : null;
}
