import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Liveness probe for Docker HEALTHCHECK and monitoring. No auth by design.
export const GET: RequestHandler = () => {
	return json({ ok: true });
};
