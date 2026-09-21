import type { Prefs } from './schemas.js';

// Shared domain types (SPEC 4). Row types mirror the SQLite schema 1:1
// (snake_case); Public* types are the camelCase shapes exposed to clients.

export type WeekStart = 0 | 1 | 6; // JS getDay(): 0=Sunday, 1=Monday, 6=Saturday

export interface UserRow {
	id: string;
	username: string;
	display_name: string;
	password_hash: string;
	recovery_hash: string;
	recovery_confirmed_at: string | null;
	tz: string;
	week_start: WeekStart;
	prefs: string; // JSON, parsed via prefsSchema on read (SPEC 4.1)
	onboarding_done_at: string | null;
	xp_total: number;
	last_activity_at: string | null;
	age_confirmed_at: string;
	created_at: string;
}

export interface SessionRow {
	id: string; // sha256(token) as hex (SPEC 6.4)
	user_id: string;
	created_at: string;
	expires_at: string;
	user_agent: string | null;
}

// User shape safe for client consumption: never carries password_hash or
// recovery_hash (SPEC 6.7).
export interface PublicUser {
	id: string;
	username: string;
	displayName: string;
	tz: string;
	weekStart: WeekStart;
	prefs: Prefs;
	recoveryConfirmedAt: string | null;
	onboardingDoneAt: string | null;
	xpTotal: number;
	lastActivityAt: string | null;
	ageConfirmedAt: string;
	createdAt: string;
}

export interface AuthSession {
	user: PublicUser;
	sessionId: string;
	// True when the sliding expiration extended the session (SPEC 6.4); the
	// caller re-sets the cookie so the browser keeps the fresh maxAge.
	renewed: boolean;
}
