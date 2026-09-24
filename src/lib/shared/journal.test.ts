import { describe, expect, it } from 'vitest';
import {
	DEFAULT_JOURNAL_TIMES,
	dueTemplates,
	mergeJournalValues,
	parseJournalFields,
	parseJournalSchedule,
	parseJournalValues,
	slotsDueAt,
	standardJournalTemplates,
	summarizeJournalValues,
	validateJournalValues,
	type JournalTemplateLike
} from './journalTemplates.js';
import {
	journalEntriesQuerySchema,
	journalEntryCreateSchema,
	journalEntryPatchSchema,
	journalFieldSchema,
	journalFieldsSchema,
	journalScheduleSchema,
	journalTemplateCreateSchema,
	journalTemplatePatchSchema,
	journalValuesSchema,
	type JournalField,
	type JournalValues
} from './schemas.js';
import { copy } from './copy.js';

// SPEC 5.7 field definitions and due rule, plus the value validation that
// guards `values_json` (AC13/AC14). Pure unit tests, no database.

const MONDAY = '2026-09-21'; // a Monday
const SUNDAY = '2026-09-20';

// Builds one parsed field of a given type; throws when the definition is
// invalid, so a typo in a valid-case test cannot silently pass.
function fieldOf<T extends JournalField['type']>(
	type: T,
	partial: Record<string, unknown> = {}
): Extract<JournalField, { type: T }> {
	const result = journalFieldSchema.safeParse({
		id: 'mood',
		label: 'Stimmung',
		required: false,
		type,
		...partial
	});
	if (!result.success) throw new Error(JSON.stringify(result.error.issues));
	return result.data as Extract<JournalField, { type: T }>;
}

function field(partial: Record<string, unknown>): JournalField {
	const { type, ...rest } = partial;
	return fieldOf((type as JournalField['type']) ?? 'yesno', rest);
}

function template(partial: Partial<JournalTemplateLike> = {}): JournalTemplateLike {
	return {
		id: 'tpl-1',
		active: true,
		schedule: { times: ['08:00'], days: [1, 2, 3, 4, 5] },
		...partial
	};
}

