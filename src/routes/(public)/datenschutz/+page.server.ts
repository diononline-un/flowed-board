import { datenschutz } from '$lib/server/legal.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { doc: datenschutz() };
};
