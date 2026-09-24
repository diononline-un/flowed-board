import type { RequestHandler } from './$types';
import {
	generateRecoveryPhrase,
	hashSecret,
	normalizePhrase,
	verifySecret
} from '$lib/server/auth.js';
import { ok, parseJson, unauthorized, validationError } from '$lib/server/http.js';
import * as usersRepo from '$lib/server/repo/users.js';
import { copy } from '$lib/shared/copy.js';
import { recoveryRegenerateSchema } from '$lib/shared/schemas.js';

// Regenerates the recovery phrase after re-entering the password
// (SPEC 6.3, 7). The old phrase becomes invalid immediately.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(recoveryRegenerateSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const row = usersRepo.getById(user.id);
	const match =
		row && (await verifySecret(row.password_hash, parsed.data.password));
	if (!match) {
		return validationError(copy.errors.invalidInput, {
			password: copy.settings.account.errors.wrongPassword
		});
	}

	const recoveryPhrase = generateRecoveryPhrase();
	usersRepo.setRecoveryHash(user.id, await hashSecret(normalizePhrase(recoveryPhrase)));
	return ok({ user: usersRepo.getPublicById(user.id), recoveryPhrase });
};
