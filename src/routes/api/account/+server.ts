import type { RequestHandler } from './$types';
import { verifySecret } from '$lib/server/auth.js';
import { ok, parseJson, unauthorized, validationError } from '$lib/server/http.js';
import * as usersRepo from '$lib/server/repo/users.js';
import { SESSION_COOKIE } from '$lib/server/session.js';
import { copy } from '$lib/shared/copy.js';
import {
	accountDeleteSchema,
	accountPatchSchema,
	normalizeUsername,
	prefsSchema
} from '$lib/shared/schemas.js';

// Profile update (SPEC 7): displayName, tz, weekStart, prefs (merged with
// the stored prefs and re-validated against the full SPEC-4.4 schema).
export const PATCH: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(accountPatchSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const patch: Parameters<typeof usersRepo.updateProfile>[1] = {};
	if (parsed.data.displayName !== undefined) patch.displayName = parsed.data.displayName;
	if (parsed.data.tz !== undefined) patch.tz = parsed.data.tz;
	if (parsed.data.weekStart !== undefined) patch.weekStart = parsed.data.weekStart;
	if (parsed.data.prefs !== undefined) {
		patch.prefs = prefsSchema.parse({ ...user.prefs, ...parsed.data.prefs });
	}

	const updated = usersRepo.updateProfile(user.id, patch);
	return ok({ user: updated });
};

// Account deletion (SPEC 6.7): username + password must match, then the
// user row is hard-deleted (cascades to every related table) and the
// cookie is cleared.
export const DELETE: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(accountDeleteSchema, event.request);
	if (!parsed.ok) return parsed.response;

	if (normalizeUsername(parsed.data.username) !== user.username) {
		return validationError(copy.errors.invalidInput, {
			username: copy.settings.account.errors.usernameMismatch
		});
	}
	const row = usersRepo.getById(user.id);
	const match =
		row && (await verifySecret(row.password_hash, parsed.data.password));
	if (!match) {
		return validationError(copy.errors.invalidInput, {
			password: copy.settings.account.errors.wrongPassword
		});
	}

	usersRepo.deleteUser(user.id);
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
	return ok({ ok: true });
};
