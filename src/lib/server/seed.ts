import * as goalsRepo from './repo/goals.js';
import * as habitsRepo from './repo/habits.js';
import * as journalTemplatesRepo from './repo/journalTemplates.js';
import * as keyResultsRepo from './repo/keyResults.js';
import * as postitsRepo from './repo/postits.js';
import * as usersRepo from './repo/users.js';
import { addDays } from '$lib/shared/date.js';
import { standardJournalTemplates } from '$lib/shared/journalTemplates.js';
import { seedContent } from '$lib/shared/seed.js';
import type { PublicUser } from '$lib/shared/types.js';

// Seed content for a fresh account (SPEC 8.7). Called at registration and
// again when the onboarding is finished (or skipped) — both calls are
// idempotent, so a complete skip still ends with a usable board (AC15) and
// nothing is created twice.
//
// The journal rhythm of SPEC 8.6 step 4 is applied here as well: the standard
// templates are created with the schedule of the chosen rhythm.

export type SeedJournalRhythm = 'morning' | 'evening' | 'off';

// Habit from onboarding step 3, when the user took the suggestion or wrote
// their own; without it the SPEC-8.7 example habit is seeded.
export interface SeedHabitInput {
	title: string;
	emoji?: string | null;
	cadence: 'week' | 'month';
	targetCount: number;
	maxPerDay?: number;
}

export interface SeedOptions {
	// false leaves the habit to the caller (onboarding already created one).
	includeHabit?: boolean;
	habit?: SeedHabitInput;
}

export interface SeedResult {
	goalId: string | null;
	postitIds: string[];
	habitId: string | null;
	templateIds: string[];
}

// Seeds everything that is still missing. Existing (non-deleted) goals,
// post-its, habits or standard templates are left alone — the user may have
// edited or deleted the example rows already.
export function seedUserContent(
	userId: string,
	today: string,
	rhythm: SeedJournalRhythm = 'off',
	options: SeedOptions = {}
): SeedResult {
	const content = seedContent();
	const result: SeedResult = { goalId: null, postitIds: [], habitId: null, templateIds: [] };

	// 1 example goal with 2 key results (SPEC 8.7).
	if (goalsRepo.countGoals(userId) === 0) {
		const goal = goalsRepo.createGoal(userId, {
			title: content.goal.title,
			note: content.goal.note,
			emoji: content.goal.emoji,
			isExample: true
		});
		result.goalId = goal.id;
		for (const keyResult of content.goal.keyResults) {
			keyResultsRepo.createKeyResult(userId, goal.id, {
				title: keyResult.title,
				kind: keyResult.kind,
				targetValue: keyResult.targetValue,
				unit: keyResult.unit
			});
		}
	}

	// 3 example post-its: today, in three days, next week (SPEC 8.7). They are
	// only linked to the goal when it is the seeded example goal.
	if (postitsRepo.listPostits(userId).length === 0) {
		for (const definition of content.postits) {
			const postit = postitsRepo.createPostit(userId, {
				title: definition.title,
				note: definition.note,
				date: addDays(today, definition.inDays),
				goalId: result.goalId,
				isExample: true
			});
			result.postitIds.push(postit.id);
		}
	}

	// 1 example habit, week cadence, target 3 (SPEC 8.7). Onboarding step 3 may
	// bring its own habit instead, then this one is skipped.
	if (
		options.includeHabit !== false &&
		habitsRepo.listHabits(userId, { includeArchived: true }).length === 0
	) {
		const definition = options.habit ?? content.habit;
		const habit = habitsRepo.createHabit(userId, {
			title: definition.title,
			emoji: definition.emoji ?? content.habit.emoji,
			color: content.habit.color,
			cadence: definition.cadence,
			targetCount: definition.targetCount,
			// The habit of step 3 belongs to the same example goal as the
			// post-its, so the goal page shows it (SPEC 8.3).
			goalId: result.goalId,
			isExample: true
		});
		result.habitId = habit.id;
	}

	// Standard journal templates with the rhythm chosen in step 4; `quick` is
	// always available without a schedule (SPEC 8.7).
	for (const definition of standardJournalTemplates(rhythm)) {
		const existing = journalTemplatesRepo.getBySeedKey(userId, definition.seedKey);
		if (existing) {
			// Keep the template (and any user edit), only follow the rhythm.
			journalTemplatesRepo.updateJournalTemplate(userId, existing.id, {
				schedule: definition.schedule
			});
			result.templateIds.push(existing.id);
			continue;
		}
		const created = journalTemplatesRepo.createJournalTemplate(userId, {
			name: definition.name,
			emoji: definition.emoji,
			fields: definition.fields,
			schedule: definition.schedule,
			seedKey: definition.seedKey
		});
		result.templateIds.push(created.id);
	}

	return result;
}

// Onboarding completion (SPEC 8.6/8.7): applies the display name from step 1,
// loads the seed content (with the habit of step 3 or the SPEC-8.7 example)
// and stamps `onboarding_done_at`, which is what the layout guard checks
// (AC16).
export function completeOnboarding(
	userId: string,
	input: { displayName?: string; rhythm: SeedJournalRhythm; habit?: SeedHabitInput | null },
	today: string
): { user: PublicUser | null; seed: SeedResult } {
	const hasOwnHabit = input.habit !== undefined && input.habit !== null;
	const seed = seedUserContent(userId, today, input.rhythm, {
		// A habit from step 3 is created by the caller before this runs; when
		// the user already owns a habit (for example the one from step 2's
		// capture) the example habit is skipped as well.
		includeHabit: !hasOwnHabit,
		habit: input.habit ?? undefined
	});
	if (input.displayName !== undefined) {
		usersRepo.updateProfile(userId, { displayName: input.displayName });
	}
	const user = usersRepo.setOnboardingDone(userId, new Date().toISOString());
	return { user, seed };
}
