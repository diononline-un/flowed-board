// In-memory rate limiting with a sliding window (SPEC 6.5). Single-process
// by design (SPEC 3: one process, one file), so no external store is needed.

export interface RateLimitResult {
	allowed: boolean;
	// Seconds until the oldest hit leaves the window; for Retry-After.
	retryAfterSec: number;
}

export interface RateLimiter {
	check(key: string, now?: number): RateLimitResult;
	reset(): void;
}

export function createLimiter(limit: number, windowMs: number): RateLimiter {
	const hits = new Map<string, number[]>();
	let operations = 0;

	function sweep(cutoff: number): void {
		for (const [key, timestamps] of hits) {
			const kept = timestamps.filter((t) => t > cutoff);
			if (kept.length === 0) hits.delete(key);
			else hits.set(key, kept);
		}
	}

	return {
		check(key: string, now: number = Date.now()): RateLimitResult {
			const cutoff = now - windowMs;
			const timestamps = (hits.get(key) ?? []).filter((t) => t > cutoff);
			if (timestamps.length >= limit) {
				hits.set(key, timestamps);
				const oldest = timestamps[0] ?? now;
				return {
					allowed: false,
					retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
				};
			}
			timestamps.push(now);
			hits.set(key, timestamps);
			// Occasional full sweep keeps the map bounded.
			operations += 1;
			if (operations % 500 === 0) sweep(cutoff);
			return { allowed: true, retryAfterSec: 0 };
		},
		reset(): void {
			hits.clear();
		}
	};
}

// Limits from the SPEC 6.5 table. The capture limiter is built now and
// wired into the capture endpoints in M3.
export const loginIpLimiter = createLimiter(10, 15 * 60_000); // 10 / 15 min per IP
export const loginUserLimiter = createLimiter(5, 15 * 60_000); // 5 / 15 min per username+IP
export const registerIpLimiter = createLimiter(5, 3_600_000); // 5 / hour per IP
export const recoverUserLimiter = createLimiter(5, 3_600_000); // 5 / hour per username
export const recoverIpLimiter = createLimiter(20, 3_600_000); // 20 / hour per IP
export const captureUserLimiter = createLimiter(5, 60_000); // 5 / min per user
