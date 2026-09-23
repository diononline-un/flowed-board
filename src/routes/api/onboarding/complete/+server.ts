import type { RequestHandler } from './$types';
import { ok, parseJson, unauthorized, validationError, withXp } from '$lib/server/http.js';
import { completeOnboarding } from '$lib/server/seed.js';
import { awardContextFor, badgeOnlyResponse } from '$lib/server/xp.js';
import { copy } from '$lib/shared/copy.js';
import { todayIn } from '$lib/shared/date.js';
import { onboardingCompleteSchema } from '$lib/shared/schemas.js';

// POST /api/onboarding/complete (SPEC 8.6): the one request that closes the
// four steps. It applies the display name of step 1, creates the habit of
// step 3 when the user accepted the suggestion, loads the seed content with
// the rhythm of step 4 and stamps `onboarding_done_at` — the value the layout
// guard checks, so the onboarding never comes back (AC16).
//
// Step 2 (Quick Capture) commits through `/api/capture/commit` as usual; its
// XP and the `quick_writer` badge are awarded there.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(onboardingCompleteSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const { user: updated, seed } = completeOnboarding(
		user.id,
		{
			displayName: parsed.data.displayName,
			rhythm: parsed.data.journalRhythm,
			habit: parsed.data.habit ?? null
		},
		todayIn(user.tz)
	);
	if (!updated) return validationError(copy.errors.generic);

	// `goal_setter` can fire when the seed creates the very first goal.
	const xp = badgeOnlyResponse(user.id, 'goal', awardContextFor(user));
	return ok(
		withXp(
			{
				user: updated,
				seeded: {
					goalId: seed.goalId,
					postits: seed.postitIds.length,
					habitId: seed.habitId,
					templates: seed.templateIds.length
				}
			},
			xp
		)
	);
};
