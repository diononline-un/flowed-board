import { describe, expect, it } from 'vitest';
import { accountPatchSchema, parsePrefs, prefsSchema } from './schemas.js';
import { parseJson } from '$lib/server/http.js';
import { copy } from './copy.js';

// SPEC 6.5: every API input is strict, so an unknown key is a 422 and never a
// silently stripped field. The prefs object was the one schema without that
// guarantee — a typo like `showDoneDay` looked applied to the client while the
// server dropped it. These tests pin the 422 and prove the round trip through
// parsePrefs (JSON in `users.prefs`, SPEC 4.4) still works.

function patchRequest(body: unknown): Request {
	return new Request('http://localhost/api/account', {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('prefsSchema strictness (SPEC 6.5)', () => {
	it('rejects an unknown preference key', () => {
		const parsed = prefsSchema.safeParse({
			gamification: true,
			showDoneDay: 3 // typo for showDoneDays
		});

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues[0]?.code).toBe('unrecognized_keys');
	});

	it('applies the documented defaults and keeps the showDoneDays limits', () => {
		const parsed = prefsSchema.safeParse({});
		expect(parsed.success).toBe(true);
		expect(parsed.data).toEqual({
			gamification: true,
			postitTilt: false,
			reduceMotion: false,
			showDoneDays: 7,
			aiConsentAt: null,
			aiEnabled: true
		});
		for (const value of [1, 3, 7, 14]) {
			expect(prefsSchema.safeParse({ showDoneDays: value }).success).toBe(true);
		}
		for (const value of [0, 2, 5, 30, '7']) {
			expect(prefsSchema.safeParse({ showDoneDays: value }).success).toBe(false);
		}
	});

	it('keeps parsePrefs tolerant of what is already stored', () => {
		// parsePrefs reads the users.prefs column; it stays lenient on purpose,
		// because a row written by an older version must not break a login.
		expect(parsePrefs('{}')).toMatchObject({ gamification: true, showDoneDays: 7 });
		expect(parsePrefs('{"gamification":false,"showDoneDays":14}')).toMatchObject({
			gamification: false,
			showDoneDays: 14
		});
		expect(parsePrefs('not json')).toMatchObject({ gamification: true, showDoneDays: 7 });
		expect(parsePrefs('{"showDoneDays":5}')).toMatchObject({ showDoneDays: 7 });
	});
});

describe('PATCH /api/account body validation (SPEC 7)', () => {
	it('answers 422 for an unknown pref key', async () => {
		const parsed = await parseJson(
			accountPatchSchema,
			patchRequest({ prefs: { showDoneDay: 3 } })
		);

		expect(parsed.ok).toBe(false);
		if (parsed.ok) throw new Error('expected a rejected body');
		expect(parsed.response.status).toBe(422);
		const body = (await parsed.response.json()) as { error: string; fields?: Record<string, string> };
		expect(body.error).toBe(copy.errors.invalidInput);
		// The rejection surfaces under the prefs path, so the client shows it
		// next to the preference section.
		expect(Object.keys(body.fields ?? {})).toContain('prefs');
	});

	it('accepts the documented pref keys, including a partial patch', async () => {
		const parsed = await parseJson(
			accountPatchSchema,
			patchRequest({
				displayName: 'Dana',
				tz: 'Europe/Berlin',
				weekStart: 1,
				prefs: { postitTilt: true, reduceMotion: true, showDoneDays: 14 }
			})
		);

		expect(parsed.ok).toBe(true);
		if (!parsed.ok) throw new Error('expected a valid body');
		// The documented keys arrive with their values; the untouched prefs
		// only carry their defaults here, because the route merges them with
		// the stored ones (`prefsSchema.parse({ ...user.prefs, ...patch })`).
		expect(parsed.data.prefs).toMatchObject({
			postitTilt: true,
			reduceMotion: true,
			showDoneDays: 14
		});
		expect(
			prefsSchema.parse({ ...prefsSchema.parse({}), ...parsed.data.prefs })
		).toMatchObject({ gamification: true, aiEnabled: true, aiConsentAt: null });
	});

	it('rejects an unknown top-level key and an unknown tz', async () => {
		expect((await parseJson(accountPatchSchema, patchRequest({ nope: 1 }))).ok).toBe(false);
		expect(
			(await parseJson(accountPatchSchema, patchRequest({ tz: 'Mars/Olympus' }))).ok
		).toBe(false);
	});
});
