import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import { getHabit } from './habits.js';
import type { HabitLogRow } from '$lib/shared/types.js';

// Minimal habit_logs access for M2: exactly what the SPEC 5.3 post-it side
// effect needs. Tap-log endpoints arrive with the habit scope in M4.

export function countForDay(userId: string, habitId: string, logDate: string): number {
	const row = getDb()
		.prepare(
			'SELECT COUNT(*) AS n FROM habit_logs WHERE user_id = ? AND habit_id = ? AND log_date = ?'
		)
		.get(userId, habitId, logDate) as { n: number };
	return row.n;
}

export function listByPostit(userId: string, postitId: string): HabitLogRow[] {
	return getDb()
		.prepare(
			`SELECT * FROM habit_logs WHERE user_id = ? AND postit_id = ? AND source = 'postit'`
		)
		.all(userId, postitId) as HabitLogRow[];
}

// SPEC 5.3: completing a post-it with habit_id creates exactly one log
// (source='postit', log_date given by the caller as date ?? today), unless
// max_per_day for that day is already reached — then nothing happens.
// Idempotent: an existing post-it log for the same post-it is returned as-is.
export function addPostitLog(
	userId: string,
	habitId: string,
	logDate: string,
	postitId: string
): HabitLogRow | null {
	const existing = listByPostit(userId, postitId);
	if (existing.length > 0) return existing[0]!;
	const habit = getHabit(userId, habitId);
	if (!habit) return null;
	if (countForDay(userId, habitId, logDate) >= habit.max_per_day) return null;
	const row: HabitLogRow = {
		id: randomUUID(),
		user_id: userId,
		habit_id: habitId,
		log_date: logDate,
		source: 'postit',
		postit_id: postitId,
		created_at: new Date().toISOString()
	};
	getDb()
		.prepare(
			`INSERT INTO habit_logs (id, user_id, habit_id, log_date, source, postit_id, created_at)
			 VALUES (@id, @user_id, @habit_id, @log_date, @source, @postit_id, @created_at)`
		)
		.run(row);
	return row;
}

// SPEC 5.3: reopening or soft-deleting the post-it removes its log.
export function removeByPostit(userId: string, postitId: string): number {
	const result = getDb()
		.prepare(
			`DELETE FROM habit_logs WHERE user_id = ? AND postit_id = ? AND source = 'postit'`
		)
		.run(userId, postitId);
	return result.changes;
}
