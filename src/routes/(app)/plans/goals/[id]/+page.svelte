<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';
	import { ArrowLeft, Check, PartyPopper, Pencil, Plus, Trash2 } from 'lucide-svelte';
	import GoalSheet, { type GoalFormPayload } from '$lib/components/GoalSheet.svelte';
	import KeyResultRow from '$lib/components/KeyResultRow.svelte';
	import { pushErrorToast, pushToast } from '$lib/state/toasts.svelte.js';
	import { copy } from '$lib/shared/copy.js';
	import { formatDe } from '$lib/shared/date.js';
	import { progressOfGoal } from '$lib/shared/progress.js';
	import type { PublicGoal, PublicKeyResult, PublicPostit } from '$lib/shared/types.js';
	import type { PageData } from './$types';

	// Goal detail (SPEC 8.3): title, note, target date, SPEC 5.4 progress
	// bar, inline-editable key results with drag reorder, linked post-its
	// and habits. 100 % only suggests "Als erreicht markieren?" (AC9).
	let { data }: { data: PageData } = $props();

	let goal = $state<PublicGoal>(data.goal);
	let keyResults = $state<PublicKeyResult[]>(data.keyResults);
	let postits = $state<PublicPostit[]>(data.postits);
	$effect(() => {
		goal = data.goal;
		keyResults = data.keyResults;
		postits = data.postits;
	});

	const progress = $derived(progressOfGoal(keyResults, postits));
	const percent = $derived(Math.round(progress * 100));
	const goalCopy = copy.plans.goal;

	let achievedDismissed = $state(false);
	const showAchieved = $derived(progress >= 1 && goal.status === 'active' && !achievedDismissed);

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

	// --- Goal itself --------------------------------------------------------

	let editOpen = $state(false);
	let formBusy = $state(false);
	let formError = $state('');

	async function submitGoalEdit(payload: GoalFormPayload) {
		formBusy = true;
		formError = '';
		try {
			const result = await api<{ goal: PublicGoal }>(`/api/goals/${goal.id}`, 'PATCH', payload);
			if (!result) {
				formError = copy.plans.toast.error;
				return;
			}
			goal = result.goal;
			editOpen = false;
			if (result.goal.status === 'done' && data.goal.status !== 'done') {
				pushToast(copy.plans.toast.goalDone);
			}
		} finally {
			formBusy = false;
		}
	}

	async function markAchieved() {
		const result = await api<{ goal: PublicGoal }>(`/api/goals/${goal.id}`, 'PATCH', {
			status: 'done'
		});
		if (!result) {
			pushErrorToast(copy.plans.toast.error);
			return;
		}
		goal = result.goal;
		pushToast(copy.plans.toast.goalDone);
	}

	async function deleteGoal() {
		const result = await api<{ goal: PublicGoal }>(`/api/goals/${goal.id}`, 'DELETE');
		if (!result) {
			pushErrorToast(copy.plans.toast.error);
			return;
		}
		pushToast(copy.plans.toast.goalDeleted, {
			action: {
				label: copy.plans.toast.undo,
				run: async () => {
					const restored = await api<{ goal: PublicGoal }>(
						`/api/goals/${goal.id}/restore`,
						'POST'
					);
					if (restored) await invalidateAll();
					else pushErrorToast(copy.plans.toast.error);
				}
			}
		});
		await goto('/plans');
	}

	// --- Key results --------------------------------------------------------

	async function patchKeyResult(kr: PublicKeyResult, patch: Record<string, unknown>) {
		const snapshot = keyResults.map((entry) => ({ ...entry }));
		keyResults = keyResults.map((entry) =>
			entry.id === kr.id ? { ...entry, ...patch } : entry
		);
		const result = await api<{ keyResult: PublicKeyResult }>(
			`/api/goals/${goal.id}/key-results/${kr.id}`,
			'PATCH',
			patch
		);
		if (!result) {
			keyResults = snapshot;
			pushErrorToast(copy.plans.toast.error);
			return;
		}
		keyResults = keyResults.map((entry) => (entry.id === kr.id ? result.keyResult : entry));
	}

	async function deleteKeyResult(kr: PublicKeyResult) {
		const snapshot = keyResults.map((entry) => ({ ...entry }));
		keyResults = keyResults.filter((entry) => entry.id !== kr.id);
		const result = await api<{ keyResult: PublicKeyResult }>(
			`/api/goals/${goal.id}/key-results/${kr.id}`,
			'DELETE'
		);
		if (!result) {
			keyResults = snapshot;
			pushErrorToast(copy.plans.toast.error);
			return;
		}
		// SPEC 7 defines no key-result restore endpoint; undo re-creates an
		// equal key result (new id, same values and position).
		pushToast(copy.plans.toast.krDeleted, {
			action: {
				label: copy.plans.toast.undo,
				run: async () => {
					const recreated = await api<{ keyResult: PublicKeyResult }>(
						`/api/goals/${goal.id}/key-results`,
						'POST',
						{
							title: kr.title,
							kind: kr.kind,
							startValue: kr.startValue,
							targetValue: kr.targetValue,
							currentValue: kr.currentValue,
							unit: kr.unit,
							position: kr.position
						}
					);
					if (!recreated) {
						pushErrorToast(copy.plans.toast.error);
						return;
					}
					keyResults = [...keyResults, recreated.keyResult].sort(
						(a, b) => a.position - b.position
					);
				}
			}
		});
	}

	let krTitle = $state('');
	let krKind = $state<'number' | 'check'>('number');
	let krTarget = $state('');
	let krUnit = $state('');

	async function addKeyResult() {
		const title = krTitle.trim();
		if (!title) return;
		const targetValue = krTarget.trim() === '' ? undefined : Number(krTarget);
		const result = await api<{ keyResult: PublicKeyResult }>(
			`/api/goals/${goal.id}/key-results`,
			'POST',
			{
				title,
				kind: krKind,
				...(krKind === 'number' && Number.isFinite(targetValue)
					? { targetValue, unit: krUnit.trim() === '' ? null : krUnit.trim() }
					: {})
			}
		);
		if (!result) {
			pushErrorToast(copy.plans.toast.error);
			return;
		}
		keyResults = [...keyResults, result.keyResult].sort((a, b) => a.position - b.position);
		krTitle = '';
		krTarget = '';
		krUnit = '';
	}

	// Drag reorder of key results (SPEC 8.3).
	function handleKrConsider(event: CustomEvent<DndEvent<PublicKeyResult>>) {
		keyResults = event.detail.items;
	}

	function handleKrFinalize(event: CustomEvent<DndEvent<PublicKeyResult>>) {
		const items = event.detail.items;
		const snapshot = keyResults.map((entry) => ({ ...entry }));
		const changed: { id: string; position: number }[] = [];
		keyResults = items.map((kr, index) => {
			const position = index + 1;
			if (position !== kr.position) changed.push({ id: kr.id, position });
			return { ...kr, position };
		});
		void (async () => {
			for (const move of changed) {
				const result = await api<{ keyResult: PublicKeyResult }>(
					`/api/goals/${goal.id}/key-results/${move.id}`,
					'PATCH',
					{ position: move.position }
				);
				if (!result) {
					keyResults = snapshot;
					pushErrorToast(copy.plans.toast.error);
					return;
				}
			}
		})();
	}

	// --- Linked post-its ----------------------------------------------------

	async function togglePostit(postit: PublicPostit) {
		const makeDone = postit.doneAt === null;
		const snapshot = postits.map((entry) => ({ ...entry }));
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
		postits = postits.map((entry) => (entry.id === postit.id ? result.postit : entry));
	}
