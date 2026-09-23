<script lang="ts">
	import { Check, Minus, Plus } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';
	import type { PublicHabit } from '$lib/shared/types.js';

	// Tap target for "today" (SPEC 8.4, AC11): one tap per log, disabled once
	// max_per_day is reached — then with the hint "Maximum für heute
	// erreicht". The parent performs the optimistic update and the rollback.
	let {
		habit,
		todayCount,
		disabled = false,
		busy = false,
		onlog
	}: {
		habit: PublicHabit;
		todayCount: number;
		disabled?: boolean;
		busy?: boolean;
		onlog: (delta: 1 | -1) => void;
	} = $props();

	const reachedMax = $derived(todayCount >= habit.maxPerDay);
</script>

<div class="flex items-center gap-1.5">
	<button
		type="button"
		class="flex items-center gap-1 rounded-pill px-3 py-2 text-sm font-bold shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 {reachedMax
			? 'bg-paper-dark text-ink-soft'
			: 'bg-sage text-ink'}"
		disabled={disabled || busy || reachedMax}
		aria-label={reachedMax
			? `${habit.title}: ${copy.calendar.log.limitReached}`
			: `${habit.title}: ${copy.calendar.log.add}`}
		onclick={() => onlog(1)}
	>
		{#if reachedMax}
			<Check size={15} strokeWidth={2} aria-hidden="true" />
		{:else}
			<Plus size={15} strokeWidth={2} aria-hidden="true" />
		{/if}
		<span>{habit.maxPerDay > 1 ? copy.calendar.log.count(todayCount) : copy.calendar.log.add}</span>
	</button>
	{#if todayCount > 0}
		<button
			type="button"
			class="rounded-full p-1.5 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink disabled:opacity-50"
			disabled={disabled || busy}
			aria-label={copy.calendar.log.remove}
			title={copy.calendar.log.remove}
			onclick={() => onlog(-1)}
		>
			<Minus size={16} strokeWidth={1.75} aria-hidden="true" />
		</button>
	{/if}
</div>
