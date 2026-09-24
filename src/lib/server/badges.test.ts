import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from './db.js';
import { useTestDb } from './testdb.js';
import * as badgesRepo from './repo/badges.js';
import * as goalsRepo from './repo/goals.js';
import * as habitLogsRepo from './repo/habitLogs.js';
import * as habitsRepo from './repo/habits.js';
import * as journalEntriesRepo from './repo/journalEntries.js';
import * as journalTemplatesRepo from './repo/journalTemplates.js';
import * as keyResultsRepo from './repo/keyResults.js';
import * as postitsRepo from './repo/postits.js';
import * as usersRepo from './repo/users.js';
import { badgeOverview, evaluateBadges, gatherBadgeFacts } from './badges.js';
import { badgeOnlyResponse, award } from './xp.js';
import { BADGE_DEFINITIONS, BADGE_IDS, earnedBadgeIds, isBadgeId } from '$lib/shared/badges.js';
import { makeEvent } from '$lib/shared/xp.js';
import type { UserRow } from '$lib/shared/types.js';

// SPEC 5.6 badge rules against :memory: with the real migrations: one test per
// trigger, the once-only guarantee, and the `keeper` case with four weeks that
// deliberately do not follow each other.

let db: SqliteDatabase;

const TODAY = '2026-09-21'; // a Monday, week_start = 1
const WEEK_START = 1 as const;
const CONTEXT = { today: TODAY, weekStart: WEEK_START };

function makeUser(username: string): UserRow {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	return usersRepo.getById(user.id)!;
}

function earnedIds(userId: string): string[] {
	return badgesRepo
		.listEarned(userId)
		.map((entry) => entry.badgeId)
		.sort();
}

// Marks every badge of a list as owned up front, so a test can look at a single
// trigger without the earlier ones (first post-it, first goal, …) interfering.
function preown(userId: string, badgeIds: string[]): void {
	badgesRepo.insertIgnored(
		userId,
		badgeIds.filter(isBadgeId)
	);
}

describe('badge catalogue', () => {
	it('matches the SPEC 5.6 list', () => {
		expect(BADGE_IDS).toEqual([
			'first_step',
			'goal_setter',
			'quick_writer',
			'week_win',
			'keeper',
			'journal_starter',
			'journal_regular',
			'halfway',
			'finisher',
			'tidy_up'
		]);
		expect(new Set(BADGE_IDS).size).toBe(BADGE_IDS.length);
		for (const badge of BADGE_DEFINITIONS) {
			expect(badge.name.length).toBeGreaterThan(0);
			expect(badge.description.length).toBeGreaterThan(0);
		}
	});

	it('evaluates every rule from the facts alone', () => {
		const facts = {
			donePostits: 1,
			goals: 1,
			doneGoals: 1,
			captures: 1,
			journalEntries: 15,
			completedWeekStarts: ['2026-08-03', '2026-08-17', '2026-08-31', '2026-09-14'],
			reachedKeyResults: 1,
			keyResultHalfway: true,
			cleanedUp: true
		};
		expect(earnedBadgeIds(facts).sort()).toEqual([...BADGE_IDS].sort());
		expect(
			earnedBadgeIds({
				...facts,
				donePostits: 0,
				goals: 0,
				doneGoals: 0,
				captures: 0,
				journalEntries: 2,
				completedWeekStarts: [],
				reachedKeyResults: 0,
				keyResultHalfway: false,
				cleanedUp: false
			})
		).toEqual([]);
	});
});

