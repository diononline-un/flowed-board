import { redirect } from '@sveltejs/kit';
import * as goalsRepo from '$lib/server/repo/goals.js';
import * as habitsRepo from '$lib/server/repo/habits.js';
import * as habitLogsRepo from '$lib/server/repo/habitLogs.js';
import * as postitsRepo from '$lib/server/repo/postits.js';
import { todayIn } from '$lib/shared/date.js';
import {
	daysInMonthView,
	daysInWeekView,
	rangeOf,
	DEFAULT_CALENDAR_VIEW,
	type CalendarView
} from '$lib/shared/calendar.js';
import type { PageServerLoad } from './$types';

// Calendar data (SPEC 3.1: reads go through the repo layer, never the API).
// The server computes "today" in the user's timezone (SPEC 5.1) and ships the
// post-its of the shown window plus the log dates of every active habit, so
// the client can recompute SPEC 5.5 progress after optimistic log taps.
export const load: PageServerLoad = ({ locals, url }) => {
	const user = locals.user;
	if (!user) redirect(303, '/login');

	const today = todayIn(user.tz);
	const requested = url.searchParams.get('view');
	const view: CalendarView =
		requested === 'week' || requested === 'month' ? requested : DEFAULT_CALENDAR_VIEW;

	const days =
		view === 'week'
			? daysInWeekView(today, user.weekStart)
			: daysInMonthView(today, user.weekStart);
	const range = rangeOf(days);

	const postits = postitsRepo.listPostits(user.id, { from: range.from, to: range.to });
	const habits = habitsRepo.listHabits(user.id);
	const logDates: Record<string, string[]> = {};
	for (const habit of habits) {
		// Logs are needed for the completed-window counters of SPEC 5.5, which
		// reach back to the habit's creation — so no date filter here.
		logDates[habit.id] = habitLogsRepo.listLogDates(user.id, habit.id);
	}

	return {
		today,
		view,
		range,
		postits,
		habits,
		logDates,
		goals: goalsRepo.listGoals(user.id)
	};
};
