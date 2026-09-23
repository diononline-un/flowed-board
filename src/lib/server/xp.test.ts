import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from './db.js';
import { useTestDb } from './testdb.js';
import * as goalsRepo from './repo/goals.js';
import * as habitLogsRepo from './repo/habitLogs.js';
import * as habitsRepo from './repo/habits.js';
import * as journalEntriesRepo from './repo/journalEntries.js';
import * as journalTemplatesRepo from './repo/journalTemplates.js';
import * as keyResultsRepo from './repo/keyResults.js';
import * as postitsRepo from './repo/postits.js';
import * as usersRepo from './repo/users.js';
import * as xpEventsRepo from './repo/xpEvents.js';
import * as badgesRepo from './repo/badges.js';
import { awardContextFor, awardPostitDone, award, xpTotalOf } from './xp.js';
import { withXp } from './http.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';
import {
	XP_KINDS,
	levelFor,
	levelName,
	xpAtLevel,
	xpBandWidth,
	xpProgress,
	xpToNextLevel
} from '$lib/shared/xp.js';
import type { UserRow } from '$lib/shared/types.js';

// SPEC 5.6 award rules against :memory: with the real migrations: the points
// table, the once-only guarantee (no XP farming by done → reopen → done), the
// level formula at its boundaries, and the promise that XP never sink.

let db: SqliteDatabase;

const WEEK_START = 1 as const;
const CONTEXT = { today: '2026-09-21', weekStart: WEEK_START };

function makeUser(username: string): UserRow {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	return usersRepo.getById(user.id)!;
}

describe('xp points table (SPEC 5.6)', () => {
	it('uses exactly the points of the SPEC table', () => {
		expect(XP_KINDS).toEqual({
			postit_done: 5,
			habit_log: 10,
			journal_entry: 15,
			kr_done: 20,
			goal_done: 50,
			capture_used: 3
		});
	});

	it('ref_id formats match the SPEC table', () => {
		db = useTestDb();
		const user = makeUser('xp-refs');
		const postit = postitsRepo.createPostit(user.id, { title: 'p' });
		const habit = habitsRepo.createHabit(user.id, {
			title: 'h',
			cadence: 'week',
			targetCount: 3
		});

		const postitAward = awardPostitDone(user.id, postit.id, CONTEXT);
		expect(postitAward.gained).toBe(5);
		const habitAward = award(
			user.id,
			[{ kind: 'habit_log', refId: `${habit.id}:2026-09-21`, points: 10 }],
			'habit',
			CONTEXT
		);
		expect(habitAward.gained).toBe(10);
		const captureAward = award(
			user.id,
			[{ kind: 'capture_used', refId: 'batch-1', points: 3 }],
			'capture',
			CONTEXT
		);
		expect(captureAward.gained).toBe(3);

		const refs = xpEventsRepo.listXpEvents(user.id).map((event) => `${event.kind}:${event.ref_id}`);
		expect(refs).toContain(`postit_done:${postit.id}`);
		expect(refs).toContain(`habit_log:${habit.id}:2026-09-21`);
		expect(refs).toContain('capture_used:batch-1');
	});
});

