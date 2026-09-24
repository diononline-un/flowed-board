import { copy } from './copy.js';
import { weekdayOf } from './date.js';
import {
	journalFieldsSchema,
	journalScheduleSchema,
	journalValuesSchema,
	type JournalField,
	type JournalSchedule,
	type JournalValues
} from './schemas.js';
import type { JournalEntryKey } from './types.js';

// Journal field definitions, standard templates and the due rule (SPEC 5.7,
// 8.5, 8.7). Pure module: server page loads, the API (via the repo layer), the
// client and the unit tests all use this one implementation.
//
// Journal content never leaves the server (SPEC 9.5 hard rule). Nothing here
// talks to a model or imports anything that could.

// SPEC 5.7: due from `time` until `time + 6 h`.
export const DUE_WINDOW_HOURS = 6;

const MINUTES_PER_DAY = 24 * 60;

function minutesOf(time: string): number {
	const [hours, minutes] = time.split(':');
	return Number(hours) * 60 + Number(minutes);
}

// A start late in the evening would push the window past midnight; the window
// is clipped to the end of the day it belongs to, because both `entry_date`
// and `slot` of a template are tied to one calendar day (DECISIONS.md).
function windowEnd(startMinutes: number): number {
	return Math.min(startMinutes + DUE_WINDOW_HOURS * 60, MINUTES_PER_DAY);
}

// Slots of one template that are due at `nowTime` on `entryDate` (SPEC 5.7):
// the weekday must be in `days` and `time <= nowTime < time + 6 h`.
export function slotsDueAt(
	schedule: JournalSchedule | null,
	entryDate: string,
	nowTime: string
): string[] {
	if (!schedule) return [];
	if (!schedule.days.includes(weekdayOf(entryDate))) return [];
	const now = minutesOf(nowTime);
	return schedule.times.filter((time) => {
		const start = minutesOf(time);
		return now >= start && now < windowEnd(start);
	});
}

// What the due check needs from a template; the callers pass their richer
// public shape and get it back unchanged.
export interface JournalTemplateLike {
	id: string;
	active: boolean;
	schedule: JournalSchedule | null;
}

export interface DueJournalTemplate<T> {
	template: T;
	// 'HH:MM' of the schedule slot that is due.
	slot: string;
}

// Due templates for one day (SPEC 5.7): active, today's weekday in `days`,
// inside the 6 h window and no entry for (template, entryDate, slot) yet.
// Order follows the templates (and within a template its schedule times).
export function dueTemplates<T extends JournalTemplateLike>(
	templates: readonly T[],
	entryDate: string,
	nowTime: string,
	entries: readonly JournalEntryKey[]
): DueJournalTemplate<T>[] {
	const due: DueJournalTemplate<T>[] = [];
	for (const template of templates) {
		if (!template.active) continue;
		for (const slot of slotsDueAt(template.schedule, entryDate, nowTime)) {
			const taken = entries.some(
				(entry) =>
					entry.templateId === template.id &&
					entry.entryDate === entryDate &&
					entry.slot === slot
			);
			if (!taken) due.push({ template, slot });
		}
	}
	return due;
}

// --- Standard templates (SPEC 8.7) -----------------------------------------

export type JournalSeedKey = 'morning' | 'evening' | 'quick';

// Journal rhythm chosen in onboarding step 4 (SPEC 8.6).
export type JournalRhythm = 'morning' | 'evening' | 'off';

export interface StandardJournalTemplate {
	seedKey: JournalSeedKey;
	name: string;
	emoji: string;
	fields: JournalField[];
	// null = manual only. Morning/evening receive a schedule once a rhythm was
	// chosen; `quick` never has one (SPEC 8.7).
	schedule: JournalSchedule | null;
}

