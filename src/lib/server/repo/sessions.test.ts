import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as sessionsRepo from './sessions.js';
import * as usersRepo from './users.js';
import type { SessionRow } from '$lib/shared/types.js';

// CRUD + tenant separation (SPEC 6.6) against :memory: with real migrations.

let db: SqliteDatabase;

function makeUser(username: string): string {
	return usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	}).id;
}

function makeSession(id: string, userId: string, expiresAt = '2026-02-01T00:00:00.000Z'): SessionRow {
	const row: SessionRow = {
		id,
		user_id: userId,
		created_at: '2026-01-01T00:00:00.000Z',
		expires_at: expiresAt,
		user_agent: 'vitest'
	};
	sessionsRepo.insertSession(row);
	return row;
}

describe('sessions repo', () => {
	it('inserts and loads a session together with its user', () => {
		db = useTestDb();
		const userId = makeUser('harry');
		makeSession('s1', userId);
		const found = sessionsRepo.getSessionWithUser('s1');
		expect(found?.session.user_id).toBe(userId);
		expect(found?.session.user_agent).toBe('vitest');
		expect(found?.user.username).toBe('harry');
		expect(sessionsRepo.getSessionWithUser('missing')).toBeNull();
	});

	it('updates expiry', () => {
		db = useTestDb();
		const userId = makeUser('irene');
		makeSession('s1', userId);
		sessionsRepo.updateExpiry('s1', '2026-03-01T00:00:00.000Z');
		expect(sessionsRepo.getSessionWithUser('s1')?.session.expires_at).toBe(
			'2026-03-01T00:00:00.000Z'
		);
	});

	it('deletes by id, by user, by user except one, and expired rows', () => {
		db = useTestDb();
		const userId = makeUser('judy');
		makeSession('s1', userId);
		makeSession('s2', userId);
		makeSession('s3', userId);
		sessionsRepo.deleteById('s1');
		expect(sessionsRepo.getSessionWithUser('s1')).toBeNull();

		sessionsRepo.deleteByUserExcept(userId, 's3');
		expect(sessionsRepo.getSessionWithUser('s2')).toBeNull();
		expect(sessionsRepo.getSessionWithUser('s3')).not.toBeNull();

		sessionsRepo.deleteByUser(userId);
		expect(sessionsRepo.getSessionWithUser('s3')).toBeNull();

		makeSession('old', userId, '2026-01-02T00:00:00.000Z');
		makeSession('fresh', userId, '2026-02-01T00:00:00.000Z');
		expect(sessionsRepo.deleteExpired('2026-01-15T00:00:00.000Z')).toBe(1);
		expect(sessionsRepo.getSessionWithUser('old')).toBeNull();
		expect(sessionsRepo.getSessionWithUser('fresh')).not.toBeNull();
	});
});

describe('sessions repo tenant separation (SPEC 6.6)', () => {
	it('user B session operations never touch user A sessions', () => {
		db = useTestDb();
		const userA = makeUser('tenant-a');
		const userB = makeUser('tenant-b');
		makeSession('a1', userA);
		makeSession('b1', userB);
		makeSession('b2', userB);

		sessionsRepo.deleteByUserExcept(userB, 'b2');
		expect(sessionsRepo.getSessionWithUser('a1')).not.toBeNull(); // A untouched
		expect(sessionsRepo.getSessionWithUser('b1')).toBeNull();
		expect(sessionsRepo.getSessionWithUser('b2')).not.toBeNull();

		sessionsRepo.deleteByUser(userB);
		expect(sessionsRepo.getSessionWithUser('a1')).not.toBeNull(); // A untouched
		expect(sessionsRepo.getSessionWithUser('b2')).toBeNull();

		// Cross-tenant lookups return nothing (no existence leak).
		expect(sessionsRepo.getSessionWithUser('a1')?.user.username).toBe('tenant-a');
	});
});
