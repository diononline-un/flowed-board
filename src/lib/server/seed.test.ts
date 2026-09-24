import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from './db.js';
import { useTestDb } from './testdb.js';
import * as goalsRepo from './repo/goals.js';
import * as habitsRepo from './repo/habits.js';
import * as journalTemplatesRepo from './repo/journalTemplates.js';
import * as keyResultsRepo from './repo/keyResults.js';
import * as postitsRepo from './repo/postits.js';
import * as usersRepo from './repo/users.js';
import { seedUserContent } from './seed.js';
import { addDays, diffDays } from '$lib/shared/date.js';
import type { UserRow } from '$lib/shared/types.js';

// SPEC 8.7 seed content and its idempotence: registration and the onboarding
// completion both call it, and a complete skip must still end with a usable
// board (AC15) — exactly one example goal, three post-its, one habit and the
// three standard journal templates.

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

describe('seed content (SPEC 8.7)', () => {
	it('creates 1 goal with 2 KRs, 3 post-its, 1 habit and 3 templates', () => {
		db = useTestDb();
		const user = makeUser('seed-a');
		const result = seedUserContent(user.id, TODAY, 'off');

		const goals = goalsRepo.listGoals(user.id);
		expect(goals).toHaveLength(1);
		expect(goals[0]!.title).toBe('Ersten Monat gut starten');
		expect(goals[0]!.isExample).toBe(true);
		const krs = keyResultsRepo.listKeyResults(user.id, result.goalId!);
		expect(krs).toHaveLength(2);

		const postits = postitsRepo.listPostits(user.id);
		expect(postits).toHaveLength(3);
		expect(postits.every((postit) => postit.isExample)).toBe(true);
		const offsets = postits
			.map((postit) => diffDays(postit.date!, TODAY))
			.sort((a, b) => a - b);
		expect(offsets).toEqual([0, 3, 7]); // today, in three days, next week
		expect(postits.every((postit) => postit.goalId === result.goalId)).toBe(true);

		const habits = habitsRepo.listHabits(user.id);
		expect(habits).toHaveLength(1);
		expect(habits[0]!.cadence).toBe('week');
		expect(habits[0]!.targetCount).toBe(3);
		expect(habits[0]!.isExample).toBe(true);

		const templates = journalTemplatesRepo.listJournalTemplates(user.id, { includeInactive: true });
		expect(templates.map((template) => template.seedKey).sort()).toEqual([
			'evening',
			'morning',
			'quick'
		]);
		// `quick` is manual only, morning/evening start without a rhythm
		expect(templates.find((template) => template.seedKey === 'quick')?.schedule).toBeNull();
		expect(templates.find((template) => template.seedKey === 'morning')?.schedule).toBeNull();
		expect(result.postitIds).toHaveLength(3);
	});

	it('is idempotent: registration plus onboarding completion seed once (AC15)', () => {
		db = useTestDb();
		const user = makeUser('seed-b');
		seedUserContent(user.id, TODAY, 'off');
		seedUserContent(user.id, TODAY, 'off');

		expect(goalsRepo.countGoals(user.id)).toBe(1);
		expect(postitsRepo.listPostits(user.id)).toHaveLength(3);
		expect(habitsRepo.listHabits(user.id, { includeArchived: true })).toHaveLength(1);
		expect(
			journalTemplatesRepo.listJournalTemplates(user.id, { includeInactive: true })
		).toHaveLength(3);
	});

	it('does not seed again once the user has own content', () => {
		db = useTestDb();
		const user = makeUser('seed-c');
		goalsRepo.createGoal(user.id, { title: 'Eigenes Ziel' });
		postitsRepo.createPostit(user.id, { title: 'Eigenes Post-it' });
		habitsRepo.createHabit(user.id, { title: 'Eigenes Habit', cadence: 'week', targetCount: 2 });

		seedUserContent(user.id, TODAY, 'off');

		expect(goalsRepo.listGoals(user.id)).toHaveLength(1);
		expect(goalsRepo.listGoals(user.id)[0]!.title).toBe('Eigenes Ziel');
		expect(postitsRepo.listPostits(user.id)).toHaveLength(1);
		expect(habitsRepo.listHabits(user.id)).toHaveLength(1);
		// the standard templates are still added: they are not example content
		expect(
			journalTemplatesRepo.listJournalTemplates(user.id, { includeInactive: true })
		).toHaveLength(3);
	});

	it('applies the journal rhythm of SPEC 8.6 step 4 to the standard templates', () => {
		db = useTestDb();
		const user = makeUser('seed-d');
		seedUserContent(user.id, TODAY, 'morning');

		const morning = journalTemplatesRepo.getBySeedKey(user.id, 'morning');
		const evening = journalTemplatesRepo.getBySeedKey(user.id, 'evening');
		expect(morning?.schedule).toEqual({ times: ['08:00'], days: [0, 1, 2, 3, 4, 5, 6] });
		expect(evening?.schedule).toBeNull();

		// Switching the rhythm later only changes the schedule, the template
		// itself (and any user edit) stays.
		journalTemplatesRepo.updateJournalTemplate(user.id, morning!.id, { name: 'Mein Morgen' });
		seedUserContent(user.id, TODAY, 'evening');
		const updatedMorning = journalTemplatesRepo.getBySeedKey(user.id, 'morning');
		expect(updatedMorning?.name).toBe('Mein Morgen');
		expect(updatedMorning?.schedule).toBeNull();
		expect(journalTemplatesRepo.getBySeedKey(user.id, 'evening')?.schedule).toEqual({
			times: ['21:00'],
			days: [0, 1, 2, 3, 4, 5, 6]
		});
	});

	it('uses the habit of onboarding step 3 when one is supplied', () => {
		db = useTestDb();
		const user = makeUser('seed-e');
		seedUserContent(user.id, TODAY, 'off', {
			habit: { title: 'Früh aufstehen', cadence: 'week', targetCount: 5 }
		});
		const habits = habitsRepo.listHabits(user.id);
		expect(habits).toHaveLength(1);
		expect(habits[0]!.title).toBe('Früh aufstehen');
		expect(habits[0]!.targetCount).toBe(5);
	});

	it('keeps the seed inside the own account (SPEC 6.6)', () => {
		db = useTestDb();
		const userA = makeUser('seed-user-a');
		const userB = makeUser('seed-user-b');
		seedUserContent(userA.id, TODAY, 'off');
		seedUserContent(userB.id, TODAY, 'off');

		expect(goalsRepo.listGoals(userA.id)).toHaveLength(1);
		expect(goalsRepo.listGoals(userB.id)).toHaveLength(1);
		expect(goalsRepo.listGoals(userA.id)[0]!.id).not.toBe(goalsRepo.listGoals(userB.id)[0]!.id);
		expect(postitsRepo.listPostits(userA.id)).toHaveLength(3);
		expect(postitsRepo.listPostits(userB.id)).toHaveLength(3);
		expect(addDays(TODAY, 0)).toBe(TODAY);
	});
});
