import {
	addDays,
	diffDays,
	monthEnd,
	monthStart,
	weekStart,
	type WeekStartDay
} from './date.js';

// Habit window, counter and pace rules (SPEC 5.5, AC12). Pure functions over
// YYYY-MM-DD strings and plain log-date arrays so server page loads, the
// client and the unit tests share one implementation.
//
// No streaks anywhere (P3): "Wochen/Monate geschafft" counts *completed*
// windows in which the target was reached, and the value never drops when a
// window is skipped. Pace text exists for `range` habits only.

export type HabitCadence = 'week' | 'month' | 'range';

// Oldest day a log may be written for (SPEC 5.5: not older than 60 days).
export const LOG_AGE_LIMIT_DAYS = 60;

export interface HabitWindow {
	from: string;
	to: string;
}

export interface HabitPlan {
	cadence: HabitCadence;
	// Calendar day the habit was created (YYYY-MM-DD, user timezone).
	created_at: string;
	range_start?: string | null;
	range_end?: string | null;
}

// Window of the current period (SPEC 5.5): week = [weekStart(today), +6],
// month = calendar month, range = [range_start, range_end].
export function habitWindow(
	habit: HabitPlan,
	today: string,
	weekStartDay: WeekStartDay
): HabitWindow {
	if (habit.cadence === 'week') {
		const from = weekStart(today, weekStartDay);
		return { from, to: addDays(from, 6) };
	}
	if (habit.cadence === 'month') {
		return { from: monthStart(today), to: monthEnd(today) };
	}
	const start = habit.range_start ?? today;
	const end = habit.range_end ?? today;
	return { from: start, to: end };
}

export function countInWindow(logDates: readonly string[], window: HabitWindow): number {
	let count = 0;
	for (const date of logDates) {
		if (date >= window.from && date <= window.to) count += 1;
	}
	return count;
}

// True when the day may carry a new log at all (SPEC 5.5): never in the
// future, never older than 60 days.
export function isLogDateAllowed(date: string, today: string): boolean {
	const age = diffDays(today, date);
	return age >= 0 && age <= LOG_AGE_LIMIT_DAYS;
}

// Periods of the cadence, oldest first, clipped to [from, to].
export function periodWindows(
	cadence: HabitCadence,
	from: string,
	to: string,
	weekStartDay: WeekStartDay
): HabitWindow[] {
	const windows: HabitWindow[] = [];
	if (from > to) return windows;
	let cursor = from;
	let guard = 0;
	while (cursor <= to && guard < 500) {
		guard += 1;
		let window: HabitWindow;
		if (cadence === 'month') {
			window = { from: monthStart(cursor), to: monthEnd(cursor) };
			cursor = addDays(window.to, 1);
		} else {
			window = { from: weekStart(cursor, weekStartDay), to: addDays(weekStart(cursor, weekStartDay), 6) };
			cursor = addDays(window.to, 1);
		}
		if (window.to < from) continue;
		windows.push({ from: window.from < from ? from : window.from, to: window.to > to ? to : window.to });
	}
	return windows;
}

export interface CompletedPeriods {
	// Windows that are over and in which count >= target. Never decreases
	// (P3) because a finished window cannot change any more.
	completed: number;
	// Best window value so far, current window included (P7: purely additive).
	best: number;
	// Granularity of both numbers, for the label (week/month/range).
	unit: 'week' | 'month';
}

// Completed-window counter and best window (SPEC 5.5). Windows are counted
// from created_at up to the last *finished* period.
export function completedPeriods(
	habit: HabitPlan & { target_count: number },
	logDates: readonly string[],
	today: string,
	weekStartDay: WeekStartDay
): CompletedPeriods {
	const unit: 'week' | 'month' = habit.cadence === 'month' ? 'month' : 'week';
	const start = habit.created_at.slice(0, 10);
	const lastEnd =
		habit.cadence === 'week'
			? addDays(weekStart(today, weekStartDay), -1)
			: addDays(monthStart(today), -1);
	let windows: HabitWindow[] = [];
	if (start <= lastEnd) {
		windows = periodWindows(habit.cadence, start, lastEnd, weekStartDay);
	}
	let completed = 0;
	let best = 0;
	for (const window of windows) {
		const count = countInWindow(logDates, window);
		if (count >= habit.target_count) completed += 1;
		if (count > best) best = count;
	}
	const current = countInWindow(logDates, habitWindow(habit, today, weekStartDay));
	if (current > best) best = current;
	return { completed, best, unit };
}

