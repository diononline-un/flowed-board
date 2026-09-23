import type { RequestHandler } from './$types';
import { ok, unauthorized } from '$lib/server/http.js';
import { badgeOverview } from '$lib/server/badges.js';
import * as postitsRepo from '$lib/server/repo/postits.js';
import { progressFor } from '$lib/server/xp.js';
import { badgeDefinition } from '$lib/shared/badges.js';
import { addDays, todayIn, weekStart } from '$lib/shared/date.js';

// GET /api/summary (SPEC 7): the numbers the dashboard chips and the
// onboarding show — what is due today, how the week is going, XP/level and the
// badges earned today. Read-only, one query per number.
export const GET: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const today = todayIn(user.tz);
	const weekFrom = weekStart(today, user.weekStart);
	const weekTo = addDays(weekFrom, 6);

	// Due = open post-its dated today or already past (SPEC 5.3: overdue stays
	// a soft hint, but it is work that is still waiting).
	const open = postitsRepo.listPostits(user.id);
	const dueToday = open.filter(
		(postit) => postit.doneAt === null && postit.date !== null && postit.date <= today
	).length;

	const weekPostits = postitsRepo.listPostits(user.id, { from: weekFrom, to: weekTo });
	const weeklyDone = weekPostits.filter((postit) => postit.doneAt !== null).length;

	return ok({
		today,
		weekStart: weekFrom,
		weekEnd: weekTo,
		dueToday,
		week: { total: weekPostits.length, done: weeklyDone },
		xp: progressFor(user.id),
		// Badges earned today (the full grid lives on the settings page).
		newBadges: badgeOverview(user.id)
			.filter((entry) => entry.earnedAt !== null && entry.earnedAt.slice(0, 10) === today)
			.map((entry) => ({
				badge: badgeDefinition(entry.id),
				earnedAt: entry.earnedAt as string
			}))
	});
};
