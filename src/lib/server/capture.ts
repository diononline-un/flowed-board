import { randomUUID } from 'node:crypto';
import { env } from './env.js';
import { buildSystemPrompt, callLlm, type CallLlm } from './llm.js';
import { captureUserLimiter, type RateLimiter } from './ratelimit.js';
import * as aiUsageRepo from './repo/aiUsage.js';
import * as goalsRepo from './repo/goals.js';
import * as habitsRepo from './repo/habits.js';
import * as postitsRepo from './repo/postits.js';
import { todayIn } from '$lib/shared/date.js';
import type { CaptureItem } from '$lib/shared/schemas.js';
import type { PublicPostit, PublicUser } from '$lib/shared/types.js';

// Quick-Capture orchestration (SPEC 9): rate limit -> consent gate -> daily
// cap -> LLM parse -> fallback. `parse` never writes user content to the DB
// (SPEC 9.1); only commit/undo do. The LLM receives nothing but the raw
// capture text (SPEC 9.5) — no journal data, no titles, no goals as context.

const MAX_ITEMS = 10; // SPEC 9.2 cap

export interface CaptureDeps {
	// Injectable LLM client (tests substitute a fake — no network in tests).
	callLlm?: CallLlm;
	// Injectable sliding-window limiter (tests pass a fresh one).
	rateLimiter?: RateLimiter;
	dailyLimit?: number;
	// Injectable clock so tests can pin "today".
	now?: Date;
}

export type ParseResult =
	| { kind: 'ok'; items: CaptureItem[]; fallback: boolean }
	| { kind: 'rate_limited'; retryAfterSec: number }
	| { kind: 'ai_limit' };

// SPEC 9.5: AI is used only after an explicit consent timestamp with the
// toggle still on. Without a decision there is no silent sending.
export function hasAiConsent(user: PublicUser): boolean {
	return user.prefs.aiConsentAt !== null && user.prefs.aiEnabled;
}

// SPEC 9.4 fallback: the raw text becomes a single post-it scheduled today.
export function fallbackItems(text: string, today: string): CaptureItem[] {
	return [
		{
			title: text.slice(0, 140),
			date: today,
			time: null,
			suggestedGoalTitle: null,
			suggestedHabit: null
		}
	];
}

// LLM output hygiene (SPEC 9.1): a date must never lie in the past — clamp
// stragglers to today — and the 10-item cap is enforced here as well.
function normalizeItems(items: CaptureItem[], today: string): CaptureItem[] {
	return items
		.slice(0, MAX_ITEMS)
		.map((item) => (item.date !== null && item.date < today ? { ...item, date: today } : item));
}

// SPEC 9.1 flow for POST /api/capture/parse. Order note: the consent gate
// runs before the daily counter is consumed so users without consent never
// burn quota for calls that cannot happen anyway (see DECISIONS.md).
export async function parseCapture(
	user: PublicUser,
	text: string,
	deps: CaptureDeps = {}
): Promise<ParseResult> {
	const limiter = deps.rateLimiter ?? captureUserLimiter;
	const rate = limiter.check(user.id);
	if (!rate.allowed) return { kind: 'rate_limited', retryAfterSec: rate.retryAfterSec };

	const today = todayIn(user.tz, deps.now);
	if (!hasAiConsent(user)) {
		return { kind: 'ok', items: fallbackItems(text, today), fallback: true };
	}

	const limit = deps.dailyLimit ?? env.AI_DAILY_LIMIT_PER_USER;
	if (!aiUsageRepo.consume(user.id, today, limit)) {
		return { kind: 'ai_limit' };
	}

	try {
		const systemPrompt = buildSystemPrompt({ today, weekStart: user.weekStart });
		const llm = deps.callLlm ?? callLlm;
		const items = normalizeItems(await llm(text, systemPrompt), today);
		if (items.length === 0) {
			return { kind: 'ok', items: fallbackItems(text, today), fallback: true };
		}
		return { kind: 'ok', items, fallback: false };
	} catch {
		// Unreachable endpoint, timeout, invalid answer — the flow never
		// breaks (SPEC 9.4).
		return { kind: 'ok', items: fallbackItems(text, today), fallback: true };
	}
}

// SPEC 7 commit: creates the post-its of one batch. suggestedGoalTitle /
// suggestedHabit are matched against existing own rows by exact title
// (case-insensitive); unknown titles stay unassigned — no auto-creation.
export function commitCapture(
	user: PublicUser,
	items: CaptureItem[],
	deps: Pick<CaptureDeps, 'now'> = {}
): { batchId: string; created: PublicPostit[] } {
	const batchId = randomUUID();
	const created: PublicPostit[] = [];
	for (const item of items.slice(0, MAX_ITEMS)) {
		const goal = item.suggestedGoalTitle
			? goalsRepo.findByTitle(user.id, item.suggestedGoalTitle)
			: null;
		const habit = item.suggestedHabit
			? habitsRepo.findByTitle(user.id, item.suggestedHabit.title)
			: null;
		created.push(
			postitsRepo.createPostit(user.id, {
				title: item.title,
				date: item.date,
				time: item.time,
				goalId: goal?.id ?? null,
				habitId: habit?.id ?? null,
				batchId
			})
		);
	}
	return { batchId, created };
}

// SPEC 7 undo (AC3): soft-deletes exactly this batch.
export function undoCapture(
	user: PublicUser,
	batchId: string,
	deps: Pick<CaptureDeps, 'now'> = {}
): PublicPostit[] {
	return postitsRepo.softDeleteBatch(user.id, batchId, todayIn(user.tz, deps.now));
}