export type PaceState = 'upcoming' | 'achieved' | 'expired' | 'onTrack' | 'behind';

export interface HabitPace {
	state: PaceState;
	remaining: number;
	perWeek: number;
	daysLeft: number;
	// Completion ratio of the whole range, 0 to 1 (progress bar).
	ratio: number;
	// Elapsed share of the range, 0 to 1 (temporal marker in the bar).
	elapsedRatio: number;
}

// Pace for `range` habits (SPEC 5.5). The caller renders the four text cases
// from this state (copy.calendar.habits.pace); colors stay sage/sand.
export function rangePace(
	habit: { target_count: number; range_start: string; range_end: string },
	count: number,
	today: string
): HabitPace {
	const totalDays = diffDays(habit.range_end, habit.range_start) + 1;
	const elapsedDays = Math.min(totalDays, Math.max(0, diffDays(today, habit.range_start) + 1));
	const daysLeft = Math.max(0, diffDays(habit.range_end, today));
	const remaining = Math.max(0, habit.target_count - count);
	const ratio = Math.min(1, Math.max(0, count / habit.target_count));
	const elapsedRatio = Math.min(1, Math.max(0, elapsedDays / totalDays));

	if (today < habit.range_start) {
		return { state: 'upcoming', remaining, perWeek: 0, daysLeft, ratio, elapsedRatio };
	}
	if (count >= habit.target_count) {
		return { state: 'achieved', remaining: 0, perWeek: 0, daysLeft, ratio, elapsedRatio };
	}
	if (today > habit.range_end) {
		return { state: 'expired', remaining, perWeek: 0, daysLeft: 0, ratio, elapsedRatio };
	}
	const expected = (habit.target_count * elapsedDays) / totalDays;
	if (count >= expected) {
		return { state: 'onTrack', remaining, perWeek: 0, daysLeft, ratio, elapsedRatio };
	}
	const perWeek = Math.ceil(remaining / Math.max(daysLeft / 7, 1 / 7));
	return { state: 'behind', remaining, perWeek, daysLeft, ratio, elapsedRatio };
}

export interface HabitProgress {
	window: HabitWindow;
	count: number;
	target: number;
	maxPerDay: number;
	ratio: number;
	// Logs already written for `today` (drives the tap cap, AC11).
	todayCount: number;
	canLogToday: boolean;
	periods: CompletedPeriods;
	// Only `range` habits carry pace text (SPEC 5.5).
	pace: HabitPace | null;
}

export interface HabitLike {
	cadence: HabitCadence;
	target_count: number;
	range_start: string | null;
	range_end: string | null;
	max_per_day: number;
	created_at: string;
}

// One call that gives the UI everything it shows for a habit (SPEC 8.4).
export function habitProgress(
	habit: HabitLike,
	logDates: readonly string[],
	today: string,
	weekStartDay: WeekStartDay
): HabitProgress {
	const window = habitWindow(
		{
			cadence: habit.cadence,
			created_at: habit.created_at.slice(0, 10),
			range_start: habit.range_start,
			range_end: habit.range_end
		},
		today,
		weekStartDay
	);
	const count = countInWindow(logDates, window);
	const todayCount = logDates.filter((date) => date === today).length;
	return {
		window,
		count,
		target: habit.target_count,
		maxPerDay: habit.max_per_day,
		ratio: Math.min(1, Math.max(0, count / habit.target_count)),
		todayCount,
		canLogToday: todayCount < habit.max_per_day,
		periods: completedPeriods(habit, logDates, today, weekStartDay),
		pace:
			habit.cadence === 'range' && habit.range_start && habit.range_end
				? rangePace(
						{
							target_count: habit.target_count,
							range_start: habit.range_start,
							range_end: habit.range_end
						},
						count,
						today
					)
				: null
	};
}