describe('xp farming prevention (SPEC 5.6)', () => {
	it('done → reopen → done awards 5 XP exactly once', () => {
		db = useTestDb();
		const user = makeUser('xp-farm-a');
		const postit = postitsRepo.createPostit(user.id, { title: 'Toggle' });

		postitsRepo.updatePostit(user.id, postit.id, { done: true }, CONTEXT.today);
		const first = awardPostitDone(user.id, postit.id, CONTEXT);
		expect(first.gained).toBe(5);
		expect(xpTotalOf(user.id)).toBe(5);

		postitsRepo.updatePostit(user.id, postit.id, { done: false }, CONTEXT.today);
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, CONTEXT.today);
		const again = awardPostitDone(user.id, postit.id, CONTEXT);
		expect(again.gained).toBe(0);
		expect(xpTotalOf(user.id)).toBe(5);

		// ten more rounds change nothing
		for (let round = 0; round < 10; round += 1) {
			postitsRepo.updatePostit(user.id, postit.id, { done: false }, CONTEXT.today);
			postitsRepo.updatePostit(user.id, postit.id, { done: true }, CONTEXT.today);
			awardPostitDone(user.id, postit.id, CONTEXT);
		}
		expect(xpTotalOf(user.id)).toBe(5);
		expect(xpEventsRepo.listXpEvents(user.id)).toHaveLength(1);
	});

	it('a repeated habit log of the same day awards once, another day again', () => {
		db = useTestDb();
		const user = makeUser('xp-farm-b');
		const habit = habitsRepo.createHabit(user.id, {
			title: 'Sport',
			cadence: 'week',
			targetCount: 3,
			maxPerDay: 2
		});

		expect(award(user.id, [{ kind: 'habit_log', refId: `${habit.id}:2026-09-21`, points: 10 }], 'habit', CONTEXT).gained).toBe(10);
		// second tap of the same day (allowed while max_per_day is not reached)
		expect(award(user.id, [{ kind: 'habit_log', refId: `${habit.id}:2026-09-21`, points: 10 }], 'habit', CONTEXT).gained).toBe(0);
		expect(award(user.id, [{ kind: 'habit_log', refId: `${habit.id}:2026-09-22`, points: 10 }], 'habit', CONTEXT).gained).toBe(10);
		expect(xpTotalOf(user.id)).toBe(20);
	});

	it('a repeated key result completion awards once (event ref_id = key result id)', () => {
		db = useTestDb();
		const user = makeUser('xp-farm-c');
		const goal = goalsRepo.createGoal(user.id, { title: 'Ziel' });
		const kr = keyResultsRepo.createKeyResult(user.id, goal.id, {
			title: 'KR',
			targetValue: 4
		})!;

		expect(award(user.id, [{ kind: 'kr_done', refId: kr.id, points: 20 }], 'keyResult', CONTEXT).gained).toBe(20);
		expect(award(user.id, [{ kind: 'kr_done', refId: kr.id, points: 20 }], 'keyResult', CONTEXT).gained).toBe(0);
		expect(xpTotalOf(user.id)).toBe(20);
	});

	it('a repeated goal completion awards once', () => {
		db = useTestDb();
		const user = makeUser('xp-farm-d');
		const goal = goalsRepo.createGoal(user.id, { title: 'Ziel' });
		award(user.id, [{ kind: 'goal_done', refId: goal.id, points: 50 }], 'goal', CONTEXT);
		award(user.id, [{ kind: 'goal_done', refId: goal.id, points: 50 }], 'goal', CONTEXT);
		expect(xpTotalOf(user.id)).toBe(50);
	});

	it('two journal entries of the same template/day with different slots both count', () => {
		db = useTestDb();
		const user = makeUser('xp-farm-e');
		expect(
			award(user.id, [{ kind: 'journal_entry', refId: `t1:2026-09-21:08:00`, points: 15 }], 'journal', CONTEXT)
				.gained
		).toBe(15);
		expect(
			award(user.id, [{ kind: 'journal_entry', refId: `t1:2026-09-21:21:00`, points: 15 }], 'journal', CONTEXT)
				.gained
		).toBe(15);
		// same slot twice is a repeat
		expect(
			award(user.id, [{ kind: 'journal_entry', refId: `t1:2026-09-21:08:00`, points: 15 }], 'journal', CONTEXT)
				.gained
		).toBe(0);
		expect(xpTotalOf(user.id)).toBe(30);
	});
});

