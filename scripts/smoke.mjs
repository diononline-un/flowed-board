// Smoke check against a running instance (SPEC 15). Real HTTP flow, no mocks:
// /healthz -> register -> logout -> login -> create a post-it -> see it in the
// list -> logout -> login again.
//
// Usage: BASE_URL=http://localhost:3000 npm run smoke
//   BASE_URL has to match the server's ORIGIN, because every mutating request
//   carries Origin and the CSRF guard compares the two (SPEC 6.5).
// Exits non-zero on the first failing step and names that step. Each run uses
// a fresh random account; the session cookie stays in memory.
const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

let failures = 0;
let cookie = '';

function fail(step, detail) {
	failures += 1;
	console.error(`smoke: FAIL ${step} — ${detail}`);
}

function pass(step, detail = '') {
	console.log(`smoke: ok   ${step}${detail ? ` — ${detail}` : ''}`);
}

// Minimal cookie jar: the app only ever sets fb_session.
function rememberCookie(response) {
	const raw = response.headers.getSetCookie?.() ?? [];
	for (const entry of raw) {
		const pair = entry.split(';')[0];
		if (pair?.startsWith('fb_session=')) cookie = pair;
	}
}

async function call(step, path, { method = 'GET', body, expect } = {}) {
	let response;
	try {
		response = await fetch(`${base}${path}`, {
			method,
			headers: {
				...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
				...(cookie ? { Cookie: cookie } : {}),
				// Server-to-server calls have no browser to set this for them.
				Origin: base
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
			redirect: 'manual'
		});
	} catch (error) {
		fail(step, `request to ${path} failed: ${error instanceof Error ? error.message : error}`);
		return null;
	}
	rememberCookie(response);
	if (expect !== undefined && response.status !== expect) {
		const text = await response.text().catch(() => '');
		fail(
			step,
			`${method} ${path} answered HTTP ${response.status}, expected ${expect}${
				text ? ` — ${text.slice(0, 200)}` : ''
			}`
		);
		return null;
	}
	return response;
}

const username = `smoke${Date.now().toString(36)}${Math.floor(Math.random() * 10_000)}`;
const password = 'rauch-test-zeichen-42';

// 1. Health (SPEC 7: /healthz without auth).
const health = await call('healthz', '/healthz', { expect: 200 });
if (health) {
	const body = await health.json().catch(() => null);
	if (body?.ok === true) pass('healthz', `${base}/healthz -> {ok:true}`);
	else fail('healthz', `unexpected body: ${JSON.stringify(body)}`);
}

// 2. Register: the recovery phrase has to come back exactly once (SPEC 6.3).
const register = await call('register', '/api/auth/register', {
	method: 'POST',
	body: { username, password, ageConfirmed: true },
	expect: 201
});
if (register) {
	const body = await register.json().catch(() => null);
	const words = typeof body?.recoveryPhrase === 'string' ? body.recoveryPhrase.trim().split(/\s+/) : [];
	if (words.length === 12) pass('register', `user ${username} created, 12-word phrase returned`);
	else fail('register', `no 12-word recoveryPhrase: ${JSON.stringify(body)?.slice(0, 200)}`);
}

// 3. Logout, then log in with the fresh account.
if (await call('logout-after-register', '/api/auth/logout', { method: 'POST', expect: 200 }))
	pass('logout-after-register');
cookie = '';

const login = await call('login', '/api/auth/login', {
	method: 'POST',
	body: { username, password },
	expect: 200
});
if (login && cookie) pass('login', 'session cookie received');
else if (login) fail('login', 'no fb_session cookie in the response');

// 4. Create a post-it (SPEC 7: POST /api/postits).
const title = `Smoke ${new Date().toISOString().slice(11, 19)}`;
let postitId = '';
const create = await call('create-postit', '/api/postits', {
	method: 'POST',
	body: { title },
	expect: 201
});
if (create) {
	const body = await create.json().catch(() => null);
	postitId = body?.postit?.id ?? '';
	if (postitId) pass('create-postit', `id ${postitId}`);
	else fail('create-postit', `no postit in the response: ${JSON.stringify(body)?.slice(0, 200)}`);
}

// 5. It has to show up in the list.
const list = await call('list-postits', '/api/postits', { expect: 200 });
if (list) {
	const body = await list.json().catch(() => null);
	const items = Array.isArray(body?.items) ? body.items : [];
	if (items.some((item) => item.id === postitId)) {
		pass('list-postits', `${items.length} item(s), created post-it present`);
	} else {
		fail('list-postits', `created post-it ${postitId} missing from ${items.length} item(s)`);
	}
}

// 6. Logout invalidates the session, then log in again.
if (await call('logout', '/api/auth/logout', { method: 'POST', expect: 200 })) pass('logout');
cookie = '';

if (await call('unauthenticated-api', '/api/postits', { expect: 401 }))
	pass('unauthenticated-api', '401 without a session');

const relogin = await call('login-again', '/api/auth/login', {
	method: 'POST',
	body: { username, password },
	expect: 200
});
if (relogin && cookie) pass('login-again', 'session restored');
else if (relogin) fail('login-again', 'no fb_session cookie on the second login');

if (failures > 0) {
	console.error(`smoke: ${failures} step(s) failed against ${base}`);
	process.exit(1);
}
console.log(`smoke: all steps passed against ${base}`);
