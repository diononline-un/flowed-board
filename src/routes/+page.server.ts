import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The board is the home screen (M1 will redirect logged-out users to /login).
export const load: PageServerLoad = () => {
	redirect(303, '/plans');
};
