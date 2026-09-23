import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import { getGoal } from './goals.js';
import type { KeyResultRow, PublicKeyResult } from '$lib/shared/types.js';

// Only SQL for the key_results table lives here (SPEC 16). userId first and
// filtered everywhere (SPEC 6.6); foreign goal or key-result ids yield null.

export function toPublicKeyResult(row: KeyResultRow): PublicKeyResult {
	return {
		id: row.id,
		goalId: row.goal_id,
		title: row.title,
		kind: row.kind,
		startValue: row.start_value,
		targetValue: row.target_value,
		currentValue: row.current_value,
		unit: row.unit,
		position: row.position,
		createdAt: row.created_at,
		deletedAt: row.deleted_at
	};
}

function nextPosition(userId: string, goalId: string): number {
	const row = getDb()
		.prepare(
			'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM key_results WHERE user_id = ? AND goal_id = ? AND deleted_at IS NULL'
		)
		.get(userId, goalId) as { next: number };
	return row.next;
}

// Returns null when the goal does not belong to the user (or is deleted) —
// a key result can never be attached to a foreign goal.
export function createKeyResult(
	userId: string,
	goalId: string,
	input: {
		title: string;
		kind?: 'number' | 'check';
		startValue?: number;
		targetValue?: number;
		currentValue?: number;
		unit?: string | null;
		position?: number;
	}
): PublicKeyResult | null {
	const goal = getGoal(userId, goalId);
	if (!goal || goal.deleted_at !== null) return null;
	const kind = input.kind ?? 'number';
	const row: KeyResultRow = {
		id: randomUUID(),
		user_id: userId,
		goal_id: goalId,
		title: input.title,
		kind,
		start_value: input.startValue ?? 0,
		target_value: input.targetValue ?? 1,
		current_value: input.currentValue ?? 0,
		unit: input.unit ?? null,
		position: input.position ?? nextPosition(userId, goalId),
		created_at: new Date().toISOString(),
		deleted_at: null
	};
	getDb()
		.prepare(
			`INSERT INTO key_results (
				id, user_id, goal_id, title, kind, start_value, target_value,
				current_value, unit, position, created_at, deleted_at
			) VALUES (
				@id, @user_id, @goal_id, @title, @kind, @start_value, @target_value,
				@current_value, @unit, @position, @created_at, @deleted_at
			)`
		)
		.run(row);
	return toPublicKeyResult(row);
}

export function listKeyResults(userId: string, goalId: string): PublicKeyResult[] {
	const rows = getDb()
		.prepare(
			'SELECT * FROM key_results WHERE user_id = ? AND goal_id = ? AND deleted_at IS NULL ORDER BY position, created_at'
		)
		.all(userId, goalId) as KeyResultRow[];
	return rows.map(toPublicKeyResult);
}

// Includes soft-deleted rows; callers filter.
export function getKeyResult(userId: string, id: string): KeyResultRow | null {
	const row = getDb()
		.prepare('SELECT * FROM key_results WHERE id = ? AND user_id = ?')
		.get(id, userId) as KeyResultRow | undefined;
	return row ?? null;
}

export function updateKeyResult(
	userId: string,
	id: string,
	patch: {
		title?: string;
		kind?: 'number' | 'check';
		startValue?: number;
		targetValue?: number;
		currentValue?: number;
		unit?: string | null;
		position?: number;
	}
): PublicKeyResult | null {
	const current = getKeyResult(userId, id);
	if (!current || current.deleted_at !== null) return null;
	getDb()
		.prepare(
			`UPDATE key_results SET
				title = @title, kind = @kind, start_value = @start_value,
				target_value = @target_value, current_value = @current_value,
				unit = @unit, position = @position
			WHERE id = @id AND user_id = @user_id`
		)
		.run({
			title: patch.title ?? current.title,
			kind: patch.kind ?? current.kind,
			start_value: patch.startValue ?? current.start_value,
			target_value: patch.targetValue ?? current.target_value,
			current_value: patch.currentValue ?? current.current_value,
			unit: patch.unit !== undefined ? patch.unit : current.unit,
			position: patch.position ?? current.position,
			id,
			user_id: userId
		});
	const updated = getKeyResult(userId, id);
	return updated ? toPublicKeyResult(updated) : null;
}

// Soft delete (deleted_at column, SPEC 4.2); SPEC 7 defines no restore
// endpoint for key results.
export function softDeleteKeyResult(userId: string, id: string): PublicKeyResult | null {
	const current = getKeyResult(userId, id);
	if (!current || current.deleted_at !== null) return null;
	getDb()
		.prepare('UPDATE key_results SET deleted_at = ? WHERE id = ? AND user_id = ?')
		.run(new Date().toISOString(), id, userId);
	const updated = getKeyResult(userId, id);
	return updated ? toPublicKeyResult(updated) : null;
}

// SPEC 6.8 purge: hard-deletes every soft-deleted key result older than the
// retention cutoff, whatever its goal. Without this step a key result deleted
// inside a live goal would never disappear (the goal cascade only fires when
// the goal itself is hard-deleted) — DECISIONS: a deleted key result vanishes
// like its title promised, independent of the goal.
export function purgeDeleted(olderThanIso: string): number {
	const result = getDb()
		.prepare('DELETE FROM key_results WHERE deleted_at IS NOT NULL AND deleted_at < ?')
		.run(olderThanIso);
	return result.changes;
}
