import { describe, expect, it } from 'vitest';
import { addDays } from './date.js';
import {
	completedPeriods,
	countInWindow,
	habitProgress,
	habitWindow,
	isLogDateAllowed,
	periodWindows,
	rangePace
} from './habit.js';

// SPEC 5.5 / AC11 / AC12: window computation, per-day cap, the four pace
// cases, the 60-day and future boundaries, and completed-window counting
// (no streaks — the counter never drops).

const TODAY = '2026-09-23'; // Wednesday

describe('habitWindow (SPEC 5.5)', () => {
	it('spans weekStart(today)..+6 for week habits, any week start', () => {
		expect(habitWindow({ cadence: 'week', created_at: '2026-09-01' }, TODAY, 1)).toEqual({
			from: '2026-09-21',
			to: '2026-09-27'
		});
		expect(habitWindow({ cadence: 'week', created_at: '2026-09-01' }, TODAY, 0)).toEqual({
			from: '2026-09-20',
			to: '2026-09-26'
		});
		expect(habitWindow({ cadence: 'week', created_at: '2026-09-01' }, TODAY, 6)).toEqual({
			from: '2026-09-19',
			to: '2026-09-25'
		});
	});

	it('spans the calendar month for month habits, including February', () => {
		expect(habitWindow({ cadence: 'month', created_at: '2026-01-01' }, '2026-02-14', 1)).toEqual({
			from: '2026-02-01',
			to: '2026-02-28'
		});
		expect(habitWindow({ cadence: 'month', created_at: '2028-01-01' }, '2028-02-14', 1)).toEqual({
			from: '2028-02-01',
			to: '2028-02-29'
		});
	});

	it('spans range_start..range_end for range habits', () => {
		expect(
			habitWindow(
				{
					cadence: 'range',
					created_at: '2026-09-01',
					range_start: '2026-09-01',
					range_end: '2026-12-31'
				},
				TODAY,
				1
			)
		).toEqual({ from: '2026-09-01', to: '2026-12-31' });
	});
});

describe('countInWindow', () => {
	it('counts logs inside the window only, boundaries inclusive', () => {
		const window = { from: '2026-09-21', to: '2026-09-27' };
		const logs = ['2026-09-20', '2026-09-21', '2026-09-23', '2026-09-23', '2026-09-27', '2026-09-28'];
		expect(countInWindow(logs, window)).toBe(4);
		expect(countInWindow([], window)).toBe(0);
	});
});

describe('isLogDateAllowed (SPEC 5.5)', () => {
	it('accepts today and the last 60 days', () => {
		expect(isLogDateAllowed(TODAY, TODAY)).toBe(true);
		expect(isLogDateAllowed(addDays(TODAY, -1), TODAY)).toBe(true);
		expect(isLogDateAllowed(addDays(TODAY, -60), TODAY)).toBe(true);
	});

	it('rejects the future and anything older than 60 days', () => {
		expect(isLogDateAllowed(addDays(TODAY, 1), TODAY)).toBe(false);
		expect(isLogDateAllowed(addDays(TODAY, -61), TODAY)).toBe(false);
	});
});

describe('periodWindows', () => {
	it('walks weeks and months chronologically with clipped edges', () => {
		expect(periodWindows('week', '2026-09-09', '2026-09-22', 1)).toEqual([
			{ from: '2026-09-09', to: '2026-09-13' },
			{ from: '2026-09-14', to: '2026-09-20' },
			{ from: '2026-09-21', to: '2026-09-22' }
		]);
		expect(periodWindows('month', '2026-01-15', '2026-03-31', 1)).toEqual([
			{ from: '2026-01-15', to: '2026-01-31' },
			{ from: '2026-02-01', to: '2026-02-28' },
			{ from: '2026-03-01', to: '2026-03-31' }
		]);
	});
});