export const DEFAULT_JOURNAL_TIMES = { morning: '08:00', evening: '21:00' } as const;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function rhythmSchedule(
	rhythm: JournalRhythm,
	part: 'morning' | 'evening'
): JournalSchedule | null {
	if (rhythm !== part) return null;
	return { times: [DEFAULT_JOURNAL_TIMES[part]], days: [...ALL_DAYS] };
}

// The three standard templates of SPEC 8.7 as fresh definitions (M6 seeds
// them, `morning`/`evening` with the rhythm picked during onboarding).
export function standardJournalTemplates(rhythm: JournalRhythm = 'off'): StandardJournalTemplate[] {
	return [
		{
			seedKey: 'morning',
			name: 'Morgen',
			emoji: '🌅',
			fields: [
				{
					id: 'mood',
					type: 'scale',
					label: 'Stimmung',
					required: true,
					min: 1,
					max: 5,
					style: 'faces'
				},
				{
					id: 'note',
					type: 'text',
					label: 'Kurzer Gedanke',
					required: false,
					placeholder: 'Was beschäftigt dich heute?',
					maxLength: 500
				}
			],
			schedule: rhythmSchedule(rhythm, 'morning')
		},
		{
			seedKey: 'evening',
			name: 'Abend',
			emoji: '🌙',
			fields: [
				{ id: 'win1', type: 'text', label: 'Erfolg 1', required: false, maxLength: 300 },
				{ id: 'win2', type: 'text', label: 'Erfolg 2', required: false, maxLength: 300 },
				{ id: 'win3', type: 'text', label: 'Erfolg 3', required: false, maxLength: 300 },
				{
					id: 'energy',
					type: 'scale',
					label: 'Energie',
					required: true,
					min: 1,
					max: 7,
					style: 'numbers'
				}
			],
			schedule: rhythmSchedule(rhythm, 'evening')
		},
		{
			seedKey: 'quick',
			name: 'Kurz notiert',
			emoji: '✏️',
			fields: [
				{
					id: 'text',
					type: 'text',
					label: 'Was gibt es?',
					required: true,
					placeholder: 'Frei heraus …',
					maxLength: 2000
				}
			],
			schedule: null
		}
	];
}

// --- JSON columns (SPEC 4.1) -----------------------------------------------