describe('JournalField schema (SPEC 5.7)', () => {
	it('fills the defaults of a scale field and keeps 5|7|10', () => {
		const parsed = fieldOf('scale', { max: 5 });
		expect(parsed).toEqual({
			id: 'mood',
			type: 'scale',
			label: 'Stimmung',
			required: false,
			min: 1,
			max: 5,
			style: 'numbers'
		});
		expect(fieldOf('scale', { max: 10 }).max).toBe(10);
		// Only 1–5 may carry faces; everything else must be numbers.
		expect(journalFieldSchema.safeParse({ id: 'e', type: 'scale', label: 'Energie', max: 7, style: 'faces', min: 1, required: true }).success).toBe(false);
		expect(fieldOf('scale', { max: 5, style: 'faces' }).style).toBe('faces');
	});

	it('rejects scale bounds outside the spec set', () => {
		for (const max of [0, 1, 4, 6, 8, 11, 100]) {
			expect(journalFieldSchema.safeParse({ id: 's', type: 'scale', label: 'Skala', max, required: false }).success).toBe(false);
		}
		expect(journalFieldSchema.safeParse({ id: 's', type: 'scale', label: 'Skala', max: 5, min: 0, required: false }).success).toBe(false);
		expect(journalFieldSchema.safeParse({ id: 's', type: 'scale', label: 'Skala', max: 5, min: 2, required: false }).success).toBe(false);
	});

	it('bounds text fields: 1–2000 characters, default 500', () => {
		expect(fieldOf('text').maxLength).toBe(500);
		expect(fieldOf('text', { maxLength: 2000 }).maxLength).toBe(2000);
		expect(journalFieldSchema.safeParse({ id: 't', type: 'text', label: 'Text', maxLength: 2001, required: false }).success).toBe(false);
		expect(journalFieldSchema.safeParse({ id: 't', type: 'text', label: 'Text', maxLength: 0, required: false }).success).toBe(false);
	});

	it('requires 2–8 distinct options on a choice field', () => {
		expect(fieldOf('choice', { options: ['A', 'B'] }).type).toBe('choice');
		expect(journalFieldSchema.safeParse({ id: 'c', type: 'choice', label: 'Auswahl', options: ['nur eine'], required: false }).success).toBe(false);
		expect(
			journalFieldSchema.safeParse({ id: 'c', type: 'choice', label: 'Auswahl', options: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], required: false }).success
		).toBe(false);
		const duplicate = journalFieldSchema.safeParse({ id: 'c', type: 'choice', label: 'Auswahl', options: ['A', 'A'], required: false });
		expect(duplicate.success).toBe(false);
		if (!duplicate.success) expect(duplicate.error.issues[0]?.message).toBe(copy.journal.errors.optionsDuplicate);
	});

	it('keeps number bounds consistent and accepts unit/yes-no', () => {
		expect(fieldOf('number', { min: 0, max: 10, unit: 'kg' })).toEqual({
			id: 'mood',
			type: 'number',
			label: 'Stimmung',
			required: false,
			min: 0,
			max: 10,
			unit: 'kg'
		});
		expect(journalFieldSchema.safeParse({ id: 'n', type: 'number', label: 'Zahl', min: 10, max: 5, required: false }).success).toBe(false);
		expect(journalFieldSchema.safeParse({ id: 'n', type: 'number', label: 'Zahl', unit: 'x'.repeat(21), required: false }).success).toBe(false);
		expect(fieldOf('yesno').type).toBe('yesno');
	});

	it('rejects unknown keys, long labels and unsafe ids (strict)', () => {
		expect(journalFieldSchema.safeParse({ id: 'x', type: 'yesno', label: 'Ja?', required: false, extra: 1 }).success).toBe(false);
		expect(journalFieldSchema.safeParse({ id: 'x', type: 'yesno', label: 'x'.repeat(81), required: false }).success).toBe(false);
		expect(journalFieldSchema.safeParse({ id: 'x', type: 'yesno', label: '', required: false }).success).toBe(false);
		expect(journalFieldSchema.safeParse({ id: 'a b', type: 'yesno', label: 'Ja?', required: false }).success).toBe(false);
		expect(journalFieldSchema.safeParse({ id: 'x'.repeat(41), type: 'yesno', label: 'Ja?', required: false }).success).toBe(false);
	});

	it('validates the field list: 1–20 fields with unique ids', () => {
		const mood = fieldOf('scale', { max: 5 });
		const note = fieldOf('text', { id: 'note', label: 'Notiz' });
		expect(journalFieldsSchema.safeParse([mood, note]).success).toBe(true);
		expect(journalFieldsSchema.safeParse([]).success).toBe(false);
		expect(journalFieldsSchema.safeParse([mood, { ...note, id: 'mood' }]).success).toBe(false);
		const many = Array.from({ length: 21 }, (_value, index) =>
			fieldOf('yesno', { id: `f${index}`, label: 'Ja/Nein' })
		);
		expect(journalFieldsSchema.safeParse(many).success).toBe(false);
	});
});

describe('Journal schedule (SPEC 5.7)', () => {
	it('accepts up to four times on 0–6 weekdays', () => {
		const parsed = journalScheduleSchema.safeParse({ times: ['08:00', '21:30'], days: [1, 3, 5] });
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data).toEqual({ times: ['08:00', '21:30'], days: [1, 3, 5] });
		expect(journalScheduleSchema.safeParse({}).success).toBe(true); // manual only
		expect(journalScheduleSchema.safeParse({ times: ['08:00'], days: [] }).success).toBe(false);
	});

	it('rejects invalid times, too many times, bad or duplicate weekdays', () => {
		expect(journalScheduleSchema.safeParse({ times: ['8:00'], days: [1] }).success).toBe(false);
		expect(journalScheduleSchema.safeParse({ times: ['25:00'], days: [1] }).success).toBe(false);
		expect(journalScheduleSchema.safeParse({ times: ['08:00', '09:00', '10:00', '11:00', '12:00'], days: [1] }).success).toBe(false);
		expect(journalScheduleSchema.safeParse({ times: ['08:00', '08:00'], days: [1] }).success).toBe(false);
		expect(journalScheduleSchema.safeParse({ times: ['08:00'], days: [7] }).success).toBe(false);
		expect(journalScheduleSchema.safeParse({ times: ['08:00'], days: [-1] }).success).toBe(false);
		expect(journalScheduleSchema.safeParse({ times: ['08:00'], days: [1, 1] }).success).toBe(false);
	});
});

