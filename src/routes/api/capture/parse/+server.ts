import { json, type RequestHandler } from '@sveltejs/kit';
import { parseCapture } from '$lib/server/capture.js';
import { ok, parseJson, rateLimited, unauthorized } from '$lib/server/http.js';
import { captureParseSchema } from '$lib/shared/schemas.js';

// SPEC 9.1: rate limit + daily cap + consent -> LLM parse, never a DB write.
// Over the daily cap: 429 {error:'ai_limit_reached'} (SPEC 9.3) so the client
// can switch to its direct fallback path.
export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(captureParseSchema, event.request);
	if (!parsed.ok) return parsed.response;

	const result = await parseCapture(user, parsed.data.text);
	if (result.kind === 'rate_limited') return rateLimited(result.retryAfterSec);
	if (result.kind === 'ai_limit') {
		return json({ error: 'ai_limit_reached' }, { status: 429 });
	}
	return ok({ items: result.items, fallback: result.fallback });
};
