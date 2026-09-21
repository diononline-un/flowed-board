import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as usersRepo from './users.js';
import * as goalsRepo from './goals.js';
import type { UserRow } from '$lib/shared/types.js';

// CRUD + soft delete/restore + tenant separation (SPEC 6.6) against
// :memory: with real migrations.

let db: SqliteDatabase;

function makeUser(username: string): UserRow {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	return usersRepo.getById(user.id)!;
}

describe('goals repo', () => {
	it('creates goals with defaults and auto-incrementing positions', () => {
		db = useTestDb();
		const user = makeUser('goal-a');
		const first = goalsRepo.createGoal(user.id, { title: 'Erstes Ziel' });
		const second = goalsRepo.createGoal(user.id, {
			title: 'Zweites Ziel',
			color: 'mint',
			targetDate: '2027-01-01'
		});
		expect(first.status).toBe('active');
		expect(first.color).toBe('butter');
		expect(first.position).toBe(1);
		expect(second.position).toBe(2);
		expect(second.color).toBe('mint');
		expect(second.targetDate).toBe('2027-01-01');
		expect(goalsRepo.listGoals(user.id).map((g) => g.id)).toEqual([first.id, second.id]);
	});

	it('updates fields and tracks completed_at via status', () => {
		db = useTestDb();
		const user = makeUser('goal-b');
		const goal = goalsRepo.createGoal(user.id, { title: 'Titel' });
		const renamed = goalsRepo.updateGoal(user.id, goal.id, {
			title: 'Neu',
			note: 'Notiz',
			horizonOverride: 'long'
		});
		expect(renamed?.title).toBe('Neu');
		expect(renamed?.note).toBe('Notiz');
		expect(renamed?.horizonOverride).toBe('long');

		const done = goalsRepo.updateGoal(user.id, goal.id, { status: 'done' });
		expect(done?.status).toBe('done');
		expect(done?.completedAt).not.toBeNull();

		const active = goalsRepo.updateGoal(user.id, goal.id, { status: 'active' });
		expect(active?.status).toBe('active');
		expect(active?.completedAt).toBeNull();

		// null clears nullable fields
		const cleared = goalsRepo.updateGoal(user.id, goal.id, { note: null, horizonOverride: null });
		expect(cleared?.note).toBeNull();
		expect(cleared?.horizonOverride).toBeNull();
	});

	it('soft-deletes and restores goals', () => {
		db = useTestDb();
		const user = makeUser('goal-c');
		const goal = goalsRepo.createGoal(user.id, { title: 'Weg damit' });
		const deleted = goalsRepo.softDeleteGoal(user.id, goal.id);
		expect(deleted?.deletedAt).not.toBeNull();
		expect(goalsRepo.listGoals(user.id)).toEqual([]);
		// double delete is a no-op
		expect(goalsRepo.softDeleteGoal(user.id, goal.id)).toBeNull();

		const restored = goalsRepo.restoreGoal(user.id, goal.id);
		expect(restored?.deletedAt).toBeNull();
		expect(goalsRepo.listGoals(user.id)).toHaveLength(1);
		// double restore is a no-op
		expect(goalsRepo.restoreGoal(user.id, goal.id)).toBeNull();
	});

	it('updates fail on deleted goals', () => {
		db = useTestDb();
		const user = makeUser('goal-d');
		const goal = goalsRepo.createGoal(user.id, { title: 'Alt' });
		goalsRepo.softDeleteGoal(user.id, goal.id);
		expect(goalsRepo.updateGoal(user.id, goal.id, { title: 'Neu' })).toBeNull();
	});
});

describe('goals repo tenant separation (SPEC 6.6)', () => {
	it('user B cannot read, change, delete or restore user A goals', () => {
		db = useTestDb();
		const userA = makeUser('goal-user-a');
		const userB = makeUser('goal-user-b');
		const goalA = goalsRepo.createGoal(userA.id, { title: 'A-Ziel' });
		goalsRepo.createGoal(userB.id, { title: 'B-Ziel' });

		expect(goalsRepo.getGoal(userB.id, goalA.id)).toBeNull();
		expect(goalsRepo.updateGoal(userB.id, goalA.id, { title: ' gekapert' })).toBeNull();
		expect(goalsRepo.softDeleteGoal(userB.id, goalA.id)).toBeNull();
		expect(goalsRepo.restoreGoal(userB.id, goalA.id)).toBeNull();

		// A is untouched
		const after = goalsRepo.getGoal(userA.id, goalA.id);
		expect(after?.title).toBe('A-Ziel');
		expect(after?.deleted_at).toBeNull();

		// lists stay isolated
		expect(goalsRepo.listGoals(userA.id)).toHaveLength(1);
		expect(goalsRepo.listGoals(userB.id)).toHaveLength(1);
		expect(goalsRepo.listGoals(userB.id)[0]!.title).toBe('B-Ziel');
	});
});
