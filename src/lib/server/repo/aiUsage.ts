import { getDb } from '../db.js';

// Only SQL for the ai_usage table lives here (SPEC 16): one row per
// (user_id, day), counting LLM parse calls for the daily cap (SPEC 9.3).

export function countFor(userId: string, day: string): number {
	const row = getDb()
		.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?')
		.get(userId, day) as { count: number } | undefined;
	return row?.count ?? 0;
}

// Read + increment before an LLM call (SPEC 9.3): over the limit nothing is
// written and false is returned, otherwise the counter is incremented and
// the call may proceed. SQLite is synchronous and single-process here, so
// the check and the increment cannot interleave.
export function consume(userId: string, day: string, limit: number): boolean {
	if (countFor(userId, day) >= limit) return false;
	getDb()
		.prepare(
			`INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1)
			 ON CONFLICT (user_id, day) DO UPDATE SET count = count + 1`
		)
		.run(userId, day);
	return true;
}
