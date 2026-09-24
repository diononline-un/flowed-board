// SQLite online backup (SPEC 13.4): copies the live database via the
// better-sqlite3 .backup() API to <BACKUP_DIR>/flowboard-YYYY-MM-DD.db and
// keeps the newest 14 files. Runs on demand (`npm run backup`, e.g. via cron),
// never automatically inside the app container.
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const KEEP = 14;
const dbPath = process.env.DB_PATH || './data/flowboard.db';
const backupDir = process.env.BACKUP_DIR || '/data/backups';
const day = new Date().toISOString().slice(0, 10);

await mkdir(backupDir, { recursive: true });

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
try {
	await db.backup(join(backupDir, `flowboard-${day}.db`));
} finally {
	db.close();
}

const backups = (await readdir(backupDir))
	.filter((file) => /^flowboard-\d{4}-\d{2}-\d{2}\.db$/.test(file))
	.sort();
const stale = backups.slice(0, Math.max(0, backups.length - KEEP));
for (const file of stale) {
	await rm(join(backupDir, file));
}

console.log(
	`backup: wrote flowboard-${day}.db to ${backupDir} (kept ${backups.length - stale.length}, removed ${stale.length})`
);
