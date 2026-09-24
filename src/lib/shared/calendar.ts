import {
	addDays,
	monthEnd,
	monthStart,
	weekStart,
	weekdayOf,
	type WeekStartDay
} from './date.js';

// Calendar view helpers (SPEC 8.4). Pure date math on top of date.ts; the
// server and the client both need the same day lists, so they live here.

export type CalendarView = 'week' | 'month';

// SPEC 8.4: the week view is the default.
export const DEFAULT_CALENDAR_VIEW: CalendarView = 'week';

export interface CalendarRange {
	from: string;
	to: string;
}

export function daysInWeekView(today: string, weekStartDay: WeekStartDay): string[] {
	const from = weekStart(today, weekStartDay);
	return Array.from({ length: 7 }, (_, index) => addDays(from, index));
}

// Whole weeks covering the calendar month, padded at the front so every row
// starts on the user's week start day.
export function daysInMonthView(today: string, weekStartDay: WeekStartDay): string[] {
	const first = monthStart(today);
	const last = monthEnd(today);
	const gridStart = weekStart(first, weekStartDay);
	const gridEnd = addDays(weekStart(last, weekStartDay), 6);
	const days: string[] = [];
	let cursor = gridStart;
	let guard = 0;
	while (cursor <= gridEnd && guard < 42) {
		guard += 1;
		days.push(cursor);
		cursor = addDays(cursor, 1);
	}
	return days;
}

export function rangeOf(days: string[]): CalendarRange {
	return { from: days[0]!, to: days[days.length - 1]! };
}

// Shifts the window by one period, keeping the same grid shape.
export function shiftWindow(
	view: CalendarView,
	reference: string,
	weekStartDay: WeekStartDay,
	step: number
): string {
	if (view === 'week') return addDays(reference, step * 7);
	const monthIndex = Number(reference.slice(5, 7)) - 1 + step;
	const year = Number(reference.slice(0, 4)) + Math.floor(monthIndex / 12);
	const month = ((monthIndex % 12) + 12) % 12;
	// Day 15 always exists, so month arithmetic never overflows.
	return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-15`;
}

// Window title, e.g. "21 – 27. Sept." or "September 2026". `reference` is the
// anchor day of the window: month labels follow the calendar month, not the
// padded grid start.
export function windowLabel(
	view: CalendarView,
	days: string[],
	reference: string,
	locale = 'de-DE'
): string {
	const first = view === 'month' ? monthStart(reference) : days[0]!;
	const last = days[days.length - 1]!;
	const toDate = (ymd: string) =>
		new Date(
			Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)), 12)
		);
	if (view === 'month') {
		return new Intl.DateTimeFormat(locale, {
			timeZone: 'UTC',
			month: 'long',
			year: 'numeric'
		}).format(toDate(first));
	}
	// A week that spans two months repeats the month on the second date.
	const sameMonth = first.slice(0, 7) === last.slice(0, 7);
	const start = new Intl.DateTimeFormat(locale, {
		timeZone: 'UTC',
		day: 'numeric',
		month: sameMonth ? undefined : 'short'
	}).format(toDate(first));
	const end = new Intl.DateTimeFormat(locale, {
		timeZone: 'UTC',
		day: 'numeric',
		month: 'short'
	}).format(toDate(last));
	return `${start} – ${end}`;
}

// Weekday index of a day for the user's week start (0 = first column).
export function columnOf(day: string, weekStartDay: WeekStartDay): number {
	return (weekdayOf(day) - weekStartDay + 7) % 7;
}
