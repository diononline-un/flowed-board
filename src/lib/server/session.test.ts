import { describe, expect, it } from 'vitest';
import { getDb } from './db.js';
import * as sessionsRepo from './repo/sessions.js';
import * as usersRepo from './repo/users.js';
import {
	createSession,
	destroyAllForUser,
	destroyByToken,
	destroyOthersForUser,
	resolveSessionToken,
	sessionCookieOptions
} from './session.js';
import { useTestDb } from './testdb.js';

// Session service (SPEC 6.4): token storage, sliding expiration, expiry.

const DAY_MS = 86_400_000;
const T0 = new Date('2026-01-01T00:00:00.000Z');

function makeUser(username: string): string {
	useTestDb();
	return usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	}).id;
}

describe('session service (SPEC 6.4)', () => {
	it('stores only sha256(token), never the token itself', () => {
		const userId = makeUser('token-check');
		const { token } = createSession(userId, null, T0);
		const rows = (
			getDb()
				.prepare('SELECT id FROM sessions WHERE user_id = ?')
				.all(userId) as { id: string }[]
		).map((row) => row.id);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatch(/^[0-9a-f]{64}$/);
		expect(rows[0]).not.toBe(token);
	});

	it('resolves a fresh session to its user', () => {
		const userId = makeUser('resolve-me');
		const { token } = createSession(userId, null, T0);
		const auth = resolveSessionToken(token, new Date(T0.getTime() + DAY_MS));
		expect(auth?.user.id).toBe(userId);
		expect(auth?.renewed).toBe(false);
	});

	it('does not renew with more than half the TTL remaining', () => {
		const userId = makeUser('no-renew');
		const { token } = createSession(userId, null, T0);
		// TTL default 30 days: 10 days in, 20 remain (> 15 half).
		const auth = resolveSessionToken(token, new Date(T0.getTime() + 10 * DAY_MS));
		expect(auth?.renewed).toBe(false);
	});

	it('renews sliding when less than half the TTL remains', () => {
		const userId = makeUser('sliding');
		const { token } = createSession(userId, null, T0);
		const at = new Date(T0.getTime() + 20 * DAY_MS); // 10 days remain (< 15)
		const auth = resolveSessionToken(token, at);
		expect(auth?.renewed).toBe(true);
		// Expiry extended to full TTL from `at`.
		const stored = sessionsRepo.getSessionWithUser(auth!.sessionId)!;
		expect(Date.parse(stored.session.expires_at)).toBe(at.getTime() + 30 * DAY_MS);
		// Still valid 29 days later.
		expect(
			resolveSessionToken(token, new Date(at.getTime() + 29 * DAY_MS))
		).not.toBeNull();
	});

	it('returns null for expired sessions and deletes them', () => {
		const userId = makeUser('expired');
		const { token } = createSession(userId, null, T0);
		expect(resolveSessionToken(token, new Date(T0.getTime() + 31 * DAY_MS))).toBeNull();
		// Deleted, not just rejected.
		expect(resolveSessionToken(token, T0)).toBeNull();
	});

	it('destroy helpers target the right sessions', () => {
		const userId = makeUser('destroy');
		const first = createSession(userId, null, T0);
		const second = createSession(userId, null, T0);
		destroyByToken(first.token);
		expect(resolveSessionToken(first.token, T0)).toBeNull();
		expect(resolveSessionToken(second.token, T0)).not.toBeNull();

		const third = createSession(userId, null, T0);
		destroyOthersForUser(userId, second.token);
		expect(resolveSessionToken(third.token, T0)).toBeNull();
		expect(resolveSessionToken(second.token, T0)).not.toBeNull();

		destroyAllForUser(userId);
		expect(resolveSessionToken(second.token, T0)).toBeNull();
	});

	it('cookie flags follow SPEC 6.4', () => {
		makeUser('cookie');
		const options = sessionCookieOptions();
		expect(options.httpOnly).toBe(true);
		expect(options.sameSite).toBe('lax');
		expect(options.path).toBe('/');
		expect(options.maxAge).toBe(30 * 86_400);
		// ORIGIN defaults to http://localhost:3000 in tests -> no Secure flag.
		expect(options.secure).toBe(false);
	});
});
