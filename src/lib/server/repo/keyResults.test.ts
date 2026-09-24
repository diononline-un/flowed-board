import { describe, expect, it } from 'vitest';
import type { SqliteDatabase } from '../db.js';
import { useTestDb } from '../testdb.js';
import * as usersRepo from './users.js';
import * as goalsRepo from './goals.js';
import * as keyResultsRepo from './keyResults.js';
import type { UserRow } from '$lib/shared/types.js';

// CRUD + tenant separation (SPEC 6.6) against :memory: with real migrations.

let db: SqliteDatabase;

function makeUser(username: string): UserRow {
	const user = usersRepo.createUser({
		username,
		passwordHash: 'hash-placeholder',
		recoveryHash: 'recovery-placeholder',
		ageConfirmedAt: '2026-01-01T00:00:00.000Z'
	});
	return usersRepo.getById(user.id)!;
}

describe('keyResults repo', () => {
	it('creates key results with defaults and per-goal positions', () => {
		db = useTestDb();
		const user = makeUser('kr-a');
		const goal = goalsRepo.createGoal(user.id, { title: 'Ziel' });
		const other = goalsRepo.createGoal(user.id, { title: 'Anderes' });
		const first = keyResultsRepo.createKeyResult(user.id, goal.id, { title: 'KR 1' });
		const second = keyResultsRepo.createKeyResult(user.id, goal.id, {
			title: 'KR 2',
			kind: 'check'
		});
		const elsewhere = keyResultsRepo.createKeyResult(user.id, other.id, { title: 'KR x' });
		expect(first?.kind).toBe('number');
		expect(first?.targetValue).toBe(1);
		expect(first?.startValue).toBe(0);
		expect(first?.position).toBe(1);
		expect(second?.kind).toBe('check');
		expect(second?.position).toBe(2);
		expect(elsewhere?.position).toBe(1); // positions are scoped per goal
		expect(keyResultsRepo.listKeyResults(user.id, goal.id).map((kr) => kr.id)).toEqual([
			first!.id,
			second!.id
		]);
	});

	it('refuses to create under a foreign or missing goal', () => {
		db = useTestDb();
		const userA = makeUser('kr-user-a');
		const userB = makeUser('kr-user-b');
		const goalA = goalsRepo.createGoal(userA.id, { title: 'A-Ziel' });
		expect(keyResultsRepo.createKeyResult(userB.id, goalA.id, { title: 'fremd' })).toBeNull();
		expect(keyResultsRepo.createKeyResult(userA.id, 'missing', { title: 'nix' })).toBeNull();
		// also refused once the goal is soft-deleted
		goalsRepo.softDeleteGoal(userA.id, goalA.id);
		expect(keyResultsRepo.createKeyResult(userA.id, goalA.id, { title: 'spät' })).toBeNull();
	});

	it('updates values and soft-deletes', () => {
		db = useTestDb();
		const user = makeUser('kr-b');
		const goal = goalsRepo.createGoal(user.id, { title: 'Ziel' });
		const kr = keyResultsRepo.createKeyResult(user.id, goal.id, {
			title: '10 km laufen',
			startValue: 0,
			targetValue: 10,
			unit: 'km'
		});
		const updated = keyResultsRepo.updateKeyResult(user.id, kr!.id, { currentValue: 4 });
		expect(updated?.currentValue).toBe(4);
		expect(updated?.unit).toBe('km');
		const reordered = keyResultsRepo.updateKeyResult(user.id, kr!.id, { position: 5 });
		expect(reordered?.position).toBe(5);

		const deleted = keyResultsRepo.softDeleteKeyResult(user.id, kr!.id);
		expect(deleted?.deletedAt).not.toBeNull();
		expect(keyResultsRepo.listKeyResults(user.id, goal.id)).toEqual([]);
		expect(keyResultsRepo.updateKeyResult(user.id, kr!.id, { currentValue: 9 })).toBeNull();
	});
});

