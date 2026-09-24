import type { RequestHandler } from './$types';
import { notFound, ok, parseJson, unauthorized } from '$lib/server/http.js';
import * as journalTemplatesRepo from '$lib/server/repo/journalTemplates.js';
import { journalTemplatePatchSchema } from '$lib/shared/schemas.js';

// PATCH /api/journal/templates/:id (SPEC 7): name, emoji, fields, schedule and
// the active flag. Deactivating means active=false — the row and all entries
// written with it stay (AC14, SPEC M5 brief). Foreign ids are 404, never 403
// (SPEC 6.6).
export const PATCH: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(journalTemplatePatchSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const template = journalTemplatesRepo.updateJournalTemplate(user.id, event.params.id, parsed.data);
	if (!template) return notFound();
	return ok({ template });
};