describe('journal API schemas (SPEC 7)', () => {
	const fields = [fieldOf('scale', { max: 5, required: true })];
	const values = { mood: 4 };

	it('accepts a template create body and rejects unknown keys', () => {
		const ok = journalTemplateCreateSchema.safeParse({
			name: 'Abend',
			emoji: '🌙',
			fields,
			schedule: { times: [DEFAULT_JOURNAL_TIMES.evening], days: [0, 1, 2, 3, 4, 5, 6] }
		});
		expect(ok.success).toBe(true);
		expect(journalTemplateCreateSchema.safeParse({ name: 'Abend', fields, extra: true }).success).toBe(false);
		expect(journalTemplateCreateSchema.safeParse({ name: '', fields }).success).toBe(false);
		expect(journalTemplateCreateSchema.safeParse({ name: 'Abend', fields: [] }).success).toBe(false);
	});

	it('patches templates including deactivation and manual schedule', () => {
		expect(journalTemplatePatchSchema.safeParse({ active: false }).success).toBe(true);
		expect(journalTemplatePatchSchema.safeParse({ schedule: null }).success).toBe(true);
		expect(journalTemplatePatchSchema.safeParse({ fields }).success).toBe(true);
		expect(journalTemplatePatchSchema.safeParse({ name: 'x'.repeat(41) }).success).toBe(false);
		expect(journalTemplatePatchSchema.safeParse({ active: 'no' }).success).toBe(false);
		expect(journalTemplatePatchSchema.safeParse({ name: 'Abend', deep: { x: 1 } }).success).toBe(false);
	});

	it('accepts entry create/patch bodies and the entries query', () => {
		const create = journalEntryCreateSchema.safeParse({
			templateId: 'tpl-1',
			entryDate: MONDAY,
			slot: '08:00',
			values
		});
		expect(create.success).toBe(true);
		// slot is optional: a manual entry has none.
		expect(
			journalEntryCreateSchema.safeParse({ templateId: 'tpl-1', entryDate: MONDAY, values }).success
		).toBe(true);
		expect(
			journalEntryCreateSchema.safeParse({ templateId: 'tpl-1', entryDate: '2026-09-31', values }).success
		).toBe(false);
		expect(
			journalEntryCreateSchema.safeParse({ templateId: 'tpl-1', entryDate: MONDAY, slot: '8:00', values }).success
		).toBe(false);
		expect(
			journalEntryCreateSchema.safeParse({ templateId: 'tpl-1', entryDate: MONDAY, values, extra: 1 }).success
		).toBe(false);

		expect(journalEntryPatchSchema.safeParse({ values }).success).toBe(true);
		expect(journalEntryPatchSchema.safeParse({ values: {}, entryDate: MONDAY }).success).toBe(false);
		expect(journalEntriesQuerySchema.safeParse({ from: MONDAY, to: MONDAY }).success).toBe(true);
		expect(journalEntriesQuerySchema.safeParse({ from: 'heute' }).success).toBe(false);
	});

	it('bounds the values object', () => {
		expect(journalValuesSchema.safeParse({ a: 'x', b: 2, c: true }).success).toBe(true);
		expect(journalValuesSchema.safeParse({ a: { nested: 1 } }).success).toBe(false);
		expect(journalValuesSchema.safeParse({ a: 'x'.repeat(2001) }).success).toBe(false);
		const wide: Record<string, number> = {};
		for (let i = 0; i < 41; i += 1) wide[`f${i}`] = i;
		expect(journalValuesSchema.safeParse(wide).success).toBe(false);
	});
});

