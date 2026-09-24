import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// Password and recovery-phrase hashing (SPEC 6.2/6.3): scrypt async,
// N=65536, r=8, p=2, maxmem 256 MiB, 16-byte salt, 64-byte key.
// Stored format: scrypt$N$r$p$<saltB64>$<hashB64>.

const SCRYPT_N = 65536;
const SCRYPT_R = 8;
const SCRYPT_P = 2;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

// scrypt with these parameters needs ~128 MiB per operation; a simple
// semaphore caps concurrent hash operations at 2 (SPEC 6.2).
const MAX_CONCURRENT_HASH_OPS = 2;
let activeHashOps = 0;
const hashQueue: Array<() => void> = [];

async function acquireHashSlot(): Promise<void> {
	if (activeHashOps < MAX_CONCURRENT_HASH_OPS) {
		activeHashOps += 1;
		return;
	}
	await new Promise<void>((resolve) => hashQueue.push(resolve));
	activeHashOps += 1;
}

function releaseHashSlot(): void {
	activeHashOps -= 1;
	const next = hashQueue.shift();
	if (next) next();
}

function scryptAsync(
	secret: string,
	salt: Buffer,
	params: { N: number; r: number; p: number }
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(
			secret,
			salt,
			KEY_BYTES,
			{ N: params.N, r: params.r, p: params.p, maxmem: SCRYPT_MAXMEM },
			(error, key) => (error ? reject(error) : resolve(key))
		);
	});
}

// Hashes a password or a normalized recovery phrase.
export async function hashSecret(secret: string): Promise<string> {
	await acquireHashSlot();
	try {
		const salt = randomBytes(SALT_BYTES);
		const key = await scryptAsync(secret, salt, {
			N: SCRYPT_N,
			r: SCRYPT_R,
			p: SCRYPT_P
		});
		return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${key.toString('base64')}`;
	} finally {
		releaseHashSlot();
	}
}

// Constant-time verification. Returns false on any malformed stored value.
export async function verifySecret(stored: string, candidate: string): Promise<boolean> {
	const parts = stored.split('$');
	if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
	const N = Number(parts[1]);
	const r = Number(parts[2]);
	const p = Number(parts[3]);
	if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
	const salt = Buffer.from(parts[4] ?? '', 'base64');
	const expected = Buffer.from(parts[5] ?? '', 'base64');
	if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false;
	await acquireHashSlot();
	try {
		const actual = await scryptAsync(candidate, salt, { N, r, p });
		return timingSafeEqual(actual, expected);
	} catch {
		return false;
	} finally {
		releaseHashSlot();
	}
}

// Timing-safe comparison for arbitrary strings (invite codes, SPEC 6.1):
// both sides are hashed first so length differences do not leak either.
export function timingSafeEqualText(a: string, b: string): boolean {
	const hashA = createHash('sha256').update(a).digest();
	const hashB = createHash('sha256').update(b).digest();
	return timingSafeEqual(hashA, hashB);
}

// Dummy hash for unknown usernames (SPEC 6.3): login and recover run the
// same scrypt work so the timing does not reveal whether an account exists.
let dummyHash: string | null = null;

export async function getDummyHash(): Promise<string> {
	if (!dummyHash) {
		dummyHash = await hashSecret(randomBytes(18).toString('base64url'));
	}
	return dummyHash;
}

// Recovery phrases (SPEC 6.3): 12 words, 128 bits of entropy.
export function generateRecoveryPhrase(): string {
	return generateMnemonic(wordlist, 128);
}

// Normalization before hashing or comparing a phrase: lowercase, trimmed,
// all whitespace collapsed to single spaces.
export function normalizePhrase(phrase: string): string {
	return phrase.trim().toLowerCase().replace(/\s+/g, ' ');
}
