import { error, redirect } from '@sveltejs/kit';
import * as goalsRepo from '$lib/server/repo/goals.js';
import * as habitsRepo from '$lib/server/repo/habits.js';
import * as keyResultsRepo from '$lib/server/repo/keyResults.js';
import * as postitsRepo from '$lib/server/repo/postits.js';
import { copy } from '$lib/shared/copy.js';
import type { PageServerLoad } from './$types';

// Goal detail (SPEC 8.3). Foreign or deleted goals are 404 (SPEC 6.6).
export const load: PageServerLoad = ({ locals, params }) => {
	const user = locals.user;
	if (!user) redirect(303, '/login');

	const row = goalsRepo.getGoal(user.id, params.id);
	if (!row || row.deleted_at !== null) error(404, copy.plans.goal.notFound);

	const goal = goalsRepo.toPublicGoal(row);
	const keyResults = keyResultsRepo.listKeyResults(user.id, goal.id);
	const postits = postitsRepo.listPostits(user.id, { goalId: goal.id });
	const habits = habitsRepo
		.listByGoal(user.id, goal.id)
		.map((habit) => ({ id: habit.id, title: habit.title, emoji: habit.emoji }));

	return { goal, keyResults, postits, habits };
};
