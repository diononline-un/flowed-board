// All user-visible texts live here (SPEC 0.7): German, Du-Form.
// Code, identifiers and comments stay English.

export const copy = {
	appName: 'FlowBoard',
	nav: {
		plans: 'Pläne',
		calendar: 'Kalender',
		journal: 'Journal',
		settings: 'Settings'
	},
	plans: {
		title: 'Pläne',
		emptyTitle: 'Noch keine Post-its',
		emptyHint: 'Sobald du etwas planst, landet es hier auf deinem Board.'
	},
	calendar: {
		title: 'Kalender',
		emptyTitle: 'Dein Kalender ist noch leer',
		emptyHint: 'Post-its mit Datum erscheinen hier ganz von selbst.'
	},
	journal: {
		title: 'Journal',
		emptyTitle: 'Noch keine Einträge',
		emptyHint: 'Dein erster Journal-Eintrag wartet schon auf dich.'
	},
	settings: {
		title: 'Settings',
		emptyTitle: 'Noch nichts einzustellen',
		emptyHint: 'Sobald dein Konto steht, findest du hier deine Optionen.'
	}
} as const;
