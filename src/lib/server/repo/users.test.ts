import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as usersRepo from './users.js';
import * as sessionsRepo from './sessions.js';
import type { UserRow } from '$lib/shared/types.js';

// CRUD + tenant separation (SPEC 6.6) against :memory: with real migrations.

let db: SqliteDatabase;

function makeUser(username: string): UserRow {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	return usersRepo.getById(user.id)!;
}

describe('users repo', () => {
	it('creates and reads users (username lookup is case-insensitive)', () => {
		db = useTestDb();
		const created = makeUser('alice');
		expect(created.username).toBe('alice');
		expect(created.display_name).toBe('alice'); // display_name starts as username
		expect(created.tz).toBe('Europe/Berlin');
		expect(created.week_start).toBe(1);
		expect(usersRepo.getByUsername('ALICE')?.id).toBe(created.id);
		expect(usersRepo.getByUsername('alice ')?.id ?? null).toBeNull(); // no trim in repo
		expect(usersRepo.getPublicById(created.id)?.displayName).toBe('alice');
		expect(usersRepo.getById('missing')).toBeNull();
	});

	it('public shape never exposes hashes (SPEC 6.7)', () => {
		db = useTestDb();
		makeUser('bob');
		const publicUser = usersRepo.getPublicById(usersRepo.getByUsername('bob')!.id)!;
		expect('password_hash' in publicUser).toBe(false);
		expect('recovery_hash' in publicUser).toBe(false);
	});

	it('updates profile fields and stores prefs as JSON', () => {
		db = useTestDb();
		const user = makeUser('carol');
		const updated = usersRepo.updateProfile(user.id, {
			displayName: 'Caro',
			tz: 'Europe/Vienna',
			weekStart: 6,
			prefs: {
				gamification: false,
				postitTilt: true,
				reduceMotion: false,
				showDoneDays: 3,
				aiConsentAt: null,
				aiEnabled: true
			}
		});
		expect(updated?.displayName).toBe('Caro');
		expect(updated?.tz).toBe('Europe/Vienna');
		expect(updated?.weekStart).toBe(6);
		expect(updated?.prefs.postitTilt).toBe(true);
		expect(updated?.prefs.gamification).toBe(false);
		// Untouched fields survive.
		const again = usersRepo.updateProfile(user.id, { displayName: 'Caro 2' });
		expect(again?.tz).toBe('Europe/Vienna');
	});

	it('manages password and recovery hashes + confirmation state', () => {
		db = useTestDb();
		const user = makeUser('dave');
		usersRepo.setPasswordHash(user.id, 'new-hash');
		expect(usersRepo.getById(user.id)?.password_hash).toBe('new-hash');

		usersRepo.setRecoveryConfirmed(user.id, '2026-02-01T00:00:00.000Z');
		expect(usersRepo.getById(user.id)?.recovery_confirmed_at).toBe(
			'2026-02-01T00:00:00.000Z'
		);
		usersRepo.setRecoveryHash(user.id, 'new-recovery');
		const after = usersRepo.getById(user.id)!;
		expect(after.recovery_hash).toBe('new-recovery');
		expect(after.recovery_confirmed_at).toBeNull(); // reset on regeneration
	});

	it('throttles last_activity_at writes to once per minute (SPEC 6.4)', () => {
		db = useTestDb();
		const user = makeUser('erin'); // last_activity_at = creation time
		expect(usersRepo.touchActivity(user.id)).toBe(false); // within the minute
		db.prepare('UPDATE users SET last_activity_at = ? WHERE id = ?').run(
			new Date(Date.now() - 120_000).toISOString(),
			user.id
		);
		expect(usersRepo.touchActivity(user.id)).toBe(true);
		expect(usersRepo.touchActivity(user.id)).toBe(false); // throttled again
	});

	it('hard-deletes a user and cascades sessions (SPEC 6.7)', () => {
		db = useTestDb();
		const user = makeUser('frank');
		sessionsRepo.insertSession({
			id: 's1',
			user_id: user.id,
			created_at: '2026-01-01T00:00:00.000Z',
			expires_at: '2026-02-01T00:00:00.000Z',
			user_agent: null
		});
		usersRepo.deleteUser(user.id);
		expect(usersRepo.getById(user.id)).toBeNull();
		expect(
			db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(user.id)
		).toEqual({ n: 0 });
	});

	it('export contains all own rows without hashes or sessions (SPEC 6.7)', () => {
		db = useTestDb();
		const user = makeUser('grace');
		sessionsRepo.insertSession({
			id: 's1',
			user_id: user.id,
			created_at: '2026-01-01T00:00:00.000Z',
			expires_at: '2026-02-01T00:00:00.000Z',
			user_agent: null
		});
		const data = usersRepo.exportData(user.id) as {
			user: Record<string, unknown>;
			goals: unknown[];
		};
		expect(data.user).not.toHaveProperty('password_hash');
		expect(data.user).not.toHaveProperty('recovery_hash');
		expect(data).not.toHaveProperty('sessions');
		expect(data.goals).toEqual([]);
		expect(data.user.username).toBe('grace');
	});
});

describe('users repo tenant separation (SPEC 6.6)', () => {
	it('user B cannot read, change or delete user A data', () => {
		db = useTestDb();
		const userA = makeUser('user-a');
		const userB = makeUser('user-b');
		sessionsRepo.insertSession({
			id: 'sess-a',
			user_id: userA.id,
			created_at: '2026-01-01T00:00:00.000Z',
			expires_at: '2026-02-01T00:00:00.000Z',
			user_agent: null
		});
		sessionsRepo.insertSession({
			id: 'sess-b',
			user_id: userB.id,
			created_at: '2026-01-01T00:00:00.000Z',
			expires_at: '2026-02-01T00:00:00.000Z',
			user_agent: null
		});

		// Updates scoped to B never touch A.
		usersRepo.updateProfile(userB.id, { displayName: 'B renamed' });
		expect(usersRepo.getById(userA.id)?.display_name).toBe('user-a');

		usersRepo.setPasswordHash(userB.id, 'b-hash');
		expect(usersRepo.getById(userA.id)?.password_hash).toBe('hash-placeholder');

		// Session wipes scoped to B leave A's sessions alone.
		sessionsRepo.deleteByUser(userB.id);
		expect(
			db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(userA.id)
		).toEqual({ n: 1 });

		// Deleting B leaves A fully intact.
		usersRepo.deleteUser(userB.id);
		expect(usersRepo.getById(userA.id)).not.toBeNull();
		expect(
			db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(userA.id)
		).toEqual({ n: 1 });

		// Export of A contains no B rows.
		const exportA = usersRepo.exportData(userA.id) as { user: { username: string } };
		expect(exportA.user.username).toBe('user-a');
	});
});
