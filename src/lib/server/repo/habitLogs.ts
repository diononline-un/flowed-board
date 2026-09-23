import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import { habitWindow, isLogDateAllowed } from '$lib/shared/habit.js';
import type { WeekStartDay } from '$lib/shared/date.js';
import type { HabitLogRow, PublicHabit, PublicHabitLog } from '$lib/shared/types.js';

// Only SQL for the habit_logs table lives here (SPEC 16). userId first and
// filtered everywhere (SPEC 6.6); foreign ids yield null / empty lists.
//
// Two writers exist: the post-it side effect of SPEC 5.3 (source='postit',
// see addPostitLog) and the calendar tap target of SPEC 8.4 (source='tap').

export function toPublicHabitLog(row: HabitLogRow): PublicHabitLog {
	return {
		id: row.id,
		habitId: row.habit_id,
		logDate: row.log_date,
		source: row.source,
		createdAt: row.created_at
	};
}

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

// Full log list of one habit, optionally restricted to a day range (SPEC 7:
// GET /api/habits/:id/logs?from,to — the calendar grid).
export function listForHabit(
	userId: string,
	habitId: string,
	range: { from?: string; to?: string } = {}
): PublicHabitLog[] {
	const conditions = ['user_id = @userId', 'habit_id = @habitId'];
	const params: Record<string, string> = { userId, habitId };
	if (range.from) {
		conditions.push('log_date >= @from');
		params.from = range.from;
	}
	if (range.to) {
		conditions.push('log_date <= @to');
		params.to = range.to;
	}
	const rows = getDb()
		.prepare(
			`SELECT * FROM habit_logs WHERE ${conditions.join(' AND ')} ORDER BY log_date, created_at`
		)
		.all(params) as unknown as HabitLogRow[];
	return rows.map(toPublicHabitLog);
}

// Plain date list — what the SPEC 5.5 counter functions consume.
export function listLogDates(
	userId: string,
	habitId: string,
	range: { from?: string; to?: string } = {}
): string[] {
	return listForHabit(userId, habitId, range).map((log) => log.logDate);
}

// SPEC 5.3: completing a post-it with habit_id creates exactly one log
// (source='postit', log_date given by the caller as date ?? today), unless
// max_per_day for that day is already reached — then nothing happens.
// Idempotent: an existing post-it log for the same post-it is returned as-is.
//
// A `range` habit only accepts days inside its own window (the same rule the
// tap path enforces, SPEC 5.5): a post-it dated outside `[range_start,
// range_end]` completes without writing a log, it never widens the window.
export function addPostitLog(
	userId: string,
	habitId: string,
	logDate: string,
	postitId: string
): HabitLogRow | null {
	const existing = listByPostit(userId, postitId);
	if (existing.length > 0) return existing[0]!;
	const habit = getDb()
		.prepare(
			'SELECT max_per_day, cadence, range_start, range_end FROM habits WHERE id = ? AND user_id = ? AND deleted_at IS NULL'
		)
		.get(habitId, userId) as
		| {
				max_per_day: number;
				cadence: 'week' | 'month' | 'range';
				range_start: string | null;
				range_end: string | null;
			}
		| undefined;
	if (!habit) return null;
	if (habit.cadence === 'range') {
		// The range window is independent of the week start (SPEC 5.5).
		const window = habitWindow(
			{
				cadence: 'range',
				created_at: logDate,
				range_start: habit.range_start,
				range_end: habit.range_end
			},
			logDate,
			1
		);
		if (logDate < window.from || logDate > window.to) return null;
	}
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

export type TapFailure = 'future' | 'tooOld' | 'outsideRange' | 'maxPerDay' | 'noLog';

export type TapResult =
	| { ok: true; log: PublicHabitLog; dayCount: number; todayCount: number; removed: boolean }
	| { ok: false; reason: TapFailure };

// SPEC 5.5/8.4, AC11: `delta:+1` adds one tap log for the day, `delta:-1`
// removes the newest tap log of that day. The date may not lie in the future
// and not more than 60 days back, and a `range` habit rejects days outside
// its window (422 for the caller). max_per_day caps the taps per day.
export function tapLog(
	userId: string,
	habit: PublicHabit,
	date: string,
	delta: 1 | -1,
	today: string,
	weekStartDay: WeekStartDay
): TapResult {
	if (!isLogDateAllowed(date, today)) {
		return { ok: false, reason: date > today ? 'future' : 'tooOld' };
	}
	if (habit.cadence === 'range') {
		const window = habitWindow(
			{
				cadence: 'range',
				created_at: habit.createdAt.slice(0, 10),
				range_start: habit.rangeStart,
				range_end: habit.rangeEnd
			},
			today,
			weekStartDay
		);
		if (date < window.from || date > window.to) return { ok: false, reason: 'outsideRange' };
	}
	if (delta === -1) {
		const removed = removeLatestTapLog(userId, habit.id, date);
		if (!removed) return { ok: false, reason: 'noLog' };
		return {
			ok: true,
			log: toPublicHabitLog(removed),
			dayCount: countForDay(userId, habit.id, date),
			todayCount: countForDay(userId, habit.id, today),
			removed: true
		};
	}
	if (countForDay(userId, habit.id, date) >= habit.maxPerDay) {
		return { ok: false, reason: 'maxPerDay' };
	}
	const row: HabitLogRow = {
		id: randomUUID(),
		user_id: userId,
		habit_id: habit.id,
		log_date: date,
		source: 'tap',
		postit_id: null,
		created_at: new Date().toISOString()
	};
	getDb()
		.prepare(
			`INSERT INTO habit_logs (id, user_id, habit_id, log_date, source, postit_id, created_at)
			 VALUES (@id, @user_id, @habit_id, @log_date, @source, @postit_id, @created_at)`
		)
		.run(row);
	return {
		ok: true,
		log: toPublicHabitLog(row),
		dayCount: countForDay(userId, habit.id, date),
		todayCount: countForDay(userId, habit.id, today),
		removed: false
	};
}

// Newest tap log of a day (post-it logs stay untouched, SPEC 5.5 names the
// tap log explicitly).
function removeLatestTapLog(userId: string, habitId: string, date: string): HabitLogRow | null {
	const row = getDb()
		.prepare(
			`SELECT * FROM habit_logs
			 WHERE user_id = ? AND habit_id = ? AND log_date = ? AND source = 'tap'
			 ORDER BY created_at DESC, rowid DESC LIMIT 1`
		)
		.get(userId, habitId, date) as HabitLogRow | undefined;
	if (!row) return null;
	getDb()
		.prepare('DELETE FROM habit_logs WHERE id = ? AND user_id = ?')
		.run(row.id, userId);
	return row;
}
