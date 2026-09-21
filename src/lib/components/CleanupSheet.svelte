<script lang="ts">
	import { copy } from '$lib/shared/copy.js';
	import { formatDe } from '$lib/shared/date.js';
	import type { PostitCleanupInput } from '$lib/shared/schemas.js';
	import type { PublicPostit } from '$lib/shared/types.js';
	import Sheet from './Sheet.svelte';

	// Aufräumen sheet (SPEC 8.2): multi-select over the overdue post-its and
	// four batch actions — today, one week later, done, delete.
	let {
		postits,
		busy = false,
		onclose,
		onapply
	}: {
		postits: PublicPostit[];
		busy?: boolean;
		onclose: () => void;
		onapply: (ids: string[], action: PostitCleanupInput['action']) => void;
	} = $props();

	let selected = $state<Set<string>>(new Set(postits.map((postit) => postit.id)));

	const allSelected = $derived(postits.length > 0 && selected.size === postits.length);

	function toggle(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function toggleAll() {
		selected = allSelected ? new Set() : new Set(postits.map((postit) => postit.id));
	}

	const actions: { key: PostitCleanupInput['action']; label: string }[] = [
		{ key: 'today', label: copy.plans.cleanupActions.today },
		{ key: 'plusWeek', label: copy.plans.cleanupActions.plusWeek },
		{ key: 'done', label: copy.plans.cleanupActions.done },
		{ key: 'delete', label: copy.plans.cleanupActions.delete }
	];
</script>

<Sheet title={copy.plans.cleanupTitle} {onclose}>
	<p class="text-sm text-ink-soft">{copy.plans.cleanupHint}</p>

	<label class="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
		<input
			type="checkbox"
			class="h-4 w-4 accent-[#3A2E22]"
			checked={allSelected}
			onchange={toggleAll}
		/>
		{copy.plans.cleanupSelectAll}
	</label>

	<ul class="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
		{#each postits as postit (postit.id)}
			<li>
				<label
					class="flex items-center gap-2 rounded-lg border border-paper-dark bg-paper px-3 py-2"
				>
					<input
						type="checkbox"
						class="h-4 w-4 shrink-0 accent-[#3A2E22]"
						checked={selected.has(postit.id)}
						onchange={() => toggle(postit.id)}
					/>
					<span class="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
						{postit.title}
					</span>
					{#if postit.date}
						<span class="shrink-0 text-xs font-semibold text-ink-soft">
							{formatDe(postit.date, 'short')}
						</span>
					{/if}
				</label>
			</li>
		{/each}
	</ul>

	<div class="mt-5 grid grid-cols-2 gap-2">
		{#each actions as action (action.key)}
			<button
				type="button"
				class="rounded-pill px-4 py-2.5 text-sm font-bold shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50 {action.key ===
				'delete'
					? 'bg-blush text-ink'
					: 'bg-butter text-ink'}"
				disabled={busy || selected.size === 0}
				onclick={() => onapply([...selected], action.key)}
			>
				{action.label}
			</button>
		{/each}
	</div>
</Sheet>
