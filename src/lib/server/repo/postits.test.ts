import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as usersRepo from './users.js';
import * as goalsRepo from './goals.js';
import * as habitsRepo from './habits.js';
import * as habitLogsRepo from './habitLogs.js';
import * as postitsRepo from './postits.js';
import type { UserRow } from '$lib/shared/types.js';

// CRUD + filters + tenant separation (SPEC 6.6) + the SPEC 5.3 habit-log
// side effect, against :memory: with real migrations.

let db: SqliteDatabase;
const TODAY = '2026-09-21';

function makeUser(username: string): UserRow {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	return usersRepo.getById(user.id)!;
}

// Habits get their full create path in M4; tests insert rows directly.
function makeHabit(userId: string, maxPerDay = 1): string {
	const id = randomUUID();
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO habits (
			id, user_id, goal_id, title, color, cadence, target_count, max_per_day,
			position, is_example, created_at, updated_at
		) VALUES (?, ?, NULL, ?, 'mint', 'week', 3, ?, 0, 0, ?, ?)`
	).run(id, userId, `Habit ${id.slice(0, 6)}`, maxPerDay, now, now);
	return id;
}

describe('postits repo', () => {
	it('creates post-its with defaults and auto-incrementing positions', () => {
		db = useTestDb();
		const user = makeUser('po-a');
		const first = postitsRepo.createPostit(user.id, { title: 'Eins' });
		const second = postitsRepo.createPostit(user.id, {
			title: 'Zwei',
			date: '2026-09-25',
			time: '09:30',
			durationMin: 45
		});
		expect(first.doneAt).toBeNull();
		expect(first.color).toBeNull();
		expect(first.position).toBe(1);
		expect(second.position).toBe(2);
		expect(second.date).toBe('2026-09-25');
		expect(second.time).toBe('09:30');
		expect(second.durationMin).toBe(45);
	});

	it('filters lists by date range and goal', () => {
		db = useTestDb();
		const user = makeUser('po-b');
		const goal = goalsRepo.createGoal(user.id, { title: 'Ziel' });
		postitsRepo.createPostit(user.id, { title: 'ohne Datum' });
		postitsRepo.createPostit(user.id, { title: 'drin', date: '2026-09-22' });
		postitsRepo.createPostit(user.id, { title: 'raus', date: '2026-10-10' });
		postitsRepo.createPostit(user.id, { title: 'mit Ziel', goalId: goal.id });

		const ranged = postitsRepo.listPostits(user.id, { from: '2026-09-01', to: '2026-09-30' });
		expect(ranged.map((p) => p.title)).toEqual(['drin']);

		const byGoal = postitsRepo.listPostits(user.id, { goalId: goal.id });
		expect(byGoal.map((p) => p.title)).toEqual(['mit Ziel']);
	});

	it('filters by effective horizon using the provided today', () => {
		db = useTestDb();
		const user = makeUser('po-c');
		postitsRepo.createPostit(user.id, { title: 'bald', date: '2026-09-25' });
		postitsRepo.createPostit(user.id, { title: 'fern', date: '2027-03-01' });
		postitsRepo.createPostit(user.id, {
			title: 'gepinnt',
			date: '2026-09-25',
			horizonOverride: 'long'
		});

		const shortLane = postitsRepo.listPostits(user.id, { horizon: 'short', today: TODAY });
		expect(shortLane.map((p) => p.title)).toEqual(['bald']);
		const longLane = postitsRepo.listPostits(user.id, { horizon: 'long', today: TODAY });
		expect(longLane.map((p) => p.title)).toEqual(['fern', 'gepinnt']);
	});

	it('toggles done and reopens', () => {
		db = useTestDb();
		const user = makeUser('po-d');
		const postit = postitsRepo.createPostit(user.id, { title: 'Task' });
		const done = postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);
		expect(done?.doneAt).not.toBeNull();
		// idempotent: done again keeps the original timestamp
		const again = postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);
		expect(again?.doneAt).toBe(done?.doneAt);
		const reopened = postitsRepo.updatePostit(user.id, postit.id, { done: false }, TODAY);
		expect(reopened?.doneAt).toBeNull();
	});

	it('soft-deletes and restores', () => {
		db = useTestDb();
		const user = makeUser('po-e');
		const postit = postitsRepo.createPostit(user.id, { title: 'weg' });
		const deleted = postitsRepo.softDeletePostit(user.id, postit.id, TODAY);
		expect(deleted?.deletedAt).not.toBeNull();
		expect(postitsRepo.listPostits(user.id)).toEqual([]);
		const restored = postitsRepo.restorePostit(user.id, postit.id, TODAY);
		expect(restored?.deletedAt).toBeNull();
		expect(postitsRepo.listPostits(user.id)).toHaveLength(1);
	});

	it('reorders in batch and only touches own rows', () => {
		db = useTestDb();
		const userA = makeUser('po-user-a');
		const userB = makeUser('po-user-b');
		const a1 = postitsRepo.createPostit(userA.id, { title: 'a1' });
		const a2 = postitsRepo.createPostit(userA.id, { title: 'a2' });
		const b1 = postitsRepo.createPostit(userB.id, { title: 'b1' });

		const updated = postitsRepo.reorderPostits(userA.id, [
			{ id: a2.id, position: 0.5 },
			{ id: a1.id, position: 1.5 },
			{ id: b1.id, position: 99 } // foreign: skipped
		]);
		expect(updated).toHaveLength(2);
		expect(postitsRepo.getPostit(userA.id, a2.id)?.position).toBe(0.5);
		expect(postitsRepo.getPostit(userA.id, a1.id)?.position).toBe(1.5);
		expect(postitsRepo.getPostit(userB.id, b1.id)?.position).toBe(1); // untouched
	});

	it('cleanup applies all four actions', () => {
		db = useTestDb();
		const user = makeUser('po-f');
		const p1 = postitsRepo.createPostit(user.id, { title: 'p1', date: '2026-09-10' });
		const p2 = postitsRepo.createPostit(user.id, { title: 'p2', date: '2026-09-10' });
		const p3 = postitsRepo.createPostit(user.id, { title: 'p3', date: '2026-09-10' });
		const p4 = postitsRepo.createPostit(user.id, { title: 'p4', date: '2026-09-10' });

		postitsRepo.cleanupPostits(user.id, [p1.id], 'today', TODAY);
		expect(postitsRepo.getPostit(user.id, p1.id)?.date).toBe(TODAY);

		postitsRepo.cleanupPostits(user.id, [p2.id], 'plusWeek', TODAY);
		expect(postitsRepo.getPostit(user.id, p2.id)?.date).toBe('2026-09-17');

		postitsRepo.cleanupPostits(user.id, [p3.id], 'done', TODAY);
		expect(postitsRepo.getPostit(user.id, p3.id)?.done_at).not.toBeNull();

		postitsRepo.cleanupPostits(user.id, [p4.id], 'delete', TODAY);
		expect(postitsRepo.getPostit(user.id, p4.id)?.deleted_at).not.toBeNull();
	});
});

describe('postits repo habit side effect (SPEC 5.3)', () => {
	it('complete creates exactly one log, reopen removes it, restore re-creates', () => {
		db = useTestDb();
		const user = makeUser('po-habit-a');
		const habitId = makeHabit(user.id);
		const postit = postitsRepo.createPostit(user.id, {
			title: 'Sport',
			habitId,
			date: '2026-09-20'
		});

		// complete -> one log with log_date = postit date
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);
		let logs = habitLogsRepo.listByPostit(user.id, postit.id);
		expect(logs).toHaveLength(1);
		expect(logs[0]!.source).toBe('postit');
		expect(logs[0]!.log_date).toBe('2026-09-20');

		// reopen -> log removed
		postitsRepo.updatePostit(user.id, postit.id, { done: false }, TODAY);
		expect(habitLogsRepo.listByPostit(user.id, postit.id)).toHaveLength(0);

		// complete again -> log back (exactly one)
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);
		expect(habitLogsRepo.listByPostit(user.id, postit.id)).toHaveLength(1);

		// soft-delete of a done post-it -> log removed
		postitsRepo.softDeletePostit(user.id, postit.id, TODAY);
		expect(habitLogsRepo.listByPostit(user.id, postit.id)).toHaveLength(0);

		// restore of the done post-it -> log re-created
		postitsRepo.restorePostit(user.id, postit.id, TODAY);
		expect(habitLogsRepo.listByPostit(user.id, postit.id)).toHaveLength(1);
	});

	it('uses today as log_date when the post-it has no date', () => {
		db = useTestDb();
		const user = makeUser('po-habit-b');
		const habitId = makeHabit(user.id);
		const postit = postitsRepo.createPostit(user.id, { title: 'irgendwann', habitId });
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);
		const logs = habitLogsRepo.listByPostit(user.id, postit.id);
		expect(logs).toHaveLength(1);
		expect(logs[0]!.log_date).toBe(TODAY);
	});

	it('respects max_per_day (no extra log when the day is full)', () => {
		db = useTestDb();
		const user = makeUser('po-habit-c');
		const habitId = makeHabit(user.id, 1);
		// one tap log already fills the day
		db.prepare(
			`INSERT INTO habit_logs (id, user_id, habit_id, log_date, source, created_at)
			 VALUES (?, ?, ?, ?, 'tap', ?)`
		).run(randomUUID(), user.id, habitId, '2026-09-20', new Date().toISOString());

		const postit = postitsRepo.createPostit(user.id, {
			title: 'zu spät',
			habitId,
			date: '2026-09-20'
		});
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);
		expect(habitLogsRepo.listByPostit(user.id, postit.id)).toHaveLength(0);
		expect(habitLogsRepo.countForDay(user.id, habitId, '2026-09-20')).toBe(1);
	});

	it('cleanup done also triggers the side effect', () => {
		db = useTestDb();
		const user = makeUser('po-habit-d');
		const habitId = makeHabit(user.id);
		const postit = postitsRepo.createPostit(user.id, {
			title: 'überfällig',
			habitId,
			date: '2026-09-01'
		});
		postitsRepo.cleanupPostits(user.id, [postit.id], 'done', TODAY);
		const logs = habitLogsRepo.listByPostit(user.id, postit.id);
		expect(logs).toHaveLength(1);
		expect(logs[0]!.log_date).toBe('2026-09-01');
	});

	// M7 polish (review finding M2): moving the date of a *completed* post-it
	// has to move its log too, otherwise the counter points at the old day.
	it('moves the log when the date of a done post-it changes', () => {
		db = useTestDb();
		const user = makeUser('po-habit-e');
		const habitId = makeHabit(user.id);
		const postit = postitsRepo.createPostit(user.id, {
			title: 'Training',
			habitId,
			date: '2026-09-19'
		});
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);
		expect(habitLogsRepo.countForDay(user.id, habitId, '2026-09-19')).toBe(1);

		postitsRepo.updatePostit(user.id, postit.id, { date: '2026-09-20' }, TODAY);

		const logs = habitLogsRepo.listByPostit(user.id, postit.id);
		expect(logs).toHaveLength(1);
		expect(logs[0]!.log_date).toBe('2026-09-20');
		expect(habitLogsRepo.countForDay(user.id, habitId, '2026-09-19')).toBe(0);
	});

	it('re-links the log when the habit of a done post-it changes', () => {
		db = useTestDb();
		const user = makeUser('po-habit-f');
		const firstHabit = makeHabit(user.id);
		const secondHabit = makeHabit(user.id);
		const postit = postitsRepo.createPostit(user.id, {
			title: 'Lesen',
			habitId: firstHabit,
			date: '2026-09-21'
		});
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);

		postitsRepo.updatePostit(user.id, postit.id, { habitId: secondHabit }, TODAY);

		const logs = habitLogsRepo.listByPostit(user.id, postit.id);
		expect(logs).toHaveLength(1);
		expect(logs[0]!.habit_id).toBe(secondHabit);
		expect(habitLogsRepo.countForDay(user.id, firstHabit, '2026-09-21')).toBe(0);
		expect(habitLogsRepo.countForDay(user.id, secondHabit, '2026-09-21')).toBe(1);
	});

	it('drops the log when a done post-it loses its habit', () => {
		db = useTestDb();
		const user = makeUser('po-habit-g');
		const habitId = makeHabit(user.id);
		const postit = postitsRepo.createPostit(user.id, {
			title: 'Dehnen',
			habitId,
			date: '2026-09-21'
		});
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);

		postitsRepo.updatePostit(user.id, postit.id, { habitId: null }, TODAY);

		expect(habitLogsRepo.listByPostit(user.id, postit.id)).toHaveLength(0);
		expect(habitLogsRepo.countForDay(user.id, habitId, '2026-09-21')).toBe(0);
	});

	it('leaves an open post-it without a log when its date moves', () => {
		db = useTestDb();
		const user = makeUser('po-habit-h');
		const habitId = makeHabit(user.id);
		const postit = postitsRepo.createPostit(user.id, {
			title: 'offen',
			habitId,
			date: '2026-09-21'
		});
		postitsRepo.updatePostit(user.id, postit.id, { date: '2026-09-22' }, TODAY);
		expect(habitLogsRepo.listByPostit(user.id, postit.id)).toHaveLength(0);
	});
});

describe('postits repo tenant separation (SPEC 6.6)', () => {
	it('user B cannot read, change, delete or restore user A post-its', () => {
		db = useTestDb();
		const userA = makeUser('po-user-c');
		const userB = makeUser('po-user-d');
		const postitA = postitsRepo.createPostit(userA.id, { title: 'A-Post-it' });
		postitsRepo.createPostit(userB.id, { title: 'B-Post-it' });

		expect(postitsRepo.getPostit(userB.id, postitA.id)).toBeNull();
		expect(postitsRepo.updatePostit(userB.id, postitA.id, { title: 'gekapert' }, TODAY)).toBeNull();
		expect(postitsRepo.updatePostit(userB.id, postitA.id, { done: true }, TODAY)).toBeNull();
		expect(postitsRepo.softDeletePostit(userB.id, postitA.id, TODAY)).toBeNull();
		expect(postitsRepo.restorePostit(userB.id, postitA.id, TODAY)).toBeNull();
		expect(postitsRepo.cleanupPostits(userB.id, [postitA.id], 'delete', TODAY)).toEqual([]);

		const after = postitsRepo.getPostit(userA.id, postitA.id);
		expect(after?.title).toBe('A-Post-it');
		expect(after?.deleted_at).toBeNull();
		expect(after?.done_at).toBeNull();

		expect(postitsRepo.listPostits(userA.id)).toHaveLength(1);
		expect(postitsRepo.listPostits(userB.id)).toHaveLength(1);
	});

	it('habit logs stay isolated per user', () => {
		db = useTestDb();
		const userA = makeUser('po-user-e');
		const userB = makeUser('po-user-f');
		const habitA = makeHabit(userA.id);
		const postitA = postitsRepo.createPostit(userA.id, { title: 'A', habitId: habitA });
		postitsRepo.updatePostit(userA.id, postitA.id, { done: true }, TODAY);

		// B sees no logs of A and cannot remove them via B's postit id space
		expect(habitLogsRepo.removeByPostit(userB.id, postitA.id)).toBe(0);
		expect(habitLogsRepo.listByPostit(userA.id, postitA.id)).toHaveLength(1);
		// foreign habit lookup yields null
		expect(habitsRepo.getHabit(userB.id, habitA)).toBeNull();
	});
});
