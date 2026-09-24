import { describe, expect, it } from 'vitest';
import { effectiveHorizon } from './horizon.js';
import { addDays } from './date.js';

// SPEC 5.2 table with boundary values (exactly 14/15/90/91 days out).
const TODAY = '2026-09-21';

describe('effectiveHorizon (SPEC 5.2)', () => {
	it('override always wins, regardless of date', () => {
		expect(
			effectiveHorizon({ horizon_override: 'long', date: TODAY }, TODAY)
		).toBe('long');
		expect(
			effectiveHorizon({ horizon_override: 'short', date: addDays(TODAY, 365) }, TODAY)
		).toBe('short');
		expect(
			effectiveHorizon({ horizon_override: 'mid', date: null, target_date: null }, TODAY)
		).toBe('mid');
	});

	it('no date and no target_date means short', () => {
		expect(effectiveHorizon({ horizon_override: null }, TODAY)).toBe('short');
		expect(effectiveHorizon({ horizon_override: null, date: null }, TODAY)).toBe('short');
		expect(
			effectiveHorizon({ horizon_override: null, date: null, target_date: null }, TODAY)
		).toBe('short');
	});

	it('date boundaries: 14 short, 15 mid, 90 mid, 91 long', () => {
		const at = (n: number) =>
			effectiveHorizon({ horizon_override: null, date: addDays(TODAY, n) }, TODAY);
		expect(at(0)).toBe('short'); // today itself
		expect(at(14)).toBe('short');
		expect(at(15)).toBe('mid');
		expect(at(90)).toBe('mid');
		expect(at(91)).toBe('long');
	});

	it('past dates are negative diffs and therefore short', () => {
		expect(
			effectiveHorizon({ horizon_override: null, date: addDays(TODAY, -1) }, TODAY)
		).toBe('short');
		expect(
			effectiveHorizon({ horizon_override: null, date: '2020-01-01' }, TODAY)
		).toBe('short');
	});

	it('target_date is used for goals without a date', () => {
		expect(
			effectiveHorizon({ horizon_override: null, target_date: addDays(TODAY, 60) }, TODAY)
		).toBe('mid');
		expect(
			effectiveHorizon({ horizon_override: null, target_date: addDays(TODAY, 200) }, TODAY)
		).toBe('long');
	});

	it('date wins over target_date when both exist', () => {
		expect(
			effectiveHorizon(
				{ horizon_override: null, date: addDays(TODAY, 200), target_date: addDays(TODAY, 3) },
				TODAY
			)
		).toBe('long');
	});
});
