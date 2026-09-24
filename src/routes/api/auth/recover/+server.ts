import type { RequestHandler } from './$types';
import {
	generateRecoveryPhrase,
	getDummyHash,
	hashSecret,
	normalizePhrase,
	verifySecret
} from '$lib/server/auth.js';
import {
	clientIp,
	ok,
	parseJson,
	rateLimited,
	unauthorized
} from '$lib/server/http.js';
import { recoverIpLimiter, recoverUserLimiter } from '$lib/server/ratelimit.js';
import * as usersRepo from '$lib/server/repo/users.js';
import {
	SESSION_COOKIE,
	createSession,
	destroyAllForUser,
	sessionCookieOptions
} from '$lib/server/session.js';
import { copy } from '$lib/shared/copy.js';
import { recoverSchema } from '$lib/shared/schemas.js';

// Recovery (SPEC 6.3, 7): username + 12 words + new password. On success
// the password is replaced, ALL sessions are deleted, a NEW phrase is
// generated and a fresh session is issued. Generic error on any mismatch.
export const POST: RequestHandler = async (event) => {
	const parsed = await parseJson(recoverSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const { username, phrase, newPassword } = parsed.data;
	const ip = clientIp(event);
	const ipLimit = recoverIpLimiter.check(ip);
	if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfterSec);
	const userLimit = recoverUserLimiter.check(username);
	if (!userLimit.allowed) return rateLimited(userLimit.retryAfterSec);

	const row = usersRepo.getByUsername(username);
	if (!row) {
		// Unknown username: same scrypt work, same error (SPEC 6.3).
		await verifySecret(await getDummyHash(), normalizePhrase(phrase));
		return unauthorized(copy.auth.errors.recoverFailed);
	}
	const match = await verifySecret(row.recovery_hash, normalizePhrase(phrase));
	if (!match) {
		return unauthorized(copy.auth.errors.recoverFailed);
	}

	usersRepo.setPasswordHash(row.id, await hashSecret(newPassword));
	const recoveryPhrase = generateRecoveryPhrase();
	usersRepo.setRecoveryHash(row.id, await hashSecret(normalizePhrase(recoveryPhrase)));
	destroyAllForUser(row.id);

	const { token } = createSession(row.id, event.request.headers.get('user-agent'));
	event.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
	usersRepo.touchActivity(row.id, 0);
	return ok({ user: usersRepo.getPublicById(row.id), recoveryPhrase });
};
