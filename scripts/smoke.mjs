// Smoke check against a running instance (SPEC 15). M0 scope: /healthz only.
// The full register -> login -> postit -> logout flow lands with M7.
// Usage: BASE_URL=http://localhost:3000 npm run smoke — exits non-zero on failure.
const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const response = await fetch(`${base}/healthz`);
if (!response.ok) {
	console.error(`smoke: /healthz returned HTTP ${response.status}`);
	process.exit(1);
}
const body = await response.json();
if (body?.ok !== true) {
	console.error(`smoke: unexpected /healthz body: ${JSON.stringify(body)}`);
	process.exit(1);
}

console.log(`smoke: ${base}/healthz ok`);
