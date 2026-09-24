import { z } from 'zod';
import { copy } from './copy.js';
import { isValidTimeZone, isValidYmd } from './date.js';

// Input validation for every API endpoint (SPEC 6.1, 6.5, 4.4). All schemas
// are strict: unknown keys are rejected (constraints 7). Pure module, safe
// for client bundles — no server-only imports here.

export const USERNAME_RE = /^[a-z0-9][a-z0-9_.-]{2,23}$/;

// Normalization before any username check or lookup (SPEC 6.1).
export function normalizeUsername(username: string): string {
	return username.trim().toLowerCase();
}

// Small built-in list of common passwords (SPEC 6.1, >= 25 entries).
export const COMMON_PASSWORDS: readonly string[] = [
	'passwort123',
	'passwort1234',
	'meinpasswort',
	'12345678910',
	'1234567890',
	'12345678901',
	'qwertzuiop',
	'qwertzuiopü',
	'qwerty12345',
	'qwerty123456',
	'password123',
	'password1234',
	'1111111111',
	'1231231231',
	'abcdef1234',
	'iloveyou12',
	'iloveyou123',
	'letmein12345',
	'admin123456',
	'willkommen1',
	'hallohallo1',
	'sonnenschein',
	'schatz12345',
	'fussball123',
	'geheim12345',
	'geheimnis12',
	'start123456',
	'dragon12345',
	'master12345',
	'superman123'
];

function isSingleRepeatedChar(password: string): boolean {
	return /^(.)\1+$/.test(password);
}

// Password rules from SPEC 6.1, parameterized by username for the
// "password must not equal username" check.
export function passwordSchema(username: string) {
	return z
		.string()
		.min(10, copy.auth.errors.passwordTooShort)
		.max(128, copy.auth.errors.passwordTooLong)
		.refine((pw) => pw.toLowerCase() !== username, {
			message: copy.auth.errors.passwordIsUsername
		})
		.refine((pw) => !COMMON_PASSWORDS.includes(pw.toLowerCase()), {
			message: copy.auth.errors.passwordCommon
		})
		.refine((pw) => !isSingleRepeatedChar(pw), {
			message: copy.auth.errors.passwordRepeated
		});
}

const usernameField = z.preprocess(
	(value) => (typeof value === 'string' ? normalizeUsername(value) : value),
	z.string().regex(USERNAME_RE, copy.auth.errors.usernameInvalid)
);

// users.prefs JSON (SPEC 4.4): every field optional with a default. Strict like
// every other API input (SPEC 6.5): an unknown preference key is rejected with
// 422 instead of being stripped, so a typo in the client never looks applied.
export const prefsSchema = z.strictObject({
	gamification: z.boolean().default(true),
	postitTilt: z.boolean().default(false),
	reduceMotion: z.boolean().default(false),
	showDoneDays: z
		.union([z.literal(1), z.literal(3), z.literal(7), z.literal(14)])
		.default(7),
	aiConsentAt: z.string().nullable().default(null),
	aiEnabled: z.boolean().default(true)
});
export type Prefs = z.infer<typeof prefsSchema>;

export function parsePrefs(json: string): Prefs {
	try {
		return prefsSchema.parse(JSON.parse(json));
	} catch {
		return prefsSchema.parse({});
	}
}

export const registerSchema = z
	.strictObject({
		username: usernameField,
		password: z.string(),
		ageConfirmed: z.literal(true, copy.auth.errors.ageRequired),
		inviteCode: z.string().optional()
	})
	.superRefine((value, ctx) => {
		const check = passwordSchema(value.username).safeParse(value.password);
		if (!check.success) {
			for (const issue of check.error.issues) {
				ctx.addIssue({ ...issue, path: ['password'] });
			}
		}
	});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.strictObject({
	username: z.string().min(1),
	password: z.string().min(1)
});
export type LoginInput = z.infer<typeof loginSchema>;

export const recoverSchema = z
	.strictObject({
		username: usernameField,
		phrase: z.string().min(1),
		newPassword: z.string()
	})
	.superRefine((value, ctx) => {
		const check = passwordSchema(value.username).safeParse(value.newPassword);
		if (!check.success) {
			for (const issue of check.error.issues) {
				ctx.addIssue({ ...issue, path: ['newPassword'] });
			}
		}
	});
