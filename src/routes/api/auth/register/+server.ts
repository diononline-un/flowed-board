import type { RequestHandler } from './$types';
import {
	generateRecoveryPhrase,
	hashSecret,
	normalizePhrase,
	timingSafeEqualText
} from '$lib/server/auth.js';
import { env } from '$lib/server/env.js';
import {
	clientIp,
	forbidden,
	ok,
	parseJson,
	rateLimited,
	validationError
} from '$lib/server/http.js';
import { registerIpLimiter } from '$lib/server/ratelimit.js';
import * as usersRepo from '$lib/server/repo/users.js';
import { seedUserContent } from '$lib/server/seed.js';
import {
	SESSION_COOKIE,
	createSession,
	sessionCookieOptions
} from '$lib/server/session.js';
import { copy } from '$lib/shared/copy.js';
import { todayIn } from '$lib/shared/date.js';
import { registerSchema } from '$lib/shared/schemas.js';

// Registration (SPEC 6.1, 7): validates input, enforces the registration
// mode, creates user + session and returns the recovery phrase exactly once.
export const POST: RequestHandler = async (event) => {
	if (env.REGISTRATION === 'closed') {
		return forbidden(copy.auth.errors.registrationClosed);
	}
	const parsed = await parseJson(registerSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const ipLimit = registerIpLimiter.check(clientIp(event));
	if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfterSec);

	if (env.REGISTRATION === 'invite') {
		const code = parsed.data.inviteCode ?? '';
		if (!timingSafeEqualText(code, env.INVITE_CODE)) {
			return validationError(copy.errors.invalidInput, {
				inviteCode: copy.auth.errors.inviteInvalid
			});
		}
	}

	const { username, password } = parsed.data;
	if (usersRepo.getByUsername(username)) {
		return validationError(copy.errors.invalidInput, {
			username: copy.auth.errors.usernameTaken
		});
	}

	const passwordHash = await hashSecret(password);
	const recoveryPhrase = generateRecoveryPhrase();
	const recoveryHash = await hashSecret(normalizePhrase(recoveryPhrase));

	let user;
	try {
		user = usersRepo.createUser({
			username,
			passwordHash,
			recoveryHash,
			ageConfirmedAt: new Date().toISOString()
		});
	} catch {
		// UNIQUE(username) race between the check above and the insert.
		return validationError(copy.errors.invalidInput, {
			username: copy.auth.errors.usernameTaken
		});
	}

	// SPEC 8.7: a fresh account starts with example content. The onboarding
	// seeds again when it finishes (idempotent), so skipping it still lands on
	// a usable board (AC15).
	seedUserContent(user.id, todayIn(user.tz));

	const { token } = createSession(user.id, event.request.headers.get('user-agent'));
	event.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
	return ok({ user, recoveryPhrase }, 201);
};
