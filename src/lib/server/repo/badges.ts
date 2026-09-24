import { getDb } from '../db.js';
import { isBadgeId, type BadgeId } from '$lib/shared/badges.js';

// Only SQL for the user_badges table lives here (SPEC 16). userId first and
// filtered everywhere (SPEC 6.6). A badge is earned once: the composite
// PRIMARY KEY (user_id, badge_id) plus INSERT OR IGNORE keeps it that way.

export interface UserBadgeRow {
	user_id: string;
	badge_id: string;
	earned_at: string;
}

export function listUserBadges(userId: string): UserBadgeRow[] {
	return getDb()
		.prepare('SELECT * FROM user_badges WHERE user_id = ? ORDER BY earned_at, badge_id')
		.all(userId) as UserBadgeRow[];
}

// Rows whose badge id is no longer part of the catalogue are dropped: the
// definitions live in code, the table only records when something was earned.
export function listEarned(userId: string): { badgeId: BadgeId; earnedAt: string }[] {
	return listUserBadges(userId)
		.filter((row) => isBadgeId(row.badge_id))
		.map((row) => ({ badgeId: row.badge_id as BadgeId, earnedAt: row.earned_at }));
}

export function hasBadge(userId: string, badgeId: BadgeId): boolean {
	const row = getDb()
		.prepare('SELECT 1 AS found FROM user_badges WHERE user_id = ? AND badge_id = ?')
		.get(userId, badgeId) as { found: number } | undefined;
	return row !== undefined;
}

export function countBadges(userId: string): number {
	const row = getDb()
		.prepare('SELECT COUNT(*) AS n FROM user_badges WHERE user_id = ?')
		.get(userId) as { n: number };
	return row.n;
}

// Awards the given badges and returns only the ones that were new — the badge
// grid, the toast and the response all read from that result.
export function insertIgnored(userId: string, badgeIds: readonly BadgeId[]): BadgeId[] {
	if (badgeIds.length === 0) return [];
	const stmt = getDb().prepare(
		'INSERT OR IGNORE INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)'
	);
	const earnedAt = new Date().toISOString();
	const fresh: BadgeId[] = [];
	const apply = getDb().transaction(() => {
		for (const badgeId of badgeIds) {
			const result = stmt.run(userId, badgeId, earnedAt);
			if (result.changes === 1) fresh.push(badgeId);
		}
	});
	apply();
	return fresh;
}

export interface EarnedBadge {
	id: BadgeId;
	earnedAt: string;
}