describe('xp never sink (P7)', () => {
	it('reopening, deleting and restoring never reduce the total', () => {
		db = useTestDb();
		const user = makeUser('xp-never-sink');
		const postit = postitsRepo.createPostit(user.id, { title: 'Aufgabe' });
		postitsRepo.updatePostit(user.id, postit.id, { done: true }, CONTEXT.today);
		awardPostitDone(user.id, postit.id, CONTEXT);
		const afterAward = xpTotalOf(user.id);

		postitsRepo.updatePostit(user.id, postit.id, { done: false }, CONTEXT.today);
		expect(xpTotalOf(user.id)).toBe(afterAward);
		postitsRepo.softDeletePostit(user.id, postit.id, CONTEXT.today);
		expect(xpTotalOf(user.id)).toBe(afterAward);
		postitsRepo.restorePostit(user.id, postit.id, CONTEXT.today);
		expect(xpTotalOf(user.id)).toBe(afterAward);
		// and the event row stays, so the value can never be rebuilt downwards
		expect(xpEventsRepo.hasEvent(user.id, 'postit_done', postit.id)).toBe(true);
	});

	it('no source file subtracts XP or rewrites an XP event', () => {
		// Static guard over the whole app code (tests excluded so the guard
		// itself does not match): the only writer of users.xp_total is the
		// award path and it only ever adds the points it really inserted.
		const root = fileURLToPath(new URL('../../../src', import.meta.url));
		const files = globSync('**/*.{ts,svelte}', { cwd: root }).filter(
			(file) => !file.endsWith('.test.ts')
		);
		expect(files.length).toBeGreaterThan(50);
		for (const file of files) {
			const source = readFileSync(`${root}/${file}`, 'utf8');
			expect(source, file).not.toMatch(/xp_total\s*=\s*xp_total\s*-/);
			expect(source, file).not.toMatch(/xp_total\s*-=/);
			expect(source, file).not.toMatch(/INSERT OR REPLACE INTO xp_events/);
			expect(source, file).not.toMatch(/DELETE FROM xp_events/);
		}
		// The one writer really is INSERT OR IGNORE (SPEC 5.6).
		expect(readFileSync(`${root}/lib/server/repo/xpEvents.ts`, 'utf8')).toMatch(
			/INSERT OR IGNORE INTO xp_events/
		);
	});
});

