import { describe, expect, it } from 'vitest';
import { goalProgress, keyResultProgress } from './progress.js';

// SPEC 5.4 table with boundary values.

describe('keyResultProgress (SPEC 5.4)', () => {
	it('number: linear progress between start and target', () => {
		expect(
			keyResultProgress({ kind: 'number', start_value: 0, target_value: 10, current_value: 5 })
		).toBe(0.5);
		expect(
			keyResultProgress({ kind: 'number', start_value: 10, target_value: 20, current_value: 10 })
		).toBe(0);
	});

	it('number: clamps below 0 and above 1', () => {
		expect(
			keyResultProgress({ kind: 'number', start_value: 5, target_value: 10, current_value: 0 })
		).toBe(0);
		expect(
			keyResultProgress({ kind: 'number', start_value: 0, target_value: 10, current_value: 99 })
		).toBe(1);
	});

	it('number: target == start -> 1 when current >= target, else 0', () => {
		expect(
			keyResultProgress({ kind: 'number', start_value: 7, target_value: 7, current_value: 7 })
		).toBe(1);
		expect(
			keyResultProgress({ kind: 'number', start_value: 7, target_value: 7, current_value: 8 })
		).toBe(1);
		expect(
			keyResultProgress({ kind: 'number', start_value: 7, target_value: 7, current_value: 6 })
		).toBe(0);
	});

	it('check: 0 or 1', () => {
		expect(
			keyResultProgress({ kind: 'check', start_value: 0, target_value: 1, current_value: 0 })
		).toBe(0);
		expect(
			keyResultProgress({ kind: 'check', start_value: 0, target_value: 1, current_value: 1 })
		).toBe(1);
	});
});

describe('goalProgress (SPEC 5.4)', () => {
	const kr = (current: number, deleted: string | null = null) => ({
		kind: 'number' as const,
		start_value: 0,
		target_value: 10,
		current_value: current,
		deleted_at: deleted
	});
	const postit = (done: string | null, deleted: string | null = null) => ({
		done_at: done,
		deleted_at: deleted
	});

	it('mean of non-deleted KRs', () => {
		expect(goalProgress([kr(10), kr(0)], [])).toBe(0.5);
		expect(goalProgress([kr(10), kr(10), kr(0)], [])).toBeCloseTo(2 / 3);
	});

	it('deleted KRs are excluded from the mean', () => {
		expect(goalProgress([kr(10), kr(0, '2026-01-01T00:00:00.000Z')], [])).toBe(1);
	});

	it('without KRs: done / all linked non-deleted post-its', () => {
		const postits = [
			postit('2026-09-01T00:00:00.000Z'),
			postit(null),
			postit(null, '2026-01-01T00:00:00.000Z') // deleted, excluded
		];
		expect(goalProgress([], postits)).toBe(0.5);
	});

	it('KRs take precedence over post-its', () => {
		expect(goalProgress([kr(10)], [postit(null)])).toBe(1);
	});

	it('empty KR list and no post-its: 0', () => {
		expect(goalProgress([], [])).toBe(0);
		expect(goalProgress([kr(5, '2026-01-01T00:00:00.000Z')], [])).toBe(0);
	});
});
