import { getDb } from '../db.js';

// Only SQL for the link_codes table lives here (SPEC 16). The table comes with
// migration 002 (optional module A, SPEC 14.1): a short-lived code links a
// Discord account to a FlowBoard account. Module A is not built in v1, but the
// code rows still need a purge path (SPEC 6.8), so the table gets its own repo
// file like every other table.

export interface LinkCodeRow {
	code_hash: string;
	user_id: string;
	expires_at: string;
}

// Writes one link code. Only the hash is stored (SPEC 14.1), the same way
// sessions keep sha256(token) instead of the token; the plain code lives in
// the ten minutes of one Discord command and never in the database.
export function insertCode(row: LinkCodeRow): void {
	getDb()
		.prepare(
			'INSERT INTO link_codes (code_hash, user_id, expires_at) VALUES (@code_hash, @user_id, @expires_at)'
		)
		.run(row);
}

// SPEC 6.8 purge: a link code is valid for 10 minutes, so every expired row is
// dead weight — hash only, no user content. The boundary is exclusive in the
// other direction than the soft-delete purge: a code is dead as soon as
// `expires_at` is reached, so `<=` also catches the exact expiry instant.
export function purgeExpired(nowIso: string): number {
	const result = getDb().prepare('DELETE FROM link_codes WHERE expires_at <= ?').run(nowIso);
	return result.changes;
}
