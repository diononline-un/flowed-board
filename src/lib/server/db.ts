import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from './env.js';
import { runMigrations } from './migrate.js';

export type SqliteDatabase = Database.Database;

// One process, one file (SPEC 3). WAL + foreign keys + busy_timeout per SPEC.
export function createDb(path: string): SqliteDatabase {
	if (path !== ':memory:') {
		mkdirSync(dirname(resolve(path)), { recursive: true });
	}
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	return db;
}

let instance: SqliteDatabase | null = null;

// Lazily opened so unit tests can use their own :memory: databases without
// touching the filesystem. First call (server start) also runs migrations.
export function getDb(): SqliteDatabase {
	if (!instance) {
		instance = createDb(env.DB_PATH);
		runMigrations(instance);
	}
	return instance;
}

// Test-only hook: unit tests inject their migrated :memory: database here so
// the repo layer keeps its SPEC-6.6 signature (userId first, no db param).
export function setDbForTests(db: SqliteDatabase | null): void {
	instance = db;
}
