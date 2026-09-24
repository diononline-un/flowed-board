import { redirect } from '@sveltejs/kit';
import * as goalsRepo from '$lib/server/repo/goals.js';
import * as keyResultsRepo from '$lib/server/repo/keyResults.js';
import * as postitsRepo from '$lib/server/repo/postits.js';
import { progressOfGoal } from '$lib/shared/progress.js';
import type { PageServerLoad } from './$types';

// Board data (SPEC 3.1: reads go through the repo layer, never the API).
// Goals carry their non-deleted key results so the client can recompute
// SPEC 5.4 progress after optimistic mutations without a refetch.
export const load: PageServerLoad = ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(303, '/login');

	const postits = postitsRepo.listPostits(user.id);
	const goals = goalsRepo.listGoals(user.id).map((goal) => {
		const keyResults = keyResultsRepo.listKeyResults(user.id, goal.id);
		const progress = progressOfGoal(
			keyResults,
			postits.filter((postit) => postit.goalId === goal.id)
		);
		return { ...goal, keyResults, progress };
	});

	return { goals, postits };
};
