import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	commitCapture,
	fallbackItems,
	hasAiConsent,
	parseCapture,
	undoCapture,
	type CaptureDeps
} from './capture.js';
import { buildSystemPrompt, parseLlmContent } from './llm.js';
import { createLimiter } from './ratelimit.js';
import type { SqliteDatabase } from './db.js';
import * as aiUsageRepo from './repo/aiUsage.js';
import * as goalsRepo from './repo/goals.js';
import * as postitsRepo from './repo/postits.js';
import * as usersRepo from './repo/users.js';
import { useTestDb } from './testdb.js';
import { parsePrefs, type CaptureItem } from '$lib/shared/schemas.js';
import type { PublicUser } from '$lib/shared/types.js';

// Quick Capture (SPEC 9): fallback paths, daily cap, consent gate, prompt
// contents, the 9.5 hard rule (static scan), commit/undo batch semantics.
// The LLM client is always injected — no network in tests.

let db: SqliteDatabase;
const NOW = new Date('2026-09-21T10:00:00.000Z'); // a Monday
const TODAY = '2026-09-21';

function makeUser(username: string, consent: boolean): PublicUser {
	const created = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	if (!consent) return created;
	return usersRepo.updateProfile(created.id, {
		prefs: parsePrefs(
			JSON.stringify({ aiConsentAt: '2026-01-01T00:00:00.000Z', aiEnabled: true })
		)
	})!;
}