describe('due rule (SPEC 5.7)', () => {
	it('fires exactly from time until time + 6 h', () => {
		expect(slotsDueAt(template().schedule, MONDAY, '07:59')).toEqual([]);
		expect(slotsDueAt(template().schedule, MONDAY, '08:00')).toEqual(['08:00']);
		expect(slotsDueAt(template().schedule, MONDAY, '13:59')).toEqual(['08:00']);
		expect(slotsDueAt(template().schedule, MONDAY, '14:00')).toEqual([]);
		expect(slotsDueAt(template().schedule, MONDAY, '23:59')).toEqual([]);
	});

	it('stays inside the calendar day for very late slots', () => {
		const late = { times: ['22:00'], days: [1] };
		expect(slotsDueAt(late, MONDAY, '21:59')).toEqual([]);
		expect(slotsDueAt(late, MONDAY, '23:59')).toEqual(['22:00']);
		// 00:30 belongs to the next day; the slot of *this* day is over.
		expect(slotsDueAt(late, MONDAY, '00:30')).toEqual([]);
	});

	it('needs an active template, a matching weekday and a schedule', () => {
		expect(dueTemplates([template()], MONDAY, '09:00', [])).toHaveLength(1);
		expect(dueTemplates([template({ active: false })], MONDAY, '09:00', [])).toHaveLength(0);
		expect(dueTemplates([template()], SUNDAY, '09:00', [])).toHaveLength(0);
		expect(dueTemplates([template({ schedule: null })], MONDAY, '09:00', [])).toHaveLength(0);
		expect(
			dueTemplates([template({ schedule: { times: ['08:00'], days: [] } })], MONDAY, '09:00', [])
		).toHaveLength(0);
	});

	it('is suppressed by an entry with the same (template, date, slot) only', () => {
		const existing = [
			{ templateId: 'tpl-1', entryDate: MONDAY, slot: '08:00' }
		];
		expect(dueTemplates([template()], MONDAY, '09:00', existing)).toHaveLength(0);
		expect(
			dueTemplates([template()], MONDAY, '09:00', [{ ...existing[0]!, slot: null }])
		).toHaveLength(1);
		expect(
			dueTemplates([template()], MONDAY, '09:00', [{ ...existing[0]!, entryDate: SUNDAY }])
		).toHaveLength(1);
		expect(
			dueTemplates([template()], MONDAY, '09:00', [{ ...existing[0]!, templateId: 'other' }])
		).toHaveLength(1);
	});

	it('reports every due slot separately (AC13: two slots, two entries)', () => {
		// Two overlapping windows: at 13:30 both slots are due.
		const morning = template({ id: 'm', schedule: { times: ['08:00', '13:00'], days: [1] } });
		expect(dueTemplates([morning], MONDAY, '09:00', []).map((due) => due.slot)).toEqual(['08:00']);
		const both = dueTemplates([morning], MONDAY, '13:30', []);
		expect(both.map((due) => due.slot)).toEqual(['08:00', '13:00']);
		// Writing the first entry leaves the second slot due.
		const afterFirst = dueTemplates([morning], MONDAY, '13:30', [
			{ templateId: 'm', entryDate: MONDAY, slot: '08:00' }
		]);
		expect(afterFirst.map((due) => due.slot)).toEqual(['13:00']);
		expect(afterFirst[0]?.template).toBe(morning);
		// A slot whose window is over is not due any more at 21:00.
		expect(dueTemplates([morning], MONDAY, '21:00', []).map((due) => due.slot)).toEqual([]);
	});
});