export type RecoverInput = z.infer<typeof recoverSchema>;

export const recoveryRegenerateSchema = z.strictObject({
	password: z.string().min(1)
});

export const accountPatchSchema = z.strictObject({
	displayName: z.string().trim().min(1).max(30).optional(),
	tz: z
		.string()
		.refine(isValidTimeZone, { message: copy.settings.account.errors.tzInvalid })
		.optional(),
	weekStart: z
		.union([z.literal(0), z.literal(1), z.literal(6)])
		.optional(),
	prefs: prefsSchema.partial().optional()
});
export type AccountPatchInput = z.infer<typeof accountPatchSchema>;

export const passwordChangeSchema = z.strictObject({
	currentPassword: z.string().min(1),
	newPassword: z.string()
});

export const accountDeleteSchema = z.strictObject({
	username: z.string().min(1),
	password: z.string().min(1)
});

// --- M2: goals, key results, post-its (SPEC 7) -----------------------------

const ymdField = z
	.string()
	.refine(isValidYmd, { message: copy.plans.errors.dateInvalid });

const timeField = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, copy.plans.errors.timeInvalid);

const colorField = z.enum(['butter', 'mint', 'sky', 'blush', 'sand', 'sage', 'lilac']);

const horizonField = z.enum(['short', 'mid', 'long']);

const titleField = z.string().trim().min(1).max(140);

export const goalCreateSchema = z.strictObject({
	title: titleField,
	note: z.string().max(2000).nullable().optional(),
	emoji: z.string().max(8).nullable().optional(),
	color: colorField.optional(),
	targetDate: ymdField.nullable().optional(),
	horizonOverride: horizonField.nullable().optional()
});
export type GoalCreateInput = z.infer<typeof goalCreateSchema>;

export const goalPatchSchema = z.strictObject({
	title: titleField.optional(),
	note: z.string().max(2000).nullable().optional(),
	emoji: z.string().max(8).nullable().optional(),
	color: colorField.optional(),
	targetDate: ymdField.nullable().optional(),
	horizonOverride: horizonField.nullable().optional(),
	status: z.enum(['active', 'done', 'archived']).optional(),
	position: z.number().finite().optional()
});
export type GoalPatchInput = z.infer<typeof goalPatchSchema>;

export const keyResultCreateSchema = z.strictObject({
	title: titleField,
	kind: z.enum(['number', 'check']).default('number'),
	startValue: z.number().finite().optional(),
	targetValue: z.number().finite().optional(),
	currentValue: z.number().finite().optional(),
	unit: z.string().max(20).nullable().optional(),
	position: z.number().finite().optional()
});
export type KeyResultCreateInput = z.infer<typeof keyResultCreateSchema>;

export const keyResultPatchSchema = z.strictObject({
	title: titleField.optional(),
	kind: z.enum(['number', 'check']).optional(),
	startValue: z.number().finite().optional(),
	targetValue: z.number().finite().optional(),
	currentValue: z.number().finite().optional(),
	unit: z.string().max(20).nullable().optional(),
	position: z.number().finite().optional()
});
export type KeyResultPatchInput = z.infer<typeof keyResultPatchSchema>;

export const postitCreateSchema = z.strictObject({
	title: titleField,
	note: z.string().max(2000).nullable().optional(),
	color: colorField.nullable().optional(),
	date: ymdField.nullable().optional(),
	time: timeField.nullable().optional(),
	durationMin: z.number().int().min(1).max(1440).nullable().optional(),
	goalId: z.string().min(1).nullable().optional(),
	habitId: z.string().min(1).nullable().optional(),
	horizonOverride: horizonField.nullable().optional(),
	position: z.number().finite().optional()
});
export type PostitCreateInput = z.infer<typeof postitCreateSchema>;

export const postitPatchSchema = z.strictObject({
	title: titleField.optional(),
	note: z.string().max(2000).nullable().optional(),
	color: colorField.nullable().optional(),
	date: ymdField.nullable().optional(),
	time: timeField.nullable().optional(),
	durationMin: z.number().int().min(1).max(1440).nullable().optional(),
	goalId: z.string().min(1).nullable().optional(),
	habitId: z.string().min(1).nullable().optional(),
	horizonOverride: horizonField.nullable().optional(),
	position: z.number().finite().optional(),
	// true sets done_at, false reopens (clears done_at) — SPEC 7.
	done: z.boolean().optional()
});
export type PostitPatchInput = z.infer<typeof postitPatchSchema>;

