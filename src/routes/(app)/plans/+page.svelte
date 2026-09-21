<script lang="ts">
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import { BrushCleaning, Plus } from 'lucide-svelte';
	import CleanupSheet from '$lib/components/CleanupSheet.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import GoalCard from '$lib/components/GoalCard.svelte';
	import GoalSheet, { type GoalFormPayload } from '$lib/components/GoalSheet.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PostitCard from '$lib/components/PostitCard.svelte';
	import PostitSheet, { type PostitFormPayload } from '$lib/components/PostitSheet.svelte';
	import { pushErrorToast, pushToast } from '$lib/state/toasts.svelte.js';
	import { copy } from '$lib/shared/copy.js';
	import { addDays, diffDays } from '$lib/shared/date.js';
	import { effectiveHorizon } from '$lib/shared/horizon.js';
	import { progressOfGoal } from '$lib/shared/progress.js';
	import type { PostitCleanupInput } from '$lib/shared/schemas.js';
	import type {
		Horizon,
		PublicGoal,
		PublicKeyResult,
		PublicPostit
	} from '$lib/shared/types.js';
	import type { PageData } from './$types';

	// Board (SPEC 8.2): three lanes by effectiveHorizon, goal filter strip,
	// drag-and-drop with menu alternative (AC7), optimistic updates with
	// rollback + error toast, undo toasts for done/delete (P5, 8 s).
	type GoalWithExtras = PublicGoal & { keyResults: PublicKeyResult[]; progress: number };

	let { data }: { data: PageData } = $props();

	const today = $derived(data.today);
	const prefs = $derived(data.user.prefs);
	const lanes: Horizon[] = ['short', 'mid', 'long'];

	let goals = $state<GoalWithExtras[]>(data.goals);
	let postits = $state<PublicPostit[]>(data.postits);
	let selectedGoalId = $state<string | null>(null);

	// Resync from fresh server data after invalidateAll (e.g. an undo
	// restore triggered from another page); untouched during optimistic
	// mutations because `data` only changes on real reloads.
	$effect(() => {
		goals = data.goals;
		postits = data.postits;
	});

	const goalsById = $derived(new Map(goals.map((goal) => [goal.id, goal])));
	const activeGoals = $derived(goals.filter((goal) => goal.status === 'active'));

	function laneOf(postit: PublicPostit): Horizon {
		return effectiveHorizon(
			{ horizon_override: postit.horizonOverride, date: postit.date },
			data.today
		);
	}

	function passesGoalFilter(postit: PublicPostit): boolean {
		return selectedGoalId === null || postit.goalId === selectedGoalId;
	}

	function computeOpenLanes(): Record<Horizon, PublicPostit[]> {
		const result: Record<Horizon, PublicPostit[]> = { short: [], mid: [], long: [] };
		for (const postit of postits) {
			if (postit.doneAt !== null || !passesGoalFilter(postit)) continue;
			result[laneOf(postit)].push(postit);
		}
		for (const lane of lanes) {
			result[lane].sort((a, b) => a.position - b.position);
		}
		return result;
	}

	// Mutable lane arrays for svelte-dnd-action; resynced from the single
	// source of truth (postits) whenever it changes outside a drag.
	let laneItems = $state<Record<Horizon, PublicPostit[]>>({ short: [], mid: [], long: [] });
	$effect(() => {
		laneItems = computeOpenLanes();
	});

	const overduePostits = $derived(
		postits.filter((postit) => postit.date !== null && postit.date < today && postit.doneAt === null)
	);
	const showCleanup = $derived(overduePostits.length >= 5);

	function doneInLane(lane: Horizon): PublicPostit[] {
		return postits
			.filter((postit) => {
				if (postit.doneAt === null || !passesGoalFilter(postit)) return false;
				const doneDay = postit.doneAt.slice(0, 10);
				const age = diffDays(today, doneDay);
				if (age < 0 || age > prefs.showDoneDays) return false;
				return laneOf(postit) === lane;
			})
			.sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
	}

	let doneExpanded = $state<Record<Horizon, boolean>>({ short: false, mid: false, long: false });

	// --- API plumbing -------------------------------------------------------

	async function api<T>(path: string, method: string, body?: unknown): Promise<T | null> {
		try {
			const response = await fetch(path, {
				method,
				headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
				body: body !== undefined ? JSON.stringify(body) : undefined
			});
			if (!response.ok) return null;
			return (await response.json()) as T;
		} catch {
			return null;
		}
	}

	function snapshotPostits(): PublicPostit[] {
		return postits.map((postit) => ({ ...postit }));
	}

	function replacePostit(updated: PublicPostit) {
		postits = postits.map((postit) => (postit.id === updated.id ? updated : postit));
	}

	function recalcProgress(goalId: string) {
		const goal = goals.find((entry) => entry.id === goalId);
		if (!goal) return;
		const progress = progressOfGoal(
			goal.keyResults,
			postits.filter((postit) => postit.goalId === goalId)
		);
		goals = goals.map((entry) => (entry.id === goalId ? { ...entry, progress } : entry));
	}

	// --- Post-it mutations --------------------------------------------------

	async function setDone(postit: PublicPostit, makeDone: boolean) {
		const snapshot = snapshotPostits();
		postits = postits.map((entry) =>
			entry.id === postit.id
				? { ...entry, doneAt: makeDone ? new Date().toISOString() : null }
				: entry
		);
		const result = await api<{ postit: PublicPostit }>(`/api/postits/${postit.id}`, 'PATCH', {
			done: makeDone
		});
		if (!result) {
			postits = snapshot;
			pushErrorToast(copy.plans.toast.error);
			return;
		}
		replacePostit(result.postit);
		if (result.postit.goalId) recalcProgress(result.postit.goalId);
		if (makeDone) {
			pushToast(copy.plans.toast.done, {
				action: {
					label: copy.plans.toast.undo,
					run: () => setDone(result.postit, false)
				}
			});
		}
	}

	async function deletePostit(postit: PublicPostit) {
		const snapshot = snapshotPostits();
		postits = postits.filter((entry) => entry.id !== postit.id);
		const result = await api<{ postit: PublicPostit }>(`/api/postits/${postit.id}`, 'DELETE');
		if (!result) {
			postits = snapshot;
			pushErrorToast(copy.plans.toast.error);
			return;
		}
		if (postit.goalId) recalcProgress(postit.goalId);
		pushToast(copy.plans.toast.deleted, {
			action: {
				label: copy.plans.toast.undo,
				run: async () => {
					const restored = await api<{ postit: PublicPostit }>(
						`/api/postits/${postit.id}/restore`,
						'POST'
					);
					if (!restored) {
						pushErrorToast(copy.plans.toast.error);
						return;
					}
					postits = [...postits.filter((entry) => entry.id !== postit.id), restored.postit];
					if (restored.postit.goalId) recalcProgress(restored.postit.goalId);
				}
			}
		});
	}

	async function patchPostit(
		postit: PublicPostit,
		patch: Record<string, unknown>,
		optimistic: Partial<PublicPostit>
	): Promise<boolean> {
		const snapshot = snapshotPostits();
		postits = postits.map((entry) =>
			entry.id === postit.id ? { ...entry, ...optimistic } : entry
		);
		const result = await api<{ postit: PublicPostit }>(
			`/api/postits/${postit.id}`,
			'PATCH',
			patch
		);
		if (!result) {
			postits = snapshot;
			pushErrorToast(copy.plans.toast.error);
			return false;
		}
		replacePostit(result.postit);
		return true;
	}

	function moveToLane(postit: PublicPostit, lane: Horizon) {
		if (laneOf(postit) === lane) return;
		void patchPostit(postit, { horizonOverride: lane }, { horizonOverride: lane });
	}

	// --- Drag and drop (AC5) ------------------------------------------------

	function handleDndConsider(lane: Horizon, event: CustomEvent<DndEvent<PublicPostit>>) {
		laneItems = { ...laneItems, [lane]: event.detail.items };
	}

	function handleDndFinalize(lane: Horizon, event: CustomEvent<DndEvent<PublicPostit>>) {
		const items = event.detail.items;
		laneItems = { ...laneItems, [lane]: items };
		const snapshot = snapshotPostits();
		const reorderBatch: { id: string; position: number }[] = [];
		const laneMoves: { postit: PublicPostit; lane: Horizon }[] = [];

		postits = postits.map((postit) => {
			const index = items.findIndex((item) => item.id === postit.id);
			if (index === -1) return postit;
			const position = index + 1;
			const next = { ...postit, position };
			if (position !== postit.position) reorderBatch.push({ id: postit.id, position });
			if (laneOf(postit) !== lane) {
				next.horizonOverride = lane;
				laneMoves.push({ postit, lane });
			}
			return next;
		});

		void (async () => {
			for (const move of laneMoves) {
				const result = await api<{ postit: PublicPostit }>(
					`/api/postits/${move.postit.id}`,
					'PATCH',
					{ horizonOverride: move.lane }
				);
				if (!result) {
					postits = snapshot;
					pushErrorToast(copy.plans.toast.error);
					return;
				}
				replacePostit(result.postit);
			}
			if (reorderBatch.length > 0) {
				const result = await api<{ items: PublicPostit[] }>(
					'/api/postits/reorder',
					'POST',
					{ postits: reorderBatch }
				);
				if (!result) {
					postits = snapshot;
					pushErrorToast(copy.plans.toast.error);
					return;
				}
				for (const updated of result.items) replacePostit(updated);
			}
		})();
	}

	// --- Sheets and modals --------------------------------------------------

	let postitSheetOpen = $state(false);
	let editingPostit = $state<PublicPostit | null>(null);
	let formBusy = $state(false);
	let formError = $state('');

	function openNewPostit() {
		editingPostit = null;
		formError = '';
		postitSheetOpen = true;
	}

	function openEditPostit(postit: PublicPostit) {
		editingPostit = postit;
		formError = '';
		postitSheetOpen = true;
	}

	async function submitPostitForm(payload: PostitFormPayload) {
		formBusy = true;
		formError = '';
		try {
			if (editingPostit) {
				const target = editingPostit;
				const result = await api<{ postit: PublicPostit }>(
					`/api/postits/${target.id}`,
					'PATCH',
					payload
				);
				if (!result) {
					formError = copy.plans.toast.error;
					return;
				}
				replacePostit(result.postit);
				if (result.postit.goalId) recalcProgress(result.postit.goalId);
			} else {
				const result = await api<{ postit: PublicPostit }>('/api/postits', 'POST', payload);
				if (!result) {
					formError = copy.plans.toast.error;
					return;
				}
				postits = [...postits, result.postit];
				if (result.postit.goalId) recalcProgress(result.postit.goalId);
			}
			postitSheetOpen = false;
		} finally {
			formBusy = false;
		}
	}

	let goalSheetOpen = $state(false);

	async function submitGoalForm(payload: GoalFormPayload) {
		formBusy = true;
		formError = '';
		try {
			const result = await api<{ goal: PublicGoal }>('/api/goals', 'POST', payload);
			if (!result) {
				formError = copy.plans.toast.error;
				return;
			}
			goals = [...goals, { ...result.goal, keyResults: [], progress: 0 }];
			goalSheetOpen = false;
		} finally {
			formBusy = false;
		}
	}

	// Date change modal.
	let dateModalPostit = $state<PublicPostit | null>(null);
	let dateDraft = $state('');

	function openDateModal(postit: PublicPostit) {
		dateDraft = postit.date ?? '';
		dateModalPostit = postit;
	}

	async function submitDateModal() {
		const target = dateModalPostit;
		if (!target) return;
		const date = dateDraft === '' ? null : dateDraft;
		const succeeded = await patchPostit(target, { date }, { date });
		if (succeeded) dateModalPostit = null;
	}

	// Goal assignment modal.
	let assignModalPostit = $state<PublicPostit | null>(null);

	async function assignGoal(goalId: string | null) {
		const target = assignModalPostit;
		if (!target) return;
		const succeeded = await patchPostit(target, { goalId }, { goalId });
		if (succeeded) {
			recalcProgress(goalId ?? target.goalId ?? '');
			if (target.goalId) recalcProgress(target.goalId);
			assignModalPostit = null;
		}
	}

	// Cleanup sheet.
	let cleanupOpen = $state(false);
	let cleanupBusy = $state(false);

	async function applyCleanup(ids: string[], action: PostitCleanupInput['action']) {
		cleanupBusy = true;
		const snapshot = snapshotPostits();
		const now = new Date().toISOString();
		if (action === 'delete') {
			postits = postits.filter((postit) => !ids.includes(postit.id));
		} else if (action === 'done') {
			postits = postits.map((postit) =>
				ids.includes(postit.id) ? { ...postit, doneAt: postit.doneAt ?? now } : postit
			);
		} else if (action === 'today') {
			postits = postits.map((postit) =>
				ids.includes(postit.id) ? { ...postit, date: today } : postit
			);
		} else {
			postits = postits.map((postit) =>
				ids.includes(postit.id) ? { ...postit, date: addDays(postit.date ?? today, 7) } : postit
			);
		}
		const result = await api<{ items: PublicPostit[] }>('/api/postits/cleanup', 'POST', {
			ids,
			action
		});
		cleanupBusy = false;
		if (!result) {
			postits = snapshot;
			pushErrorToast(copy.plans.toast.error);
			return;
		}
		const byId = new Map(result.items.map((item) => [item.id, item]));
		postits = postits.map((postit) => byId.get(postit.id) ?? postit);
		cleanupOpen = false;
		const touched = [...new Set(result.items.map((item) => item.goalId).filter(Boolean))];
		for (const goalId of touched) recalcProgress(goalId as string);
		if (action === 'delete' || action === 'done') {
			pushToast(copy.plans.toast.cleanedUp(result.items.length), {
				action: {
					label: copy.plans.toast.undo,
					run: async () => {
						for (const item of result.items) {
							if (action === 'delete') {
								const restored = await api<{ postit: PublicPostit }>(
									`/api/postits/${item.id}/restore`,
									'POST'
								);
								if (restored) {
									postits = [
										...postits.filter((postit) => postit.id !== item.id),
										restored.postit
									];
								}
							} else {
								const reopened = await api<{ postit: PublicPostit }>(
									`/api/postits/${item.id}`,
									'PATCH',
									{ done: false }
								);
								if (reopened) replacePostit(reopened.postit);
							}
							if (item.goalId) recalcProgress(item.goalId);
						}
					}
				}
			});
		} else {
			pushToast(copy.plans.toast.cleanedUp(result.items.length));
		}
	}