describe('level formula (SPEC 5.6)', () => {
	it('follows floor(sqrt(xp/30)) + 1 at the band boundaries', () => {
		expect(levelFor(0)).toBe(1);
		expect(levelFor(29)).toBe(1);
		expect(levelFor(30)).toBe(2);
		expect(levelFor(119)).toBe(2);
		expect(levelFor(120)).toBe(3);
		expect(levelFor(269)).toBe(3);
		expect(levelFor(270)).toBe(4);
		expect(levelFor(479)).toBe(4);
		expect(levelFor(480)).toBe(5);
		// 30 * 9² = 2430 starts level 10
		expect(levelFor(2429)).toBe(9);
		expect(levelFor(2430)).toBe(10);
		expect(levelFor(-50)).toBe(1); // defensive: XP cannot be negative
	});

	it('names the levels and keeps Café-Legende from 10 on', () => {
		expect(levelName(1)).toBe('Kaffeebohne');
		expect(levelName(2)).toBe('Espresso');
		expect(levelName(3)).toBe('Flat White');
		expect(levelName(4)).toBe('Cappuccino');
		expect(levelName(5)).toBe('Latte');
		expect(levelName(6)).toBe('Mocha');
		expect(levelName(7)).toBe('Affogato');
		expect(levelName(8)).toBe('Barista');
		expect(levelName(9)).toBe('Röstmeister:in');
		expect(levelName(10)).toBe('Café-Legende');
		expect(levelName(42)).toBe('Café-Legende');
	});

	it('separates the cumulative level threshold from the level width', () => {
		// B(L) = 30 * (L-1)^2 is where a level begins and where `levelFor`
		// switches; the level itself is only B(L+1) - B(L) = 30 * (2L - 1) wide.
		// SPEC 5.6's "30 * level²" is the cumulative threshold, not the rest.
		expect(xpAtLevel(1)).toBe(0);
		expect(xpAtLevel(2)).toBe(30);
		expect(xpAtLevel(3)).toBe(120);
		expect(xpAtLevel(4)).toBe(270);
		expect(xpAtLevel(5)).toBe(480);
		expect(xpAtLevel(10)).toBe(30 * 81);
		expect(xpBandWidth(1)).toBe(30);
		expect(xpBandWidth(2)).toBe(90);
		expect(xpBandWidth(3)).toBe(150);
		expect(xpBandWidth(4)).toBe(210);
		expect(xpBandWidth(5)).toBe(270);
		// the widths really add up to the thresholds
		expect(xpBandWidth(1) + xpBandWidth(2) + xpBandWidth(3)).toBe(xpAtLevel(4));
		expect(xpBandWidth(1) + xpBandWidth(2)).toBe(xpAtLevel(3));
	});

	it('matches the expected values at every level boundary', () => {
		// The table is the contract: level, XP inside the level, level width,
		// XP up to the next level and the bar ratio.
		const cases: {
			total: number;
			level: number;
			intoLevel: number;
			bandWidth: number;
			toNextLevel: number;
			ratio: number;
		}[] = [
			{ total: 0, level: 1, intoLevel: 0, bandWidth: 30, toNextLevel: 30, ratio: 0 },
			{ total: 29, level: 1, intoLevel: 29, bandWidth: 30, toNextLevel: 1, ratio: 29 / 30 },
			{ total: 30, level: 2, intoLevel: 0, bandWidth: 90, toNextLevel: 90, ratio: 0 },
			{ total: 119, level: 2, intoLevel: 89, bandWidth: 90, toNextLevel: 1, ratio: 89 / 90 },
			{ total: 120, level: 3, intoLevel: 0, bandWidth: 150, toNextLevel: 150, ratio: 0 },
			{ total: 269, level: 3, intoLevel: 149, bandWidth: 150, toNextLevel: 1, ratio: 149 / 150 },
			{ total: 270, level: 4, intoLevel: 0, bandWidth: 210, toNextLevel: 210, ratio: 0 },
			{ total: 480, level: 5, intoLevel: 0, bandWidth: 270, toNextLevel: 270, ratio: 0 }
		];
		for (const expected of cases) {
			const progress = xpProgress(expected.total);
			expect(progress.level, `level at ${expected.total}`).toBe(expected.level);
			expect(progress.intoLevel, `intoLevel at ${expected.total}`).toBe(expected.intoLevel);
			expect(progress.bandWidth, `bandWidth at ${expected.total}`).toBe(expected.bandWidth);
			expect(progress.toNextLevel, `toNextLevel at ${expected.total}`).toBe(expected.toNextLevel);
			expect(progress.ratio, `ratio at ${expected.total}`).toBeCloseTo(expected.ratio, 10);
			// `xpToNextLevel` answers the same question relative to the total
			expect(xpToNextLevel(expected.total), `xpToNextLevel at ${expected.total}`).toBe(
				expected.toNextLevel
			);
			// B(level) + intoLevel = total, and the width is the difference
			expect(xpAtLevel(expected.level) + progress.intoLevel).toBe(expected.total);
			expect(xpAtLevel(expected.level + 1) - xpAtLevel(expected.level)).toBe(expected.bandWidth);
		}
		// inside a level the ratio stays below 1 and reaches it only at the end
		expect(xpProgress(45).level).toBe(2);
		expect(xpProgress(45).intoLevel).toBe(15);
		expect(xpProgress(45).bandWidth).toBe(90);
		expect(xpProgress(45).toNextLevel).toBe(75);
		expect(xpProgress(119).ratio).toBeCloseTo(89 / 90, 10);
		expect(xpProgress(119).toNextLevel).toBe(1);
		expect(xpProgress(120).toNextLevel).toBe(150);
		expect(xpProgress(120).ratio).toBe(0);
	});

	it('keeps the progress values consistent over a wide range', () => {
		// Regression guard: `xpAtLevel` used to sum the bands (0, 30, 150, 480 …)
		// while `levelFor` switched at 30 * (L-1)^2, which produced a negative
		// `intoLevel` and a negative bar width from level 3 on; mixing the
		// cumulative threshold into the remainder reported too many missing XP.
		const totals = [
			0, 1, 29, 30, 60, 89, 119, 120, 150, 200, 269, 270, 300, 479, 480, 1000, 2430, 3150
		];
		for (const total of totals) {
			const progress = xpProgress(total);
			const bandStart = xpAtLevel(progress.level);
			const nextStart = xpAtLevel(progress.level + 1);
			expect(progress.level, `level at ${total}`).toBe(levelFor(total));
			expect(bandStart, `band start at ${total}`).toBeLessThanOrEqual(total);
			expect(nextStart, `next band start at ${total}`).toBeGreaterThan(total);
			expect(progress.intoLevel, `intoLevel at ${total}`).toBe(total - bandStart);
			expect(progress.intoLevel, `intoLevel at ${total}`).toBeGreaterThanOrEqual(0);
			expect(progress.intoLevel, `intoLevel at ${total}`).toBeLessThan(progress.bandWidth);
			expect(progress.bandWidth, `bandWidth at ${total}`).toBe(nextStart - bandStart);
			expect(progress.toNextLevel, `toNextLevel at ${total}`).toBe(nextStart - total);
			expect(progress.toNextLevel, `toNextLevel at ${total}`).toBe(
				progress.bandWidth - progress.intoLevel
			);
			expect(progress.ratio, `ratio at ${total}`).toBeGreaterThanOrEqual(0);
			expect(progress.ratio, `ratio at ${total}`).toBeLessThan(1);
			expect(progress.ratio, `ratio at ${total}`).toBeCloseTo(
				progress.intoLevel / progress.bandWidth,
				10
			);
			expect(xpToNextLevel(total), `xpToNextLevel at ${total}`).toBe(progress.toNextLevel);
		}
		// defensively clamped inputs
		expect(xpToNextLevel(-5)).toBe(30);
		expect(xpProgress(Number.NaN).level).toBe(1);
		expect(xpProgress(Number.NaN).toNextLevel).toBe(30);
		expect(xpProgress(Number.NaN).ratio).toBe(0);
	});

	it('reports the unchanged level for a badge without XP (gained 0)', () => {
		db = useTestDb();
		const user = makeUser('xp-badge-only');
		const goal = goalsRepo.createGoal(user.id, { title: 'Ziel' });
		// a real gain first, so the total is not 0
		postitsRepo.createPostit(user.id, { title: 'x' });
		award(user.id, [{ kind: 'goal_done', refId: goal.id, points: 50 }], 'goal', CONTEXT);
		expect(xpTotalOf(user.id)).toBe(50);

		// the cleanup trigger awards no XP, only its badge
		const again = award(user.id, [], 'cleanup', CONTEXT);
		expect(again.gained).toBe(0);
		expect(again.newBadges.map((entry) => entry.badge.id)).toEqual(['tidy_up']);
		// the response built from it carries the level of the unchanged total
		// (not 0/level 1), which is what keeps the sidebar chip stable
		const payload = withXp({ ok: true }, again).xp;
		expect(payload?.gained).toBe(0);
		expect(payload?.total).toBe(50);
		expect(payload?.level).toBe(2);
		expect(payload?.levelName).toBe('Espresso');
		// and the total itself is untouched
		expect(xpTotalOf(user.id)).toBe(50);
	});
});