export const postitsQuerySchema = z.strictObject({
	from: ymdField.optional(),
	to: ymdField.optional(),
	horizon: horizonField.optional(),
	goalId: z.string().min(1).optional()
});
export type PostitsQueryInput = z.infer<typeof postitsQuerySchema>;

export const postitReorderSchema = z.strictObject({
	postits: z
		.array(
			z.strictObject({
				id: z.string().min(1),
				position: z.number().finite()
			})
		)
		.min(1)
		.max(500)
});
export type PostitReorderInput = z.infer<typeof postitReorderSchema>;

// Cleanup payload (form chosen here, noted in DECISIONS.md): ids plus one of
// four actions — reschedule to today, push one week, mark done, soft-delete.
export const postitCleanupSchema = z.strictObject({
	ids: z.array(z.string().min(1)).min(1).max(500),
	action: z.enum(['today', 'plusWeek', 'done', 'delete'])
});
export type PostitCleanupInput = z.infer<typeof postitCleanupSchema>;

// --- M3: Quick Capture (SPEC 9) ---------------------------------------------

// CaptureItem (SPEC 9.1): the shape the LLM returns and the client edits in
// the preview. suggestedGoalTitle is free text, never a foreign key.
export const suggestedHabitSchema = z.strictObject({
	title: z.string().trim().min(1).max(80),
	cadence: z.enum(['week', 'month']),
	targetCount: z.number().int().min(1).max(10000)
});
export type SuggestedHabit = z.infer<typeof suggestedHabitSchema>;

export const captureItemSchema = z.strictObject({
	title: z.string().trim().min(1).max(140),
	date: ymdField.nullable(),
	time: timeField.nullable(),
	suggestedGoalTitle: z.string().trim().min(1).max(140).nullable(),
	suggestedHabit: suggestedHabitSchema.nullable()
});
export type CaptureItem = z.infer<typeof captureItemSchema>;

export const captureParseSchema = z.strictObject({
	text: z.string().trim().min(1).max(2000)
});
export type CaptureParseInput = z.infer<typeof captureParseSchema>;

export const captureCommitSchema = z.strictObject({
	items: z.array(captureItemSchema).min(1).max(10)
});
export type CaptureCommitInput = z.infer<typeof captureCommitSchema>;

export const captureUndoSchema = z.strictObject({
	batchId: z.string().min(1).max(64)
});
export type CaptureUndoInput = z.infer<typeof captureUndoSchema>;

// --- M4: habits and habit logs (SPEC 5.5, 7) --------------------------------

const habitCadenceField = z.enum(['week', 'month', 'range']);

const habitTitleField = z.string().trim().min(1).max(80);

const targetCountField = z.number().int().min(1).max(10000);
const maxPerDayField = z.number().int().min(1).max(20);

// range habits must carry a start and an end, end >= start (SPEC 4.2 CHECK).
const rangeRefinement = (value: { cadence?: string; rangeStart?: string | null; rangeEnd?: string | null }) => {
	if (value.cadence !== 'range') return true;
	if (!value.rangeStart || !value.rangeEnd) return false;
	return value.rangeEnd >= value.rangeStart;
};

export const habitCreateSchema = z
	.strictObject({
		title: habitTitleField,
		emoji: z.string().max(8).nullable().optional(),
		color: colorField.optional(),
		cadence: habitCadenceField,
		targetCount: targetCountField.default(1),
		rangeStart: ymdField.nullable().optional(),
		rangeEnd: ymdField.nullable().optional(),
		maxPerDay: maxPerDayField.default(1),
		goalId: z.string().min(1).nullable().optional()
	})
	.refine(rangeRefinement, { message: copy.calendar.errors.rangeRequired, path: ['rangeEnd'] });
export type HabitCreateInput = z.infer<typeof habitCreateSchema>;

