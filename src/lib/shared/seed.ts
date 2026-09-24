// Seed content (SPEC 8.7). The definitions live here, the rows are written by
// `$lib/server/seed.ts` — which is also where the "only if empty" rule and the
// dates sit (they depend on the user's "today").
//
// Everything is ordinary content: deletable, editable, and `is_example=1` only
// drives a small "Beispiel" chip in the UI.

export const SEED_GOAL_TITLE = 'Ersten Monat gut starten';

export interface SeedKeyResultDefinition {
	title: string;
	kind: 'number' | 'check';
	targetValue: number;
	unit: string | null;
}

export interface SeedPostitDefinition {
	title: string;
	note: string;
	// Offset from the user's today: 0 = today, 3 = in three days, 7 = next week.
	inDays: number;
}

export interface SeedHabitDefinition {
	title: string;
	emoji: string;
	color: 'mint';
	cadence: 'week';
	targetCount: number;
}

export interface SeedContent {
	goal: {
		title: string;
		emoji: string;
		note: string;
		keyResults: SeedKeyResultDefinition[];
	};
	postits: SeedPostitDefinition[];
	habit: SeedHabitDefinition;
	// Titles of the standard journal templates; their field definitions come
	// from `shared/journalTemplates.ts` (one source, also used for the rhythm).
	journalSeedKeys: readonly string[];
}

// The habit suggestion of SPEC 8.6 step 3 doubles as the seeded example habit,
// so the suggestion and the seed cannot drift apart.
export const SEED_HABIT: SeedHabitDefinition = {
	title: 'Drei Mal die Woche bewegen',
	emoji: '🏃',
	color: 'mint',
	cadence: 'week',
	targetCount: 3
};

export function seedContent(): SeedContent {
	return {
		goal: {
			title: SEED_GOAL_TITLE,
			emoji: '🌤️',
			note: 'Ein Beispielziel zum Ausprobieren — du kannst es ändern oder löschen.',
			keyResults: [
				{ title: 'Woche 1 geplant', kind: 'check', targetValue: 1, unit: null },
				{ title: 'Vier Mal Sport', kind: 'number', targetValue: 4, unit: 'Mal' }
			]
		},
		postits: [
			{ title: 'Board erkunden', note: 'Schau dich in Ruhe um.', inDays: 0 },
			{ title: 'Erstes Ziel anpassen', note: 'Was passt zu deiner Woche?', inDays: 3 },
			{ title: 'Rückblick auf die Woche', note: 'Was lief gut?', inDays: 7 }
		],
		habit: { ...SEED_HABIT },
		journalSeedKeys: ['morning', 'evening', 'quick']
	};
}
