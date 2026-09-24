import type { RequestHandler } from './$types';
import { hashSecret, verifySecret } from '$lib/server/auth.js';
import { ok, parseJson, unauthorized, validationError } from '$lib/server/http.js';
import * as usersRepo from '$lib/server/repo/users.js';
import { destroyOthersForUser } from '$lib/server/session.js';
import { copy } from '$lib/shared/copy.js';
import { passwordChangeSchema, passwordSchema } from '$lib/shared/schemas.js';

// Password change (SPEC 6.4, 7): verifies the current password, then
// deletes all other sessions (the current one survives).
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user || !event.locals.sessionToken) return unauthorized();
	const parsed = await parseJson(passwordChangeSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const row = usersRepo.getById(user.id);
	const match =
		row && (await verifySecret(row.password_hash, parsed.data.currentPassword));
	if (!match) {
		return validationError(copy.errors.invalidInput, {
			currentPassword: copy.settings.account.errors.wrongPassword
		});
	}

	const newPasswordCheck = passwordSchema(user.username).safeParse(
		parsed.data.newPassword
	);
	if (!newPasswordCheck.success) {
		const issue = newPasswordCheck.error.issues[0];
		return validationError(copy.errors.invalidInput, {
			newPassword: issue ? issue.message : copy.errors.invalidInput
		});
	}

	usersRepo.setPasswordHash(user.id, await hashSecret(parsed.data.newPassword));
	destroyOthersForUser(user.id, event.locals.sessionToken);
	return ok({ user: usersRepo.getPublicById(user.id) });
};