export const habitPatchSchema = z
	.strictObject({
		title: habitTitleField.optional(),
		emoji: z.string().max(8).nullable().optional(),
		color: colorField.optional(),
		cadence: habitCadenceField.optional(),
		targetCount: targetCountField.optional(),
		rangeStart: ymdField.nullable().optional(),
		rangeEnd: ymdField.nullable().optional(),
		maxPerDay: maxPerDayField.optional(),
		goalId: z.string().min(1).nullable().optional(),
		// true archives (archived_at), false restores the habit to the bar.
		archived: z.boolean().optional(),
		position: z.number().finite().optional()
	})
	.refine(rangeRefinement, { message: copy.calendar.errors.rangeRequired, path: ['rangeEnd'] });
export type HabitPatchInput = z.infer<typeof habitPatchSchema>;

export const habitsQuerySchema = z.strictObject({
	archived: z.enum(['0', '1']).optional()
});
export type HabitsQueryInput = z.infer<typeof habitsQuerySchema>;

export const habitLogTapSchema = z.strictObject({
	date: ymdField,
	delta: z.union([z.literal(1), z.literal(-1)])
});
export type HabitLogTapInput = z.infer<typeof habitLogTapSchema>;

export const habitLogsQuerySchema = z.strictObject({
	from: ymdField.optional(),
	to: ymdField.optional()
});
export type HabitLogsQueryInput = z.infer<typeof habitLogsQuerySchema>;

// --- M5: journal templates and entries (SPEC 5.7, 7, 8.5) -------------------

// Field ids are stable keys of the values object, so they stay URL/attribute
// safe (DECISIONS.md).
const journalFieldId = z
	.string()
	.trim()
	.min(1)
	.max(40)
	.regex(/^[A-Za-z0-9_-]+$/, copy.journal.errors.fieldIdInvalid);

const journalLabel = z.string().trim().min(1).max(80);

// scale: min is always 1, max is 5, 7 or 10; faces are only meaningful on a
// 1–5 scale (SPEC 5.7).
const journalScaleField = z
	.strictObject({
		id: journalFieldId,
		type: z.literal('scale'),
		label: journalLabel,
		required: z.boolean().default(false),
		min: z.literal(1).default(1),
		max: z.union([z.literal(5), z.literal(7), z.literal(10)]),
		style: z.enum(['faces', 'numbers']).default('numbers')
	})
	.refine((field) => field.style !== 'faces' || field.max === 5, {
		message: copy.journal.errors.facesRange,
		path: ['style']
	});

const journalTextField = z.strictObject({
	id: journalFieldId,
	type: z.literal('text'),
	label: journalLabel,
	required: z.boolean().default(false),
	placeholder: z.string().max(80).nullable().optional(),
	maxLength: z.number().int().min(1).max(2000).default(500)
});

const journalYesNoField = z.strictObject({
	id: journalFieldId,
	type: z.literal('yesno'),
	label: journalLabel,
	required: z.boolean().default(false)
});

const journalChoiceField = z
	.strictObject({
		id: journalFieldId,
		type: z.literal('choice'),
		label: journalLabel,
		required: z.boolean().default(false),
		options: z.array(z.string().trim().min(1).max(40)).min(2).max(8)
	})
	.refine((field) => new Set(field.options).size === field.options.length, {
		message: copy.journal.errors.optionsDuplicate,
		path: ['options']
	});

const journalNumberField = z
	.strictObject({
		id: journalFieldId,
		type: z.literal('number'),
		label: journalLabel,
		required: z.boolean().default(false),
		unit: z.string().max(20).nullable().optional(),
		min: z.number().finite().nullable().optional(),
		max: z.number().finite().nullable().optional()
	})
	.refine(
		(field) =>
			field.min === undefined ||
			field.min === null ||
			field.max === undefined ||
			field.max === null ||
			field.min <= field.max,
		{ message: copy.journal.errors.boundsInvalid, path: ['max'] }
	);

export const journalFieldSchema = z.discriminatedUnion('type', [
	journalScaleField,
	journalTextField,
	journalYesNoField,
	journalChoiceField,
	journalNumberField
]);
export type JournalField = z.infer<typeof journalFieldSchema>;

// A template carries 1–20 fields with unique ids (SPEC 5.7).
export const journalFieldsSchema = z
	.array(journalFieldSchema)
	.min(1)
	.max(20)
	.refine((fields) => new Set(fields.map((field) => field.id)).size === fields.length, {
		message: copy.journal.errors.fieldIdDuplicate
	});

