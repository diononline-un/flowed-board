<script lang="ts">
	import ExampleChip from './ExampleChip.svelte';
	import { ChevronRight } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';
	import type { PublicGoal } from '$lib/shared/types.js';

	// Compact goal card for the horizontal filter strip above the board
	// (SPEC 8.2): the main button toggles the board filter, the corner link
	// opens the goal detail page (SPEC 8.3).
	let {
		goal,
		progress,
		selected = false,
		onselect
	}: {
		goal: PublicGoal;
		progress: number;
		selected?: boolean;
		onselect: () => void;
	} = $props();

	const percent = $derived(Math.round(progress * 100));
</script>

<div
	class="relative w-44 shrink-0 rounded-card border bg-paper shadow-postit transition-transform duration-fast hover:scale-[1.02] {selected
		? 'border-ink'
		: 'border-paper-dark'}"
>
	<button
		type="button"
		class="flex w-full flex-col gap-1.5 px-3 py-2.5 pr-8 text-left"
		aria-pressed={selected}
		onclick={onselect}
	>
		<span class="flex items-center gap-2">
			<span
				class="h-3 w-3 shrink-0 rounded-full"
				style:background-color="var(--color-{goal.color})"
				aria-hidden="true"
			></span>
			<span class="truncate text-sm font-bold text-ink">
				{#if goal.emoji}<span aria-hidden="true">{goal.emoji} </span>{/if}{goal.title}
			</span>
			{#if goal.isExample}
				<ExampleChip />
			{/if}
		</span>
		<span
			class="h-1.5 w-full overflow-hidden rounded-pill bg-paper-dark"
			role="progressbar"
			aria-valuenow={percent}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label={copy.plans.goalProgress(percent)}
		>
			<span
				class="block h-full rounded-pill"
				style:background-color="var(--color-{goal.color})"
				style:width="{percent}%"
			></span>
		</span>
	</button>
	<a
		href="/plans/goals/{goal.id}"
		class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-1.5 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
		aria-label={copy.plans.goal.open}
	>
		<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
	</a>
</div>