describe('badge triggers (SPEC 5.6)', () => {
	it('first_step: the first completed post-it', () => {
		db = useTestDb();
		const user = makeUser('bg-first-step');
		const postit = postitsRepo.createPostit(user.id, { title: 'Aufgabe' });
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);

		const result = award(user.id, [makeEvent('postit_done', postit.id)], 'postit', CONTEXT);
		expect(result.newBadges.map((entry) => entry.badge.id)).toEqual(['first_step']);
		expect(earnedIds(user.id)).toEqual(['first_step']);
	});

	it('goal_setter: the first goal, without any XP', () => {
		db = useTestDb();
		const user = makeUser('bg-goal-setter');
		const result = badgeOnlyResponse(user.id, 'goal', CONTEXT);
		expect(goalsRepo.createGoal(user.id, { title: 'Ziel' }).id).toBeTruthy();
		// the badge check runs after the goal exists
		expect(result.newBadges).toEqual([]);
		const after = badgeOnlyResponse(user.id, 'goal', CONTEXT);
		expect(after.gained).toBe(0);
		expect(after.newBadges.map((entry) => entry.badge.id)).toEqual(['goal_setter']);
		expect(earnedIds(user.id)).toEqual(['goal_setter']);
	});

	it('quick_writer: the first committed capture batch', () => {
		db = useTestDb();
		const user = makeUser('bg-quick-writer');
		postitsRepo.createPostit(user.id, { title: 'Aus Capture', batchId: 'batch-1' });
		const result = award(user.id, [makeEvent('capture_used', 'batch-1')], 'capture', CONTEXT);
		expect(result.gained).toBe(3);
		expect(result.newBadges.map((entry) => entry.badge.id)).toEqual(['quick_writer']);
	});

	it('week_win: the first week in which a habit reached its target', () => {
		db = useTestDb();
		const user = makeUser('bg-week-win');
		const habit = habitsRepo.createHabit(user.id, {
			title: 'Bewegen',
			cadence: 'week',
			targetCount: 3
		});
		preown(user.id, ['goal_setter']);
		// created_at is "now"; the logs below lie in a finished week (2 weeks ago)
		db.prepare('UPDATE habits SET created_at = ? WHERE id = ?').run('2026-08-31T10:00:00.000Z', habit.id);
		for (const date of ['2026-09-07', '2026-09-08', '2026-09-09']) {
			const postit = postitsRepo.createPostit(user.id, { title: 'x', habitId: habit.id, date });
			habitLogsRepo.addPostitLog(user.id, habit.id, date, postit.id);
		}

		const facts = gatherBadgeFacts(user.id, TODAY, WEEK_START);
		expect(facts.completedWeekStarts).toEqual(['2026-09-07']);
		const newBadges = evaluateBadges(user.id, facts, 'habit');
		expect(newBadges.map((entry) => entry.id)).toEqual(['week_win']);
	});

	it('keeper: four weeks, deliberately not consecutive', () => {
		db = useTestDb();
		const user = makeUser('bg-keeper');
		const habit = habitsRepo.createHabit(user.id, {
			title: 'Lesen',
			cadence: 'week',
			targetCount: 2
		});
		preown(user.id, ['goal_setter', 'week_win']);
		db.prepare('UPDATE habits SET created_at = ? WHERE id = ?').run('2026-07-20T10:00:00.000Z', habit.id);
		// weeks of 2026-07-20, 2026-08-03, 2026-08-24 and 2026-09-07 — with gaps
		const weeks = ['2026-07-20', '2026-08-03', '2026-08-24', '2026-09-07'];
		for (const week of weeks) {
			for (const offset of [0, 2]) {
				const date = new Date(Date.UTC(2026, Number(week.slice(5, 7)) - 1, Number(week.slice(8, 10)) + offset));
				const ymd = date.toISOString().slice(0, 10);
				const postit = postitsRepo.createPostit(user.id, { title: 'x', habitId: habit.id, date: ymd });
				habitLogsRepo.addPostitLog(user.id, habit.id, ymd, postit.id);
			}
		}

		const facts = gatherBadgeFacts(user.id, TODAY, WEEK_START);
		expect(facts.completedWeekStarts).toEqual(weeks);
		expect(evaluateBadges(user.id, facts, 'habit').map((entry) => entry.id)).toEqual(['keeper']);
	});

	it('keeper stays open with only three weeks', () => {
		db = useTestDb();
		const user = makeUser('bg-keeper-three');
		const habit = habitsRepo.createHabit(user.id, {
			title: 'Lesen',
			cadence: 'week',
			targetCount: 1
		});
		preown(user.id, ['goal_setter', 'week_win']);
		db.prepare('UPDATE habits SET created_at = ? WHERE id = ?').run('2026-08-31T10:00:00.000Z', habit.id);
		for (const week of ['2026-08-31', '2026-09-07', '2026-09-14']) {
			const postit = postitsRepo.createPostit(user.id, { title: 'x', habitId: habit.id, date: week });
			habitLogsRepo.addPostitLog(user.id, habit.id, week, postit.id);
		}
		const facts = gatherBadgeFacts(user.id, TODAY, WEEK_START);
		expect(facts.completedWeekStarts).toHaveLength(3);
		expect(evaluateBadges(user.id, facts, 'habit').map((entry) => entry.id)).toEqual([]);
	});

	it('journal_starter at three entries and journal_regular at fifteen', () => {
		db = useTestDb();
		const user = makeUser('bg-journal');
		const template = journalTemplatesRepo.createJournalTemplate(user.id, {
			name: 'Abend',
			fields: [{ id: 'note', type: 'text', label: 'Notiz', required: false, maxLength: 100 }]
		});
		preown(user.id, ['goal_setter']);

		for (let index = 0; index < 15; index += 1) {
			const date = `2026-09-${String(index + 1).padStart(2, '0')}`;
			journalEntriesRepo.createJournalEntry(user.id, template, {
				entryDate: date,
				slot: null,
				values: { note: 'ok' }
			});
			const facts = gatherBadgeFacts(user.id, TODAY, WEEK_START);
			const newBadges = evaluateBadges(user.id, facts, 'journal');
			if (index === 2) {
				expect(newBadges.map((entry) => entry.id)).toEqual(['journal_starter']);
			} else if (index === 14) {
				expect(newBadges.map((entry) => entry.id)).toEqual(['journal_regular']);
			} else {
				expect(newBadges).toEqual([]);
			}
		}
		expect(earnedIds(user.id)).toEqual(['goal_setter', 'journal_regular', 'journal_starter']);
	});

	it('halfway: a key result at 50 %', () => {
		db = useTestDb();
		const user = makeUser('bg-halfway');
		preown(user.id, ['goal_setter']);
		const goal = goalsRepo.createGoal(user.id, { title: 'Ziel' });
		const kr = keyResultsRepo.createKeyResult(user.id, goal.id, {
			title: 'KR',
			targetValue: 10
		})!;

		// 4 of 10 is still below half
		keyResultsRepo.updateKeyResult(user.id, kr.id, { currentValue: 4 });
		expect(evaluateBadges(user.id, gatherBadgeFacts(user.id, TODAY, WEEK_START), 'keyResult')).toEqual([]);

		keyResultsRepo.updateKeyResult(user.id, kr.id, { currentValue: 5 });
		const facts = gatherBadgeFacts(user.id, TODAY, WEEK_START);
		expect(facts.keyResultHalfway).toBe(true);
		expect(evaluateBadges(user.id, facts, 'keyResult').map((entry) => entry.id)).toEqual(['halfway']);
	});

	it('finisher: the first goal marked as done', () => {
		db = useTestDb();
		const user = makeUser('bg-finisher');
		preown(user.id, ['goal_setter']);
		const goal = goalsRepo.createGoal(user.id, { title: 'Ziel' });
		goalsRepo.updateGoal(user.id, goal.id, { status: 'done' });

		const result = award(user.id, [makeEvent('goal_done', goal.id)], 'goal', CONTEXT);
		expect(result.gained).toBe(50);
		expect(result.newBadges.map((entry) => entry.badge.id)).toEqual(['finisher']);
	});

	it('tidy_up: the cleanup sheet was run (badge without XP)', () => {
		db = useTestDb();
		const user = makeUser('bg-tidy-up');
		preown(user.id, ['goal_setter']);
		const postit = postitsRepo.createPostit(user.id, { title: 'alt', date: '2026-09-01' });
		postitsRepo.cleanupPostits(user.id, [postit.id], 'today', TODAY);

		const result = award(user.id, [], 'cleanup', CONTEXT);
		expect(result.gained).toBe(0);
		expect(result.newBadges.map((entry) => entry.badge.id)).toEqual(['tidy_up']);
	});
});

