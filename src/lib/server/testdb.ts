import { fileURLToPath } from 'node:url';
import { createDb, setDbForTests, type SqliteDatabase } from './db.js';
import { runMigrations } from './migrate.js';

// Test-only helper (constraints 11): hands the repo layer a fresh
// :memory: SQLite database migrated with the real migration files.
// Imported exclusively by *.test.ts, never by application code.
const MIGRATIONS_DIR = fileURLToPath(new URL('../../../migrations', import.meta.url));

export function useTestDb(): SqliteDatabase {
	const db = createDb(':memory:');
	runMigrations(db, MIGRATIONS_DIR);
	setDbForTests(db);
	return db;
}
