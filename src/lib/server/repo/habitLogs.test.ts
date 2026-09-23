import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as usersRepo from './users.js';
import * as habitsRepo from './habits.js';
import * as habitLogsRepo from './habitLogs.js';
import * as postitsRepo from './postits.js';
import type { PublicHabit, UserRow } from '$lib/shared/types.js';

// Tap logs (SPEC 5.5, AC11) and the SPEC-5.3 post-it side effect, against
// :memory: with the real migrations.

let db: SqliteDatabase;
const TODAY = '2026-09-23';
const WEEK_START = 1;

function makeUser(username: string): UserRow {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	return usersRepo.getById(user.id)!;
}

function makeHabit(
	userId: string,
	overrides: Partial<{
		cadence: 'week' | 'month' | 'range';
		targetCount: number;
		maxPerDay: number;
		rangeStart: string | null;
		rangeEnd: string | null;
	}> = {}
): PublicHabit {
	return habitsRepo.createHabit(userId, {
		title: 'Laufen',
		cadence: overrides.cadence ?? 'week',
		targetCount: overrides.targetCount ?? 3,
		maxPerDay: overrides.maxPerDay ?? 1,
		rangeStart: overrides.rangeStart ?? null,
		rangeEnd: overrides.rangeEnd ?? null
	});
}

function tap(userId: string, habit: PublicHabit, date: string, delta: 1 | -1) {
	return habitLogsRepo.tapLog(userId, habit, date, delta, TODAY, WEEK_START);
}

