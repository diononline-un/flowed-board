import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import PostitSheet from './PostitSheet.svelte';
import GoalSheet from './GoalSheet.svelte';
import HabitSheet from './HabitSheet.svelte';
import { copy } from '$lib/shared/copy.js';

// SPEC 11: an error message belongs to every field that can cause it. The
// form sheets show one server-side error for the whole form (title, note,
// colour, date …), so each contributing control has to point at that message
// via aria-describedby; the title field alone left the rest of the form
// unlabelled. Server rendering is enough to pin the attribute, and it also
// proves the attribute disappears when there is no error.

const ERROR = 'Die Eingabe war ungültig.';
const GOAL = {
	id: 'goal-1',
	title: 'Ziel',
	note: null,
	emoji: null,
	color: 'butter',
	targetDate: null,
	horizonOverride: null,
	status: 'active',
	position: 1,
	isExample: false,
	createdAt: '2026-09-01T00:00:00.000Z',
	updatedAt: '2026-09-01T00:00:00.000Z',
	completedAt: null,
	deletedAt: null
} as const;

function postitSheet(error = ''): string {
	const { body } = render(PostitSheet, {
		props: { goals: [GOAL as never], error, onclose: () => {}, onsubmit: () => {} }
	});
	return body;
}

function goalSheet(error = '', withGoal = false): string {
	const { body } = render(GoalSheet, {
		props: {
			goal: withGoal
				? ({ ...GOAL, note: 'Notiz', emoji: '🎯' } as never)
				: null,
			error,
			onclose: () => {},
			onsubmit: () => {}
		}
	});
	return body;
}

function habitSheet(error = '', rangeEnd = '2026-09-30'): string {
	const { body } = render(HabitSheet, {
		props: {
			habit: {
				id: 'habit-1',
				title: 'Habit',
				emoji: '💧',
				color: 'mint',
				cadence: 'range',
				targetCount: 3,
				rangeStart: '2026-09-01',
				rangeEnd,
				maxPerDay: 1,
				goalId: null,
				archivedAt: null,
				position: 1,
				isExample: false,
				createdAt: '2026-09-01T00:00:00.000Z',
				updatedAt: '2026-09-01T00:00:00.000Z',
				deletedAt: null
			} as never,
			goals: [GOAL as never],
			tz: 'Europe/Berlin',
			error,
			onclose: () => {},
			onsubmit: () => {}
		}
	});
	return body;
}

// Counts the controls that carry a describedby target.
function describedByCount(html: string, id: string): number {
	return (html.match(new RegExp(`aria-describedby="${id}"`, 'g')) ?? []).length;
}

describe('form sheet error association (SPEC 11)', () => {
	it('PostitSheet points every contributing field at the error', () => {
		const html = postitSheet(ERROR);

		// Title, note, date, time, duration, goal select and the colour
		// fieldset: seven places, all on the same message.
		expect(describedByCount(html, 'postit-form-error')).toBe(7);
		expect(html).toContain('id="postit-form-error"');
		expect(html).toContain('role="alert"');
		expect(html).toContain(ERROR);
		// The fields really are the ones rendered here.
		expect(html).toContain('type="date"');
		expect(html).toContain('type="time"');
		expect(html).toContain('<textarea');
		expect(html).toContain('<fieldset aria-describedby="postit-form-error">');
	});

	it('PostitSheet drops the reference when there is no error', () => {
		const html = postitSheet();
		expect(html).not.toContain('aria-describedby');
		expect(html).not.toContain('postit-form-error');
		expect(html).not.toContain('role="alert"');
	});

	it('GoalSheet points every contributing field at the error', () => {
		const html = goalSheet(ERROR, true);

		expect(describedByCount(html, 'goal-form-error')).toBe(6);
		expect(html).toContain('id="goal-form-error"');
		expect(html).toContain('role="alert"');
		expect(html).toContain('<fieldset aria-describedby="goal-form-error">');
		// The edit form is the one with note, emoji and status.
		expect(html).toContain(copy.plans.form.notePlaceholder);
		expect(html).toContain(copy.plans.goal.status);
	});

	it('GoalSheet associates the create form too, where note/emoji/status are absent', () => {
		const html = goalSheet(ERROR, false);

		// Title and target date are the only controls of the create form.
		expect(describedByCount(html, 'goal-form-error')).toBe(2);
		expect(html).not.toContain('<fieldset');
	});

	it('HabitSheet points every contributing field at the error', () => {
		const html = habitSheet(ERROR);

		// A valid range means no range error, so title, emoji, cadence, goal
		// and the colour fieldset are the five places that point at the form
		// error (the range fields only point at their own error when it fires,
		// see the next test).
		expect(describedByCount(html, 'habit-form-error')).toBe(5);
		expect(html).toContain('id="habit-form-error"');
		expect(html).toContain('role="alert"');
		expect(html).toContain('<fieldset aria-describedby="habit-form-error">');
		// The two number fields keep their own inline errors instead.
		expect(describedByCount(html, 'habit-target-error')).toBe(0);
		expect(describedByCount(html, 'habit-max-error')).toBe(0);
	});

	it('HabitSheet wires the range error to both date fields', () => {
		// An empty range end is a client-side error of the two date inputs, and
		// it is a different message than the server-side form error. This also
		// pairs the single form error with the range fields: together the two
		// tests cover every field that can cause an error.
		const html = habitSheet('', '');

		expect(html).toContain('id="habit-range-error"');
		expect(describedByCount(html, 'habit-range-error')).toBe(2);
		expect(html).toContain(copy.calendar.errors.rangeRequired);

		// With both errors present, all seven references are in place.
		expect(describedByCount(habitSheet(ERROR, ''), 'habit-form-error')).toBe(5);
		expect(describedByCount(habitSheet(ERROR, ''), 'habit-range-error')).toBe(2);
	});
});
