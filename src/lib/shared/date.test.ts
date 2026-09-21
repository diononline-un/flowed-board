import { describe, expect, it } from 'vitest';
import {
	addDays,
	diffDays,
	formatDe,
	isValidTimeZone,
	isValidYmd,
	isoWeekNumber,
	monthEnd,
	monthStart,
	nowTimeIn,
	todayIn,
	weekdayOf,
	weekStart
} from './date.js';

describe('isValidYmd', () => {
	it('accepts real calendar days', () => {
		expect(isValidYmd('2026-09-21')).toBe(true);
		expect(isValidYmd('2024-02-29')).toBe(true); // leap year
		expect(isValidYmd('0001-01-01')).toBe(true);
	});
	it('rejects impossible or malformed days', () => {
		expect(isValidYmd('2026-02-29')).toBe(false); // 2026 is not a leap year
		expect(isValidYmd('2026-13-01')).toBe(false);
		expect(isValidYmd('2026-00-10')).toBe(false);
		expect(isValidYmd('2026-04-31')).toBe(false);
		expect(isValidYmd('2026-3-9')).toBe(false); // must be zero-padded
		expect(isValidYmd('21.09.2026')).toBe(false);
		expect(isValidYmd('')).toBe(false);
	});
});

describe('isValidTimeZone', () => {
	it('accepts IANA names and rejects garbage', () => {
		expect(isValidTimeZone('Europe/Berlin')).toBe(true);
		expect(isValidTimeZone('UTC')).toBe(true);
		expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
		expect(isValidTimeZone('')).toBe(false);
	});
});

describe('todayIn / nowTimeIn', () => {
	it('maps an instant to the zoned calendar day', () => {
		const now = new Date('2026-09-21T22:30:00.000Z');
		expect(todayIn('Europe/Berlin', now)).toBe('2026-09-22'); // 00:30 CEST
		expect(todayIn('UTC', now)).toBe('2026-09-21');
	});
	it('returns HH:MM wall clock in the zone', () => {
		const now = new Date('2026-09-21T14:05:00.000Z');
		expect(nowTimeIn('Europe/Berlin', now)).toBe('16:05'); // CEST = UTC+2
		expect(nowTimeIn('UTC', now)).toBe('14:05');
	});
});

describe('DST Europe/Berlin 2026 (spring forward 2026-03-29, fall back 2026-10-25)', () => {
	it('spring: the day starts and ends on the right instants', () => {
		// 23:00 UTC = 00:00 CET on 2026-03-29
		expect(todayIn('Europe/Berlin', new Date('2026-03-28T22:59:59.000Z'))).toBe('2026-03-28');
		expect(todayIn('Europe/Berlin', new Date('2026-03-28T23:00:00.000Z'))).toBe('2026-03-29');
		// 22:00 UTC = 00:00 CEST on 2026-03-30
		expect(todayIn('Europe/Berlin', new Date('2026-03-29T21:59:59.000Z'))).toBe('2026-03-29');
		expect(todayIn('Europe/Berlin', new Date('2026-03-29T22:00:00.000Z'))).toBe('2026-03-30');
	});
	it('spring: 02:00–02:59 does not exist, clock jumps to 03:00', () => {
		expect(nowTimeIn('Europe/Berlin', new Date('2026-03-29T00:59:59.000Z'))).toBe('01:59');
		expect(nowTimeIn('Europe/Berlin', new Date('2026-03-29T01:00:00.000Z'))).toBe('03:00');
	});
	it('fall: the ambiguous hour 02:00–02:59 happens twice', () => {
		expect(nowTimeIn('Europe/Berlin', new Date('2026-10-25T00:30:00.000Z'))).toBe('02:30'); // CEST
		expect(nowTimeIn('Europe/Berlin', new Date('2026-10-25T01:30:00.000Z'))).toBe('02:30'); // CET
		expect(todayIn('Europe/Berlin', new Date('2026-10-25T01:30:00.000Z'))).toBe('2026-10-25');
	});
	it('date-string arithmetic stays exact across both switches', () => {
		expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
		expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
		expect(diffDays('2026-03-30', '2026-03-29')).toBe(1);
		expect(diffDays('2026-10-26', '2026-10-25')).toBe(1);
	});
});