describe('keyResults repo purge (SPEC 6.8)', () => {
	const CUTOFF = '2026-09-10T00:00:00.000Z';

	it('hard-deletes deleted key results older than the cutoff, keeps fresh ones', () => {
		db = useTestDb();
		const user = makeUser('kr-purge-a');
		const goal = goalsRepo.createGoal(user.id, { title: 'Lebendes Ziel' });
		const old = keyResultsRepo.createKeyResult(user.id, goal.id, { title: 'alt' });
		const fresh = keyResultsRepo.createKeyResult(user.id, goal.id, { title: 'frisch' });
		const live = keyResultsRepo.createKeyResult(user.id, goal.id, { title: 'nie gelöscht' });
		keyResultsRepo.softDeleteKeyResult(user.id, old!.id);
		keyResultsRepo.softDeleteKeyResult(user.id, fresh!.id);
		db.prepare('UPDATE key_results SET deleted_at = ? WHERE id = ?').run(
			'2026-09-01T00:00:00.000Z',
			old!.id
		);
		db.prepare('UPDATE key_results SET deleted_at = ? WHERE id = ?').run(
			'2026-09-20T00:00:00.000Z',
			fresh!.id
		);

		expect(keyResultsRepo.purgeDeleted(CUTOFF)).toBe(1);

		expect(keyResultsRepo.getKeyResult(user.id, old!.id)).toBeNull();
		expect(keyResultsRepo.getKeyResult(user.id, fresh!.id)?.deleted_at).toBe(
			'2026-09-20T00:00:00.000Z'
		);
		// An undeleted key result is never touched, and its goal stays alive:
		// this is the case the goal cascade cannot reach on its own.
		expect(keyResultsRepo.getKeyResult(user.id, live!.id)?.deleted_at).toBeNull();
		expect(goalsRepo.getGoal(user.id, goal.id)).not.toBeNull();
	});

	it('purges across goals and users in one pass, idempotent on a second run', () => {
		db = useTestDb();
		const userA = makeUser('kr-purge-b');
		const userB = makeUser('kr-purge-c');
		const goalA = goalsRepo.createGoal(userA.id, { title: 'A-Ziel' });
		const goalB = goalsRepo.createGoal(userB.id, { title: 'B-Ziel' });
		const krA = keyResultsRepo.createKeyResult(userA.id, goalA.id, { title: 'A-KR' });
		const krB = keyResultsRepo.createKeyResult(userB.id, goalB.id, { title: 'B-KR' });
		for (const kr of [krA!, krB!]) {
			db.prepare('UPDATE key_results SET deleted_at = ? WHERE id = ?').run(
				'2026-09-01T00:00:00.000Z',
				kr.id
			);
		}

		expect(keyResultsRepo.purgeDeleted(CUTOFF)).toBe(2);
		expect(keyResultsRepo.getKeyResult(userA.id, krA!.id)).toBeNull();
		expect(keyResultsRepo.getKeyResult(userB.id, krB!.id)).toBeNull();
		expect(keyResultsRepo.purgeDeleted(CUTOFF)).toBe(0);
	});
});

describe('keyResults repo tenant separation (SPEC 6.6)', () => {
	it('user B cannot read, change or delete user A key results', () => {
		db = useTestDb();
		const userA = makeUser('kr-user-c');
		const userB = makeUser('kr-user-d');
		const goalA = goalsRepo.createGoal(userA.id, { title: 'A-Ziel' });
		const kr = keyResultsRepo.createKeyResult(userA.id, goalA.id, { title: 'A-KR' });

		expect(keyResultsRepo.getKeyResult(userB.id, kr!.id)).toBeNull();
		expect(keyResultsRepo.listKeyResults(userB.id, goalA.id)).toEqual([]);
		expect(keyResultsRepo.updateKeyResult(userB.id, kr!.id, { title: 'gekapert' })).toBeNull();
		expect(keyResultsRepo.softDeleteKeyResult(userB.id, kr!.id)).toBeNull();

		const after = keyResultsRepo.getKeyResult(userA.id, kr!.id);
		expect(after?.title).toBe('A-KR');
		expect(after?.deleted_at).toBeNull();
	});
});
