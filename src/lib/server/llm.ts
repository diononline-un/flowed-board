import { z } from 'zod';
import { env } from './env.js';
import { isValidYmd, weekdayOf } from '$lib/shared/date.js';
import type { CaptureItem } from '$lib/shared/schemas.js';
import type { WeekStart } from '$lib/shared/types.js';

// LLM client for Quick Capture (SPEC 9). Plain fetch against an
// OpenAI-compatible chat-completions endpoint — no SDK. The system prompt is
// fixed in code and cannot be overridden by the user (SPEC 9.2).
//
// HARD RULE (SPEC 9.5): this module only ever receives the raw capture text.
// Journal content (journal_entries, journal_templates.fields values) must
// never be passed here — there is intentionally no code path for it. A
// static test (capture.test.ts) scans this file to keep it that way.

const TIMEOUT_MS = 8000; // SPEC 9.1: 8 s AbortController timeout
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Lenient item schema for LLM output: unknown keys are stripped (LLMs add
// junk keys), anything structurally invalid fails the whole response and the
// caller falls back (SPEC 9.4).
const llmHabitSchema = z.object({
	title: z.string().trim().min(1).max(80),
	cadence: z.enum(['week', 'month']),
	targetCount: z.number().int().min(1).max(10000)
});

const llmItemSchema = z.object({
	title: z.string().trim().min(1).max(140),
	date: z
		.string()
		.refine(isValidYmd, { message: 'invalid date' })
		.nullable(),
	time: z.string().regex(TIME_RE).nullable(),
	suggestedGoalTitle: z.string().trim().min(1).max(140).nullable(),
	suggestedHabit: llmHabitSchema.nullable()
});

const llmResponseSchema = z.object({ items: z.array(llmItemSchema) });

export const WEEKDAY_NAMES_DE = [
	'Sonntag',
	'Montag',
	'Dienstag',
	'Mittwoch',
	'Donnerstag',
	'Freitag',
	'Samstag'
] as const;

const WEEK_START_NAMES_DE: Record<WeekStart, string> = {
	0: 'Sonntag',
	1: 'Montag',
	6: 'Samstag'
};

// SPEC 9.2 system prompt: today's date + weekday (user timezone, computed by
// the caller), week_start, JSON-only instruction, the 9.1 schema, the two
// date/habit rules and the 10-item cap. Fixed wording, German because the
// captured texts are German.
export function buildSystemPrompt(context: { today: string; weekStart: WeekStart }): string {
	const weekdayName = WEEKDAY_NAMES_DE[weekdayOf(context.today)];
	const weekStartName = WEEK_START_NAMES_DE[context.weekStart];
	return [
		'Du zerlegst kurze deutsche Eingaben in einzelne Aufgaben für eine Planungs-App.',
		`Heute ist ${weekdayName}, der ${context.today}. Die Woche des Nutzers beginnt am ${weekStartName} (week_start).`,
		'Gib ausschließlich JSON nach diesem Schema zurück, keinen Fließtext:',
		'{"items":[{"title":string,"date":"YYYY-MM-DD"|null,"time":"HH:MM"|null,"suggestedGoalTitle":string|null,"suggestedHabit":{"title":string,"cadence":"week"|"month","targetCount":number}|null}]}',
		'Regeln:',
		'- Zerlege die Eingabe in einzelne Aufgaben; jede Aufgabe bekommt ein eigenes Item (title 1–140 Zeichen).',
		'- Löse relative Datumsangaben (Wochentage, „morgen", „in 3 Tagen") relativ zu heute auf; das Datum liegt dabei nie in der Vergangenheit. Liegt kein Datum im Text vor, setze date auf null.',
		'- Setze time nur bei einer expliziten Uhrzeit, sonst null.',
		'- Erkennst du ein übergeordnetes Vorhaben, setze suggestedGoalTitle (kurzer Titel), sonst null.',
		'- Erkennst du eine wiederkehrende Aktivität (z. B. „3x die Woche"), fülle suggestedHabit, sonst null.',
		'- Maximal 10 Items pro Anfrage.'
	].join('\n');
}

// Parses the raw message content into CaptureItems. In JSON mode the content
// should be a plain JSON document; otherwise the first '{' … last '}' span
// is extracted (SPEC 9.2). Throws on any structural mismatch — the caller
// treats that as the SPEC-9.4 fallback case.
export function parseLlmContent(content: string): CaptureItem[] {
	let parsed: unknown = null;
	let directError: unknown = null;
	try {
		parsed = JSON.parse(content);
	} catch (error) {
		directError = error;
	}
	if (parsed === null) {
		const start = content.indexOf('{');
		const end = content.lastIndexOf('}');
		if (start === -1 || end <= start) {
			throw directError instanceof Error
				? directError
				: new Error('llm response is not JSON');
		}
		parsed = JSON.parse(content.slice(start, end + 1));
	}
	return llmResponseSchema.parse(parsed).items;
}

export type CallLlm = (text: string, systemPrompt: string) => Promise<CaptureItem[]>;

// One chat-completions call with an 8 s AbortController timeout (SPEC 9.1).
// `response_format: {type:'json_object'}` only when LLM_JSON_MODE is enabled
// (SPEC 9.2). Any failure (HTTP, timeout, shape) throws; capture.ts maps
// that to the fallback. Only the raw capture text goes into the user message
// — no other user data (SPEC 9.5).
export const callLlm: CallLlm = async (text, systemPrompt) => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const response = await fetch(`${env.LLM_BASE_URL.replace(/\/+$/, '')}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${env.LLM_API_KEY}`
			},
			body: JSON.stringify({
				model: env.LLM_MODEL,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: text }
				],
				temperature: 0,
				...(env.LLM_JSON_MODE ? { response_format: { type: 'json_object' } } : {})
			}),
			signal: controller.signal
		});
		if (!response.ok) throw new Error(`llm http ${response.status}`);
		const data = (await response.json()) as {
			choices?: { message?: { content?: unknown } }[];
		};
		const content = data.choices?.[0]?.message?.content;
		if (typeof content !== 'string' || content.trim() === '') {
			throw new Error('llm empty content');
		}
		return parseLlmContent(content);
	} finally {
		clearTimeout(timeout);
	}
};