describe('weekdayOf / addDays / diffDays', () => {
	it('knows 2026-03-29 and 2026-10-25 are Sundays', () => {
		expect(weekdayOf('2026-03-29')).toBe(0);
		expect(weekdayOf('2026-10-25')).toBe(0);
		expect(weekdayOf('2026-09-21')).toBe(1); // Monday
	});
	it('moves across month and year boundaries', () => {
		expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
		expect(addDays('2026-09-21', 0)).toBe('2026-09-21');
	});
	it('diffs in whole days, negative into the past', () => {
		expect(diffDays('2026-09-21', '2026-09-21')).toBe(0);
		expect(diffDays('2026-09-22', '2026-09-21')).toBe(1);
		expect(diffDays('2026-09-14', '2026-09-21')).toBe(-7);
	});
});

describe('weekStart with week_start in {0, 1, 6}', () => {
	// 2026-03-29 is a Sunday, 2026-09-21 a Monday.
	it('week start Monday (1)', () => {
		expect(weekStart('2026-03-29', 1)).toBe('2026-03-23'); // Sunday belongs to the week started Mon
		expect(weekStart('2026-09-21', 1)).toBe('2026-09-21'); // Monday itself
		expect(weekStart('2026-09-27', 1)).toBe('2026-09-21');
	});
	it('week start Sunday (0)', () => {
		expect(weekStart('2026-03-29', 0)).toBe('2026-03-29'); // Sunday itself
		expect(weekStart('2026-09-21', 0)).toBe('2026-09-20'); // Monday belongs to the week started Sun
		expect(weekStart('2026-09-26', 0)).toBe('2026-09-20');
	});
	it('week start Saturday (6)', () => {
		expect(weekStart('2026-03-29', 6)).toBe('2026-03-28'); // Sunday belongs to the week started Sat
		expect(weekStart('2026-09-21', 6)).toBe('2026-09-19');
		expect(weekStart('2026-09-25', 6)).toBe('2026-09-19'); // Friday still in the same week
	});
});

describe('monthStart / monthEnd', () => {
	it('covers regular and leap Februaries', () => {
		expect(monthStart('2026-09-21')).toBe('2026-09-01');
		expect(monthEnd('2026-09-21')).toBe('2026-09-30');
		expect(monthEnd('2026-02-10')).toBe('2026-02-28');
		expect(monthEnd('2024-02-10')).toBe('2024-02-29');
		expect(monthEnd('2026-12-15')).toBe('2026-12-31');
		expect(monthEnd('2026-01-15')).toBe('2026-01-31');
	});
});

describe('isoWeekNumber', () => {
	it('computes ISO-8601 week numbers at year boundaries', () => {
		expect(isoWeekNumber('2026-01-01')).toBe(1); // Thursday -> ISO week 1
		expect(isoWeekNumber('2025-12-29')).toBe(1); // Monday of ISO week 1/2026
		expect(isoWeekNumber('2025-12-28')).toBe(52); // Sunday of ISO week 52/2025
		expect(isoWeekNumber('2024-12-30')).toBe(1); // Monday of ISO week 1/2025
		expect(isoWeekNumber('2026-09-21')).toBe(39);
	});
});

describe('formatDe', () => {
	it('formats German styles', () => {
		expect(formatDe('2026-09-21', 'short')).toBe('Mo., 21. Sept.');
		expect(formatDe('2026-09-21', 'dayMonth')).toBe('21. Sept.');
		expect(formatDe('2026-09-21', 'long')).toBe('Montag, 21. September 2026');
	});
	it('defaults to short', () => {
		expect(formatDe('2026-09-21')).toBe('Mo., 21. Sept.');
	});
});
