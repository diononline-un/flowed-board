import { z } from 'zod';

// Central, validated environment access. Startup aborts on invalid values.
// Defaults mirror .env.example (SPEC 13.1) so a local `node build` works without .env.
const schema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	ORIGIN: z.url().default('http://localhost:3000'),
	PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
	REGISTRATION: z.enum(['open', 'invite', 'closed']).default('open'),
	INVITE_CODE: z.string().default(''),
	DB_PATH: z.string().min(1).default('./data/flowboard.db'),
	LLM_BASE_URL: z.url().default('https://api.deepseek.com/v1'),
	LLM_API_KEY: z.string().default(''),
	LLM_MODEL: z.string().min(1).default('deepseek-chat'),
	LLM_JSON_MODE: z
		.enum(['true', 'false'])
		.default('true')
		.transform((v) => v === 'true'),
	LLM_PROVIDER_NAME: z.string().min(1).default('DeepSeek'),
	AI_DAILY_LIMIT_PER_USER: z.coerce.number().int().min(1).default(30),
	HOSTING_COUNTRY: z.string().min(1).default('Deutschland'),
	ADDRESS_HEADER: z.string().default(''),
	XFF_DEPTH: z.coerce.number().int().min(0).max(10).default(1),
	BODY_SIZE_LIMIT: z.coerce.number().int().min(1024).default(524288),
	BACKUP_DIR: z.string().min(1).default('/data/backups')
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
	console.error(
		'Invalid environment configuration:',
		z.flattenError(parsed.error).fieldErrors
	);
	process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof schema>;
