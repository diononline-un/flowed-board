import type { RequestHandler } from './$types';
import {
	notFound,
	ok,
	parseJson,
	unauthorized,
	validationError,
	withXp
} from '$lib/server/http.js';
import * as habitsRepo from '$lib/server/repo/habits.js';
import * as habitLogsRepo from '$lib/server/repo/habitLogs.js';
import { awardContextFor, awardHabitLog, NO_XP } from '$lib/server/xp.js';
import { copy } from '$lib/shared/copy.js';
import { todayIn } from '$lib/shared/date.js';
import { habitLogsQuerySchema, habitLogTapSchema } from '$lib/shared/schemas.js';

// GET: logs of one habit, optional ?from,to (SPEC 7) — the calendar grid
// reads this when the shown range changes.
export const GET: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	if (!habitsRepo.getHabit(user.id, event.params.id)) return notFound();
	const query = habitLogsQuerySchema.safeParse(
		Object.fromEntries(event.url.searchParams.entries())
	);
	if (!query.success) return validationError(copy.errors.invalidInput);
	const items = habitLogsRepo.listForHabit(user.id, event.params.id, query.data);
	return ok({ items });
};

// POST {date, delta}: +1 creates one tap log, -1 removes the newest tap log
// of that day (SPEC 5.5). Days in the future, older than 60 days or outside a
// `range` window are rejected with 422; the per-day maximum blocks further
// taps until the client disables the button (AC11).
//
// Gamification (SPEC 5.6): a new tap log awards `habit_log` with
// `${habit_id}:${log_date}` as ref_id, so tapping the same day several times
// (up to max_per_day) still counts once.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const habit = habitsRepo.getHabit(user.id, event.params.id);
	if (!habit) return notFound();
	const parsed = await parseJson(habitLogTapSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const result = habitLogsRepo.tapLog(
		user.id,
		habit,
		parsed.data.date,
		parsed.data.delta,
		todayIn(user.tz),
		user.weekStart
	);
	if (!result.ok) {
		return validationError(copy.errors.invalidInput, {
			date: copy.calendar.log.errors[result.reason]
		});
	}
	const xp = result.removed
		? NO_XP
		: awardHabitLog(user.id, habit.id, parsed.data.date, awardContextFor(user));
	return ok(
		withXp(
			{
				habit,
				log: result.removed ? null : result.log,
				dayCount: result.dayCount,
				todayCount: result.todayCount
			},
			xp
		),
		result.removed ? 200 : 201
	);
};