describe('completedPeriods (SPEC 5.5, no streaks)', () => {
	const base = { target_count: 2, created_at: '2026-09-07' };

	it('counts finished weeks with count >= target and never drops on gaps', () => {
		// Creation Monday 2026-09-07. Finished weeks before today (Wed 09-23):
		// 09-07..09-13 (ok), 09-14..09-20 (skipped).
		const logs = ['2026-09-07', '2026-09-08', '2026-09-19'];
		const result = completedPeriods({ ...base, cadence: 'week' }, logs, TODAY, 1);
		expect(result.completed).toBe(1);
		expect(result.unit).toBe('week');
		// best = max(2 in the first week, 1 in the skipped week, 1 in the running week)
		expect(result.best).toBe(2);
	});

	it('counts finished months and includes the running month in best', () => {
		const habit = { cadence: 'month' as const, target_count: 3, created_at: '2026-07-10' };
		const logs = [
			'2026-07-11',
			'2026-07-12',
			'2026-07-13', // July: 3 = target
			'2026-08-02', // August: 1 < target
			'2026-09-01',
			'2026-09-02',
			'2026-09-03',
			'2026-09-04' // running September: 4
		];
		const result = completedPeriods(habit, logs, TODAY, 1);
		expect(result.completed).toBe(1);
		expect(result.best).toBe(4);
		expect(result.unit).toBe('month');
	});

	it('does not count the running window before it is over', () => {
		const habit = { cadence: 'week' as const, target_count: 1, created_at: '2026-09-21' };
		const result = completedPeriods(habit, ['2026-09-21', '2026-09-22'], TODAY, 1);
		expect(result.completed).toBe(0);
		expect(result.best).toBe(2);
	});
});

describe('rangePace (SPEC 5.5, AC12)', () => {
	const habit = {
		target_count: 100,
		range_start: '2026-01-01',
		range_end: '2026-12-31'
	};

	it('case 1: before range_start', () => {
		const pace = rangePace(habit, 0, '2025-12-20');
		expect(pace.state).toBe('upcoming');
		expect(pace.ratio).toBe(0);
	});

	it('case 2: target reached', () => {
		expect(rangePace(habit, 100, '2026-06-01').state).toBe('achieved');
		expect(rangePace(habit, 140, '2026-06-01').state).toBe('achieved');
		expect(rangePace(habit, 140, '2026-06-01').ratio).toBe(1);
	});

	it('case 3: range over without reaching the target', () => {
		const pace = rangePace({ ...habit, range_end: '2026-06-30' }, 61, '2026-09-23');
		expect(pace.state).toBe('expired');
		expect(pace.remaining).toBe(39);
	});

	it('case 4a: on track when count >= expected', () => {
		// Day 82 of 365 → expected 22.5; 25 logs are ahead of plan.
		expect(rangePace(habit, 25, '2026-03-23').state).toBe('onTrack');
	});

	it('case 4b: behind with "etwa n pro Woche"', () => {
		// Day 82 of 365 → expected 22.5; 10 logs are behind.
		const pace = rangePace(habit, 10, '2026-03-23');
		expect(pace.state).toBe('behind');
		expect(pace.remaining).toBe(90);
		expect(pace.daysLeft).toBe(283);
		// ceil(90 / (283 / 7)) = ceil(2.226) = 3
		expect(pace.perWeek).toBe(3);
	});

	it('treats the last day of the range as still open', () => {
		expect(rangePace(habit, 10, '2026-12-31').state).toBe('behind');
		expect(rangePace(habit, 10, '2027-01-01').state).toBe('expired');
	});
});

describe('habitProgress', () => {
	it('combines window, count, per-day cap and range pace', () => {
		const progress = habitProgress(
			{
				cadence: 'week',
				target_count: 3,
				range_start: null,
				range_end: null,
				max_per_day: 2,
				created_at: '2026-09-01'
			},
			['2026-09-23', '2026-09-23', '2026-09-24'],
			TODAY,
			1
		);
		expect(progress.window).toEqual({ from: '2026-09-21', to: '2026-09-27' });
		expect(progress.count).toBe(3);
		expect(progress.todayCount).toBe(2);
		expect(progress.canLogToday).toBe(false);
		expect(progress.pace).toBeNull();
	});

	it('accepts the ISO created_at of a row and clips it to the calendar day', () => {
		const habit = {
			cadence: 'week' as const,
			target_count: 1,
			range_start: null,
			range_end: null,
			max_per_day: 1,
			created_at: '2026-09-07T08:30:00.000Z'
		};
		// The week 09-07..09-13 is over and met the target → one completed week.
		const progress = habitProgress(habit, ['2026-09-07'], TODAY, 1);
		expect(progress.periods.completed).toBe(1);
	});

	it('exposes pace only for range habits', () => {		const progress = habitProgress(
			{
				cadence: 'range',
				target_count: 5,
				range_start: '2026-09-01',
				range_end: '2026-09-30',
				max_per_day: 1,
				created_at: '2026-09-01'
			},
			['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
			TODAY,
			1
		);
		expect(progress.pace?.state).toBe('onTrack');
		expect(progress.canLogToday).toBe(true);
	});
});
