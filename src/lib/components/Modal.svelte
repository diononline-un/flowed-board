<script lang="ts">
	import type { Snippet } from 'svelte';
	import { copy } from '$lib/shared/copy.js';

	// Centered modal (SPEC 10.4) for small, focused choices (date picker,
	// goal assignment). Focus trap + Escape + backdrop click close.
	let {
		title,
		onclose,
		children
	}: {
		title: string;
		onclose: () => void;
		children: Snippet;
	} = $props();

	let dialogEl: HTMLElement | undefined = $state();
	const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		const focusables = () =>
			Array.from(
				el.querySelectorAll<HTMLElement>(
					'input:not([disabled]), select:not([disabled]), button:not([disabled])'
				)
			);
		const firstInput = el.querySelector<HTMLElement>('input:not([disabled])');
		(firstInput ?? focusables()[0])?.focus();

		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.preventDefault();
				onclose();
				return;
			}
			if (event.key !== 'Tab') return;
			const items = focusables();
			if (items.length === 0) return;
			const first = items[0]!;
			const last = items[items.length - 1]!;
			const active = document.activeElement;
			if (event.shiftKey && (active === first || !el!.contains(active))) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		}
		document.addEventListener('keydown', onKeydown);
		return () => document.removeEventListener('keydown', onKeydown);
	});
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
	role="presentation"
	onclick={(event) => {
		if (event.target === event.currentTarget) onclose();
	}}
>
	<div
		bind:this={dialogEl}
		role="dialog"
		aria-modal="true"
		aria-labelledby={titleId}
		class="w-full max-w-sm rounded-card bg-paper p-6 shadow-postit"
	>
		<h2 id={titleId} class="text-xl font-bold text-ink">{title}</h2>
		<div class="mt-4">{@render children()}</div>
		<div class="mt-6 flex justify-end">
			<button
				type="button"
				class="rounded-pill px-4 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
				onclick={onclose}
			>
				{copy.plans.form.cancel}
			</button>
		</div>
	</div>
</div>
