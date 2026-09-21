import { z } from 'zod';
import { copy } from './copy.js';
import { isValidTimeZone } from './date.js';

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
