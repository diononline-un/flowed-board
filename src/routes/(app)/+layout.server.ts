import { todayIn } from '$lib/shared/date.js';
import type { LayoutServerLoad } from './$types';

// Only the server computes "today" (SPEC 5.1); the client receives it here.
// M1 will use the logged-in user's tz instead of the app default.
export const load: LayoutServerLoad = () => {
	return { today: todayIn('Europe/Berlin') };
};
