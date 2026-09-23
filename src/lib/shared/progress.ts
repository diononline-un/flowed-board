import type { KeyResultKind } from './types.js';

// Goal progress (SPEC 5.4). Pure functions over row-shaped data so both the
// server (page loads) and tests share one implementation.

export interface ProgressKeyResult {
	kind: KeyResultKind;
	start_value: number;
	target_value: number;
	current_value: number;
	deleted_at: string | null;
}

export interface ProgressPostit {
	done_at: string | null;
	deleted_at: string | null;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

// KR number: clamp((current − start) / (target − start), 0, 1); when
// target == start: 1 if current >= target else 0. KR check: 0 or 1.
export function keyResultProgress(kr: Omit<ProgressKeyResult, 'deleted_at'>): number {
	if (kr.kind === 'check') return kr.current_value >= 1 ? 1 : 0;
	if (kr.target_value === kr.start_value) return kr.current_value >= kr.target_value ? 1 : 0;
	return clamp01((kr.current_value - kr.start_value) / (kr.target_value - kr.start_value));
}

// Goal = mean of non-deleted KRs. Without KRs: done / all linked non-deleted
// post-its. Without either: 0 (the UI shows the "Noch keine Schritte" hint).
export function goalProgress(krs: ProgressKeyResult[], postits: ProgressPostit[]): number {
	const activeKrs = krs.filter((kr) => kr.deleted_at === null);
	if (activeKrs.length > 0) {
		const sum = activeKrs.reduce((total, kr) => total + keyResultProgress(kr), 0);
		return sum / activeKrs.length;
	}
	const activePostits = postits.filter((postit) => postit.deleted_at === null);
	if (activePostits.length > 0) {
		const done = activePostits.filter((postit) => postit.done_at !== null).length;
		return done / activePostits.length;
	}
	return 0;
}

// SPEC 5.6 `kr_done`: the moment a key result reaches its target. A `check`
// key result reaches it only by being ticked (`current >= 1`), a `number` one
// by `current >= target`.
export function keyResultTargetReached(kr: {
	kind: KeyResultKind;
	target_value: number;
	current_value: number;
}): boolean {
	if (kr.kind === 'check') return kr.current_value >= 1;
	return kr.current_value >= kr.target_value;
}

// Same rule for the camelCase client shape.
export function keyResultTargetReachedPublic(kr: {
	kind: KeyResultKind;
	targetValue: number;
	currentValue: number;
}): boolean {
	return keyResultTargetReached({
		kind: kr.kind,
		target_value: kr.targetValue,
		current_value: kr.currentValue
	});
}

// SPEC 5.6 `halfway`: a key result at 50 % or more of its target. A `check`
// key result is either done or not, so ticking it counts as half done at least.
export function keyResultAtLeastHalfPublic(kr: {
	kind: KeyResultKind;
	targetValue: number;
	currentValue: number;
}): boolean {
	if (kr.kind === 'check') return kr.currentValue >= 1;
	if (kr.targetValue <= 0) return false;
	return kr.currentValue / kr.targetValue >= 0.5;
}

// Convenience wrapper over the camelCase Public* shapes used by page loads
// and client state — one mapping, shared by server and browser.
export function progressOfGoal(
	krs: {
		kind: KeyResultKind;
		startValue: number;
		targetValue: number;
		currentValue: number;
		deletedAt: string | null;
	}[],
	postits: { doneAt: string | null; deletedAt: string | null }[]
): number {
	return goalProgress(
		krs.map((kr) => ({
			kind: kr.kind,
			start_value: kr.startValue,
			target_value: kr.targetValue,
			current_value: kr.currentValue,
			deleted_at: kr.deletedAt
		})),
		postits.map((postit) => ({ done_at: postit.doneAt, deleted_at: postit.deletedAt }))
	);
}
