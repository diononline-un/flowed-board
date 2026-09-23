import { pushToast } from './toasts.svelte.js';
import { copy } from '$lib/shared/copy.js';
import { xpProgress, type XpProgress } from '$lib/shared/xp.js';

// One place for the XP shown in the app shell (sidebar/level badge) and for
// the toasts after an award (SPEC 5.6, 10.4).
//
// The layout loads the total from the server; every mutation response carries
// the fresh total, so the store is kept in sync without a page reload.
//
// P7: the toasts are the only visible reward, purely additive, and they stay
// off when `prefs.gamification` is disabled — the XP themselves are always
// recorded on the server.

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

export interface XpResponsePayload {
	gained: number;
	total: number;
	level: number;
	levelName: string;
	levelUp: boolean;
	newBadges: { badge: { id: string; name: string; emoji: string }; earnedAt: string }[];
}

// Applies an award from a mutation response: updates the store, then shows the
// dezent toasts (+XP, level up, badge) when gamification is on.
export function applyXp(payload: XpResponsePayload | undefined): void {
	if (!payload) return;
	total = Math.max(0, payload.total);
	if (!gamification) return;
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
