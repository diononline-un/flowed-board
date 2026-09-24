import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { env } from './env.js';
import type { XpResponse } from './xp.js';
import type { XpResponsePayload } from '$lib/shared/xp.js';
import { copy } from '$lib/shared/copy.js';

// Shared response and parsing helpers for +server.ts routes (SPEC 7, 16).

export function ok<T>(data: T, status = 200): Response {
	return json(data, { status });
}

// Validation failures are 422 with {error, fields?} (SPEC 7).
export function validationError(
	message: string,
	fields?: Record<string, string>
): Response {
	return json(fields ? { error: message, fields } : { error: message }, { status: 422 });
}

export function unauthorized(message: string = copy.errors.unauthorized): Response {
	return json({ error: message }, { status: 401 });
}

export function forbidden(message: string = copy.errors.forbidden): Response {
	return json({ error: message }, { status: 403 });
}

export function notFound(message: string = copy.errors.notFound): Response {
	return json({ error: message }, { status: 404 });
}

// 409 for a state conflict the client resolves by editing what exists
// (AC13: the same journal slot twice).
export function conflict(message: string): Response {
	return json({ error: message }, { status: 409 });
}

// 429 always carries Retry-After (SPEC 6.5).
export function rateLimited(retryAfterSec: number): Response {
	return json(
		{ error: copy.auth.errors.rateLimited },
		{ status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
	);
}

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: Response };

// SPEC 5.6: mutations that can award XP or a badge carry the result along
// (`xp` is additive to the resource the endpoint already returns); the shape is
// `XpResponsePayload` from `$lib/shared/xp.ts`, so client and server share one
// type. The client shows a toast only when `prefs.gamification` is on.
//
// Nothing gained at all (e.g. a repeated completion of the same post-it) omits
// the key entirely, so pre-M6 response shapes stay valid. A badge without XP of
// its own (goal_setter, tidy_up) does carry the key with `gained: 0` **and** the
// level of the unchanged total, so the client never has to fall back to zero.
export function withXp<T extends object>(
	payload: T,
	xp: XpResponse
): T & { xp?: XpResponsePayload } {
	if (xp.gained === 0 && xp.newBadges.length === 0) return payload;
	return {
		...payload,
		xp: {
			gained: xp.gained,
			total: xp.total,
			level: xp.level,
			levelName: xp.levelName,
			levelUp: xp.levelUp,
			newBadges: xp.newBadges
		}
	};
}

// Parses and validates a JSON body with a strict zod schema. The first
// issue per field is surfaced in `fields` for form display.
export async function parseJson<S extends z.ZodType>(
	schema: S,
	request: Request
): Promise<ParsedBody<z.infer<S>>> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return { ok: false, response: validationError(copy.errors.invalidBody) };
	}
	const result = schema.safeParse(raw);
	if (!result.success) {
		const fields: Record<string, string> = {};
		for (const issue of result.error.issues) {
			const key = issue.path.join('.') || '_';
			if (!(key in fields)) fields[key] = issue.message;
		}
		return { ok: false, response: validationError(copy.errors.invalidInput, fields) };
	}
	return { ok: true, data: result.data };
}

// Client IP (SPEC 6.5): manual parsing when ADDRESS_HEADER is configured
// (XFF_DEPTH counts from the right), otherwise SvelteKit's resolution.
export function clientIp(event: RequestEvent): string {
	if (env.ADDRESS_HEADER) {
		const raw = event.request.headers.get(env.ADDRESS_HEADER);
		if (raw) {
			const parts = raw
				.split(',')
				.map((part) => part.trim())
				.filter(Boolean);
			const index = Math.max(0, parts.length - env.XFF_DEPTH);
			const picked = parts[index];
			if (picked) return picked;
		}
	}
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown';
	}
}