</script>

<svelte:head>
	<title>{copy.plans.title} · {copy.appName}</title>
</svelte:head>

<div class="flex items-center justify-between gap-2">
	<h1 class="text-3xl font-bold">{copy.plans.title}</h1>
	<button
		type="button"
		class="flex items-center gap-1.5 rounded-pill bg-butter px-4 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
		onclick={openNewPostit}
	>
		<Plus size={16} strokeWidth={2} aria-hidden="true" />
		{copy.plans.newPostit}
	</button>
</div>

<!-- Goal filter strip (SPEC 8.2) -->
<div class="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
	<button
		type="button"
		class="shrink-0 rounded-pill border px-3 py-2 text-sm font-bold transition-colors duration-fast {selectedGoalId ===
		null
			? 'border-ink bg-ink text-paper'
			: 'border-paper-dark bg-paper text-ink-soft hover:text-ink'}"
		aria-pressed={selectedGoalId === null}
		onclick={() => (selectedGoalId = null)}
	>
		{copy.plans.allGoals}
	</button>
	{#each activeGoals as goal (goal.id)}
		<GoalCard
			{goal}
			progress={goal.progress}
			selected={selectedGoalId === goal.id}
			onselect={() => (selectedGoalId = selectedGoalId === goal.id ? null : goal.id)}
		/>
	{/each}
	<button
		type="button"
		class="flex w-32 shrink-0 items-center justify-center gap-1 rounded-card border border-dashed border-ink-soft/50 px-3 py-2.5 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:border-ink hover:text-ink"
		onclick={() => {
			formError = '';
			goalSheetOpen = true;
		}}
	>
		<Plus size={15} strokeWidth={2} aria-hidden="true" />
		{copy.plans.newGoal}
	</button>
</div>

{#if showCleanup}
	<button
		type="button"
		class="mt-3 flex items-center gap-1.5 rounded-pill bg-sand/70 px-4 py-2 text-sm font-bold text-ink transition-transform duration-fast hover:scale-[1.02]"
		onclick={() => (cleanupOpen = true)}
	>
		<BrushCleaning size={16} strokeWidth={1.75} aria-hidden="true" />
		{copy.plans.cleanupButton(overduePostits.length)}
	</button>
{/if}

{#if postits.length === 0}
	<EmptyState title={copy.plans.emptyTitle} hint={copy.plans.emptyHint} />
{:else}
	<div class="mt-5 grid gap-4 md:grid-cols-3">
		{#each lanes as lane (lane)}
			{@const doneList = doneInLane(lane)}
			<section aria-label={copy.plans.lanes[lane]}>
				<h2 class="mb-2 flex items-baseline gap-2 text-sm font-bold text-ink">
					{copy.plans.lanes[lane]}
					<span class="text-xs font-semibold text-ink-soft">{laneItems[lane].length}</span>
				</h2>
				<div
					use:dndzone={{
						items: laneItems[lane],
						type: 'postit',
						flipDurationMs: prefs.reduceMotion ? 0 : 150,
						delayTouchStart: true,
						dropTargetStyle: {}
					}}
					onconsider={(event) => handleDndConsider(lane, event)}
					onfinalize={(event) => handleDndFinalize(lane, event)}
					class="flex min-h-24 flex-col gap-3 rounded-card p-1"
					role="list"
					aria-label={copy.plans.lanes[lane]}
				>
					{#each laneItems[lane] as postit (postit.id)}
						<PostitCard
							{postit}
							goal={postit.goalId ? (goalsById.get(postit.goalId) ?? null) : null}
							{today}
							tilt={prefs.postitTilt}
							ontoggle={() => setDone(postit, postit.doneAt === null)}
							onedit={() => openEditPostit(postit)}
							onchangedate={() => openDateModal(postit)}
							onassigngoal={() => (assignModalPostit = postit)}
							onmove={(target) => moveToLane(postit, target)}
							ondelete={() => deletePostit(postit)}
						/>
					{/each}
				</div>
				{#if laneItems[lane].length === 0}
					<p class="px-1 text-xs text-ink-soft italic">{copy.plans.laneEmpty}</p>
				{/if}
				{#if doneList.length > 0}
					<button
						type="button"
						class="mt-3 text-xs font-bold text-ink-soft transition-colors duration-fast hover:text-ink"
						aria-expanded={doneExpanded[lane]}
						onclick={() => (doneExpanded = { ...doneExpanded, [lane]: !doneExpanded[lane] })}
					>
						{doneExpanded[lane] ? copy.plans.hideDone : copy.plans.doneSection(doneList.length)}
					</button>
					{#if doneExpanded[lane]}
						<div class="mt-2 flex flex-col gap-3">
							{#each doneList as postit (postit.id)}
								<PostitCard
									{postit}
									goal={postit.goalId ? (goalsById.get(postit.goalId) ?? null) : null}
									{today}
									tilt={prefs.postitTilt}
									ontoggle={() => setDone(postit, false)}
									onedit={() => openEditPostit(postit)}
									onchangedate={() => openDateModal(postit)}
									onassigngoal={() => (assignModalPostit = postit)}
									onmove={(target) => moveToLane(postit, target)}
									ondelete={() => deletePostit(postit)}
								/>
							{/each}
						</div>
					{/if}
				{/if}
			</section>
		{/each}
	</div>
{/if}

{#if postitSheetOpen}
	<PostitSheet
		postit={editingPostit}
		goals={activeGoals}
		busy={formBusy}
		error={formError}
		onclose={() => (postitSheetOpen = false)}
		onsubmit={submitPostitForm}
	/>
{/if}

{#if goalSheetOpen}
	<GoalSheet
		busy={formBusy}
		error={formError}
		onclose={() => (goalSheetOpen = false)}
		onsubmit={submitGoalForm}
	/>
{/if}

{#if dateModalPostit}
	<Modal title={copy.plans.actions.changeDate} onclose={() => (dateModalPostit = null)}>
		<form
			class="flex flex-col gap-3"
			onsubmit={(event) => {
				event.preventDefault();
				void submitDateModal();
			}}
		>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{copy.plans.form.date}</span>
				<input
					type="date"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={dateDraft}
				/>
			</label>
			<button
				type="submit"
				class="rounded-pill bg-butter px-4 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
			>
				{copy.plans.form.save}
			</button>
		</form>
	</Modal>
{/if}

{#if assignModalPostit}
	<Modal title={copy.plans.actions.assignGoal} onclose={() => (assignModalPostit = null)}>
		<div class="flex flex-col gap-1.5">
			<button
				type="button"
				class="rounded-lg border border-paper-dark px-3 py-2 text-left text-sm font-semibold text-ink transition-colors duration-fast hover:bg-paper-dark {assignModalPostit.goalId ===
				null
					? 'bg-paper-dark'
					: ''}"
				onclick={() => assignGoal(null)}
			>
				{copy.plans.form.noGoal}
			</button>
			{#each activeGoals as goal (goal.id)}
				<button
					type="button"
					class="flex items-center gap-2 rounded-lg border border-paper-dark px-3 py-2 text-left text-sm font-semibold text-ink transition-colors duration-fast hover:bg-paper-dark {assignModalPostit.goalId ===
					goal.id
						? 'bg-paper-dark'
						: ''}"
					onclick={() => assignGoal(goal.id)}
				>
					<span
						class="h-3 w-3 shrink-0 rounded-full"
						style:background-color="var(--color-{goal.color})"
						aria-hidden="true"
					></span>
					{goal.title}
				</button>
			{/each}
		</div>
	</Modal>
{/if}

{#if cleanupOpen}
	<CleanupSheet
		postits={overduePostits}
		busy={cleanupBusy}
		onclose={() => (cleanupOpen = false)}
		onapply={applyCleanup}
	/>
{/if}