describe('habitLogs repo', () => {
	it('adds one log per tap and counts the day', () => {
		db = useTestDb();
		const user = makeUser('hl-a');
		const habit = makeHabit(user.id, { maxPerDay: 2 });
		const first = tap(user.id, habit, TODAY, 1);
		expect(first.ok).toBe(true);
		expect(first.ok && first.dayCount).toBe(1);
		const second = tap(user.id, habit, TODAY, 1);
		expect(second.ok && second.dayCount).toBe(2);
		expect(second.ok && second.todayCount).toBe(2);
		expect(habitLogsRepo.listLogDates(user.id, habit.id)).toEqual([TODAY, TODAY]);
	});

	it('blocks further taps once max_per_day is reached (AC11)', () => {
		db = useTestDb();
		const user = makeUser('hl-b');
		const habit = makeHabit(user.id, { maxPerDay: 2 });
		tap(user.id, habit, TODAY, 1);
		tap(user.id, habit, TODAY, 1);
		const third = tap(user.id, habit, TODAY, 1);
		expect(third.ok).toBe(false);
		expect(third.ok ? '' : third.reason).toBe('maxPerDay');
		expect(habitLogsRepo.countForDay(user.id, habit.id, TODAY)).toBe(2);
	});

	it('removes the newest tap log of the day on delta -1', () => {
		db = useTestDb();
		const user = makeUser('hl-c');
		const habit = makeHabit(user.id, { maxPerDay: 3 });
		tap(user.id, habit, TODAY, 1);
		tap(user.id, habit, TODAY, 1);
		const removed = tap(user.id, habit, TODAY, -1);
		expect(removed.ok).toBe(true);
		expect(removed.ok && removed.removed).toBe(true);
		expect(removed.ok && removed.dayCount).toBe(1);
		// second removal clears the remaining tap, the third has nothing left
		expect(tap(user.id, habit, TODAY, -1).ok).toBe(true);
		const empty = tap(user.id, habit, TODAY, -1);
		expect(empty.ok).toBe(false);
		expect(empty.ok ? '' : empty.reason).toBe('noLog');
		expect(habitLogsRepo.listLogDates(user.id, habit.id)).toHaveLength(0);
	});

	it('never touches post-it logs when removing a tap log', () => {
		db = useTestDb();
		const user = makeUser('hl-d');
		const habit = makeHabit(user.id, { maxPerDay: 3 });
		const postit = postitsRepo.createPostit(user.id, {
			title: 'Laufen gehen',
			date: TODAY,
			habitId: habit.id
		});
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);
		tap(user.id, habit, TODAY, 1);
		const removed = tap(user.id, habit, TODAY, -1);
		expect(removed.ok).toBe(true);
		const remaining = habitLogsRepo.listForHabit(user.id, habit.id);
		expect(remaining).toHaveLength(1);
		expect(remaining[0]!.source).toBe('postit');
	});

	it('rejects future dates and anything older than 60 days (SPEC 5.5)', () => {
		db = useTestDb();
		const user = makeUser('hl-e');
		const habit = makeHabit(user.id, { maxPerDay: 2 });
		const future = tap(user.id, habit, '2026-09-24', 1);
		expect(future.ok ? '' : future.reason).toBe('future');
		const old = tap(user.id, habit, '2026-07-24', 1);
		expect(old.ok ? '' : old.reason).toBe('tooOld');
		// exactly 60 days back is still fine
		const edge = tap(user.id, habit, '2026-07-25', 1);
		expect(edge.ok).toBe(true);
		expect(habitLogsRepo.listForHabit(user.id, habit.id).map((log) => log.logDate)).toEqual([
			'2026-07-25'
		]);
	});

	it('rejects days outside the window of a range habit (422 path)', () => {
		db = useTestDb();
		const user = makeUser('hl-f');
		const habit = makeHabit(user.id, {
			cadence: 'range',
			targetCount: 10,
			rangeStart: '2026-09-01',
			rangeEnd: '2026-09-30'
		});
		const before = tap(user.id, habit, '2026-08-31', 1);
		expect(before.ok ? '' : before.reason).toBe('outsideRange');
		const inside = tap(user.id, habit, '2026-09-10', 1);
		expect(inside.ok).toBe(true);
		// week habits have no window restriction besides the 60-day rule
		const weekly = makeHabit(user.id, { maxPerDay: 1 });
		expect(tap(user.id, weekly, '2026-09-01', 1).ok).toBe(true);
	});

	it('filters by from/to for the calendar grid', () => {
		db = useTestDb();
		const user = makeUser('hl-g');
		const habit = makeHabit(user.id, { maxPerDay: 1 });
		tap(user.id, habit, '2026-09-01', 1);
		tap(user.id, habit, '2026-09-10', 1);
		tap(user.id, habit, '2026-09-20', 1);
		const ranged = habitLogsRepo.listForHabit(user.id, habit.id, {
			from: '2026-09-05',
			to: '2026-09-15'
		});
		expect(ranged.map((log) => log.logDate)).toEqual(['2026-09-10']);
		expect(habitLogsRepo.listForHabit(user.id, habit.id)).toHaveLength(3);
	});

	it('keeps the SPEC 5.3 post-it side effect intact', () => {
		db = useTestDb();
		const user = makeUser('hl-h');
		const habit = makeHabit(user.id, { targetCount: 3 });
		const postit = postitsRepo.createPostit(user.id, {
			title: 'Laufen',
			date: TODAY,
			habitId: habit.id
		});
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);
		expect(habitLogsRepo.countForDay(user.id, habit.id, TODAY)).toBe(1);
		postitsRepo.updatePostit(user.id, postit.id, { done: false }, TODAY);
		expect(habitLogsRepo.countForDay(user.id, habit.id, TODAY)).toBe(0);
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);
		postitsRepo.softDeletePostit(user.id, postit.id, TODAY);
		expect(habitLogsRepo.countForDay(user.id, habit.id, TODAY)).toBe(0);
	});

	it('keeps users apart: B cannot log, read or delete A logs', () => {
		db = useTestDb();
		const userA = makeUser('hl-user-a');
		const userB = makeUser('hl-user-b');
		const habitA = makeHabit(userA.id, { maxPerDay: 2 });
		tap(userA.id, habitA, TODAY, 1);

		expect(habitLogsRepo.countForDay(userB.id, habitA.id, TODAY)).toBe(0);
		expect(habitLogsRepo.listForHabit(userB.id, habitA.id)).toHaveLength(0);
		expect(habitLogsRepo.listLogDates(userB.id, habitA.id)).toHaveLength(0);
		const foreignRemoval = habitLogsRepo.tapLog(
			userB.id,
			habitA,
			TODAY,
			-1,
			TODAY,
			WEEK_START
		);
		expect(foreignRemoval.ok).toBe(false);
		expect(habitLogsRepo.countForDay(userA.id, habitA.id, TODAY)).toBe(1);
		expect(habitLogsRepo.removeByPostit(userB.id, 'any')).toBe(0);
		expect(habitLogsRepo.listByPostit(userB.id, 'any')).toHaveLength(0);
	});
});