// schedule: up to four times (HH:MM) on 0–6 weekdays. NULL means "manual
// only" (SPEC 5.7). Times without a weekday could never become due, so that
// combination is rejected instead of silently dead (DECISIONS.md).
export const journalScheduleSchema = z
	.strictObject({
		times: z.array(timeField).max(4).default([]),
		days: z.array(z.number().int().min(0).max(6)).max(7).default([])
	})
	.refine((schedule) => new Set(schedule.times).size === schedule.times.length, {
		message: copy.journal.errors.timesDuplicate,
		path: ['times']
	})
	.refine((schedule) => new Set(schedule.days).size === schedule.days.length, {
		message: copy.journal.errors.daysDuplicate,
		path: ['days']
	})
	.refine((schedule) => schedule.times.length === 0 || schedule.days.length > 0, {
		message: copy.journal.errors.timesNeedDays,
		path: ['days']
	});
export type JournalSchedule = z.infer<typeof journalScheduleSchema>;

// Field values (SPEC 4.2 values_json): string | number | boolean per field id.
export const journalValuesSchema = z
	.record(
		z.string().min(1).max(40),
		z.union([z.string().max(2000), z.number().finite(), z.boolean()])
	)
	.refine((values) => Object.keys(values).length <= 40, {
		message: copy.journal.errors.tooManyValues
	});
export type JournalValues = z.infer<typeof journalValuesSchema>;

export const journalTemplateCreateSchema = z.strictObject({
	name: z.string().trim().min(1).max(40),
	emoji: z.string().max(8).nullable().optional(),
	fields: journalFieldsSchema,
	schedule: journalScheduleSchema.nullable().optional()
});
export type JournalTemplateCreateInput = z.infer<typeof journalTemplateCreateSchema>;

export const journalTemplatePatchSchema = z.strictObject({
	name: z.string().trim().min(1).max(40).optional(),
	emoji: z.string().max(8).nullable().optional(),
	fields: journalFieldsSchema.optional(),
	schedule: journalScheduleSchema.nullable().optional(),
	// false deactivates the template; its entries stay readable (AC14).
	active: z.boolean().optional()
});
export type JournalTemplatePatchInput = z.infer<typeof journalTemplatePatchSchema>;

export const journalTemplatesQuerySchema = z.strictObject({
	// '1' also returns deactivated templates (the management list, AC14).
	includeInactive: z.enum(['0', '1']).optional()
});
export type JournalTemplatesQueryInput = z.infer<typeof journalTemplatesQuerySchema>;

export const journalEntryCreateSchema = z.strictObject({
	templateId: z.string().min(1),
	entryDate: ymdField,
	// 'HH:MM' of the schedule slot, or null for a manual entry (SPEC 4.2).
	slot: timeField.nullable().optional(),
	values: journalValuesSchema
});
export type JournalEntryCreateInput = z.infer<typeof journalEntryCreateSchema>;

// Only the values are editable; date and slot belong to the slot identity
// (SPEC 7, AC13).
export const journalEntryPatchSchema = z.strictObject({
	values: journalValuesSchema
});
export type JournalEntryPatchInput = z.infer<typeof journalEntryPatchSchema>;

export const journalEntriesQuerySchema = z.strictObject({
	from: ymdField.optional(),
	to: ymdField.optional()
});
export type JournalEntriesQueryInput = z.infer<typeof journalEntriesQuerySchema>;

// --- M6: onboarding (SPEC 8.6) ----------------------------------------------

// One request finishes the four steps: the name from step 1, the rhythm from
// step 4 and, when the user accepted the suggestion, the habit from step 3
// (capture has its own endpoint and is committed from step 2 directly).
export const onboardingCompleteSchema = z.strictObject({
	displayName: z.string().trim().min(1).max(30).optional(),
	journalRhythm: z.enum(['morning', 'evening', 'off']),
	habit: z
		.strictObject({
			title: z.string().trim().min(1).max(80),
			emoji: z.string().max(8).nullable().optional(),
			color: colorField.optional(),
			cadence: z.enum(['week', 'month']),
			targetCount: z.number().int().min(1).max(10000),
			maxPerDay: z.number().int().min(1).max(20).optional()
		})
		.nullable()
		.optional()
});
export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>;
