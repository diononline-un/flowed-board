import { getDb } from './db.js';
import * as badgesRepo from './repo/badges.js';
import * as goalsRepo from './repo/goals.js';
import * as habitLogsRepo from './repo/habitLogs.js';
import * as habitsRepo from './repo/habits.js';
import * as journalEntriesRepo from './repo/journalEntries.js';
import * as postitsRepo from './repo/postits.js';
import { completedWeekStarts } from '$lib/shared/habit.js';
import { keyResultAtLeastHalfPublic } from '$lib/shared/progress.js';
import { BADGE_IDS, earnedBadgeIds, type BadgeFacts, type BadgeId } from '$lib/shared/badges.js';
import type { PublicHabit } from '$lib/shared/types.js';

// Badge evaluation (SPEC 5.6). Called after the events that could unlock
// something; wording and thresholds live in `$lib/shared/badges.ts`.
//
// Badges are derived state: every check counts the current rows, so a badge can
// never be lost and no counter has to be kept in sync (P7).

export type BadgeTrigger =
	| 'postit'
	| 'habit'
	| 'journal'
	| 'goal'
	| 'keyResult'
	| 'capture'
	| 'cleanup';

export type BadgeFactsInput = Omit<BadgeFacts, 'cleanedUp'> & { cleanedUp?: boolean };

// Key results that reached their target. Number: current >= target; check:
// current >= 1, which only ever happens by ticking it (SPEC 5.4).
export function countReachedKeyResults(userId: string): number {
	const row = getDb()
		.prepare(
			`SELECT COUNT(*) AS n FROM key_results
			 WHERE user_id = ? AND deleted_at IS NULL
			   AND ((kind = 'check' AND current_value >= 1)
			     OR (kind = 'number' AND current_value >= target_value))`
		)
		.get(userId) as { n: number };
	return row.n;
}

// Weeks in which one of the user's habits reached its target, counted with the
// same rule the habit bar shows (SPEC 5.5) and de-duplicated across habits:
// `keeper` means four different weeks, not four weeks of one habit.
export function completedWeekStartsForUser(
	userId: string,
	today: string,
	weekStartDay: 0 | 1 | 6
): string[] {
	const habits: PublicHabit[] = habitsRepo.listHabits(userId, { includeArchived: true });
	const starts = new Set<string>();
	for (const habit of habits) {
		const logDates = habitLogsRepo.listLogDates(userId, habit.id);
		for (const start of completedWeekStarts(
			{
				cadence: 'week',
				created_at: habit.createdAt.slice(0, 10),
				range_start: habit.rangeStart,
				range_end: habit.rangeEnd,
				target_count: habit.targetCount
			},
			logDates,
			today,
			weekStartDay
		)) {
			starts.add(start);
		}
	}
	return [...starts].sort();
}

// Everything the SPEC-5.6 rules look at. Cheap enough to run after a single
// user action (a handful of indexed queries). `trigger` decides the one fact
// that is not derivable from the rows: whether the cleanup sheet ran.
export function gatherBadgeFacts(
	userId: string,
	today: string,
	weekStartDay: 0 | 1 | 6,
	trigger: BadgeTrigger = 'postit'
): BadgeFactsInput {
	const keyResults = goalsRepo.listActiveKeyResults(userId);
	return {
		donePostits: postitsRepo.countDonePostits(userId),
		goals: goalsRepo.countGoals(userId),
		doneGoals: goalsRepo.countGoals(userId, 'done'),
		captures: postitsRepo.countCaptureBatches(userId),
		journalEntries: journalEntriesRepo.countJournalEntries(userId),
		completedWeekStarts: completedWeekStartsForUser(userId, today, weekStartDay),
		reachedKeyResults: countReachedKeyResults(userId),
		keyResultHalfway: keyResults.some((keyResult) =>
			keyResultAtLeastHalfPublic({
				kind: keyResult.kind,
				targetValue: keyResult.targetValue,
				currentValue: keyResult.currentValue
			})
		),
		cleanedUp: trigger === 'cleanup'
	};
}

// Resolves the badges a fact set satisfies and records the new ones.
export function evaluateBadges(
	userId: string,
	facts: BadgeFactsInput,
	trigger: BadgeTrigger
): { id: BadgeId; earnedAt: string }[] {
	void trigger;
	const satisfied = earnedBadgeIds({ ...facts, cleanedUp: facts.cleanedUp === true });
	if (satisfied.length === 0) return [];
	const owned = new Set(badgesRepo.listEarned(userId).map((entry) => entry.badgeId));
	const missing = satisfied.filter((badgeId) => !owned.has(badgeId));
	if (missing.length === 0) return [];
	return badgesRepo.insertIgnored(userId, missing).map((id) => ({
		id,
		earnedAt: new Date().toISOString()
	}));
}

// Definitions for the badge grid: every badge of the catalogue with the moment
// it was earned (null = still open).
export function badgeOverview(userId: string): { id: BadgeId; earnedAt: string | null }[] {
	const earned = new Map(
		badgesRepo.listEarned(userId).map((entry) => [entry.badgeId, entry.earnedAt])
	);
	return BADGE_IDS.map((badgeId) => ({ id: badgeId, earnedAt: earned.get(badgeId) ?? null }));
}
