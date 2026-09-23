import * as xpEventsRepo from './repo/xpEvents.js';
import { evaluateBadges, gatherBadgeFacts, type BadgeTrigger } from './badges.js';
import { badgeDefinition, type BadgeDefinition, type BadgeId } from '$lib/shared/badges.js';
import { todayIn } from '$lib/shared/date.js';
import { makeEvent, xpProgress, type XpEvent } from '$lib/shared/xp.js';

// XP service (SPEC 5.6). The award path lives here; the numbers, the level
// formula and the badge rules live in `$lib/shared/xp.ts` / `badges.ts`.
//
// Two invariants of P7 are enforced at this layer:
//   1. points are only added when an event was really inserted (INSERT OR
//      IGNORE plus the UNIQUE index), so done → reopen → done cannot farm XP;
//   2. XP never decrease — no code path subtracts.

export interface XpAward {
	gained: number;
	total: number;
	level: number;
	levelName: string;
	levelUp: boolean;
}

export interface XpResponse {
	// Null when the action produced neither points nor a badge.
	xp: XpAward | null;
	// Only the badges awarded by this very request.
	newBadges: { badge: BadgeDefinition; earnedAt: string }[];
}

export const NO_XP: XpResponse = { xp: null, newBadges: [] };

// The badge rules need the user's day boundary (which week a log belongs to)
// and their week start, so every award carries those two values.
export interface AwardContext {
	today: string;
	weekStart: 0 | 1 | 6;
}

export function awardContextFor(user: { tz: string; weekStart: 0 | 1 | 6 }): AwardContext {
	return { today: todayIn(user.tz), weekStart: user.weekStart };
}

export function xpTotalOf(userId: string): number {
	return xpEventsRepo.getXpTotal(userId);
}

// One post-it completion (SPEC 5.6 `postit_done`).
export function awardPostitDone(
	userId: string,
	postitId: string,
	context: AwardContext
): XpResponse {
	return award(userId, [makeEvent('postit_done', postitId)], 'postit', context);
}

// One habit log. The ref_id is `${habit_id}:${log_date}`, so several taps of
// the same day (up to max_per_day) share a single award (SPEC 5.6).
export function awardHabitLog(
	userId: string,
	habitId: string,
	logDate: string,
	context: AwardContext
): XpResponse {
	return award(userId, [makeEvent('habit_log', `${habitId}:${logDate}`)], 'habit', context);
}

// One journal entry; a repeated (template, day, slot) is refused by AC13, a
// NULL slot counts as `none` and may repeat legitimately (SPEC 5.6).
export function awardJournalEntry(
	userId: string,
	entry: { templateId: string | null; entryDate: string; slot: string | null },
	context: AwardContext
): XpResponse {
	return award(
		userId,
		[
			makeEvent(
				'journal_entry',
				`${entry.templateId ?? 'x'}:${entry.entryDate}:${entry.slot ?? 'none'}`
			)
		],
		'journal',
		context
	);
}

export function awardKeyResultDone(
	userId: string,
	keyResultId: string,
	context: AwardContext
): XpResponse {
	return award(userId, [makeEvent('kr_done', keyResultId)], 'keyResult', context);
}

export function awardGoalDone(userId: string, goalId: string, context: AwardContext): XpResponse {
	return award(userId, [makeEvent('goal_done', goalId)], 'goal', context);
}

// Quick-Capture commit: one award per batch, so gaining points again requires
// a new batch — which is real work, not a toggle (SPEC 5.6).
export function awardCaptureUsed(
	userId: string,
	batchId: string,
	context: AwardContext
): XpResponse {
	return award(userId, [makeEvent('capture_used', batchId)], 'capture', context);
}

// Running the cleanup sheet awards nothing by itself; it is the `tidy_up`
// badge trigger (SPEC 5.6), so the caller passes an empty event list with the
// `cleanup` trigger and only the badge check runs.
export function awardCleanup(userId: string, context: AwardContext): XpResponse {
	return award(userId, [], 'cleanup', context);
}

// Triggers that exist purely because of a badge (SPEC 5.6 `goal_setter`,
// `tidy_up`, a key result that starts out complete): no XP event is written,
// the badge check still runs.
export function badgeOnlyResponse(
	userId: string,
	trigger: BadgeTrigger,
	context: AwardContext
): XpResponse {
	return award(userId, [], trigger, context);
}

// Central award path: insert the events, add exactly the inserted points, then
// check the badges. Everything the client may show is in the result.
export function award(
	userId: string,
	events: readonly XpEvent[],
	trigger: BadgeTrigger,
	context: AwardContext
): XpResponse {
	const recorded = xpEventsRepo.insertIgnored(userId, events);
	const before = xpEventsRepo.getXpTotal(userId);
	const gained = recorded.reduce((sum, points) => sum + points, 0);
	const total = gained > 0 ? xpEventsRepo.addPoints(userId, gained) : before;

	const next = xpProgress(total);
	const previous = xpProgress(before);
	const xp: XpAward | null =
		gained > 0
			? {
					gained,
					total,
					level: next.level,
					levelName: next.name,
					levelUp: next.level > previous.level
				}
			: null;

	const facts = gatherBadgeFacts(userId, context.today, context.weekStart, trigger);
	const newBadges = evaluateBadges(userId, facts, trigger);
	return { xp, newBadges: toPayload(newBadges) };
}

// What the sidebar and the settings page show (SPEC 5.6, 10.4). The total is
// read from users.xp_total, the level derived from it.
export function progressFor(userId: string): {
	total: number;
	level: number;
	levelName: string;
	toNextLevel: number;
	ratio: number;
	intoLevel: number;
} {
	const total = xpEventsRepo.getXpTotal(userId);
	const level = xpProgress(total);
	return {
		total: level.total,
		level: level.level,
		levelName: level.name,
		toNextLevel: level.toNextLevel,
		ratio: level.ratio,
		intoLevel: level.intoLevel
	};
}

function toPayload(
	earned: readonly { id: BadgeId; earnedAt: string }[]
): { badge: BadgeDefinition; earnedAt: string }[] {
	return earned.map((entry) => ({
		badge: badgeDefinition(entry.id),
		earnedAt: entry.earnedAt
	}));
}
