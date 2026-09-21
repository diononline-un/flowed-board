import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import { parsePrefs, type Prefs } from '$lib/shared/schemas.js';
import type { PublicUser, UserRow, WeekStart } from '$lib/shared/types.js';

// Only SQL for the users table lives here (SPEC 16). Every user-scoped
// function takes userId as its first parameter and filters by it (SPEC 6.6).

export function toPublicUser(row: UserRow): PublicUser {
	return {
		id: row.id,
		username: row.username,
		displayName: row.display_name,
		tz: row.tz,
		weekStart: row.week_start,
		prefs: parsePrefs(row.prefs),
		recoveryConfirmedAt: row.recovery_confirmed_at,
		onboardingDoneAt: row.onboarding_done_at,
		xpTotal: row.xp_total,
		lastActivityAt: row.last_activity_at,
		ageConfirmedAt: row.age_confirmed_at,
		createdAt: row.created_at
	};
}

export function createUser(input: {
	username: string;
	passwordHash: string;
	recoveryHash: string;
	ageConfirmedAt: string;
}): PublicUser {
	const now = new Date().toISOString();
	const row: UserRow = {
		id: randomUUID(),
		username: input.username,
		display_name: input.username, // display_name starts as username (SPEC 6.1)
		password_hash: input.passwordHash,
		recovery_hash: input.recoveryHash,
		recovery_confirmed_at: null,
		tz: 'Europe/Berlin',
		week_start: 1,
		prefs: '{}',
		onboarding_done_at: null,
		xp_total: 0,
		last_activity_at: now,
		age_confirmed_at: input.ageConfirmedAt,
		created_at: now
	};
	getDb()
		.prepare(
			`INSERT INTO users (
				id, username, display_name, password_hash, recovery_hash,
				recovery_confirmed_at, tz, week_start, prefs, onboarding_done_at,
				xp_total, last_activity_at, age_confirmed_at, created_at
			) VALUES (
				@id, @username, @display_name, @password_hash, @recovery_hash,
				@recovery_confirmed_at, @tz, @week_start, @prefs, @onboarding_done_at,
				@xp_total, @last_activity_at, @age_confirmed_at, @created_at
			)`
		)
		.run(row);
	return toPublicUser(row);
}

// Global lookup by username, only used pre-auth (login/register/recover);
// the UNIQUE COLLATE NOCASE column makes this case-insensitive.
export function getByUsername(username: string): UserRow | null {
	const row = getDb()
		.prepare('SELECT * FROM users WHERE username = ?')
		.get(username) as UserRow | undefined;
	return row ?? null;
}

export function getById(userId: string): UserRow | null {
	const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) as
		| UserRow
		| undefined;
	return row ?? null;
}

export function getPublicById(userId: string): PublicUser | null {
	const row = getById(userId);
	return row ? toPublicUser(row) : null;
}

export function updateProfile(
	userId: string,
	patch: { displayName?: string; tz?: string; weekStart?: WeekStart; prefs?: Prefs }
): PublicUser | null {
	const current = getById(userId);
	if (!current) return null;
	const next = {
		display_name: patch.displayName ?? current.display_name,
		tz: patch.tz ?? current.tz,
		week_start: patch.weekStart ?? current.week_start,
		prefs: patch.prefs ? JSON.stringify(patch.prefs) : current.prefs
	};
	getDb()
		.prepare(
			'UPDATE users SET display_name = @display_name, tz = @tz, week_start = @week_start, prefs = @prefs WHERE id = @id'
		)
		.run({ ...next, id: userId });
	return getPublicById(userId);
}

export function setPasswordHash(userId: string, passwordHash: string): void {
	getDb()
		.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
		.run(passwordHash, userId);
}

// Stores a new recovery hash and marks the phrase as not yet confirmed.
export function setRecoveryHash(userId: string, recoveryHash: string): void {
	getDb()
		.prepare(
			'UPDATE users SET recovery_hash = ?, recovery_confirmed_at = NULL WHERE id = ?'
		)
		.run(recoveryHash, userId);
}

export function setRecoveryConfirmed(userId: string, confirmedAt: string): PublicUser | null {
	getDb()
		.prepare('UPDATE users SET recovery_confirmed_at = ? WHERE id = ?')
		.run(confirmedAt, userId);
	return getPublicById(userId);
}

// SPEC 6.4: last_activity_at is written at most once per minute.
export function touchActivity(userId: string, minIntervalMs = 60_000): boolean {
	const row = getDb()
		.prepare('SELECT last_activity_at FROM users WHERE id = ?')
		.get(userId) as { last_activity_at: string | null } | undefined;
	if (!row) return false;
	const now = Date.now();
	if (
		row.last_activity_at &&
		now - Date.parse(row.last_activity_at) < minIntervalMs
	) {
		return false;
	}
	getDb()
		.prepare('UPDATE users SET last_activity_at = ? WHERE id = ?')
		.run(new Date(now).toISOString(), userId);
	return true;
}

// Hard delete; every related row cascades (SPEC 6.7).
export function deleteUser(userId: string): void {
	getDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
}

// Data export (SPEC 6.7): all own rows, without password_hash,
// recovery_hash and sessions.
export function exportData(userId: string): Record<string, unknown> {
	const db = getDb();
	const user = getPublicById(userId);
	const all = (table: string): unknown[] =>
		db.prepare(`SELECT * FROM ${table} WHERE user_id = ?`).all(userId);
	return {
		exportedAt: new Date().toISOString(),
		user,
		goals: all('goals'),
		keyResults: all('key_results'),
		habits: all('habits'),
		postits: all('postits'),
		habitLogs: all('habit_logs'),
		journalTemplates: all('journal_templates'),
		journalEntries: all('journal_entries'),
		xpEvents: all('xp_events'),
		userBadges: all('user_badges'),
		aiUsage: all('ai_usage')
	};
}
