import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as usersRepo from './users.js';
import type { PublicUser } from '$lib/shared/types.js';
import * as aiUsageRepo from './aiUsage.js';

// Consumption logic of the daily LLM cap (SPEC 9.3) and its purge boundary
// (SPEC 6.8) against :memory: with the real migrations. The counter is kept
// per (user_id, day): one user's calls may never eat another user's budget.

const DAY = '2026-09-24';

let db: SqliteDatabase;

function makeUser(username: string): PublicUser {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	return user;
}

describe('aiUsage repo', () => {
	it('starts at zero and counts one call per consume', () => {
		db = useTestDb();
		const user = makeUser('usage-a');

		expect(aiUsageRepo.countFor(user.id, DAY)).toBe(0);
		expect(aiUsageRepo.countFor(user.id, '2026-09-25')).toBe(0);

		expect(aiUsageRepo.consume(user.id, DAY, 3)).toBe(true);
		expect(aiUsageRepo.consume(user.id, DAY, 3)).toBe(true);
		expect(aiUsageRepo.countFor(user.id, DAY)).toBe(2);
		// A different day has its own counter row.
		expect(aiUsageRepo.countFor(user.id, '2026-09-25')).toBe(0);
	});

	it('refuses the call over the limit and writes nothing', () => {
		db = useTestDb();
		const user = makeUser('usage-b');

		expect(aiUsageRepo.consume(user.id, DAY, 2)).toBe(true);
		expect(aiUsageRepo.consume(user.id, DAY, 2)).toBe(true);
		// At the limit the third call is refused and the count stays put.
		expect(aiUsageRepo.consume(user.id, DAY, 2)).toBe(false);
		expect(aiUsageRepo.countFor(user.id, DAY)).toBe(2);
		expect(
			db
				.prepare('SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = ?')
				.get(user.id)
		).toEqual({ n: 1 });
	});

	it('keeps the counters of two users apart (SPEC 6.6)', () => {
		db = useTestDb();
		const userA = makeUser('usage-c');
		const userB = makeUser('usage-d');

		expect(aiUsageRepo.consume(userA.id, DAY, 2)).toBe(true);
		expect(aiUsageRepo.consume(userA.id, DAY, 2)).toBe(true);
		expect(aiUsageRepo.countFor(userA.id, DAY)).toBe(2);
		// B's budget is untouched by A's calls.
		expect(aiUsageRepo.countFor(userB.id, DAY)).toBe(0);
		expect(aiUsageRepo.consume(userB.id, DAY, 2)).toBe(true);
		expect(aiUsageRepo.countFor(userB.id, DAY)).toBe(1);
		expect(aiUsageRepo.countFor(userA.id, DAY)).toBe(2);
	});

	it('purges days older than the cutoff and keeps the cutoff day', () => {
		db = useTestDb();
		const userA = makeUser('usage-e');
		const userB = makeUser('usage-f');
		aiUsageRepo.consume(userA.id, '2026-09-16', 30);
		aiUsageRepo.consume(userA.id, '2026-09-17', 30);
		aiUsageRepo.consume(userB.id, '2026-09-16', 30);
		aiUsageRepo.consume(userB.id, '2026-09-24', 30);

		// Strictly older than the cutoff day (DECISIONS: `day < cutoff`).
		expect(aiUsageRepo.purgeOlderThan('2026-09-17')).toBe(2);

		expect(aiUsageRepo.countFor(userA.id, '2026-09-16')).toBe(0);
		expect(aiUsageRepo.countFor(userA.id, '2026-09-17')).toBe(1);
		expect(aiUsageRepo.countFor(userB.id, '2026-09-16')).toBe(0);
		expect(aiUsageRepo.countFor(userB.id, '2026-09-24')).toBe(1);
		// A second run finds nothing left.
		expect(aiUsageRepo.purgeOlderThan('2026-09-17')).toBe(0);
	});

	it('cascades the counters when the user is deleted', () => {
		db = useTestDb();
		const user = makeUser('usage-g');
		aiUsageRepo.consume(user.id, DAY, 30);

		usersRepo.deleteUser(user.id);

		expect(db.prepare('SELECT COUNT(*) AS n FROM ai_usage').get()).toEqual({ n: 0 });
	});
});
