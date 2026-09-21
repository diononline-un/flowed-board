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
