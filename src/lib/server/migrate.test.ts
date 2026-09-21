import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDb } from './db.js';
import { runMigrations } from './migrate.js';

// Real migrations against an in-memory database (constraints 11).
const MIGRATIONS_DIR = fileURLToPath(new URL('../../../migrations', import.meta.url));

function tableNames(db: ReturnType<typeof createDb>): string[] {
	return (
		db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
			)
			.all() as { name: string }[]
	).map((row) => row.name);
}

describe('runMigrations', () => {
	it('applies 001 and 002 once each, in a transaction', () => {
		const db = createDb(':memory:');
		const applied = runMigrations(db, MIGRATIONS_DIR);
		expect(applied).toEqual(['001_init.sql', '002_optional_modules.sql']);
		const tracked = db.prepare('SELECT name FROM _migrations ORDER BY name').all() as {
			name: string;
		}[];
		expect(tracked.map((row) => row.name)).toEqual([
			'001_init.sql',
			'002_optional_modules.sql'
		]);
	});

	it('creates every table from SPEC 4.2 and 4.3', () => {
		const db = createDb(':memory:');
		runMigrations(db, MIGRATIONS_DIR);
		expect(tableNames(db)).toEqual([
			'_migrations',
			'ai_usage',
			'discord_links',
			'goals',
			'habit_logs',
			'habits',
			'journal_entries',
			'journal_templates',
			'key_results',
			'link_codes',
			'postits',
			'push_subscriptions',
			'sessions',
			'user_badges',
			'users',
			'xp_events'
		]);
	});

	it('is idempotent on a second run', () => {
		const db = createDb(':memory:');
		runMigrations(db, MIGRATIONS_DIR);
		expect(runMigrations(db, MIGRATIONS_DIR)).toEqual([]);
	});

	it('enforces foreign keys', () => {
		const db = createDb(':memory:');
		runMigrations(db, MIGRATIONS_DIR);
		expect(() =>
			db
				.prepare(
					"INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES ('s1', 'missing-user', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z')"
				)
				.run()
		).toThrowError(/FOREIGN KEY/);
	});
});
