import { randomUUID } from 'node:crypto';
import { getDb } from '../db.js';
import { addDays } from '$lib/shared/date.js';
import { effectiveHorizon } from '$lib/shared/horizon.js';
import type {
	Horizon,
	PostitColor,
	PostitRow,
	PublicPostit
} from '$lib/shared/types.js';
import * as habitLogsRepo from './habitLogs.js';

// Only SQL for the postits table lives here (SPEC 16). userId first and
// filtered everywhere (SPEC 6.6); foreign ids yield null. The SPEC 5.3
// habit-log side effect is wired into every done/soft-delete/restore path.

export function toPublicPostit(row: PostitRow): PublicPostit {
	return {
		id: row.id,
		goalId: row.goal_id,
		habitId: row.habit_id,
		title: row.title,
		note: row.note,
		color: (row.color as PostitColor | null) ?? null,
		date: row.date,
		time: row.time,
		durationMin: row.duration_min,
		horizonOverride: row.horizon_override,
		position: row.position,
		batchId: row.batch_id,
		isExample: row.is_example === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		doneAt: row.done_at,
		deletedAt: row.deleted_at
	};
}

function nextPosition(userId: string): number {
	const row = getDb()
		.prepare(
			'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM postits WHERE user_id = ? AND deleted_at IS NULL'
		)
		.get(userId) as { next: number };
	return row.next;
}

export function createPostit(
	userId: string,
	input: {
		title: string;
		note?: string | null;
		color?: PostitColor | null;
		date?: string | null;
		time?: string | null;
		durationMin?: number | null;
		goalId?: string | null;
		habitId?: string | null;
		horizonOverride?: Horizon | null;
		position?: number;
		batchId?: string | null;
		isExample?: boolean;
	}
): PublicPostit {
	const now = new Date().toISOString();
	const row: PostitRow = {
		id: randomUUID(),
		user_id: userId,
		goal_id: input.goalId ?? null,
		habit_id: input.habitId ?? null,
		title: input.title,
		note: input.note ?? null,
		color: input.color ?? null,
		date: input.date ?? null,
		time: input.time ?? null,
		duration_min: input.durationMin ?? null,
		horizon_override: input.horizonOverride ?? null,
		position: input.position ?? nextPosition(userId),
		batch_id: input.batchId ?? null,
		is_example: input.isExample ? 1 : 0,
		created_at: now,
		updated_at: now,
		done_at: null,
		deleted_at: null
	};
	getDb()
		.prepare(
			`INSERT INTO postits (
				id, user_id, goal_id, habit_id, title, note, color, date, time,
				duration_min, horizon_override, position, batch_id, is_example,
				created_at, updated_at, done_at, deleted_at
			) VALUES (
				@id, @user_id, @goal_id, @habit_id, @title, @note, @color, @date, @time,
				@duration_min, @horizon_override, @position, @batch_id, @is_example,
				@created_at, @updated_at, @done_at, @deleted_at
			)`
		)
		.run(row);
	return toPublicPostit(row);
}

export interface PostitListFilter {
	from?: string;
	to?: string;
	goalId?: string;
	// horizon filters by effectiveHorizon (SPEC 5.2) and therefore needs the
	// server-computed "today" of the user's timezone.
	horizon?: Horizon;
	today?: string;
}

// Non-deleted post-its. from/to restrict to dated post-its inside the range
// (calendar use); without them every non-deleted post-it is returned.
export function listPostits(userId: string, filter: PostitListFilter = {}): PublicPostit[] {
	const conditions = ['user_id = @userId', 'deleted_at IS NULL'];
	const params: Record<string, string> = { userId };
	if (filter.from) {
		conditions.push('date IS NOT NULL', 'date >= @from');
		params.from = filter.from;
	}
	if (filter.to) {
		conditions.push('date IS NOT NULL', 'date <= @to');
		params.to = filter.to;
	}
	if (filter.goalId) {
		conditions.push('goal_id = @goalId');
		params.goalId = filter.goalId;
	}
	const rows = getDb()
		.prepare(
			`SELECT * FROM postits WHERE ${conditions.join(' AND ')} ORDER BY position, created_at`
		)
		.all(params) as unknown as PostitRow[];
	let postits = rows.map(toPublicPostit);
	if (filter.horizon && filter.today) {
		const today = filter.today;
		postits = postits.filter(
			(postit) =>
				effectiveHorizon(
					{ horizon_override: postit.horizonOverride, date: postit.date },
					today
				) === filter.horizon
		);
	}
	return postits;
}

