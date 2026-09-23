import { beforeEach, describe, expect, it } from 'vitest';
import { applyXp, resetXpForTests, syncXp, xpStore, type XpResponsePayload } from './xp.svelte.js';
import { toastStore, dismissToast } from './toasts.svelte.js';
import { badgeDefinition, type BadgeDefinition } from '$lib/shared/badges.js';

// SPEC 5.6 client side: the store behind the sidebar chip and the toasts.
//
// The case that used to break: a badge without XP of its own (goal_setter,
// tidy_up) answers `gained: 0, total: 0` — taking that total over dropped the
// chip to "Level 1 · Kaffeebohne, 0 XP" until a reload.

function badgePayload(id: 'first_step' | 'goal_setter' | 'tidy_up'): {
	badge: BadgeDefinition;
	earnedAt: string;
} {
	return { badge: badgeDefinition(id), earnedAt: '2026-09-24T10:00:00.000Z' };
}

function payload(overrides: Partial<XpResponsePayload>): XpResponsePayload {
	return {
		gained: 0,
		total: 0,
		level: 0,
		levelName: '',
		levelUp: false,
		newBadges: [],
		...overrides
	};
}

function clearToasts(): void {
	for (const toast of [...toastStore.items]) dismissToast(toast.id);
}

describe('xp store (SPEC 5.6, P7)', () => {
	beforeEach(() => {
		resetXpForTests(0, true);
		clearToasts();
	});

	it('starts at level 1 and follows the layout data', () => {
		resetXpForTests(480, true);
		expect(xpStore.progress.level).toBe(5);
		expect(xpStore.progress.name).toBe('Latte');
		expect(xpStore.progress.ratio).toBe(0);
		syncXp(119, true);
		expect(xpStore.total).toBe(119);
		expect(xpStore.progress.level).toBe(2);
		expect(xpStore.gamification).toBe(true);
	});

	it('keeps the current total on a badge without XP (no jump to 0)', () => {
		syncXp(45, true);
		applyXp(payload({ newBadges: [badgePayload('goal_setter')] }));
		expect(xpStore.total).toBe(45);
		expect(xpStore.progress.level).toBe(2);
		expect(xpStore.progress.name).toBe('Espresso');
		// the badge itself is shown as a toast
		expect(toastStore.items).toHaveLength(1);
		expect(toastStore.items[0]!.message).toContain('Ziel gesetzt');
	});

	it('keeps the current total when the cleanup sheet awards only tidy_up', () => {
		syncXp(150, true);
		applyXp(payload({ newBadges: [badgePayload('tidy_up')] }));
		expect(xpStore.total).toBe(150);
	});

	it('takes over a real gain and toasts points plus a level up', () => {
		syncXp(25, true);
		applyXp(
			payload({ gained: 5, total: 30, level: 2, levelName: 'Espresso', levelUp: true })
		);
		expect(xpStore.total).toBe(30);
		expect(xpStore.progress.level).toBe(2);
		expect(toastStore.items.map((toast) => toast.message)).toEqual([
			'+5 XP',
			'Level 2: Espresso!'
		]);
	});

	it('never awards a toast when gamification is off, but still tracks the total', () => {
		syncXp(10, false);
		applyXp(
			payload({
				gained: 5,
				total: 15,
				level: 1,
				levelName: 'Kaffeebohne',
				newBadges: [badgePayload('first_step')]
			})
		);
		expect(xpStore.total).toBe(15);
		expect(toastStore.items).toHaveLength(0);
	});

	it('ignores an undefined payload (endpoints without an award)', () => {
		syncXp(7, true);
		applyXp(undefined);
		expect(xpStore.total).toBe(7);
		expect(toastStore.items).toHaveLength(0);
	});
});
