import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AI_USAGE_RETENTION_DAYS,
	PURGE_INTERVAL_MS,
	RETENTION_DAYS,
	aiUsageCutoff,
	purgeJobAllowed,
	retentionCutoff,
	runPurge,
	startPurgeJob
} from './purge.js';
import type { SqliteDatabase } from './db.js';
import * as aiUsageRepo from './repo/aiUsage.js';
import * as goalsRepo from './repo/goals.js';
import * as habitsRepo from './repo/habits.js';
import * as journalTemplatesRepo from './repo/journalTemplates.js';
import * as keyResultsRepo from './repo/keyResults.js';
import * as linkCodesRepo from './repo/linkCodes.js';
import * as postitsRepo from './repo/postits.js';
import * as sessionsRepo from './repo/sessions.js';
import * as usersRepo from './repo/users.js';
import { useTestDb } from './testdb.js';

// SPEC 6.8: the purge job is a retention boundary. These tests pin the exact
// boundary (14 days for soft-deleted rows, 7 days for ai_usage), prove that the
// cascades fire, that nothing live is touched and that the job never throws.

const NOW = new Date('2026-09-24T03:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
	return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

function makeUser(db: SqliteDatabase, username = 'purgeuser'): string {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'scrypt$1$1$1$salt$hash',
		recoveryHash: 'scrypt$1$1$1$salt$hash',
		ageConfirmedAt: NOW.toISOString()
	});
	return user.id;
}

describe('retention cutoffs', () => {
	it('cut off exactly 14 and 7 days behind now', () => {
		expect(retentionCutoff(NOW)).toBe('2026-09-10T03:00:00.000Z');
		expect(retentionCutoff(NOW, RETENTION_DAYS)).toBe('2026-09-10T03:00:00.000Z');
		expect(aiUsageCutoff(NOW)).toBe('2026-09-17');
		expect(aiUsageCutoff(NOW, AI_USAGE_RETENTION_DAYS)).toBe('2026-09-17');
	});
});