function makeHabit(userId: string, title: string): string {
	const id = randomUUID();
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO habits (
			id, user_id, goal_id, title, color, cadence, target_count, max_per_day,
			position, is_example, created_at, updated_at
		) VALUES (?, ?, NULL, ?, 'mint', 'week', 3, 1, 0, 0, ?, ?)`
	).run(id, userId, title, now, now);
	return id;
}

function deps(overrides: Partial<CaptureDeps> = {}): CaptureDeps {
	return { rateLimiter: createLimiter(5, 60_000), now: NOW, ...overrides };
}

function item(partial: Partial<CaptureItem> & { title: string }): CaptureItem {
	return {
		date: null,
		time: null,
		suggestedGoalTitle: null,
		suggestedHabit: null,
		...partial
	};
}

describe('capture parse (SPEC 9.1–9.4)', () => {
	it('returns LLM items untouched when everything works (AC1 shape)', async () => {
		db = useTestDb();
		const user = makeUser('cap-ok', true);
		const llmItems = [
			item({ title: 'Sport', date: '2026-09-28' }), // next Monday
			item({ title: 'lernen', date: '2026-09-22' }), // Tuesday
			item({ title: 'lernen', date: '2026-09-23' }) // Wednesday
		];
		let seenPrompt = '';
		const result = await parseCapture(user, 'Montag Sport, Dienstag und Mittwoch lernen', {
			...deps(),
			callLlm: async (_text, prompt) => {
				seenPrompt = prompt;
				return llmItems;
			}
		});
		expect(result).toEqual({ kind: 'ok', items: llmItems, fallback: false });
		expect(seenPrompt).toContain(TODAY);
	});

	it('falls back on a failed call, a timeout and an empty result (9.4)', async () => {
		db = useTestDb();
		const user = makeUser('cap-fallback', true);
		const expected = fallbackItems('Dachrinne putzen', TODAY);

		const failure = await parseCapture(user, 'Dachrinne putzen', {
			...deps(),
			callLlm: () => Promise.reject(new Error('connect failed'))
		});
		expect(failure).toEqual({ kind: 'ok', items: expected, fallback: true });

		const timeout = await parseCapture(user, 'Dachrinne putzen', {
			...deps(),
			callLlm: () => Promise.reject(new Error('aborted'))
		});
		expect(timeout).toEqual({ kind: 'ok', items: expected, fallback: true });

		const empty = await parseCapture(user, 'Dachrinne putzen', {
			...deps(),
			callLlm: () => Promise.resolve([])
		});
		expect(empty).toEqual({ kind: 'ok', items: expected, fallback: true });
	});

	it('fallback truncates the title at 140 chars and dates it today', () => {
		const [fallback] = fallbackItems('x'.repeat(200), TODAY);
		expect(fallback?.title).toHaveLength(140);
		expect(fallback?.date).toBe(TODAY);
		expect(fallback?.time).toBeNull();
		expect(fallback?.suggestedGoalTitle).toBeNull();
		expect(fallback?.suggestedHabit).toBeNull();
	});

	it('clamps past dates to today — never backwards (9.1)', async () => {
		db = useTestDb();
		const user = makeUser('cap-past', true);
		const result = await parseCapture(user, 'gestern lernen', {
			...deps(),
			callLlm: () => Promise.resolve([item({ title: 'lernen', date: '2026-09-20' })])
		});
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.items[0]?.date).toBe(TODAY);
	});

	it('enforces the daily cap: 429-style result, no LLM call, no increment (9.3)', async () => {
		db = useTestDb();
		const user = makeUser('cap-limit', true);
		let llmCalls = 0;
		const injected = deps({
			dailyLimit: 2,
			callLlm: () => {
				llmCalls += 1;
				return Promise.resolve([item({ title: 'A' })]);
			}
		});
		await parseCapture(user, 'eins', injected);
		await parseCapture(user, 'zwei', injected);
		expect(llmCalls).toBe(2);
		expect(aiUsageRepo.countFor(user.id, TODAY)).toBe(2);

		const third = await parseCapture(user, 'drei', injected);
		expect(third).toEqual({ kind: 'ai_limit' });
		expect(llmCalls).toBe(2); // no LLM call beyond the cap
		expect(aiUsageRepo.countFor(user.id, TODAY)).toBe(2);
	});

	it('gates on consent: no consent -> fallback, no LLM call, no usage (9.5)', async () => {
		db = useTestDb();
		const undecided = makeUser('cap-undecided', false);
		expect(hasAiConsent(undecided)).toBe(false);
		let llmCalls = 0;
		const result = await parseCapture(undecided, 'Montag Sport', {
			...deps(),
			callLlm: () => {
				llmCalls += 1;
				return Promise.resolve([item({ title: 'Sport' })]);
			}
		});
		expect(llmCalls).toBe(0);
		expect(result).toEqual({
			kind: 'ok',
			items: fallbackItems('Montag Sport', TODAY),
			fallback: true
		});
		expect(aiUsageRepo.countFor(undecided.id, TODAY)).toBe(0);

		// Consent given but toggle switched off again -> still no AI.
		const disabled = usersRepo.updateProfile(undecided.id, {
			prefs: parsePrefs(
				JSON.stringify({ aiConsentAt: '2026-01-01T00:00:00.000Z', aiEnabled: false })
			)
		})!;
		expect(hasAiConsent(disabled)).toBe(false);
	});

	it('rate-limits before anything else runs', async () => {
		db = useTestDb();
		const user = makeUser('cap-rate', true);
		let llmCalls = 0;
		const injected = deps({
			rateLimiter: createLimiter(1, 60_000),
			callLlm: () => {
				llmCalls += 1;
				return Promise.resolve([item({ title: 'A' })]);
			}
		});
		await parseCapture(user, 'eins', injected);
		const limited = await parseCapture(user, 'zwei', injected);
		expect(limited.kind).toBe('rate_limited');
		if (limited.kind !== 'rate_limited') return;
		expect(limited.retryAfterSec).toBeGreaterThan(0);
		expect(llmCalls).toBe(1);
	});
});

describe('capture prompt (SPEC 9.2)', () => {
	it('fills date, weekday and week_start into the fixed system prompt', () => {
		const prompt = buildSystemPrompt({ today: TODAY, weekStart: 1 });
		expect(prompt).toContain('Montag, der 2026-09-21');
		expect(prompt).toContain('Montag (week_start)');
		expect(prompt).toContain('ausschließlich JSON');
		expect(prompt).toContain('"date":"YYYY-MM-DD"|null');
		expect(prompt).toContain('nie in der Vergangenheit');
		expect(prompt).toContain('date auf null');
		expect(prompt).toContain('suggestedHabit');
		expect(prompt).toContain('Maximal 10 Items');

		const sundayStart = buildSystemPrompt({ today: '2026-09-20', weekStart: 0 });
		expect(sundayStart).toContain('Sonntag, der 2026-09-20');
		expect(sundayStart).toContain('Sonntag (week_start)');
	});

	it('parses JSON-mode answers and extracts braces from prose answers', () => {
		const payload = { items: [item({ title: 'Sport', date: '2026-09-28' })] };
		expect(parseLlmContent(JSON.stringify(payload))).toEqual(payload.items);
		expect(parseLlmContent(`Hier ist das Ergebnis: ${JSON.stringify(payload)} (fertig)`)).toEqual(
			payload.items
		);
		expect(() => parseLlmContent('gar kein JSON')).toThrow();
		expect(() => parseLlmContent('{"items":[{"title":""}]}')).toThrow();
	});
});

describe('capture commit/undo (SPEC 7, AC3)', () => {
	it('creates one batch with goal/habit matched by exact title only', () => {
		db = useTestDb();
		const user = makeUser('cap-commit', true);
		const goal = goalsRepo.createGoal(user.id, { title: 'Fitness' });
		const habitId = makeHabit(user.id, 'Laufen');

		const { batchId, created } = commitCapture(
			user,
			[
				item({
					title: 'Sport',
					date: '2026-09-28',
					suggestedGoalTitle: 'fitness', // case-insensitive match
					suggestedHabit: { title: 'LAUFEN', cadence: 'week', targetCount: 3 }
				}),
				item({ title: 'lernen', date: '2026-09-22', suggestedGoalTitle: 'unbekannt' }),
				item({
					title: 'lesen',
					suggestedHabit: { title: 'gibts nicht', cadence: 'month', targetCount: 5 }
				})
			],
			deps()
		);

		expect(created).toHaveLength(3);
		expect(created.every((postit) => postit.batchId === batchId)).toBe(true);
		expect(created[0]?.goalId).toBe(goal.id);
		expect(created[0]?.habitId).toBe(habitId);
		// Unknown titles stay unassigned — nothing is auto-created.
		expect(created[1]?.goalId).toBeNull();
		expect(created[2]?.habitId).toBeNull();
		expect(goalsRepo.listGoals(user.id)).toHaveLength(1);
	});

	it('undo soft-deletes exactly the batch, nothing else (AC3)', () => {
		db = useTestDb();
		const user = makeUser('cap-undo', true);
		const other = postitsRepo.createPostit(user.id, { title: 'bleibt' });
		const { created } = commitCapture(
			user,
			[item({ title: 'A' }), item({ title: 'B' })],
			deps()
		);
		const secondBatch = commitCapture(user, [item({ title: 'C' })], deps());

		const removed = undoCapture(user, secondBatch.batchId, deps());
		expect(removed.map((postit) => postit.title)).toEqual(['C']);

		const alive = postitsRepo.listPostits(user.id).map((postit) => postit.title);
		expect(alive).toContain('A');
		expect(alive).toContain('B');
		expect(alive).toContain('bleibt');
		expect(alive).not.toContain('C');
		expect(postitsRepo.getPostit(user.id, other.id)?.deleted_at).toBeNull();
		expect(
			created.every((postit) => postitsRepo.getPostit(user.id, postit.id)?.deleted_at === null)
		).toBe(true);
	});
});

describe('hard rule 9.5: journal data never reaches llm.ts (static scan)', () => {
	// Import/require lines only, comments stripped — the rule is about code
	// paths, not about the comments that document it.
	function codeOnly(source: string): string {
		return source
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/.*$/gm, '');
	}

	function serverFiles(dir: string): string[] {
		const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
			.map((entry) => join(entry.parentPath, entry.name));
	}

	it('llm.ts and capture.ts contain no journal reference in code', () => {
		for (const file of ['llm.ts', 'capture.ts']) {
			const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
			expect(codeOnly(source).toLowerCase()).not.toContain('journal');
		}
	});

	it('llm.ts imports no repository module (it cannot read the DB at all)', () => {
		const source = codeOnly(readFileSync(new URL('./llm.ts', import.meta.url), 'utf8'));
		expect(source).not.toMatch(/from\s+'(\.\/|\$lib\/server\/)repo\//);
		expect(source).not.toContain('getDb');
	});

	it('the only non-test importer of llm.ts is capture.ts', () => {
		const serverDir = new URL('./', import.meta.url).pathname;
		const routesDir = new URL('../../routes/', import.meta.url).pathname;
		const importers = [...serverFiles(serverDir), ...serverFiles(routesDir)]
			.filter((file) => !file.endsWith('.test.ts') && !file.endsWith('llm.ts'))
			.filter((file) => /from\s+'[^']*llm\.js'/.test(codeOnly(readFileSync(file, 'utf8'))));
		expect(importers).toEqual([join(serverDir, 'capture.ts')]);
	});
});