// Includes soft-deleted rows so restore can find them; callers filter.
export function getPostit(userId: string, id: string): PostitRow | null {
	const row = getDb()
		.prepare('SELECT * FROM postits WHERE id = ? AND user_id = ?')
		.get(id, userId) as PostitRow | undefined;
	return row ?? null;
}

// --- M6 aggregates (SPEC 5.6 badge rules, SPEC 7 GET /api/summary) ----------

export function countDonePostits(userId: string): number {
	const row = getDb()
		.prepare(
			'SELECT COUNT(*) AS n FROM postits WHERE user_id = ? AND deleted_at IS NULL AND done_at IS NOT NULL'
		)
		.get(userId) as { n: number };
	return row.n;
}

// One row per Quick-Capture commit; SPEC 5.6 ties `quick_writer` and the
// `capture_used` award to a batch, so batches are the unit here, not post-its.
export function countCaptureBatches(userId: string): number {
	const row = getDb()
		.prepare(
			'SELECT COUNT(DISTINCT batch_id) AS n FROM postits WHERE user_id = ? AND batch_id IS NOT NULL'
		)
		.get(userId) as { n: number };
	return row.n;
}

export function countDonePostitsInWeek(userId: string, from: string, to: string): number {
	const row = getDb()
		.prepare(
			`SELECT COUNT(*) AS n FROM postits
			 WHERE user_id = ? AND deleted_at IS NULL AND done_at IS NOT NULL
			   AND substr(done_at, 1, 10) >= ? AND substr(done_at, 1, 10) <= ?`
		)
		.get(userId, from, to) as { n: number };
	return row.n;
}

// SPEC 5.3: one log per completed post-it (log_date = date ?? today), capped
// by max_per_day; reopening removes it again.
function syncHabitLog(row: PostitRow, today: string): void {
	if (row.habit_id === null) return;
	if (row.done_at !== null && row.deleted_at === null) {
		habitLogsRepo.addPostitLog(row.user_id, row.habit_id, row.date ?? today, row.id);
	} else {
		habitLogsRepo.removeByPostit(row.user_id, row.id);
	}
}

export function updatePostit(
	userId: string,
	id: string,
	patch: {
		title?: string;
		note?: string | null;
		color?: PostitColor | null;
		date?: string | null;
		time?: string | null;
		durationMin?: number | null;
		goalId?: string | null;
		habitId?: string | null;
		horizonOverride?: Horizon | null;
		position?: number;
		done?: boolean;
	},
	today: string
): PublicPostit | null {
	const current = getPostit(userId, id);
	if (!current || current.deleted_at !== null) return null;
	const now = new Date().toISOString();
	const doneAt =
		patch.done === undefined
			? current.done_at
			: patch.done
				? (current.done_at ?? now)
				: null;
	getDb()
		.prepare(
			`UPDATE postits SET
				title = @title, note = @note, color = @color, date = @date, time = @time,
				duration_min = @duration_min, goal_id = @goal_id, habit_id = @habit_id,
				horizon_override = @horizon_override, position = @position,
				updated_at = @updated_at, done_at = @done_at
			WHERE id = @id AND user_id = @user_id`
		)
		.run({
			title: patch.title ?? current.title,
			note: patch.note !== undefined ? patch.note : current.note,
			color: patch.color !== undefined ? patch.color : current.color,
			date: patch.date !== undefined ? patch.date : current.date,
			time: patch.time !== undefined ? patch.time : current.time,
			duration_min: patch.durationMin !== undefined ? patch.durationMin : current.duration_min,
			goal_id: patch.goalId !== undefined ? patch.goalId : current.goal_id,
			habit_id: patch.habitId !== undefined ? patch.habitId : current.habit_id,
			horizon_override:
				patch.horizonOverride !== undefined ? patch.horizonOverride : current.horizon_override,
			position: patch.position ?? current.position,
			updated_at: now,
			done_at: doneAt,
			id,
			user_id: userId
		});
	const updated = getPostit(userId, id);
	if (!updated) return null;
	if (patch.done !== undefined && patch.done !== (current.done_at !== null)) {
		syncHabitLog(updated, today);
	}
	return toPublicPostit(updated);
}

