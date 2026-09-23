import { getDb } from '../db.js';
import { isXpKind, type XpKind } from '$lib/shared/xp.js';

// Only SQL for the xp_events table lives here (SPEC 16). userId first and
// filtered everywhere (SPEC 6.6).
//
// SPEC 5.6: an event is only ever recorded once per (user, kind, ref_id) —
// `INSERT OR IGNORE` plus the UNIQUE index is what makes completing, reopening
// and completing again worth exactly the same single award.

export interface XpEventRow {
	id: number;
	user_id: string;
	kind: string;
	ref_id: string;
	points: number;
	created_at: string;
}

export function listXpEvents(userId: string): XpEventRow[] {
	return getDb()
		.prepare('SELECT * FROM xp_events WHERE user_id = ? ORDER BY id')
		.all(userId) as XpEventRow[];
}

export function hasEvent(userId: string, kind: XpKind, refId: string): boolean {
	const row = getDb()
		.prepare('SELECT 1 AS found FROM xp_events WHERE user_id = ? AND kind = ? AND ref_id = ?')
		.get(userId, kind, refId) as { found: number } | undefined;
	return row !== undefined;
}

// Returns the points that were actually recorded ([] when every event was a
// repeat) — never an assumed amount.
export function insertIgnored(
	userId: string,
	events: readonly { kind: XpKind; refId: string; points: number }[]
): number[] {
	if (events.length === 0) return [];
	const stmt = getDb().prepare(
		`INSERT OR IGNORE INTO xp_events (user_id, kind, ref_id, points, created_at)
		 VALUES (?, ?, ?, ?, ?)`
	);
	const createdAt = new Date().toISOString();
	const recorded: number[] = [];
	const apply = getDb().transaction(() => {
		for (const event of events) {
			if (!isXpKind(event.kind)) continue;
			const result = stmt.run(userId, event.kind, event.refId, event.points, createdAt);
			if (result.changes === 1) recorded.push(event.points);
		}
	});
	apply();
	return recorded;
}

// users.xp_total is only raised by the points that were really inserted
// (SPEC 5.6), so a repeated event cannot farm XP.
export function addPoints(userId: string, points: number): number {
	if (points > 0) {
		getDb().prepare('UPDATE users SET xp_total = xp_total + ? WHERE id = ?').run(points, userId);
	}
	return getXpTotal(userId);
}

export function getXpTotal(userId: string): number {
	const row = getDb()
		.prepare('SELECT COALESCE(xp_total, 0) AS total FROM users WHERE id = ?')
		.get(userId) as { total: number } | undefined;
	return row?.total ?? 0;
}
