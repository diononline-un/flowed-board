import { redirect } from '@sveltejs/kit';
import { progressFor } from '$lib/server/xp.js';
import * as postitsRepo from '$lib/server/repo/postits.js';
import { addDays, todayIn, weekStart } from '$lib/shared/date.js';
import type { PageServerLoad } from './$types';

// Onboarding data (SPEC 8.6). The four steps need a little context: the XP
// chips and the numbers of the week so far, so the progress dots are not the
// only feedback. Reads go through the repo layer (SPEC 3.1).
//
// The guard runs in both directions: with `onboarding_done_at` set the page
// redirects away (AC16), so it can never be opened a second time.
export const load: PageServerLoad = ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(303, '/login');
	if (user.onboardingDoneAt !== null) redirect(303, '/plans');

	const today = todayIn(user.tz);
	const weekFrom = weekStart(today, user.weekStart);
	const weekTo = addDays(weekFrom, 6);
	const open = postitsRepo.listPostits(user.id);
	const weekPostits = postitsRepo.listPostits(user.id, { from: weekFrom, to: weekTo });

	return {
		today,
		weekStart: weekFrom,
		weekEnd: weekTo,
		xp: progressFor(user.id),
		dueToday: open.filter(
			(postit) => postit.doneAt === null && postit.date !== null && postit.date <= today
		).length,
		week: {
			total: weekPostits.length,
			done: weekPostits.filter((postit) => postit.doneAt !== null).length
		}
	};
};
