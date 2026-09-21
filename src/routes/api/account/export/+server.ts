import type { RequestHandler } from './$types';
import { unauthorized } from '$lib/server/http.js';
import * as usersRepo from '$lib/server/repo/users.js';
import { todayIn } from '$lib/shared/date.js';

// Data export (SPEC 6.7): JSON download of all own rows, without
// password_hash, recovery_hash and sessions.
export const GET: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const data = usersRepo.exportData(user.id);
	const today = todayIn(user.tz);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="flowboard-export-${today}.json"`
		}
	});
};