export function softDeletePostit(userId: string, id: string, today: string): PublicPostit | null {
	const current = getPostit(userId, id);
	if (!current || current.deleted_at !== null) return null;
	const now = new Date().toISOString();
	getDb()
		.prepare('UPDATE postits SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?')
		.run(now, now, id, userId);
	const updated = getPostit(userId, id);
	if (!updated) return null;
	syncHabitLog(updated, today); // removes the log of a done post-it
	return toPublicPostit(updated);
}

export function restorePostit(userId: string, id: string, today: string): PublicPostit | null {
	const current = getPostit(userId, id);
	if (!current || current.deleted_at === null) return null;
	const now = new Date().toISOString();
	getDb()
		.prepare('UPDATE postits SET deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?')
		.run(now, id, userId);
	const updated = getPostit(userId, id);
	if (!updated) return null;
	syncHabitLog(updated, today); // re-creates the log of a done post-it
	return toPublicPostit(updated);
}

// Capture undo (SPEC 7, AC3): soft-deletes exactly the still-live post-its of
// one batch, nothing else. Goes through softDeletePostit so the SPEC-5.3
// habit-log side effect stays consistent.
export function softDeleteBatch(userId: string, batchId: string, today: string): PublicPostit[] {
	const rows = getDb()
		.prepare(
			'SELECT id FROM postits WHERE user_id = ? AND batch_id = ? AND deleted_at IS NULL ORDER BY position'
		)
		.all(userId, batchId) as { id: string }[];
	const deleted: PublicPostit[] = [];
	for (const row of rows) {
		const postit = softDeletePostit(userId, row.id, today);
		if (postit) deleted.push(postit);
	}
	return deleted;
}

// Batch position update for drag-and-drop (SPEC 7). Ids of other users are
// silently skipped; returns the affected, updated post-its.
export function reorderPostits(
	userId: string,
	items: { id: string; position: number }[]
): PublicPostit[] {
	const db = getDb();
	const stmt = db.prepare(
		'UPDATE postits SET position = @position, updated_at = @updatedAt WHERE id = @id AND user_id = @userId AND deleted_at IS NULL'
	);
	const updatedAt = new Date().toISOString();
	const apply = db.transaction(() => {
		for (const item of items) {
			stmt.run({ position: item.position, updatedAt, id: item.id, userId });
		}
	});
	apply();
	const updated: PublicPostit[] = [];
	for (const item of items) {
		const row = getPostit(userId, item.id);
		if (row && row.deleted_at === null) updated.push(toPublicPostit(row));
	}
	return updated;
}

export type CleanupAction = 'today' | 'plusWeek' | 'done' | 'delete';

// Aufräumen sheet actions (SPEC 8.2). Only owned, non-deleted post-its are
// touched; foreign ids are skipped silently. Date actions keep an existing
// horizon_override untouched (SPEC P4: no hidden re-sorting).
export function cleanupPostits(
	userId: string,
	ids: string[],
	action: CleanupAction,
	today: string
): PublicPostit[] {
	const touched: PublicPostit[] = [];
	for (const id of ids) {
		let updated: PublicPostit | null = null;
		if (action === 'delete') {
			updated = softDeletePostit(userId, id, today);
		} else if (action === 'done') {
			updated = updatePostit(userId, id, { done: true }, today);
		} else if (action === 'today') {
			updated = updatePostit(userId, id, { date: today }, today);
		} else {
			const current = getPostit(userId, id);
			if (current && current.deleted_at === null) {
				updated = updatePostit(
					userId,
					id,
					{ date: addDays(current.date ?? today, 7) },
					today
				);
			}
		}
		if (updated) touched.push(updated);
	}
	return touched;
}
