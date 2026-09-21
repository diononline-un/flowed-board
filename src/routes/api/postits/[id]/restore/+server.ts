import type { RequestHandler } from './$types';
import { notFound, ok, unauthorized } from '$lib/server/http.js';
import * as postitsRepo from '$lib/server/repo/postits.js';
import { todayIn } from '$lib/shared/date.js';

// Undo for the soft delete; restores the SPEC 5.3 habit log when the
// post-it was done (via the repo layer).
export const POST: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const postit = postitsRepo.restorePostit(user.id, event.params.id, todayIn(user.tz));
	if (!postit) return notFound();
	return ok({ postit });
};