</script>

<svelte:head>
	<title>{goal.title} · {copy.plans.title} · {copy.appName}</title>
</svelte:head>

<a
	href="/plans"
	class="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:text-ink"
>
	<ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
	{goalCopy.back}
</a>

<div class="mt-3 flex flex-wrap items-start justify-between gap-3">
	<div class="flex items-center gap-3">
		<span
			class="h-4 w-4 shrink-0 rounded-full"
			style:background-color="var(--color-{goal.color})"
			aria-hidden="true"
		></span>
		<h1 class="text-3xl font-bold">
			{#if goal.emoji}<span aria-hidden="true">{goal.emoji} </span>{/if}{goal.title}
		</h1>
		<span class="rounded-pill bg-paper-dark px-2.5 py-1 text-xs font-bold text-ink-soft">
			{goalCopy.statuses[goal.status]}
		</span>
	</div>
	<div class="flex gap-2">
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-pill border border-paper-dark bg-paper px-3.5 py-2 text-sm font-semibold text-ink transition-colors duration-fast hover:bg-paper-dark"
			onclick={() => {
				formError = '';
				editOpen = true;
			}}
		>
			<Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
			{goalCopy.editGoal}
		</button>
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-pill bg-blush px-3.5 py-2 text-sm font-semibold text-ink transition-transform duration-fast hover:scale-[1.02]"
			onclick={deleteGoal}
		>
			<Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
			{goalCopy.deleteGoal}
		</button>
	</div>
</div>

{#if goal.note}
	<p class="mt-2 max-w-2xl text-sm text-ink-soft">{goal.note}</p>
{/if}
{#if goal.targetDate}
	<p class="mt-1 text-sm font-semibold text-ink-soft">
		{copy.plans.form.targetDate}: {formatDe(goal.targetDate, 'long')}
	</p>
{/if}

<!-- SPEC 5.4 progress -->
<section class="mt-5 max-w-xl" aria-label={goalCopy.progressTitle}>
	<div class="flex items-baseline justify-between">
		<h2 class="text-sm font-bold text-ink">{goalCopy.progressTitle}</h2>
		<span class="text-sm font-bold text-ink">{copy.plans.goalProgress(percent)}</span>
	</div>
	<div
		class="mt-1.5 h-2.5 w-full overflow-hidden rounded-pill bg-paper-dark"
		role="progressbar"
		aria-valuenow={percent}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label={copy.plans.goalProgress(percent)}
	>
		<div
			class="h-full rounded-pill transition-[width] duration-base"
			style:background-color="var(--color-{goal.color})"
			style:width="{percent}%"
		></div>
	</div>
	{#if keyResults.length === 0 && postits.length === 0}
		<p class="mt-2 text-sm text-ink-soft italic">{goalCopy.noSteps}</p>
	{/if}
</section>

{#if showAchieved}
	<div
		class="mt-4 flex max-w-xl flex-wrap items-center gap-3 rounded-card border border-mint bg-mint/40 px-4 py-3"
	>
		<PartyPopper size={20} strokeWidth={1.75} aria-hidden="true" />
		<div class="min-w-0 flex-1">
			<p class="text-sm font-bold text-ink">{goalCopy.achievedTitle}</p>
			<p class="text-sm text-ink-soft">{goalCopy.achievedQuestion}</p>
		</div>
		<button
			type="button"
			class="rounded-pill bg-butter px-4 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
			onclick={markAchieved}
		>
			{goalCopy.achievedAction}
		</button>
		<button
			type="button"
			class="rounded-pill px-3 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
			onclick={() => (achievedDismissed = true)}
		>
			{goalCopy.achievedLater}
		</button>
	</div>
{/if}

<!-- Key results -->
<section class="mt-8 max-w-2xl">
	<h2 class="text-lg font-bold text-ink">{goalCopy.keyResults}</h2>
	{#if keyResults.length === 0}
		<p class="mt-2 text-sm text-ink-soft">{goalCopy.noKeyResults}</p>
	{:else}
		<div
			use:dndzone={{
				items: keyResults,
				type: `keyresult-${goal.id}`,
				flipDurationMs: data.user.prefs.reduceMotion ? 0 : 150,
				delayTouchStart: true,
				dropTargetStyle: {}
			}}
			onconsider={handleKrConsider}
			onfinalize={handleKrFinalize}
			class="mt-3 flex flex-col gap-2"
			role="list"
			aria-label={goalCopy.keyResults}
		>
			{#each keyResults as kr (kr.id)}
				<KeyResultRow
					{kr}
					onpatch={(patch) => patchKeyResult(kr, patch)}
					ondelete={() => deleteKeyResult(kr)}
				/>
			{/each}
		</div>
	{/if}
	<form
		class="mt-3 flex flex-wrap items-end gap-2"
		onsubmit={(event) => {
			event.preventDefault();
			void addKeyResult();
		}}
	>
		<label class="flex min-w-40 flex-1 flex-col gap-1">
			<span class="text-xs font-semibold text-ink">{goalCopy.addKeyResult}</span>
			<input
				type="text"
				class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
				bind:value={krTitle}
				maxlength="140"
				required
			/>
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-xs font-semibold text-ink">{goalCopy.kindNumber} / {goalCopy.kindCheck}</span>
			<select
				class="rounded-lg border border-paper-dark bg-paper px-2 py-2 text-sm text-ink"
				bind:value={krKind}
			>
				<option value="number">{goalCopy.kindNumber}</option>
				<option value="check">{goalCopy.kindCheck}</option>
			</select>
		</label>
		{#if krKind === 'number'}
			<label class="flex w-24 flex-col gap-1">
				<span class="text-xs font-semibold text-ink">{goalCopy.targetValue}</span>
				<input
					type="number"
					class="rounded-lg border border-paper-dark bg-paper px-2 py-2 text-sm text-ink"
					bind:value={krTarget}
					inputmode="decimal"
				/>
			</label>
			<label class="flex w-24 flex-col gap-1">
				<span class="text-xs font-semibold text-ink">{goalCopy.unit}</span>
				<input
					type="text"
					class="rounded-lg border border-paper-dark bg-paper px-2 py-2 text-sm text-ink"
					bind:value={krUnit}
					maxlength="20"
				/>
			</label>
		{/if}
		<button
			type="submit"
			class="flex items-center gap-1 rounded-pill bg-butter px-4 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
			disabled={krTitle.trim() === ''}
		>
			<Plus size={15} strokeWidth={2} aria-hidden="true" />
			{goalCopy.addKeyResult}
		</button>
	</form>
</section>

<!-- Linked post-its -->
<section class="mt-8 max-w-2xl">
	<h2 class="text-lg font-bold text-ink">{goalCopy.linkedPostits}</h2>
	{#if postits.length === 0}
		<p class="mt-2 text-sm text-ink-soft">{goalCopy.noLinkedPostits}</p>
	{:else}
		<ul class="mt-3 flex flex-col gap-2" role="list">
			{#each postits as postit (postit.id)}
				<li
					class="flex items-center gap-2 rounded-card border border-paper-dark bg-paper px-3 py-2"
				>
					<button
						type="button"
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ink-soft transition-colors duration-fast {postit.doneAt !==
						null
							? 'border-transparent bg-mint'
							: 'hover:border-ink'}"
						aria-label={postit.doneAt !== null
							? copy.plans.actions.reopen
							: copy.plans.actions.markDone}
						aria-pressed={postit.doneAt !== null}
						onclick={() => togglePostit(postit)}
					>
						{#if postit.doneAt !== null}
							<Check size={14} strokeWidth={2.5} aria-hidden="true" />
						{/if}
					</button>
					<span
						class="min-w-0 flex-1 truncate text-sm font-semibold text-ink {postit.doneAt !==
						null
							? 'line-through opacity-60'
							: ''}"
					>
						{postit.title}
					</span>
					{#if postit.date}
						<span class="shrink-0 text-xs font-semibold text-ink-soft">
							{formatDe(postit.date, 'short')}
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if data.habits.length > 0}
	<section class="mt-8 max-w-2xl">
		<h2 class="text-lg font-bold text-ink">{goalCopy.linkedHabits}</h2>
		<ul class="mt-3 flex flex-wrap gap-2">
			{#each data.habits as habit (habit.id)}
				<li class="rounded-pill bg-mint/50 px-3 py-1.5 text-sm font-semibold text-ink">
					{#if habit.emoji}<span aria-hidden="true">{habit.emoji} </span>{/if}{habit.title}
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if editOpen}
	<GoalSheet
		{goal}
		busy={formBusy}
		error={formError}
		onclose={() => (editOpen = false)}
		onsubmit={submitGoalEdit}
	/>
{/if}