// JournalField[] from the `fields`/`fields_snapshot` column. A corrupt or
// outdated value falls back to an empty field list instead of throwing: the
// entry itself stays readable (AC14).
export function parseJournalFields(json: string | null): JournalField[] {
	if (!json) return [];
	try {
		const parsed = journalFieldsSchema.safeParse(JSON.parse(json));
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}

// JournalSchedule from the `schedule` column; NULL or anything unreadable
// means "manual only".
export function parseJournalSchedule(json: string | null): JournalSchedule | null {
	if (!json) return null;
	try {
		const parsed = journalScheduleSchema.safeParse(JSON.parse(json));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

// JournalValues from the `values_json` column; unreadable content degrades to
// an empty answer set so the entry stays listable (AC14).
export function parseJournalValues(json: string | null): JournalValues {
	if (!json) return {};
	try {
		const parsed = journalValuesSchema.safeParse(JSON.parse(json));
		return parsed.success ? parsed.data : {};
	} catch {
		return {};
	}
}

// --- Values validation (SPEC 5.7, AC13) ------------------------------------

export interface JournalValueIssue {
	fieldId: string;
	message: string;
}

export type JournalValuesResult =
	| { ok: true; values: JournalValues }
	| { ok: false; errors: JournalValueIssue[] };

function asNumber(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	// Forms and older clients send numbers as strings; a numeric string is
	// accepted and stored as a number (DECISIONS.md).
	if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
		return Number(value);
	}
	return null;
}

function asBoolean(value: unknown): boolean | null {
	if (typeof value === 'boolean') return value;
	if (value === 'true' || value === '1') return true;
	if (value === 'false' || value === '0') return false;
	return null;
}

function isProvided(value: unknown): boolean {
	if (value === undefined || value === null) return false;
	return !(typeof value === 'string' && value.trim() === '');
}

// Validates values against the field definitions they were collected for.
// Used with the template's `fields` on create and with the entry's
// `fields_snapshot` on update (AC13/AC14), so an edited template can never
// invalidate an existing entry silently: only the snapshot counts.
// Unknown ids are rejected, optional empty answers are dropped, and the
// result is the normalized object that belongs into `values_json`.
export function validateJournalValues(
	fields: readonly JournalField[],
	values: JournalValues
): JournalValuesResult {
	const errors: JournalValueIssue[] = [];
	const cleaned: JournalValues = {};
	const known = new Set(fields.map((field) => field.id));

	for (const key of Object.keys(values)) {
		if (!known.has(key)) {
			errors.push({ fieldId: key, message: copy.journal.errors.unknownField });
		}
	}

	for (const field of fields) {
		const raw = values[field.id];
		if (!isProvided(raw)) {
			if (field.required) {
				errors.push({ fieldId: field.id, message: copy.journal.errors.required });
			}
			continue;
		}
		if (field.type === 'scale') {
			const number = asNumber(raw);
			if (number === null || !Number.isInteger(number)) {
				errors.push({ fieldId: field.id, message: copy.journal.errors.notANumber });
			} else if (number < field.min || number > field.max) {
				errors.push({ fieldId: field.id, message: copy.journal.errors.outOfScale });
			} else {
				cleaned[field.id] = number;
			}
			continue;
		}
		if (field.type === 'number') {
			const number = asNumber(raw);
			const min = field.min ?? null;
			const max = field.max ?? null;
			if (number === null) {
				errors.push({ fieldId: field.id, message: copy.journal.errors.notANumber });
			} else if ((min !== null && number < min) || (max !== null && number > max)) {
				errors.push({ fieldId: field.id, message: copy.journal.errors.outOfBounds });
			} else {
				cleaned[field.id] = number;
			}
			continue;
		}
		if (field.type === 'yesno') {
			const bool = asBoolean(raw);
			if (bool === null) {
				errors.push({ fieldId: field.id, message: copy.journal.errors.notBoolean });
			} else {
				cleaned[field.id] = bool;
			}
			continue;
		}
		if (field.type === 'choice') {
			const text = typeof raw === 'string' ? raw.trim() : null;
			if (text === null || !field.options.includes(text)) {
				errors.push({ fieldId: field.id, message: copy.journal.errors.notInOptions });
			} else {
				cleaned[field.id] = text;
			}
			continue;
		}
		// text
		if (typeof raw !== 'string') {
			errors.push({ fieldId: field.id, message: copy.journal.errors.invalidValue });
		} else if (raw.length > field.maxLength) {
			errors.push({ fieldId: field.id, message: copy.journal.errors.textTooLong });
		} else {
			cleaned[field.id] = raw;
		}
	}

	return errors.length > 0 ? { ok: false, errors } : { ok: true, values: cleaned };
}

// Full value set of an edit form: existing values plus the submitted ones.
// Fields the user emptied disappear from the result (and are then reported by
// validateJournalValues when they are required).
export function mergeJournalValues(
	existing: JournalValues,
	incoming: JournalValues
): JournalValues {
	return { ...existing, ...incoming };
}

// Short one-line summary of an entry for the history list (SPEC 8.5).
export function summarizeJournalValues(
	fields: readonly JournalField[],
	values: JournalValues
): string {
	const parts: string[] = [];
	for (const field of fields) {
		const value = values[field.id];
		if (!isProvided(value)) continue;
		if (field.type === 'yesno') {
			parts.push(`${field.label}: ${value ? copy.journal.values.yes : copy.journal.values.no}`);
			continue;
		}
		if (field.type === 'number') {
			const unit = field.unit ? ` ${field.unit}` : '';
			parts.push(`${field.label}: ${value}${unit}`);
			continue;
		}
		parts.push(`${field.label}: ${String(value)}`);
	}
	return parts.join(' · ');
}