describe('badge once-only (SPEC 5.6)', () => {
	it('never awards the same badge twice and never removes one', () => {
		db = useTestDb();
		const user = makeUser('bg-once');
		const postit = postitsRepo.createPostit(user.id, { title: 'Aufgabe' });
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, TODAY);

		const first = award(user.id, [makeEvent('postit_done', postit.id)], 'postit', CONTEXT);
		expect(first.newBadges).toHaveLength(1);
		const second = award(user.id, [makeEvent('postit_done', postit.id)], 'postit', CONTEXT);
		expect(second.newBadges).toEqual([]);
		expect(badgesRepo.countBadges(user.id)).toBe(1);
		expect(badgesRepo.hasBadge(user.id, 'first_step')).toBe(true);

		// badge grid: every catalogue badge with its state
		const overview = badgeOverview(user.id);
		expect(overview).toHaveLength(BADGE_IDS.length);
		expect(overview.find((entry) => entry.id === 'first_step')?.earnedAt).not.toBeNull();
		expect(overview.filter((entry) => entry.earnedAt === null)).toHaveLength(BADGE_IDS.length - 1);
	});

	it('keeps badges isolated per user (SPEC 6.6)', () => {
		db = useTestDb();
		const userA = makeUser('bg-user-a');
		const userB = makeUser('bg-user-b');
		const postitA = postitsRepo.createPostit(userA.id, { title: 'A' });
		postitsRepo.updatePostit(userA.id, postitA.id, { done: true }, TODAY);
		award(userA.id, [makeEvent('postit_done', postitA.id)], 'postit', CONTEXT);

		expect(badgesRepo.listEarned(userB.id)).toEqual([]);
		expect(badgeOverview(userB.id).every((entry) => entry.earnedAt === null)).toBe(true);
		expect(badgesRepo.hasBadge(userB.id, 'first_step')).toBe(false);
		expect(badgesRepo.insertIgnored(userB.id, ['keeper'])).toEqual(['keeper']);
		expect(badgesRepo.countBadges(userA.id)).toBe(1);
	});
});
