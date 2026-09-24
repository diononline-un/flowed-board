import { redirect } from '@sveltejs/kit';
import { env } from '$lib/server/env.js';
import { progressFor } from '$lib/server/xp.js';
import { todayIn } from '$lib/shared/date.js';
import type { LayoutServerLoad } from './$types';

// Only the server computes "today" (SPEC 5.1); the client receives it here,
// in the logged-in user's timezone. The hooks guard has already redirected
// anonymous visitors, the null check is belt and braces for typing. The LLM
// provider name is needed for the capture consent text (SPEC 9.5).
//
// Onboarding guard (SPEC 8.6, AC15/AC16): without `onboarding_done_at` the
// user belongs in /onboarding, and once it is stamped the onboarding is never
// shown again. The onboarding page itself is excluded from both directions
// (its own load handles them), so there is no redirect loop.
export const load: LayoutServerLoad = ({ locals, url }) => {
	const user = locals.user;
	if (!user) redirect(303, '/login');
	const onOnboarding = url.pathname.startsWith('/onboarding');
	const done = user.onboardingDoneAt !== null;
	if (!done && !onOnboarding) redirect(303, '/onboarding');
	if (done && onOnboarding) redirect(303, '/plans');
	// XP/level for the shell (SPEC 5.6); the badge grid and its dates live on
	// the settings page, the total is enough for the level chip.
	return {
		today: todayIn(user.tz),
		user,
		llmProviderName: env.LLM_PROVIDER_NAME,
		xp: progressFor(user.id)
	};
};