describe('standard templates (SPEC 8.7)', () => {
	it('ships morning, evening and quick with valid definitions', () => {
		const [morning, evening, quick] = standardJournalTemplates();
		expect([morning!.seedKey, evening!.seedKey, quick!.seedKey]).toEqual([
			'morning',
			'evening',
			'quick'
		]);
		for (const definition of standardJournalTemplates()) {
			expect(journalFieldsSchema.safeParse(definition.fields).success).toBe(true);
			if (definition.schedule) {
				expect(journalScheduleSchema.safeParse(definition.schedule).success).toBe(true);
			}
		}
		expect(morning!.fields.map((entry) => entry.type)).toEqual(['scale', 'text']);
		expect(morning!.fields[0]?.label).toBe('Stimmung');
		expect(evening!.fields.map((entry) => entry.label)).toEqual([
			'Erfolg 1',
			'Erfolg 2',
			'Erfolg 3',
			'Energie'
		]);
		expect(evening!.fields[3]?.type).toBe('scale');
		expect(quick!.fields).toHaveLength(1);
		expect(quick!.fields[0]?.type).toBe('text');
		expect(quick!.schedule).toBeNull();
	});

	it('attaches the onboarding rhythm to morning/evening only', () => {
		const off = standardJournalTemplates('off');
		expect(off.every((definition) => definition.schedule === null)).toBe(true);
		const morningOnly = standardJournalTemplates('morning');
		expect(morningOnly[0]!.schedule?.times).toEqual([DEFAULT_JOURNAL_TIMES.morning]);
		expect(morningOnly[1]!.schedule).toBeNull();
		expect(morningOnly[2]!.schedule).toBeNull();
		const eveningOnly = standardJournalTemplates('evening');
		expect(eveningOnly[1]!.schedule?.times).toEqual([DEFAULT_JOURNAL_TIMES.evening]);
		expect(eveningOnly[1]!.schedule?.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
		// Definitions are fresh copies: mutating one must not leak into the next.
		const first = standardJournalTemplates();
		first[0]!.fields[0]!.label = 'geändert';
		expect(standardJournalTemplates()[0]!.fields[0]!.label).toBe('Stimmung');
	});
});

describe('value validation against a field set (AC13/AC14)', () => {
	const fields: JournalField[] = [
		fieldOf('scale', { id: 'mood', label: 'Stimmung', required: true, max: 5, style: 'faces' }),
		fieldOf('text', { id: 'note', label: 'Notiz', maxLength: 10 }),
		fieldOf('yesno', { id: 'done', label: 'Geschafft?' }),
		fieldOf('number', { id: 'energy', label: 'Energie', min: 1, max: 10, unit: 'Punkte' }),
		fieldOf('number', { id: 'count', label: 'Anzahl' }),
		fieldOf('choice', { id: 'place', label: 'Ort', options: ['Büro', 'Zuhause'] })
	];

	function values(partial: JournalValues): JournalValues {
		return { mood: 3, ...partial };
	}

	it('normalizes a complete answer set', () => {
		const result = validateJournalValues(
			fields,
			values({ note: 'kurz', done: true, energy: 7, place: 'Büro' })
		);
		expect(result).toEqual({
			ok: true,
			values: { mood: 3, note: 'kurz', done: true, energy: 7, place: 'Büro' }
		});
	});

	it('accepts false and 0 as real answers, drops empty optional ones', () => {
		const result = validateJournalValues(fields, values({ done: false, count: 0, note: '  ' }));
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.values).toEqual({ mood: 3, done: false, count: 0 });
		expect('note' in result.values).toBe(false);
	});

	it('coerces numeric strings and ja/nein-style booleans', () => {
		const result = validateJournalValues(
			fields,
			values({ mood: '4', done: 'true', energy: '7.5', place: ' Zuhause ' })
		);
		expect(result).toEqual({
			ok: true,
			values: { mood: 4, done: true, energy: 7.5, place: 'Zuhause' }
		});
	});

	it('reports a missing required field', () => {
		const result = validateJournalValues(fields, {});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors).toEqual([
			{ fieldId: 'mood', message: copy.journal.errors.required }
		]);
		expect(validateJournalValues(fields, { mood: '   ' }).ok).toBe(false);
	});

	it('rejects unknown ids and wrong types', () => {
		const unknown = validateJournalValues(fields, values({ fremd: 'x' }));
		expect(unknown.ok).toBe(false);
		if (!unknown.ok) {
			expect(unknown.errors).toContainEqual({
				fieldId: 'fremd',
				message: copy.journal.errors.unknownField
			});
		}
		const wrongText = validateJournalValues(fields, values({ note: 42 }));
		expect(wrongText.ok).toBe(false);
		if (!wrongText.ok) {
			expect(wrongText.errors[0]).toEqual({
				fieldId: 'note',
				message: copy.journal.errors.invalidValue
			});
		}
	});

	it('enforces scale range, number bounds, choices and text length', () => {
		const cases: Array<[JournalValues, string]> = [
			[{ mood: 6 }, copy.journal.errors.outOfScale],
			[{ mood: 0 }, copy.journal.errors.outOfScale],
			[{ mood: 2.5 }, copy.journal.errors.notANumber],
			[{ mood: 'viel' }, copy.journal.errors.notANumber],
			[{ energy: 11 }, copy.journal.errors.outOfBounds],
			[{ energy: 'viel' }, copy.journal.errors.notANumber],
			[{ done: 'vielleicht' }, copy.journal.errors.notBoolean],
			[{ place: 'Balkon' }, copy.journal.errors.notInOptions],
			[{ note: 'x'.repeat(11) }, copy.journal.errors.textTooLong]
		];
		for (const [partial, message] of cases) {
			const result = validateJournalValues(fields, values(partial));
			expect(result.ok, JSON.stringify(partial)).toBe(false);
			if (result.ok) continue;
			expect(result.errors.map((issue) => issue.message)).toContain(message);
		}
		// The boundary values themselves are fine.
		expect(validateJournalValues(fields, values({ mood: 1 })).ok).toBe(true);
		expect(validateJournalValues(fields, values({ mood: 5 })).ok).toBe(true);
		expect(validateJournalValues(fields, values({ energy: 1 })).ok).toBe(true);
		expect(validateJournalValues(fields, values({ energy: 10 })).ok).toBe(true);
		expect(validateJournalValues(fields, values({ note: 'x'.repeat(10) })).ok).toBe(true);
	});

	it('keeps an old entry valid after the template changed (AC14)', () => {
		// The snapshot still carries the old scale and label.
		const snapshot: JournalField[] = [
			fieldOf('scale', { id: 'mood', label: 'Stimmung (alt)', required: true, max: 7 })
		];
		expect(validateJournalValues(snapshot, { mood: 7 }).ok).toBe(true);
		expect(validateJournalValues(snapshot, { mood: 8 }).ok).toBe(false);
		// A field that only exists in the new template is unknown to the entry.
		const changed: JournalField[] = [
			fieldOf('yesno', { id: 'stimmung', label: 'Stimmung neu', required: true })
		];
		expect(validateJournalValues(changed, { mood: 3 }).ok).toBe(false);
	});

	it('merges edits and summarizes an entry in one line', () => {
		const merged = mergeJournalValues({ mood: 3, note: 'alt' }, { note: 'neu' });
		expect(merged).toEqual({ mood: 3, note: 'neu' });
		expect(summarizeJournalValues(fields, { mood: 4, done: false, energy: 7, place: 'Büro' })).toBe(
			'Stimmung: 4 · Geschafft?: Nein · Energie: 7 Punkte · Ort: Büro'
		);
		expect(summarizeJournalValues(fields, { mood: 4, done: true })).toBe('Stimmung: 4 · Geschafft?: Ja');
		expect(summarizeJournalValues(fields, {})).toBe('');
	});
});

describe('JSON columns are parsed conservatively (SPEC 4.1)', () => {
	it('reads fields and schedule, falling back to empty/manual', () => {
		const fields = [fieldOf('scale', { max: 5 })];
		expect(parseJournalFields(JSON.stringify(fields))).toEqual(fields);
		expect(parseJournalFields('kein json')).toEqual([]);
		expect(parseJournalFields('[{"id":"x","type":"unbekannt"}]')).toEqual([]);
		expect(parseJournalFields(null)).toEqual([]);

		const schedule = { times: ['08:00'], days: [1] };
		expect(parseJournalSchedule(JSON.stringify(schedule))).toEqual(schedule);
		expect(parseJournalSchedule('{"times":["25:00"],"days":[1]}')).toBeNull();
		expect(parseJournalSchedule('kaputt')).toBeNull();
		expect(parseJournalSchedule(null)).toBeNull();

		expect(parseJournalValues('{"mood":4,"done":true}')).toEqual({ mood: 4, done: true });
		expect(parseJournalValues('[]')).toEqual({});
		expect(parseJournalValues('kaputt')).toEqual({});
		expect(parseJournalValues(null)).toEqual({});
	});
});
