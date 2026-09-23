import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import type { GoalRow, PostitColor, PublicGoal } from '$lib/shared/types.js';

// Only SQL for the goals table lives here (SPEC 16). Every function takes
// userId first and filters by it (SPEC 6.6); foreign ids yield null, never
// an error that would leak existence.

export function toPublicGoal(row: GoalRow): PublicGoal {
	return {
		id: row.id,
		title: row.title,
		note: row.note,
		emoji: row.emoji,
		color: row.color as PostitColor,
		targetDate: row.target_date,
		horizonOverride: row.horizon_override,
		status: row.status,
		position: row.position,
		isExample: row.is_example === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		completedAt: row.completed_at,
		deletedAt: row.deleted_at
	};
}

function nextPosition(userId: string): number {
	const row = getDb()
		.prepare(
			'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM goals WHERE user_id = ? AND deleted_at IS NULL'
		)
		.get(userId) as { next: number };
	return row.next;
}

export function createGoal(
	userId: string,
	input: {
		title: string;
		note?: string | null;
		emoji?: string | null;
		color?: PostitColor;
		targetDate?: string | null;
		horizonOverride?: 'short' | 'mid' | 'long' | null;
		position?: number;
		isExample?: boolean;
	}
): PublicGoal {
	const now = new Date().toISOString();
	const row: GoalRow = {
		id: randomUUID(),
		user_id: userId,
		title: input.title,
		note: input.note ?? null,
		emoji: input.emoji ?? null,
		color: input.color ?? 'butter',
		target_date: input.targetDate ?? null,
		horizon_override: input.horizonOverride ?? null,
		status: 'active',
		position: input.position ?? nextPosition(userId),
		is_example: input.isExample ? 1 : 0,
		created_at: now,
		updated_at: now,
		completed_at: null,
		deleted_at: null
	};
	getDb()
		.prepare(
			`INSERT INTO goals (
				id, user_id, title, note, emoji, color, target_date, horizon_override,
				status, position, is_example, created_at, updated_at, completed_at, deleted_at
			) VALUES (
				@id, @user_id, @title, @note, @emoji, @color, @target_date, @horizon_override,
				@status, @position, @is_example, @created_at, @updated_at, @completed_at, @deleted_at
			)`
		)
		.run(row);
	return toPublicGoal(row);
}

// Non-deleted goals of the user, manual order first (SPEC P4).
export function listGoals(userId: string): PublicGoal[] {
	const rows = getDb()
		.prepare(
			'SELECT * FROM goals WHERE user_id = ? AND deleted_at IS NULL ORDER BY position, created_at'
		)
		.all(userId) as GoalRow[];
	return rows.map(toPublicGoal);
}

// Includes soft-deleted rows so restore can find them; callers filter.
export function getGoal(userId: string, id: string): GoalRow | null {
	const row = getDb()
		.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?')
		.get(id, userId) as GoalRow | undefined;
	return row ?? null;
}

// Live goal (not soft-deleted), used by every ownership check of an incoming
// foreign key: a soft-deleted goal is gone for the user, so linking to it must
// fail exactly like a foreign id (SPEC 6.6, mirrors getHabit).
export function getLiveGoal(userId: string, id: string): GoalRow | null {
	const row = getGoal(userId, id);
	if (!row || row.deleted_at !== null) return null;
	return row;
}

// --- M6 aggregates (SPEC 5.6 badge rules) -----------------------------------

// Counts non-deleted goals, optionally restricted to one status.
export function countGoals(userId: string, status?: 'active' | 'done' | 'archived'): number {
	if (status) {
		const row = getDb()
			.prepare(
				'SELECT COUNT(*) AS n FROM goals WHERE user_id = ? AND deleted_at IS NULL AND status = ?'
			)
			.get(userId, status) as { n: number };
		return row.n;
	}
	const row = getDb()
		.prepare('SELECT COUNT(*) AS n FROM goals WHERE user_id = ? AND deleted_at IS NULL')
		.get(userId) as { n: number };
	return row.n;
}

