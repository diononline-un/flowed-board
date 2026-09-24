import { describe, expect, it } from 'vitest';
import {
	generateRecoveryPhrase,
	getDummyHash,
	hashSecret,
	normalizePhrase,
	timingSafeEqualText,
	verifySecret
} from './auth.js';
import * as usersRepo from './repo/users.js';
import { createSession, destroyAllForUser, resolveSessionToken } from './session.js';
import { useTestDb } from './testdb.js';
import {
	COMMON_PASSWORDS,
	USERNAME_RE,
	normalizeUsername,
	passwordSchema
} from '$lib/shared/schemas.js';

describe('hashSecret / verifySecret (SPEC 6.2)', () => {
	it('round-trips a password hash', async () => {
		const hash = await hashSecret('correct horse battery staple');
		expect(hash.startsWith('scrypt$65536$8$2$')).toBe(true);
		expect(await verifySecret(hash, 'correct horse battery staple')).toBe(true);
	});

	it('rejects a wrong password', async () => {
		const hash = await hashSecret('the-right-password');
		expect(await verifySecret(hash, 'the-wrong-password')).toBe(false);
	});

	it('rejects malformed stored hashes', async () => {
		expect(await verifySecret('not-a-hash', 'x')).toBe(false);
		expect(await verifySecret('scrypt$abc$8$2$AAAA$BBBB', 'x')).toBe(false);
		expect(await verifySecret('bcrypt$65536$8$2$AAAA$BBBB', 'x')).toBe(false);
	});
});

describe('recovery phrases (SPEC 6.3)', () => {
	it('generates 12 words from 128 bits of entropy', () => {
		const phrase = generateRecoveryPhrase();
		expect(phrase.split(' ')).toHaveLength(12);
		expect(generateRecoveryPhrase()).not.toBe(phrase);
	});

	it('normalizes case, trim and whitespace runs', () => {
		expect(normalizePhrase('  Foo   BAR\tBaz \n Qux ')).toBe('foo bar baz qux');
	});

	it('verifies a normalized phrase against its hash', async () => {
		const phrase = generateRecoveryPhrase();
		const hash = await hashSecret(normalizePhrase(phrase));
		const messy = phrase.split(' ').join('  \n ').toUpperCase();
		expect(await verifySecret(hash, normalizePhrase(messy))).toBe(true);
		expect(
			await verifySecret(hash, normalizePhrase(generateRecoveryPhrase()))
		).toBe(false);
	});

	it('dummy hash is a real scrypt hash and cached (SPEC 6.3)', async () => {
		const dummy = await getDummyHash();
		expect(dummy.startsWith('scrypt$65536$8$2$')).toBe(true);
		expect(await verifySecret(dummy, 'any-candidate')).toBe(false);
		expect(await getDummyHash()).toBe(dummy);
	});
});

describe('timingSafeEqualText (SPEC 6.1 invite code)', () => {
	it('matches equal strings only', () => {
		expect(timingSafeEqualText('secret-code', 'secret-code')).toBe(true);
		expect(timingSafeEqualText('secret-code', 'secret-codf')).toBe(false);
		expect(timingSafeEqualText('secret-code', '')).toBe(false);
	});
});

describe('password rules (SPEC 6.1)', () => {
	const check = (password: string, username = 'someuser') =>
		passwordSchema(username).safeParse(password);

	it('ships a common-password list with at least 25 entries', () => {
		expect(COMMON_PASSWORDS.length).toBeGreaterThanOrEqual(25);
	});

	it('rejects passwords shorter than 10 characters', () => {
		expect(check('kurz123').success).toBe(false);
	});

	it('rejects passwords longer than 128 characters', () => {
		expect(check('x'.repeat(129)).success).toBe(false);
	});

	it('rejects the password equal to the username (case-insensitive)', () => {
		expect(check('MeinUser123', 'meinuser123').success).toBe(false);
	});

	it('rejects listed common passwords (case-insensitive)', () => {
		expect(check('Passwort123').success).toBe(false);
		expect(check('QWERTZUIOP').success).toBe(false);
	});

	it('rejects a single repeated character', () => {
		expect(check('aaaaaaaaaa').success).toBe(false);
		expect(check('----------').success).toBe(false);
	});

	it('accepts a strong passphrase', () => {
		expect(check('kaffee-birne-lampe-42').success).toBe(true);
	});
});

describe('username rules (SPEC 6.1)', () => {
	it('normalizes trim and case before checks', () => {
		expect(normalizeUsername('  Foo.BAR ')).toBe('foo.bar');
	});

	it('accepts valid usernames', () => {
		for (const name of ['abc', 'user_1', 'a.b-c_d', 'x'.repeat(24), '9lives']) {
			expect(USERNAME_RE.test(name), name).toBe(true);
		}
	});

	it('rejects invalid usernames', () => {
		for (const name of [
			'ab', // too short
			'x'.repeat(25), // too long
			'_lead', // must start alphanumeric
			'.lead',
			'-lead',
			'white space',
			'umläut',
			'UPPER', // regex expects pre-normalized lowercase
			'emoji🙂x'
		]) {
			expect(USERNAME_RE.test(name), name).toBe(false);
		}
	});
});

describe('recovery roundtrip incl. session invalidation (SPEC 6.3)', () => {
	it('replaces password, deletes all sessions, issues a new phrase', async () => {
		useTestDb();
		const oldPhrase = generateRecoveryPhrase();
		const user = usersRepo.createUser({
			username: 'recoverme',
			passwordHash: await hashSecret('old-password-1'),
			recoveryHash: await hashSecret(normalizePhrase(oldPhrase)),
			ageConfirmedAt: new Date().toISOString()
		});
		const sessionA = createSession(user.id);
		const sessionB = createSession(user.id);
		expect(resolveSessionToken(sessionA.token)).not.toBeNull();

		// Same steps the /api/auth/recover route performs.
		const row = usersRepo.getByUsername('recoverme');
		expect(row).not.toBeNull();
		expect(await verifySecret(row!.recovery_hash, normalizePhrase(oldPhrase))).toBe(
			true
		);
		usersRepo.setPasswordHash(row!.id, await hashSecret('new-password-1'));
		const newPhrase = generateRecoveryPhrase();
		usersRepo.setRecoveryHash(row!.id, await hashSecret(normalizePhrase(newPhrase)));
		destroyAllForUser(row!.id);

		// All old sessions are gone.
		expect(resolveSessionToken(sessionA.token)).toBeNull();
		expect(resolveSessionToken(sessionB.token)).toBeNull();

		// New password works, old one does not.
		const after = usersRepo.getByUsername('recoverme')!;
		expect(await verifySecret(after.password_hash, 'new-password-1')).toBe(true);
		expect(await verifySecret(after.password_hash, 'old-password-1')).toBe(false);

		// Old phrase is invalid, new phrase works, confirmation reset.
		expect(await verifySecret(after.recovery_hash, normalizePhrase(oldPhrase))).toBe(
			false
		);
		expect(await verifySecret(after.recovery_hash, normalizePhrase(newPhrase))).toBe(
			true
		);
		expect(after.recovery_confirmed_at).toBeNull();

		// A fresh session resolves again.
		const fresh = createSession(after.id);
		expect(resolveSessionToken(fresh.token)?.user.username).toBe('recoverme');
	});
});
