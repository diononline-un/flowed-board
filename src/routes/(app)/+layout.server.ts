import { redirect } from '@sveltejs/kit';
import { env } from '$lib/server/env.js';
import { todayIn } from '$lib/shared/date.js';
import type { LayoutServerLoad } from './$types';

// Only the server computes "today" (SPEC 5.1); the client receives it here,
// in the logged-in user's timezone. The hooks guard has already redirected
// anonymous visitors, the null check is belt and braces for typing. The LLM
// provider name is needed for the capture consent text (SPEC 9.5).
export const load: LayoutServerLoad = ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(303, '/login');
	return { today: todayIn(user.tz), user, llmProviderName: env.LLM_PROVIDER_NAME };
};
