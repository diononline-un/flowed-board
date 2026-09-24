import { createHash, randomBytes } from 'node:crypto';
import { env } from './env.js';
import * as sessionsRepo from './repo/sessions.js';
import { toPublicUser } from './repo/users.js';
import type { AuthSession } from '$lib/shared/types.js';

// Session service (SPEC 6.4). The cookie carries a 32-byte random token
// (base64url); the database only ever stores sha256hex(token) as sessions.id.

export const SESSION_COOKIE = 'fb_session';

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function ttlMs(): number {
	return env.SESSION_TTL_DAYS * 86_400_000;
}

export function sessionCookieOptions(): {
	path: string;
	httpOnly: boolean;
	sameSite: 'lax';
	secure: boolean;
	maxAge: number;
} {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: env.ORIGIN.startsWith('https://'),
		maxAge: env.SESSION_TTL_DAYS * 86_400
	};
}

export function createSession(
	userId: string,
	userAgent: string | null = null,
	now: Date = new Date()
): { token: string; expiresAt: string } {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(now.getTime() + ttlMs()).toISOString();
	sessionsRepo.insertSession({
		id: hashToken(token),
		user_id: userId,
		created_at: now.toISOString(),
		expires_at: expiresAt,
		user_agent: userAgent
	});
	return { token, expiresAt };
}

// Resolves a cookie token to user + session. Sliding expiration (SPEC 6.4):
// when less than half the TTL remains, the session is extended to full TTL
// and `renewed` tells the caller to re-set the cookie.
export function resolveSessionToken(
	token: string,
	now: Date = new Date()
): AuthSession | null {
	const sessionId = hashToken(token);
	const found = sessionsRepo.getSessionWithUser(sessionId);
	if (!found) return null;
	const expiresAtMs = Date.parse(found.session.expires_at);
	if (expiresAtMs <= now.getTime()) {
		sessionsRepo.deleteById(sessionId);
		return null;
	}
	let renewed = false;
	if (expiresAtMs - now.getTime() < ttlMs() / 2) {
		sessionsRepo.updateExpiry(sessionId, new Date(now.getTime() + ttlMs()).toISOString());
		renewed = true;
	}
	return { user: toPublicUser(found.user), sessionId, renewed };
}

export function destroyByToken(token: string): void {
	sessionsRepo.deleteById(hashToken(token));
}

export function destroyAllForUser(userId: string): void {
	sessionsRepo.deleteByUser(userId);
}

export function destroyOthersForUser(userId: string, currentToken: string): void {
	sessionsRepo.deleteByUserExcept(userId, hashToken(currentToken));
}
