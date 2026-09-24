import { env } from '$lib/server/env.js';
import type { LayoutServerLoad } from './$types';

// Registration mode drives whether /register shows the invite field
// (SPEC 6.1).
export const load: LayoutServerLoad = () => {
	return { registrationMode: env.REGISTRATION };
};
