import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import JournalFieldInput from './JournalFieldInput.svelte';
import { copy } from '$lib/shared/copy.js';
import { journalFieldSchema, type JournalField } from '$lib/shared/schemas.js';

// SPEC 8.5/10.4: JournalFieldInput dispatches by field type. Rendering the
// component on the server proves each branch renders its own control (scale as
// buttons/faces, yes/no as two large buttons, choice as chips, text as a
// textarea with a counter, number as a stepper) with the accessible labels.
// Interaction itself stays with the browser; the value flow is unit-tested in
// shared/journal.test.ts.

function field(definition: Record<string, unknown>): JournalField {
	const parsed = journalFieldSchema.safeParse(definition);
	if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
	return parsed.data;
}

function htmlOf(definition: Record<string, unknown>, value?: string | number | boolean): string {
	const { body } = render(JournalFieldInput, {
		props: {
			field: field(definition),
			value,
			onchange: () => {}
		}
	});
	return body;
}

describe('JournalFieldInput (SPEC 8.5)', () => {
	it('renders a 1–5 scale as faces with accessible labels', () => {
		const html = htmlOf(
			{ id: 'mood', type: 'scale', label: 'Stimmung', required: true, min: 1, max: 5, style: 'faces' },
			4
		);
		expect(html).toContain('Stimmung');
		expect(html).toContain(copy.journal.form.requiredMark);
		expect(html.match(/aria-pressed/g)).toHaveLength(5);
		for (const emoji of ['😞', '🙁', '😐', '🙂', '😄']) expect(html).toContain(emoji);
		expect(html).toContain(`aria-label="Stimmung: ${copy.journal.faceLabels[4]}"`);
		// The current value is the pressed option.
		expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
		expect(html).toMatch(/aria-pressed="true"[^>]*>[\s\S]{0,80}🙂/);
	});

	it('renders a numeric scale with every step between min and max', () => {
		const html = htmlOf(
			{ id: 'energy', type: 'scale', label: 'Energie', required: false, min: 1, max: 7, style: 'numbers' },
			7
		);
		expect(html.match(/aria-pressed/g)).toHaveLength(7);
		expect(html).toContain('aria-label="Energie: 7"');
		expect(html).not.toContain('😐');
	});

	it('renders yes/no as two large buttons', () => {
		const html = htmlOf({ id: 'done', type: 'yesno', label: 'Geschafft?', required: false }, false);
		expect(html).toContain('Geschafft?');
		expect(html.match(/aria-pressed/g)).toHaveLength(2);
		expect(html).toContain(copy.journal.values.yes);
		expect(html).toContain(copy.journal.values.no);
		// `false` is a real answer: the Nein button is the pressed one.
		expect(html).toMatch(/aria-pressed="true"[^>]*>\s*Nein/);
	});

	it('renders choice options as chips', () => {
		const html = htmlOf(
			{ id: 'place', type: 'choice', label: 'Ort', required: false, options: ['Büro', 'Zuhause', 'Unterwegs'] },
			'Zuhause'
		);
		for (const option of ['Büro', 'Zuhause', 'Unterwegs']) expect(html).toContain(option);
		expect(html.match(/aria-pressed/g)).toHaveLength(3);
		expect(html).toMatch(/aria-pressed="true"[^>]*>\s*Zuhause/);
	});

	it('renders text as a textarea with a character counter', () => {
		const html = htmlOf(
			{ id: 'note', type: 'text', label: 'Notiz', required: false, placeholder: 'Was noch?', maxLength: 20 },
			'hallo'
		);
		expect(html).toContain('<textarea');
		expect(html).toContain('maxlength="20"');
		expect(html).toContain('placeholder="Was noch?"');
		expect(html).toContain(copy.journal.values.counter(5, 20));
		expect(html).toContain('hallo');
	});

	it('renders numbers as a stepper with bounds and unit', () => {
		const html = htmlOf(
			{ id: 'weight', type: 'number', label: 'Gewicht', required: true, min: 0, max: 10, unit: 'kg' },
			4
		);
		expect(html).toContain('type="number"');
		expect(html).toContain('min="0"');
		expect(html).toContain('max="10"');
		expect(html).toContain('kg');
		expect(html).toContain(`aria-label="${copy.journal.values.decrease}"`);
		expect(html).toContain(`aria-label="${copy.journal.values.increase}"`);
		// The value is inside the input.
		expect(html).toMatch(/type="number"[^>]*value="4"|value="4"[^>]*type="number"/);
	});

	it('surfaces a validation error next to the control', () => {
		const { body } = render(JournalFieldInput, {
			props: {
				field: field({ id: 'mood', type: 'scale', label: 'Stimmung', required: true, min: 1, max: 5, style: 'numbers' }),
				value: undefined,
				error: copy.journal.errors.required,
				onchange: () => {}
			}
		});
		expect(body).toContain('role="alert"');
		expect(body).toContain(copy.journal.errors.required);
		expect(body).toContain('aria-describedby="journal-field-mood-error"');
	});
});
