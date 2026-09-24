import { describe, expect, it } from 'vitest';
import {
	columnOf,
	daysInMonthView,
	daysInWeekView,
	rangeOf,
	shiftWindow,
	windowLabel
} from './calendar.js';

// Calendar grid helpers (SPEC 8.4): week view follows week_start, the month
// view covers whole weeks, navigation shifts by exactly one period.

describe('calendar views', () => {
	it('builds a week view from the user week start', () => {
		expect(daysInWeekView('2026-09-23', 1)).toEqual([
			'2026-09-21',
			'2026-09-22',
			'2026-09-23',
			'2026-09-24',
			'2026-09-25',
			'2026-09-26',
			'2026-09-27'
		]);
		expect(daysInWeekView('2026-09-23', 0)[0]).toBe('2026-09-20');
		expect(daysInWeekView('2026-09-23', 6)[0]).toBe('2026-09-19');
	});

	it('pads the month view to whole weeks', () => {
		const days = daysInMonthView('2026-09-15', 1);
		expect(days[0]).toBe('2026-08-31');
		expect(days[days.length - 1]).toBe('2026-10-04');
		expect(days).toContain('2026-09-01');
		expect(days).toContain('2026-09-30');
		expect(days.length % 7).toBe(0);
	});

	it('keeps February of a leap year complete', () => {
		const days = daysInMonthView('2028-02-10', 1);
		expect(days).toContain('2028-02-29');
		expect(rangeOf(days).from <= '2028-02-01').toBe(true);
	});

	it('shifts by one week or one month and survives year boundaries', () => {
		expect(shiftWindow('week', '2026-09-23', 1, 1)).toBe('2026-09-30');
		expect(shiftWindow('week', '2026-09-23', 1, -1)).toBe('2026-09-16');
		expect(shiftWindow('month', '2026-09-23', 1, 1)).toBe('2026-10-15');
		expect(shiftWindow('month', '2026-12-05', 1, 1)).toBe('2027-01-15');
		expect(shiftWindow('month', '2026-01-05', 1, -1)).toBe('2025-12-15');
	});

	it('labels the window in German', () => {
		expect(windowLabel('week', daysInWeekView('2026-09-23', 1), '2026-09-23')).toBe(
			'21 – 27. Sept.'
		);
		expect(windowLabel('month', daysInMonthView('2026-09-15', 1), '2026-09-15')).toBe(
			'September 2026'
		);
		// A week spanning two months names both.
		expect(windowLabel('week', daysInWeekView('2026-09-30', 1), '2026-09-30')).toContain('Okt');
	});

	it('computes the column of a day for the week start', () => {
		expect(columnOf('2026-09-21', 1)).toBe(0); // Monday
		expect(columnOf('2026-09-27', 1)).toBe(6); // Sunday
		expect(columnOf('2026-09-20', 0)).toBe(0); // Sunday-first
	});
});
