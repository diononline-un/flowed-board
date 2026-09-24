import { redirect } from '@sveltejs/kit';
import { badgeOverview } from '$lib/server/badges.js';
import { progressFor } from '$lib/server/xp.js';
import type { PageServerLoad } from './$types';

// Settings reads its data directly from the repo layer (SPEC 3.1). The XP bar
// and the badge grid (SPEC 5.6, 10.4) come from the badge/Xp services; the
// grid is only rendered when `prefs.gamification` is on.
export const load: PageServerLoad = ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(303, '/login');
	return {
		xp: progressFor(user.id),
		badges: badgeOverview(user.id)
	};
};
