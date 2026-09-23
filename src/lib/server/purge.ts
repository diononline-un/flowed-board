import * as aiUsageRepo from './repo/aiUsage.js';
import * as goalsRepo from './repo/goals.js';
import * as habitsRepo from './repo/habits.js';
import * as journalTemplatesRepo from './repo/journalTemplates.js';
import * as linkCodesRepo from './repo/linkCodes.js';
import * as postitsRepo from './repo/postits.js';
import * as sessionsRepo from './repo/sessions.js';

// Background job of SPEC 6.8: hard-deletes what soft-delete only marked.
//
// Runs once at server start and then every six hours. Every step is wrapped in
// its own try/catch, so a failing step is logged and the rest of the run (and
// the server itself) continues — the job may never break the app.
//
// Started exclusively from a real server run (hooks.server.ts) and guarded
// against test runs, so unit tests never spawn a timer.

export const RETENTION_DAYS = 14; // SPEC 4.1: soft-deleted rows live 14 days
export const AI_USAGE_RETENTION_DAYS = 7; // SPEC 6.8
export const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000; // SPEC 6.8: every 6 h

export interface PurgeResult {
	cutoff: string;
	aiUsageCutoff: string;
	removed: {
		postits: number;
		goals: number;
		habits: number;
		journalTemplates: number;
		sessions: number;
		linkCodes: number;
		aiUsage: number;
	};
	errors: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Cutoff helpers are exported so the tests can assert the boundary without
// duplicating the arithmetic.
export function retentionCutoff(now: Date = new Date(), days = RETENTION_DAYS): string {
	return new Date(now.getTime() - days * DAY_MS).toISOString();
}

export function aiUsageCutoff(now: Date = new Date(), days = AI_USAGE_RETENTION_DAYS): string {
	return new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

// One full pass. Never throws: each step is isolated and its error recorded.
export function runPurge(now: Date = new Date()): PurgeResult {
	const cutoff = retentionCutoff(now);
	const usageCutoff = aiUsageCutoff(now);
	const result: PurgeResult = {
		cutoff,
		aiUsageCutoff: usageCutoff,
		removed: {
			postits: 0,
			goals: 0,
			habits: 0,
			journalTemplates: 0,
			sessions: 0,
			linkCodes: 0,
			aiUsage: 0
		},
		errors: []
	};

	step(result, 'postits', () => postitsRepo.purgeDeleted(cutoff));
	step(result, 'goals', () => goalsRepo.purgeDeleted(cutoff));
	// habit_logs carry no deleted_at of their own; they disappear with their
	// habit through ON DELETE CASCADE (SPEC 6.8 names them for that reason).
	step(result, 'habits', () => habitsRepo.purgeDeleted(cutoff));
	step(result, 'journalTemplates', () => journalTemplatesRepo.purgeDeleted(cutoff));
	step(result, 'sessions', () => sessionsRepo.deleteExpired(now.toISOString()));
	step(result, 'linkCodes', () => linkCodesRepo.purgeExpired(now.toISOString()));
	step(result, 'aiUsage', () => aiUsageRepo.purgeOlderThan(usageCutoff));

	return result;
}

function step(result: PurgeResult, name: keyof PurgeResult['removed'], run: () => number): void {
	try {
		result.removed[name] = run();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		result.errors.push(`${name}: ${message}`);
		// Only the step name and the driver message — never user content.
		console.error(`purge: step "${name}" failed: ${message}`);
	}
}

// Starts the SPEC-6.8 schedule: one run immediately, then every 6 h. The timer
// is unref'd so it never keeps a shutting-down process alive.
export function startPurgeJob(): NodeJS.Timeout {
	const first = runPurge();
	console.log(
		`purge: initial run removed ${Object.entries(first.removed)
			.map(([key, value]) => `${key}=${value}`)
			.join(' ')}`
	);
	const timer = setInterval(() => {
		try {
			runPurge();
		} catch (error) {
			// runPurge already isolates every step; this is the last net.
			console.error('purge: unexpected failure', error);
		}
	}, PURGE_INTERVAL_MS);
	timer.unref();
	return timer;
}

// SPEC 15/constraints: never start the timer inside a test run.
export function purgeJobAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
	return env.NODE_ENV !== 'test' && !env.VITEST;
}
