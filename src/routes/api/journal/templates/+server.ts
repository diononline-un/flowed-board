import type { RequestHandler } from './$types';
import { ok, parseJson, unauthorized, validationError } from '$lib/server/http.js';
import * as journalTemplatesRepo from '$lib/server/repo/journalTemplates.js';
import { copy } from '$lib/shared/copy.js';
import { journalTemplateCreateSchema, journalTemplatesQuerySchema } from '$lib/shared/schemas.js';

// GET: list journal templates (SPEC 7). Default is the active set that feeds
// the "Heute" card (SPEC 8.5); `?includeInactive=1` adds deactivated ones for
// the management sheet — their entries stay readable either way (AC14).
// POST: create a template.
export const GET: RequestHandler = (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const query = journalTemplatesQuerySchema.safeParse(
		Object.fromEntries(event.url.searchParams.entries())
	);
	if (!query.success) return validationError(copy.errors.invalidInput);
	return ok({
		items: journalTemplatesRepo.listJournalTemplates(user.id, {
			includeInactive: query.data.includeInactive === '1'
		})
	});
};

export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) return unauthorized();
	const parsed = await parseJson(journalTemplateCreateSchema, event.request);
	if (!parsed.ok) return parsed.response;
	const template = journalTemplatesRepo.createJournalTemplate(user.id, parsed.data);
	return ok({ template }, 201);
};