// Non-deleted key results of all goals of one user — the `halfway` badge needs
// them without going through a single goal.
export function listActiveKeyResults(userId: string): {
	kind: 'number' | 'check';
	targetValue: number;
	currentValue: number;
}[] {
	const rows = getDb()
		.prepare(
			'SELECT kind, target_value, current_value FROM key_results WHERE user_id = ? AND deleted_at IS NULL'
		)
		.all(userId) as { kind: 'number' | 'check'; target_value: number; current_value: number }[];
	return rows.map((row) => ({
		kind: row.kind,
		targetValue: row.target_value,
		currentValue: row.current_value
	}));
}

// Exact title match, case-insensitive (capture commit, SPEC 7): assigns a
// suggested goal only when the user already owns one with that title.
export function findByTitle(userId: string, title: string): GoalRow | null {
	const row = getDb()
		.prepare(
			'SELECT * FROM goals WHERE user_id = ? AND deleted_at IS NULL AND lower(title) = lower(?) ORDER BY position LIMIT 1'
		)
		.get(userId, title) as GoalRow | undefined;
	return row ?? null;
}

export function updateGoal(
	userId: string,
	id: string,
	patch: {
		title?: string;
		note?: string | null;
		emoji?: string | null;
		color?: PostitColor;
		targetDate?: string | null;
		horizonOverride?: 'short' | 'mid' | 'long' | null;
		status?: 'active' | 'done' | 'archived';
		position?: number;
	}
): PublicGoal | null {
	const current = getGoal(userId, id);
	if (!current || current.deleted_at !== null) return null;
	const now = new Date().toISOString();
	const nextStatus = patch.status ?? current.status;
	// completed_at follows the status transitions (SPEC 4.2 column semantics).
	const completedAt =
		nextStatus === 'done'
			? (current.completed_at ?? now)
			: nextStatus === 'active'
				? null
				: current.completed_at;
	getDb()
		.prepare(
			`UPDATE goals SET
				title = @title, note = @note, emoji = @emoji, color = @color,
				target_date = @target_date, horizon_override = @horizon_override,
				status = @status, position = @position, updated_at = @updated_at,
				completed_at = @completed_at
			WHERE id = @id AND user_id = @user_id`
		)
		.run({
			title: patch.title ?? current.title,
			note: patch.note !== undefined ? patch.note : current.note,
			emoji: patch.emoji !== undefined ? patch.emoji : current.emoji,
			color: patch.color ?? current.color,
			target_date: patch.targetDate !== undefined ? patch.targetDate : current.target_date,
			horizon_override:
				patch.horizonOverride !== undefined ? patch.horizonOverride : current.horizon_override,
			status: nextStatus,
			position: patch.position ?? current.position,
			updated_at: now,
			completed_at: completedAt,
			id,
			user_id: userId
		});
	const updated = getGoal(userId, id);
	return updated ? toPublicGoal(updated) : null;
}

export function softDeleteGoal(userId: string, id: string): PublicGoal | null {
	const current = getGoal(userId, id);
	if (!current || current.deleted_at !== null) return null;
	const now = new Date().toISOString();
	getDb()
		.prepare('UPDATE goals SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?')
		.run(now, now, id, userId);
	const updated = getGoal(userId, id);
	return updated ? toPublicGoal(updated) : null;
}

export function restoreGoal(userId: string, id: string): PublicGoal | null {
	const current = getGoal(userId, id);
	if (!current || current.deleted_at === null) return null;
	const now = new Date().toISOString();
	getDb()
		.prepare('UPDATE goals SET deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?')
		.run(now, id, userId);
	const updated = getGoal(userId, id);
	return updated ? toPublicGoal(updated) : null;
}

// SPEC 6.8 purge: hard-deletes every soft-deleted goal older than the
// retention cutoff; its key results cascade (key_results.goal_id).
export function purgeDeleted(olderThanIso: string): number {
	const result = getDb()
		.prepare('DELETE FROM goals WHERE deleted_at IS NOT NULL AND deleted_at < ?')
		.run(olderThanIso);
	return result.changes;
}
