// Gamification rules (SPEC 5.6). Pure module: the award path on the server,
// the XP bar in the browser and the unit tests all use these numbers.
//
// P7 (rein additiv): XP only ever grow. No leaderboards, no penalties, no
// decay — the UI merely reflects the total.

export const XP_KINDS = {
	postit_done: 5,
	habit_log: 10,
	journal_entry: 15,
	kr_done: 20,
	goal_done: 50,
	capture_used: 3
} as const;

export type XpKind = keyof typeof XP_KINDS;

export const XP_KIND_LIST = Object.keys(XP_KINDS) as XpKind[];

export function isXpKind(value: string): value is XpKind {
	return Object.prototype.hasOwnProperty.call(XP_KINDS, value);
}

export function pointsFor(kind: XpKind): number {
	return XP_KINDS[kind];
}

// Reference ids that make an event unique per user (SPEC 5.6 table). They are
// the whole trick behind "no farming": completing, reopening and completing
// again yields the same ref_id, so the UNIQUE(user_id, kind, ref_id) index
// keeps the second attempt without points.
export function xpRefId(kind: XpKind, ids: XpRefIds): string {
	switch (kind) {
		case 'postit_done':
			return ids.postitId;
		case 'habit_log':
			return `${ids.habitId}:${ids.logDate}`;
		case 'journal_entry':
			return `${ids.templateId ?? 'x'}:${ids.entryDate}:${ids.slot ?? 'none'}`;
		case 'kr_done':
			return ids.keyResultId;
		case 'goal_done':
			return ids.goalId;
		case 'capture_used':
			return ids.batchId;
	}
}

export interface XpRefIds {
	postitId: string;
	habitId: string;
	logDate: string;
	templateId: string | null;
	entryDate: string;
	slot: string | null;
	keyResultId: string;
	goalId: string;
	batchId: string;
}

// --- Level (SPEC 5.6) ------------------------------------------------------

export const XP_PER_LEVEL_FACTOR = 30;

export const LEVEL_NAMES = [
	'Kaffeebohne',
	'Espresso',
	'Flat White',
	'Cappuccino',
	'Latte',
	'Mocha',
	'Affogato',
	'Barista',
	'Röstmeister:in',
	'Café-Legende'
] as const;

// level = floor(sqrt(xp_total / 30)) + 1
export function levelFor(total: number): number {
	const safe = Number.isFinite(total) && total > 0 ? total : 0;
	return Math.floor(Math.sqrt(safe / XP_PER_LEVEL_FACTOR)) + 1;
}

// Band 10 and above keep the last name (SPEC 5.6: "10+ Café-Legende").
export function levelName(level: number): string {
	const index = Math.max(1, Math.floor(level)) - 1;
	return LEVEL_NAMES[Math.min(index, LEVEL_NAMES.length - 1)]!;
}

// Total XP that has to be collected to be on `level`, i.e. the sum of all
// completed bands: 0, 30, 120, 270, 480, … (band of level n = 30 * n²).
export function xpAtLevel(level: number): number {
	const completed = Math.max(0, Math.floor(level) - 1);
	let total = 0;
	for (let index = 1; index <= completed; index += 1) {
		total += XP_PER_LEVEL_FACTOR * index * index;
	}
	return total;
}

// XP still missing inside the current band ("XP bis nächstes Level: 30 * level²").
export function xpToNextLevel(total: number): number {
	const level = levelFor(total);
	const next = xpAtLevel(level + 1);
	return Math.max(0, next - Math.max(0, total));
}

export interface XpProgress {
	total: number;
	level: number;
	name: string;
	// XP collected inside the current band.
	intoLevel: number;
	// Size of the current band (30 * level²).
	bandSize: number;
	toNextLevel: number;
	// Band completion 0…1, for the progress bar.
	ratio: number;
}

// One call that gives the UI everything it shows (SPEC 10.4 `XpBar`).
export function xpProgress(total: number): XpProgress {
	const safe = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
	const level = levelFor(safe);
	const bandStart = xpAtLevel(level);
	const bandSize = XP_PER_LEVEL_FACTOR * level * level;
	const intoLevel = safe - bandStart;
	return {
		total: safe,
		level,
		name: levelName(level),
		intoLevel,
		bandSize,
		toNextLevel: Math.max(0, bandSize - intoLevel),
		ratio: bandSize > 0 ? Math.min(1, intoLevel / bandSize) : 0
	};
}

// --- Award payloads --------------------------------------------------------

export interface XpEvent {
	kind: XpKind;
	refId: string;
	points: number;
}

export interface XpAward {
	// Points of the events that were recorded now (0 on a repeated event).
	gained: number;
	total: number;
	level: number;
	levelName: string;
	// True when this award crossed a level boundary.
	levelUp: boolean;
}

export function makeEvent(kind: XpKind, refId: string): XpEvent {
	return { kind, refId, points: pointsFor(kind) };
}
