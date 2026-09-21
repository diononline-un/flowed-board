<script lang="ts">
	import { GripVertical, Trash2 } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';
	import { keyResultProgress } from '$lib/shared/progress.js';
	import type { PublicKeyResult } from '$lib/shared/types.js';

	// One key result, inline editable (SPEC 8.3): title, current value (or
	// check toggle), delete. Drag order comes from the parent dnd zone.
	let {
		kr,
		onpatch,
		ondelete
	}: {
		kr: PublicKeyResult;
		onpatch: (patch: { title?: string; currentValue?: number }) => void;
		ondelete: () => void;
	} = $props();

	const progress = $derived(
		keyResultProgress({
			kind: kr.kind,
			start_value: kr.startValue,
			target_value: kr.targetValue,
			current_value: kr.currentValue
		})
	);
	const percent = $derived(Math.round(progress * 100));

	// Local edit buffers, committed on blur/Enter (explicit user action).
	let titleDraft = $state(kr.title);
	let valueDraft = $state(String(kr.currentValue));

	function commitTitle() {
		const title = titleDraft.trim();
		if (title && title !== kr.title) onpatch({ title });
		else titleDraft = kr.title;
	}

	function commitValue() {
		const value = Number(valueDraft);
		if (Number.isFinite(value) && value !== kr.currentValue) {
			onpatch({ currentValue: value });
		} else {
			valueDraft = String(kr.currentValue);
		}
	}

	function toggleCheck() {
		onpatch({ currentValue: kr.currentValue >= 1 ? 0 : 1 });
	}
</script>

<div class="flex items-center gap-2 rounded-card border border-paper-dark bg-paper px-3 py-2">
	<span class="cursor-grab text-ink-soft" aria-hidden="true">
		<GripVertical size={16} strokeWidth={1.75} />
	</span>
	{#if kr.kind === 'check'}
		<button
			type="button"
			class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-ink-soft transition-colors duration-fast {kr.currentValue >=
			1
				? 'border-transparent bg-mint'
				: ''}"
			aria-pressed={kr.currentValue >= 1}
			aria-label={kr.title}
			onclick={toggleCheck}
		>
			{#if kr.currentValue >= 1}
				<span class="text-xs font-black text-ink">✓</span>
			{/if}
		</button>
	{/if}
	<input
		type="text"
		class="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold text-ink"
		bind:value={titleDraft}
		onblur={commitTitle}
		onkeydown={(event) => {
			if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
		}}
		aria-label={copy.plans.goal.keyResults}
	/>
	{#if kr.kind === 'number'}
		<span class="flex shrink-0 items-baseline gap-1 text-xs text-ink-soft">
			<input
				type="number"
				class="w-16 rounded-md border border-paper-dark bg-paper px-1.5 py-0.5 text-right text-xs font-bold text-ink"
				bind:value={valueDraft}
				onblur={commitValue}
				onkeydown={(event) => {
					if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
				}}
				aria-label={copy.plans.goal.currentValue}
			/>
			<span>/ {kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''}</span>
		</span>
		<span
			class="h-1.5 w-16 shrink-0 overflow-hidden rounded-pill bg-paper-dark"
			role="progressbar"
			aria-valuenow={percent}
			aria-valuemin={0}
			aria-valuemax={100}
		>
			<span class="block h-full rounded-pill bg-sky" style:width="{percent}%"></span>
		</span>
	{/if}
	<button
		type="button"
		class="shrink-0 rounded-full p-1 text-ink-soft transition-colors duration-fast hover:bg-blush/50 hover:text-ink"
		aria-label={copy.plans.goal.deleteKeyResult}
		onclick={ondelete}
	>
		<Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
	</button>
</div>
