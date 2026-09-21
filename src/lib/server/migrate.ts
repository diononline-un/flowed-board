import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SqliteDatabase } from './db.js';

// Applies numbered .sql files from migrations/ exactly once, each in its own
// transaction, tracked in the _migrations table (SPEC 3). Runs at server start.
export function runMigrations(
	db: SqliteDatabase,
	dir = join(process.cwd(), 'migrations')
): string[] {
	db.exec(
		'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)'
	);
	const applied = new Set(
		(db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map(
			(row) => row.name
		)
	);
	const files = readdirSync(dir)
		.filter((file) => /^\d+.*\.sql$/.test(file))
		.sort();
	const appliedNow: string[] = [];
	for (const file of files) {
		if (applied.has(file)) continue;
		const sql = readFileSync(join(dir, file), 'utf8');
		const apply = db.transaction(() => {
			db.exec(sql);
			db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
				file,
				new Date().toISOString()
			);
		});
		apply();
		appliedNow.push(file);
	}
	return appliedNow;
}