describe('xp award payload', () => {
	it('reports a level up exactly when the band is crossed', () => {
		db = useTestDb();
		const user = makeUser('xp-levelup');
		// 6 post-its = 30 XP = level 2
		const ids: string[] = [];
		for (let index = 0; index < 6; index += 1) {
			ids.push(postitsRepo.createPostit(user.id, { title: `p${index}` }).id);
		}
		let levelUp = false;
		for (const [index, id] of ids.entries()) {
			const result = awardPostitDone(user.id, id, CONTEXT);
			expect(result.gained).toBe(5);
			if (index === 5) levelUp = result.levelUp;
		}
		expect(levelUp).toBe(true);
		expect(xpTotalOf(user.id)).toBe(30);
		expect(awardContextFor({ tz: 'Europe/Berlin', weekStart: 1 }).weekStart).toBe(1);
	});
});

describe('xp tenant separation (SPEC 6.6)', () => {
	it('awards and badge checks stay inside the own account', () => {
		db = useTestDb();
		const userA = makeUser('xp-user-a');
		const userB = makeUser('xp-user-b');
		const postitA = postitsRepo.createPostit(userA.id, { title: 'A' });
		postitsRepo.updatePostit(userA.id, postitA.id, { done: true }, CONTEXT.today);
		awardPostitDone(userA.id, postitA.id, CONTEXT);
		expect(xpTotalOf(userA.id)).toBe(5);
		expect(xpTotalOf(userB.id)).toBe(0);
		expect(xpEventsRepo.listXpEvents(userB.id)).toEqual([]);
		expect(badgesRepo.listEarned(userB.id)).toEqual([]);
		expect(badgesRepo.listEarned(userA.id).map((entry) => entry.badgeId)).toEqual(['first_step']);
		// B cannot award on A's post-it id either: the events are per user, and
		// A's total stays untouched
		awardPostitDone(userB.id, postitA.id, CONTEXT);
		expect(xpTotalOf(userA.id)).toBe(5);
		expect(xpTotalOf(userB.id)).toBe(5);
	});
});

