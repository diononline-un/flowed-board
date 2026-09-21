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

// users.prefs JSON (SPEC 4.4): every field optional with a default.
export const prefsSchema = z.object({
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
