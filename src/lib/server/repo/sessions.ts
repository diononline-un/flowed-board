import { getDb } from '../db.js';
import type { SessionRow, UserRow } from '$lib/shared/types.js';

// Only SQL for the sessions table lives here (SPEC 16). Every user-scoped
// function takes userId as its first parameter and filters by it (SPEC 6.6).

export function insertSession(row: SessionRow): void {
	getDb()
		.prepare(
			'INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent) VALUES (@id, @user_id, @created_at, @expires_at, @user_agent)'
		)
		.run(row);
}

// Session lookup joins the owning user so hooks get both in one query.
export function getSessionWithUser(
	sessionId: string
): { session: SessionRow; user: UserRow } | null {
	const row = getDb()
		.prepare(
			`SELECT s.id AS s_id, s.user_id AS s_user_id, s.created_at AS s_created_at,
				s.expires_at AS s_expires_at, s.user_agent AS s_user_agent, u.*
			FROM sessions s JOIN users u ON u.id = s.user_id
			WHERE s.id = ?`
		)
		.get(sessionId) as (UserRow & { s_id: string; s_user_id: string; s_created_at: string; s_expires_at: string; s_user_agent: string | null }) | undefined;
	if (!row) return null;
	const { s_id, s_user_id, s_created_at, s_expires_at, s_user_agent, ...user } = row;
	return {
		session: {
			id: s_id,
			user_id: s_user_id,
			created_at: s_created_at,
			expires_at: s_expires_at,
			user_agent: s_user_agent
		},
		user
	};
}

export function updateExpiry(sessionId: string, expiresAt: string): void {
	getDb()
		.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
		.run(expiresAt, sessionId);
}

export function deleteById(sessionId: string): void {
	getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function deleteByUser(userId: string): void {
	getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function deleteByUserExcept(userId: string, keepSessionId: string): void {
	getDb()
		.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?')
		.run(userId, keepSessionId);
}

export function deleteExpired(nowIso: string): number {
	const result = getDb()
		.prepare('DELETE FROM sessions WHERE expires_at <= ?')
		.run(nowIso);
	return result.changes;
}
