import { getDb } from '../db.js';
import type { HabitRow } from '$lib/shared/types.js';

// Minimal habits access for M2 (ownership checks + max_per_day for the SPEC
// 5.3 post-it side effect). The full habit scope arrives in M4.

export function getHabit(userId: string, id: string): HabitRow | null {
	const row = getDb()
		.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
		.get(id, userId) as HabitRow | undefined;
	return row ?? null;
}

// Habits linked to a goal (SPEC 8.3 goal detail page).
export function listByGoal(userId: string, goalId: string): HabitRow[] {
	return getDb()
		.prepare(
			'SELECT * FROM habits WHERE user_id = ? AND goal_id = ? AND deleted_at IS NULL ORDER BY position'
		)
		.all(userId, goalId) as HabitRow[];
}
