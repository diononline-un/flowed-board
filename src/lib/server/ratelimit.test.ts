import { describe, expect, it } from 'vitest';
import { createLimiter } from './ratelimit.js';

// Sliding-window in-memory limiter (SPEC 6.5).

describe('createLimiter', () => {
	it('allows up to the limit, then denies with Retry-After', () => {
		const limiter = createLimiter(3, 60_000);
		const t0 = 1_000_000;
		expect(limiter.check('k', t0).allowed).toBe(true);
		expect(limiter.check('k', t0 + 1).allowed).toBe(true);
		expect(limiter.check('k', t0 + 2).allowed).toBe(true);
		const denied = limiter.check('k', t0 + 3);
		expect(denied.allowed).toBe(false);
		expect(denied.retryAfterSec).toBeGreaterThan(0);
		expect(denied.retryAfterSec).toBeLessThanOrEqual(60);
	});

	it('denied hits do not extend the window (sliding)', () => {
		const limiter = createLimiter(2, 60_000);
		const t0 = 1_000_000;
		limiter.check('k', t0);
		limiter.check('k', t0 + 10_000);
		expect(limiter.check('k', t0 + 20_000).allowed).toBe(false);
		// Oldest hit leaves the window at t0 + 60s; then allowed again.
		expect(limiter.check('k', t0 + 60_001).allowed).toBe(true);
	});

	it('tracks keys independently', () => {
		const limiter = createLimiter(1, 60_000);
		const t0 = 1_000_000;
		expect(limiter.check('a', t0).allowed).toBe(true);
		expect(limiter.check('a', t0).allowed).toBe(false);
		expect(limiter.check('b', t0).allowed).toBe(true);
	});

	it('reset clears all buckets', () => {
		const limiter = createLimiter(1, 60_000);
		limiter.check('a');
		limiter.reset();
		expect(limiter.check('a').allowed).toBe(true);
	});
});