describe('runPurge', () => {
	let db: SqliteDatabase;
	let userId: string;

	beforeEach(() => {
		db = useTestDb();
		userId = makeUser(db);
	});

	function createPostit(title: string, deletedAgoDays: number | null): string {
		const postit = postitsRepo.createPostit(userId, { title, date: '2026-09-01' });
		if (deletedAgoDays !== null) {
			db.prepare('UPDATE postits SET deleted_at = ? WHERE id = ?').run(
				daysAgo(deletedAgoDays),
				postit.id
			);
		}
		return postit.id;
	}

	it('hard-deletes soft-deleted rows older than 14 days and keeps fresh ones', () => {
		const old = createPostit('alt', 15);
		const fresh = createPostit('frisch', 13);

		const goal = goalsRepo.createGoal(userId, { title: 'Altes Ziel' });
		db.prepare('UPDATE goals SET deleted_at = ? WHERE id = ?').run(daysAgo(20), goal.id);

		const habit = habitsRepo.createHabit(userId, {
			title: 'Altes Habit',
			cadence: 'week',
			targetCount: 3
		});
		db.prepare('UPDATE habits SET deleted_at = ? WHERE id = ?').run(daysAgo(15), habit.id);

		const template = journalTemplatesRepo.createJournalTemplate(userId, {
			name: 'Alte Vorlage',
			fields: [
				{
					id: 'mood',
					type: 'scale',
					label: 'Stimmung',
					required: false,
					min: 1,
					max: 5,
					style: 'faces'
				}
			]
		});
		db.prepare('UPDATE journal_templates SET deleted_at = ? WHERE id = ?').run(
			daysAgo(15),
			template.id
		);
		// Exactly at the cutoff: 14 days old is *not* "older than 14 days".
		const boundary = journalTemplatesRepo.createJournalTemplate(userId, {
			name: 'Grenzfall',
			fields: [
				{
					id: 'note',
					type: 'text',
					label: 'Notiz',
					required: false,
					maxLength: 100
				}
			]
		});
		db.prepare('UPDATE journal_templates SET deleted_at = ? WHERE id = ?').run(
			daysAgo(14),
			boundary.id
		);

		const result = runPurge(NOW);

		expect(result.errors).toEqual([]);
		expect(result.removed).toMatchObject({
			postits: 1,
			goals: 1,
			habits: 1,
			journalTemplates: 1
		});

		expect(postitsRepo.getPostit(userId, fresh)).not.toBeNull();
		expect(postitsRepo.getPostit(userId, old)).toBeNull();
		expect(goalsRepo.getGoal(userId, goal.id)).toBeNull();
		expect(habitsRepo.getHabitRow(userId, habit.id)).toBeNull();
		expect(journalTemplatesRepo.getJournalTemplateRow(userId, template.id)).toBeNull();
		expect(journalTemplatesRepo.getJournalTemplateRow(userId, boundary.id)).not.toBeNull();
	});

	it('keeps stale but live rows untouched', () => {
		const live = postitsRepo.createPostit(userId, { title: 'nie gelöscht' });
		db.prepare('UPDATE postits SET created_at = ? WHERE id = ?').run(daysAgo(400), live.id);

		runPurge(NOW);

		expect(postitsRepo.getPostit(userId, live.id)).not.toBeNull();
	});

	it('cascades: key results and habit logs go with their parent', () => {
		const goal = goalsRepo.createGoal(userId, { title: 'Ziel' });
		const kr = keyResultsRepo.createKeyResult(userId, goal.id, { title: 'KR', targetValue: 10 });
		expect(kr).not.toBeNull();
		db.prepare('UPDATE goals SET deleted_at = ? WHERE id = ?').run(daysAgo(30), goal.id);

		const habit = habitsRepo.createHabit(userId, {
			title: 'Habit',
			cadence: 'week',
			targetCount: 1
		});
		db.prepare(
			`INSERT INTO habit_logs (id, user_id, habit_id, log_date, source, postit_id, created_at)
			 VALUES ('log-1', ?, ?, '2026-09-01', 'tap', NULL, ?)`
		).run(userId, habit.id, daysAgo(30));
		db.prepare('UPDATE habits SET deleted_at = ? WHERE id = ?').run(daysAgo(30), habit.id);

		runPurge(NOW);

		expect(db.prepare('SELECT COUNT(*) AS n FROM key_results WHERE id = ?').get(kr!.id)).toEqual({
			n: 0
		});
		expect(
			db.prepare('SELECT COUNT(*) AS n FROM habit_logs WHERE habit_id = ?').get(habit.id)
		).toEqual({ n: 0 });
	});

	it('deletes expired sessions and link codes, keeps valid ones', () => {
		sessionsRepo.insertSession({
			id: 'expired-session',
			user_id: userId,
			created_at: daysAgo(40),
			expires_at: daysAgo(1),
			user_agent: null
		});
		sessionsRepo.insertSession({
			id: 'valid-session',
			user_id: userId,
			created_at: daysAgo(2),
			expires_at: daysAgo(-5),
			user_agent: null
		});
		db.prepare('INSERT INTO link_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
			'old-code',
			userId,
			daysAgo(1)
		);
		db.prepare('INSERT INTO link_codes (code_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
			'fresh-code',
			userId,
			daysAgo(-1)
		);

		const result = runPurge(NOW);

		expect(result.removed.sessions).toBe(1);
		expect(result.removed.linkCodes).toBe(1);
		expect(db.prepare('SELECT id FROM sessions').all()).toEqual([{ id: 'valid-session' }]);
		expect(db.prepare('SELECT code_hash FROM link_codes').all()).toEqual([
			{ code_hash: 'fresh-code' }
		]);
		// The repo function is the one the purge calls for link codes.
		expect(linkCodesRepo.purgeExpired(NOW.toISOString())).toBe(0);
	});

	it('deletes ai_usage older than 7 days and keeps the cutoff day', () => {
		aiUsageRepo.consume(userId, '2026-09-24', 30); // today
		aiUsageRepo.consume(userId, '2026-09-17', 30); // exactly at the cutoff
		aiUsageRepo.consume(userId, '2026-09-16', 30); // one day older

		const result = runPurge(NOW);

		expect(result.removed.aiUsage).toBe(1);
		expect(aiUsageRepo.countFor(userId, '2026-09-24')).toBe(1);
		expect(aiUsageRepo.countFor(userId, '2026-09-17')).toBe(1);
		expect(aiUsageRepo.countFor(userId, '2026-09-16')).toBe(0);
	});

	it('never throws, reports the failing step and keeps going', () => {
		const spy = vi.spyOn(postitsRepo, 'purgeDeleted').mockImplementation(() => {
			throw new Error('database is locked');
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		let result!: ReturnType<typeof runPurge>;
		expect(() => {
			result = runPurge(NOW);
		}).not.toThrow();

		expect(result.removed.postits).toBe(0);
		expect(result.errors).toEqual(['postits: database is locked']);
		expect(errorSpy).toHaveBeenCalledOnce();
		expect(result.removed.aiUsage).toBe(0); // the remaining steps ran

		spy.mockRestore();
		errorSpy.mockRestore();
	});

	it('is idempotent: a second run removes nothing more', () => {
		createPostit('alt', 30);
		runPurge(NOW);
		const second = runPurge(NOW);
		expect(second.removed.postits).toBe(0);
		expect(second.errors).toEqual([]);
	});

	it('is empty-safe: a fresh database is a no-op', () => {
		const result = runPurge(NOW);
		expect(result.errors).toEqual([]);
		expect(Object.values(result.removed).every((count) => count === 0)).toBe(true);
	});
});

describe('purge schedule', () => {
	it('never runs inside a test process', () => {
		expect(purgeJobAllowed({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(false);
		expect(purgeJobAllowed({ VITEST: 'true' } as NodeJS.ProcessEnv)).toBe(false);
		expect(purgeJobAllowed({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
	});

	it('runs once at start and then every 6 h', () => {
		vi.useFakeTimers();
		const db = useTestDb();
		const userId = makeUser(db, 'scheduleuser');
		const first = postitsRepo.createPostit(userId, { title: 'alt' });
		db.prepare('UPDATE postits SET deleted_at = ? WHERE id = ?').run(daysAgo(20), first.id);
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		const timer = startPurgeJob();
		expect(postitsRepo.getPostit(userId, first.id)).toBeNull(); // initial run happened

		const second = postitsRepo.createPostit(userId, { title: 'auch alt' });
		db.prepare('UPDATE postits SET deleted_at = ? WHERE id = ?').run(daysAgo(20), second.id);
		vi.advanceTimersByTime(PURGE_INTERVAL_MS - 1);
		expect(postitsRepo.getPostit(userId, second.id)).not.toBeNull();
		vi.advanceTimersByTime(1);
		expect(postitsRepo.getPostit(userId, second.id)).toBeNull();

		clearInterval(timer);
		logSpy.mockRestore();
		vi.useRealTimers();
	});
});
