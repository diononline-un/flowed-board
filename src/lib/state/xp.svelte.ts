import { pushToast } from './toasts.svelte.js';
import { copy } from '$lib/shared/copy.js';
import { xpProgress, type XpProgress, type XpResponsePayload } from '$lib/shared/xp.js';

// One place for the XP shown in the app shell (sidebar/level badge) and for
// the toasts after an award (SPEC 5.6, 10.4).
//
// The layout loads the total from the server; every mutation response carries
// the fresh total, so the store is kept in sync without a page reload.
//
// P7: the toasts are the only visible reward, purely additive, and they stay
// off when `prefs.gamification` is disabled — the XP themselves are always
// recorded on the server.

// The callers pass the `xp` object of a mutation response straight through, so
// the type stays shared with the server (`$lib/shared/xp.ts`).
export type { XpResponsePayload };

let total = $state(0);
let gamification = $state(true);

export const xpStore = {
	get total(): number {
		return total;
	},
	get gamification(): boolean {
		return gamification;
	},
	get progress(): XpProgress {
		return xpProgress(total);
	}
};

// Called by the app layout whenever fresh server data arrives.
export function syncXp(nextTotal: number, nextGamification: boolean): void {
	total = Math.max(0, Math.floor(nextTotal));
	gamification = nextGamification;
}

// Applies an award from a mutation response: updates the store, then shows the
// dezent toasts (+XP, level up, badge) when gamification is on.
//
// The total is only taken over when the server really reported one: a badge
// without XP of its own (goal_setter, tidy_up) answers `gained: 0, total: 0`,
// and overwriting the store with that would drop the sidebar chip to 0 XP
// until the next reload. The previous value stays untouched instead.
export function applyXp(payload: XpResponsePayload | undefined): void {
	if (!payload) return;
	if (payload.gained > 0 && payload.total > 0) {
		total = Math.max(0, payload.total);
	}
	if (gamification) {
		if (payload.gained > 0) {
			pushToast(copy.toast.xpGained(payload.gained));
		}
		if (payload.gained > 0 && payload.levelUp) {
			pushToast(copy.toast.levelUp(payload.level, payload.levelName));
		}
		for (const entry of payload.newBadges) {
			pushToast(`${entry.badge.emoji} ${copy.toast.badgeEarned(entry.badge.name)}`);
		}
	}
}

// Test-only hook: unit tests drive the store without a browser.
export function resetXpForTests(nextTotal = 0, nextGamification = true): void {
	total = Math.max(0, nextTotal);
	gamification = nextGamification;
}
