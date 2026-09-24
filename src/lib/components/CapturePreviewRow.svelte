<script lang="ts">
	import { X } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';
	import type { CaptureItem } from '$lib/shared/schemas.js';

	// One editable preview row (SPEC 8.1): title, date and time are editable
	// before committing; goal/habit suggestions are shown as info chips; the
	// row can be removed. `item` is a $state proxy owned by the parent, so
	// edits propagate directly.
	let { item, onremove }: { item: CaptureItem; onremove: () => void } = $props();

	const uid = Math.random().toString(36).slice(2, 8);
	const titleId = `capture-title-${uid}`;
	const dateId = `capture-date-${uid}`;
	const timeId = `capture-time-${uid}`;
</script>

<li class="rounded-card border border-paper-dark bg-paper p-3 shadow-postit">
	<div class="flex items-start gap-2">
		<div class="flex min-w-0 flex-1 flex-col gap-2">
			<label class="flex flex-col gap-0.5" for={titleId}>
				<span class="text-xs font-semibold text-ink-soft">{copy.capture.rowTitle}</span>
				<input
					id={titleId}
					type="text"
					inputmode="text"
					maxlength="140"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={item.title}
				/>
			</label>
			<div class="flex flex-wrap gap-2">
				<label class="flex flex-col gap-0.5" for={dateId}>
					<span class="text-xs font-semibold text-ink-soft">{copy.capture.rowDate}</span>
					<input
						id={dateId}
						type="date"
						class="rounded-lg border border-paper-dark bg-paper px-3 py-1.5 text-sm text-ink"
						value={item.date ?? ''}
						oninput={(event) => {
							const value = event.currentTarget.value;
							item.date = value === '' ? null : value;
						}}
					/>
				</label>
				<label class="flex flex-col gap-0.5" for={timeId}>
					<span class="text-xs font-semibold text-ink-soft">{copy.capture.rowTime}</span>
					<input
						id={timeId}
						type="time"
						class="rounded-lg border border-paper-dark bg-paper px-3 py-1.5 text-sm text-ink"
						value={item.time ?? ''}
						oninput={(event) => {
							const value = event.currentTarget.value;
							item.time = value === '' ? null : value;
						}}
					/>
				</label>
			</div>
			{#if item.suggestedGoalTitle || item.suggestedHabit}
				<div class="flex flex-wrap gap-1.5 pt-0.5">
					{#if item.suggestedGoalTitle}
						<span
							class="rounded-pill bg-sky/60 px-2.5 py-0.5 text-xs font-semibold text-ink"
						>
							{copy.capture.goalChip(item.suggestedGoalTitle)}
						</span>
					{/if}
					{#if item.suggestedHabit}
						<span
							class="rounded-pill bg-mint/70 px-2.5 py-0.5 text-xs font-semibold text-ink"
						>
							{copy.capture.habitChip(item.suggestedHabit.title)}
						</span>
					{/if}
				</div>
			{/if}
		</div>
		<button
			type="button"
			class="mt-5 shrink-0 rounded-full p-1.5 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
			aria-label={copy.capture.removeRow}
			onclick={onremove}
		>
			<X size={18} strokeWidth={1.75} aria-hidden="true" />
		</button>
	</div>
</li>
