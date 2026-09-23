import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as usersRepo from './users.js';
import * as goalsRepo from './goals.js';
import * as habitsRepo from './habits.js';
import type { UserRow } from '$lib/shared/types.js';

// CRUD, archive flag, goal linking and tenant separation (SPEC 6.6) against
// :memory: with the real migrations.

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

describe('habits repo', () => {
	it('creates habits with defaults and per-user positions', () => {
		db = useTestDb();
		const user = makeUser('ha-a');
		const first = habitsRepo.createHabit(user.id, {
			title: 'Laufen',
			cadence: 'week',
			targetCount: 3
		});
		const second = habitsRepo.createHabit(user.id, {
			title: 'Lesen',
			cadence: 'month',
			targetCount: 10,
			maxPerDay: 2,
			color: 'sky'
		});
		expect(first.color).toBe('mint');
		expect(first.maxPerDay).toBe(1);
		expect(first.position).toBe(1);
		expect(first.rangeStart).toBeNull();
		expect(first.archivedAt).toBeNull();
		expect(second.position).toBe(2);
		expect(second.maxPerDay).toBe(2);
		expect(second.color).toBe('sky');
		expect(habitsRepo.listHabits(user.id).map((habit) => habit.id)).toEqual([
			first.id,
			second.id
		]);
	});

	it('keeps range_start/range_end only for range habits', () => {
		db = useTestDb();
		const user = makeUser('ha-range');
		const ranged = habitsRepo.createHabit(user.id, {
			title: '100 Läufe',
			cadence: 'range',
			targetCount: 100,
			rangeStart: '2026-01-01',
			rangeEnd: '2026-12-31'
		});
		expect(ranged.rangeStart).toBe('2026-01-01');
		expect(ranged.rangeEnd).toBe('2026-12-31');
		// A week habit ignores range inputs (the CHECK constraint would reject
		// them otherwise) and switching back to week clears them again.
		const weekly = habitsRepo.createHabit(user.id, {
			title: 'Wöchentlich',
			cadence: 'week',
			targetCount: 2,
			rangeStart: '2026-01-01',
			rangeEnd: '2026-12-31'
		});
		expect(weekly.rangeStart).toBeNull();
		const switched = habitsRepo.updateHabit(user.id, ranged.id, { cadence: 'week' });
		expect(switched?.rangeStart).toBeNull();
		expect(switched?.rangeEnd).toBeNull();
	});

	it('updates fields, archives and restores', () => {
		db = useTestDb();
		const user = makeUser('ha-b');
		const habit = habitsRepo.createHabit(user.id, {
			title: 'Laufen',
			cadence: 'week',
			targetCount: 3
		});
		const updated = habitsRepo.updateHabit(user.id, habit.id, {
			title: 'Joggen',
			targetCount: 5,
			maxPerDay: 3,
			emoji: '🏃'
		});
		expect(updated?.title).toBe('Joggen');
		expect(updated?.targetCount).toBe(5);
		expect(updated?.maxPerDay).toBe(3);
		expect(updated?.emoji).toBe('🏃');

		const archived = habitsRepo.updateHabit(user.id, habit.id, { archived: true });
		expect(archived?.archivedAt).not.toBeNull();
		expect(habitsRepo.listHabits(user.id)).toHaveLength(0);
		expect(habitsRepo.listHabits(user.id, { includeArchived: true })).toHaveLength(1);
		expect(habitsRepo.getHabit(user.id, habit.id)?.id).toBe(habit.id);

		const restored = habitsRepo.updateHabit(user.id, habit.id, { archived: false });
		expect(restored?.archivedAt).toBeNull();
		expect(habitsRepo.listHabits(user.id)).toHaveLength(1);
	});

	it('soft-deletes and restores without leaking the row to lists', () => {
		db = useTestDb();
		const user = makeUser('ha-c');
		const habit = habitsRepo.createHabit(user.id, {
			title: 'Lesen',
			cadence: 'month',
			targetCount: 4
		});
		const deleted = habitsRepo.softDeleteHabit(user.id, habit.id);
		expect(deleted?.deletedAt).not.toBeNull();
		expect(habitsRepo.listHabits(user.id, { includeArchived: true })).toHaveLength(0);
		expect(habitsRepo.getHabit(user.id, habit.id)).toBeNull();
		expect(habitsRepo.softDeleteHabit(user.id, habit.id)).toBeNull();

		const restored = habitsRepo.restoreHabit(user.id, habit.id);
		expect(restored?.deletedAt).toBeNull();
		expect(habitsRepo.listHabits(user.id)).toHaveLength(1);
		expect(habitsRepo.restoreHabit(user.id, habit.id)).toBeNull();
	});

	it('links habits to an owned goal and lists them per goal', () => {
		db = useTestDb();
		const user = makeUser('ha-d');
		const goal = goalsRepo.createGoal(user.id, { title: 'Fitness' });
		const habit = habitsRepo.createHabit(user.id, {
			title: 'Laufen',
			cadence: 'week',
			targetCount: 3,
			goalId: goal.id
		});
		expect(habit.goalId).toBe(goal.id);
		expect(habitsRepo.listByGoal(user.id, goal.id).map((entry) => entry.id)).toEqual([habit.id]);
		const unlinked = habitsRepo.updateHabit(user.id, habit.id, { goalId: null });
		expect(unlinked?.goalId).toBeNull();
		expect(habitsRepo.listByGoal(user.id, goal.id)).toHaveLength(0);
	});

	it('finds an active habit by title case-insensitively', () => {
		db = useTestDb();
		const user = makeUser('ha-e');
		const habit = habitsRepo.createHabit(user.id, {
			title: 'Laufen',
			cadence: 'week',
			targetCount: 3
		});
		expect(habitsRepo.findByTitle(user.id, 'LAUFEN')?.id).toBe(habit.id);
		expect(habitsRepo.findByTitle(user.id, 'Schwimmen')).toBeNull();
		habitsRepo.updateHabit(user.id, habit.id, { archived: true });
		expect(habitsRepo.findByTitle(user.id, 'laufen')).toBeNull();
	});

	it('keeps users apart: B cannot read, change, archive or delete A rows', () => {
		db = useTestDb();
		const userA = makeUser('ha-user-a');
		const userB = makeUser('ha-user-b');
		const goalA = goalsRepo.createGoal(userA.id, { title: 'A-Ziel' });
		const habitA = habitsRepo.createHabit(userA.id, {
			title: 'A-Habit',
			cadence: 'week',
			targetCount: 1
		});

		expect(habitsRepo.getHabit(userB.id, habitA.id)).toBeNull();
		expect(habitsRepo.getHabitRow(userB.id, habitA.id)).toBeNull();
		expect(habitsRepo.listHabits(userB.id)).toHaveLength(0);
		expect(habitsRepo.listByGoal(userB.id, goalA.id)).toHaveLength(0);
		expect(habitsRepo.updateHabit(userB.id, habitA.id, { title: 'gekapert' })).toBeNull();
		expect(habitsRepo.softDeleteHabit(userB.id, habitA.id)).toBeNull();
		expect(habitsRepo.restoreHabit(userB.id, habitA.id)).toBeNull();
		expect(habitsRepo.getHabit(userA.id, habitA.id)?.title).toBe('A-Habit');
		expect(habitsRepo.listHabits(userA.id)).toHaveLength(1);
	});
});
