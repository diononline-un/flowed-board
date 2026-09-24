// Badge catalogue and evaluation rules (SPEC 5.6). Pure module: the server
// evaluates facts with it, the badge grid renders the same definitions.
//
// P7 (rein additiv): a badge is only ever added, never taken away. There is no
// ranking, no "lost badge", and nothing here rewards speed.

export type BadgeId =
	| 'first_step'
	| 'goal_setter'
	| 'quick_writer'
	| 'week_win'
	| 'keeper'
	| 'journal_starter'
	| 'journal_regular'
	| 'halfway'
	| 'finisher'
	| 'tidy_up';

export interface BadgeDefinition {
	id: BadgeId;
	name: string;
	description: string;
	emoji: string;
}

// Order = display order in the badge grid.
export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
	{
		id: 'first_step',
		name: 'Erster Schritt',
		description: 'Dein erstes Post-it erledigt.',
		emoji: '✅'
	},
	{
		id: 'goal_setter',
		name: 'Ziel gesetzt',
		description: 'Dein erstes Ziel angelegt.',
		emoji: '🎯'
	},
	{
		id: 'quick_writer',
		name: 'Schnell notiert',
		description: 'Deine erste Quick-Capture-Eingabe übernommen.',
		emoji: '⚡'
	},
	{
		id: 'week_win',
		name: 'Woche geschafft',
		description: 'Ein Habit hat zum ersten Mal sein Wochenziel erreicht.',
		emoji: '🌱'
	},
	{
		id: 'keeper',
		name: 'Dranbleiber:in',
		description: 'Wochenziel in vier verschiedenen Wochen erreicht.',
		emoji: '🧗'
	},
	{
		id: 'journal_starter',
		name: 'Journal-Start',
		description: 'Drei Journal-Einträge geschrieben.',
		emoji: '📓'
	},
	{
		id: 'journal_regular',
		name: 'Journal-Routine',
		description: 'Fünfzehn Journal-Einträge geschrieben.',
		emoji: '🖋️'
	},
	{
		id: 'halfway',
		name: 'Halbzeit',
		description: 'Ein Key Result ist zur Hälfte geschafft.',
		emoji: '⛰️'
	},
	{
		id: 'finisher',
		name: 'Geschafft',
		description: 'Dein erstes Ziel als erreicht markiert.',
		emoji: '🏁'
	},
	{
		id: 'tidy_up',
		name: 'Aufgeräumt',
		description: 'Das Aufräumen-Sheet einmal durchlaufen.',
		emoji: '🧹'
	}
] as const;

export const BADGE_IDS: readonly BadgeId[] = BADGE_DEFINITIONS.map((badge) => badge.id);

export function isBadgeId(value: string): value is BadgeId {
	return BADGE_DEFINITIONS.some((badge) => badge.id === value);
}

export function badgeDefinition(id: BadgeId): BadgeDefinition {
	const found = BADGE_DEFINITIONS.find((badge) => badge.id === id);
	// Unreachable for a valid BadgeId; keeps the signature free of undefined.
	if (!found) throw new Error(`unknown badge: ${id}`);
	return found;
}

// What the evaluation needs, gathered from the repos after a relevant event.
// Every number is "how much of this does the user have in total" — badges are
// derived state, never counters that could run backwards.
export interface BadgeFacts {
	donePostits: number;
	goals: number;
	doneGoals: number;
	captures: number;
	journalEntries: number;
	// Weeks (their start dates) in which a habit target was reached.
	completedWeekStarts: readonly string[];
	// Key results that reached 100 % — a `check` key result only ever reaches
	// it by being checked (SPEC 5.4/5.6).
	reachedKeyResults: number;
	// True when a key result sits at 50 % or above.
	keyResultHalfway: boolean;
	// True when the cleanup sheet was run.
	cleanedUp: boolean;
}

// SPEC 5.6 thresholds, one place.
export const BADGE_THRESHOLDS = {
	journalStarter: 3,
	journalRegular: 15,
	keeperWeeks: 4
} as const;

// Badges whose trigger the given facts satisfy. The caller subtracts the ones
// the user already owns.
export function earnedBadgeIds(facts: BadgeFacts): BadgeId[] {
	const earned: BadgeId[] = [];
	if (facts.donePostits >= 1) earned.push('first_step');
	if (facts.goals >= 1) earned.push('goal_setter');
	if (facts.captures >= 1) earned.push('quick_writer');
	if (facts.completedWeekStarts.length >= 1) earned.push('week_win');
	if (facts.completedWeekStarts.length >= BADGE_THRESHOLDS.keeperWeeks) earned.push('keeper');
	if (facts.journalEntries >= BADGE_THRESHOLDS.journalStarter) earned.push('journal_starter');
	if (facts.journalEntries >= BADGE_THRESHOLDS.journalRegular) earned.push('journal_regular');
	if (facts.keyResultHalfway) earned.push('halfway');
	if (facts.doneGoals >= 1) earned.push('finisher');
	if (facts.cleanedUp) earned.push('tidy_up');
	return earned;
}
