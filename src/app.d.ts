import type { PublicUser } from '$lib/shared/types.js';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			// Resolved from the session cookie in hooks.server.ts (SPEC 6.4).
			user: PublicUser | null;
			// Raw session token, needed by endpoints that manage "other"
			// sessions (password change, logout-all, logout).
			sessionToken: string | null;
		}
	}
}

export {};