// The habit-log side effect of SPEC 5.3 must not award XP twice for the same
// day, which is what the habit ref_id guarantees.
describe('habit log side effect and XP', () => {
	it('a post-it log and a tap log of the same day still award habit_log once per day', () => {
		db = useTestDb();
		const user = makeUser('xp-habit-log');
		const habit = habitsRepo.createHabit(user.id, {
			title: 'Lesen',
			cadence: 'week',
			targetCount: 3,
			maxPerDay: 3
		});
		const postit = postitsRepo.createPostit(user.id, {
			title: 'Lesen',
			habitId: habit.id,
			date: CONTEXT.today
		});
		habitLogsRepo.addPostitLog(user.id, habit.id, CONTEXT.today, postit.id);
		award(user.id, [{ kind: 'habit_log', refId: `${habit.id}:${CONTEXT.today}`, points: 10 }], 'habit', CONTEXT);
		award(user.id, [{ kind: 'habit_log', refId: `${habit.id}:${CONTEXT.today}`, points: 10 }], 'habit', CONTEXT);
		expect(xpTotalOf(user.id)).toBe(10);
	});

	it('journal entries of different days award separately', () => {
		db = useTestDb();
		const user = makeUser('xp-journal-days');
		const template = journalTemplatesRepo.createJournalTemplate(user.id, {
			name: 'Abend',
			fields: [{ id: 'note', type: 'text', label: 'Notiz', required: false, maxLength: 100 }]
		});
		for (const date of ['2026-09-20', '2026-09-21']) {
			journalEntriesRepo.createJournalEntry(user.id, template, {
				entryDate: date,
				slot: null,
				values: { note: 'ok' }
			});
			award(
				user.id,
				[{ kind: 'journal_entry', refId: `${template.id}:${date}:none`, points: 15 }],
				'journal',
				CONTEXT
			);
		}
		expect(xpTotalOf(user.id)).toBe(30);
	});
});
