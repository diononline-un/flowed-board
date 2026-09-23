import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as usersRepo from './users.js';
import type { PublicUser } from '$lib/shared/types.js';
import * as linkCodesRepo from './linkCodes.js';

// link_codes belongs to optional module A (SPEC 14.1): the Discord flow is not
// built in v1, so the table has no API surface yet. What exists is the storage
// contract and the mandatory purge of SPEC 6.8, and both are pinned here
// against :memory: with the real migrations — a code lives exactly ten minutes
// and every user only ever sees their own rows.

const NOW = new Date('2026-09-24T12:00:00.000Z');
const MINUTE_MS = 60 * 1000;

function tenMinutesFromNow(): string {
	return new Date(NOW.getTime() + 10 * MINUTE_MS).toISOString();
}

let db: SqliteDatabase;

function makeUser(username: string): PublicUser {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	return user;
}

describe('linkCodes repo', () => {
	it('stores a code and keeps it while it is valid', () => {
		db = useTestDb();
		const user = makeUser('code-a');

		linkCodesRepo.insertCode({
			code_hash: 'hash-a',
			user_id: user.id,
			expires_at: tenMinutesFromNow()
		});

		expect(db.prepare('SELECT code_hash, user_id, expires_at FROM link_codes').all()).toEqual([
			{ code_hash: 'hash-a', user_id: user.id, expires_at: tenMinutesFromNow() }
		]);
		expect(linkCodesRepo.purgeExpired(NOW.toISOString())).toBe(0);
	});

	it('purges the code once it expires, and only then', () => {
		db = useTestDb();
		const user = makeUser('code-b');
		linkCodesRepo.insertCode({
			code_hash: 'expiring',
			user_id: user.id,
			expires_at: tenMinutesFromNow()
		});
		linkCodesRepo.insertCode({
			code_hash: 'later',
			user_id: user.id,
			expires_at: new Date(NOW.getTime() + 20 * MINUTE_MS).toISOString()
		});

		// One minute before the expiry nothing is dead yet.
		expect(linkCodesRepo.purgeExpired(new Date(NOW.getTime() + 9 * MINUTE_MS).toISOString())).toBe(
			0
		);
		// The exact expiry instant counts as dead (DECISIONS: `expires_at <= now`).
		expect(linkCodesRepo.purgeExpired(tenMinutesFromNow())).toBe(1);
		expect(db.prepare('SELECT code_hash FROM link_codes').all()).toEqual([{ code_hash: 'later' }]);
		// Idempotent: a second pass removes nothing more.
		expect(linkCodesRepo.purgeExpired(tenMinutesFromNow())).toBe(0);
	});

	it('purges every expired code of every user in one pass (SPEC 6.8)', () => {
		db = useTestDb();
		const userA = makeUser('code-c');
		const userB = makeUser('code-d');
		linkCodesRepo.insertCode({
			code_hash: 'dead-a',
			user_id: userA.id,
			expires_at: new Date(NOW.getTime() - MINUTE_MS).toISOString()
		});
		linkCodesRepo.insertCode({
			code_hash: 'dead-b',
			user_id: userB.id,
			expires_at: new Date(NOW.getTime() - MINUTE_MS).toISOString()
		});
		linkCodesRepo.insertCode({
			code_hash: 'live-b',
			user_id: userB.id,
			expires_at: tenMinutesFromNow()
		});

		expect(linkCodesRepo.purgeExpired(NOW.toISOString())).toBe(2);
		expect(db.prepare('SELECT code_hash FROM link_codes').all()).toEqual([{ code_hash: 'live-b' }]);
	});

	it('keeps the two users apart (SPEC 6.6)', () => {
		db = useTestDb();
		const userA = makeUser('code-e');
		const userB = makeUser('code-f');
		linkCodesRepo.insertCode({
			code_hash: 'only-a',
			user_id: userA.id,
			expires_at: tenMinutesFromNow()
		});

		// Ownership is carried by the row itself: B has no code of their own,
		// and A's row is never reachable through B's user id.
		expect(
			db.prepare('SELECT COUNT(*) AS n FROM link_codes WHERE user_id = ?').get(userB.id)
		).toEqual({ n: 0 });
		expect(
			db.prepare('SELECT COUNT(*) AS n FROM link_codes WHERE user_id = ?').get(userA.id)
		).toEqual({ n: 1 });
	});

	it('cascades the codes when the user is deleted', () => {
		db = useTestDb();
		const user = makeUser('code-g');
		linkCodesRepo.insertCode({
			code_hash: 'cascade',
			user_id: user.id,
			expires_at: tenMinutesFromNow()
		});

		usersRepo.deleteUser(user.id);

		expect(db.prepare('SELECT COUNT(*) AS n FROM link_codes').get()).toEqual({ n: 0 });
	});

	it('refuses a code for a user that does not exist', () => {
		db = useTestDb();
		expect(() =>
			linkCodesRepo.insertCode({
				code_hash: 'orphan',
				user_id: 'missing-user',
				expires_at: tenMinutesFromNow()
			})
		).toThrow(/FOREIGN KEY/i);
	});
});
