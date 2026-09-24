import type { JournalField, JournalSchedule, JournalValues, Prefs } from './schemas.js';
import type { HabitCadence } from './habit.js';

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

// Board horizons (SPEC 4.0) and the fixed post-it/habit color palette
// (SPEC 10.1: no user hex codes, semantic names only).
export type Horizon = 'short' | 'mid' | 'long';
export type PostitColor = 'butter' | 'mint' | 'sky' | 'blush' | 'sand' | 'sage' | 'lilac';
export type GoalStatus = 'active' | 'done' | 'archived';
export type KeyResultKind = 'number' | 'check';
// The habit cadence lives with the SPEC 5.5 window rules; re-exported here so
// row and public types read from one module.
export type { HabitCadence } from './habit.js';

export interface GoalRow {
	id: string;
	user_id: string;
	title: string;
	note: string | null;
	emoji: string | null;
	color: string; // PostitColor, stored as TEXT with default 'butter'
	target_date: string | null;
	horizon_override: Horizon | null;
	status: GoalStatus;
	position: number;
	is_example: 0 | 1;
	created_at: string;
	updated_at: string;
	completed_at: string | null;
	deleted_at: string | null;
}

export interface KeyResultRow {
	id: string;
	user_id: string;
	goal_id: string;
	title: string;
	kind: KeyResultKind;
	start_value: number;
	target_value: number;
	current_value: number;
	unit: string | null;
	position: number;
	created_at: string;
	deleted_at: string | null;
}

export interface HabitRow {
	id: string;
	user_id: string;
	goal_id: string | null;
	title: string;
	emoji: string | null;
	color: string; // PostitColor
	cadence: 'week' | 'month' | 'range';
	target_count: number;
	range_start: string | null;
	range_end: string | null;
	max_per_day: number;
	position: number;
	is_example: 0 | 1;
	created_at: string;
	updated_at: string;
	archived_at: string | null;
	deleted_at: string | null;
}

export interface HabitLogRow {
	id: string;
	user_id: string;
	habit_id: string;
	log_date: string;
	source: 'tap' | 'postit';
	postit_id: string | null;
	created_at: string;
}

export interface PostitRow {
	id: string;
	user_id: string;
	goal_id: string | null;
	habit_id: string | null;
	title: string;
	note: string | null;
	color: string | null; // NULL = goal color, else PostitColor
	date: string | null;
	time: string | null;
	duration_min: number | null;
	horizon_override: Horizon | null;
	position: number;
	batch_id: string | null;
	is_example: 0 | 1;
	created_at: string;
	updated_at: string;
	done_at: string | null;
	deleted_at: string | null;
}

export interface PublicGoal {
	id: string;
	title: string;
	note: string | null;
	emoji: string | null;
	color: PostitColor;
	targetDate: string | null;
	horizonOverride: Horizon | null;
	status: GoalStatus;
	position: number;
	isExample: boolean;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
	deletedAt: string | null;
}

export interface PublicKeyResult {
	id: string;
	goalId: string;
	title: string;
	kind: KeyResultKind;
	startValue: number;
	targetValue: number;
	currentValue: number;
	unit: string | null;
	position: number;
	createdAt: string;
	deletedAt: string | null;
}

export interface PublicPostit {
	id: string;
	goalId: string | null;
	habitId: string | null;
	title: string;
	note: string | null;
	color: PostitColor | null;
	date: string | null;
	time: string | null;
	durationMin: number | null;
	horizonOverride: Horizon | null;
	position: number;
	batchId: string | null;
	isExample: boolean;
	createdAt: string;
	updatedAt: string;
	doneAt: string | null;
	deletedAt: string | null;
}

export interface PublicHabit {
	id: string;
	goalId: string | null;
	title: string;
	emoji: string | null;
	color: PostitColor;
	cadence: HabitCadence;
	targetCount: number;
	rangeStart: string | null;
	rangeEnd: string | null;
	maxPerDay: number;
	position: number;
	isExample: boolean;
	createdAt: string;
	updatedAt: string;
	archivedAt: string | null;
	deletedAt: string | null;
}

// Logs are only ever shown as dates and counts (SPEC 8.4), so the client
// shape stays deliberately small.
export interface PublicHabitLog {
	id: string;
	habitId: string;
	logDate: string;
	source: 'tap' | 'postit';
	createdAt: string;
}

// --- Journal (SPEC 4.2, 5.7) ------------------------------------------------
// The JSON columns (fields, schedule, fields_snapshot, values_json) are TEXT
// in SQLite and parsed with zod on read (SPEC 4.1).
export type { JournalField, JournalSchedule, JournalValues } from './schemas.js';

export interface JournalTemplateRow {
	id: string;
	user_id: string;
	name: string;
	emoji: string | null;
	fields: string; // JSON: JournalField[]
	schedule: string | null; // JSON: JournalSchedule | null
	active: 0 | 1;
	seed_key: string | null;
	position: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface JournalEntryRow {
	id: string;
	user_id: string;
	template_id: string | null;
	template_name: string;
	entry_date: string;
	slot: string | null;
	fields_snapshot: string; // JSON: JournalField[] as of the entry
	values_json: string; // JSON: { [fieldId]: string | number | boolean }
	created_at: string;
	updated_at: string;
}

export interface PublicJournalTemplate {
	id: string;
	name: string;
	emoji: string | null;
	fields: JournalField[];
	schedule: JournalSchedule | null;
	active: boolean;
	seedKey: string | null;
	position: number;
	createdAt: string;
	updatedAt: string;
}

export interface PublicJournalEntry {
	id: string;
	templateId: string | null;
	templateName: string;
	entryDate: string;
	slot: string | null;
	// Field definitions at entry time (AC14): entries stay readable after the
	// template changed or was deactivated.
	fields: JournalField[];
	values: JournalValues;
	createdAt: string;
	updatedAt: string;
}

// Identity of an entry for the due check of SPEC 5.7.
export interface JournalEntryKey {
	templateId: string | null;
	entryDate: string;
	slot: string | null;
}
