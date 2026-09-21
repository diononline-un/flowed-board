<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';

	// Bottom sheet (SPEC 10.4): base for overlays that slide up on mobile and
	// center on larger screens. Focus trap + Escape + backdrop click close.
	let {
		title,
		onclose,
		children
	}: {
		title: string;
		onclose: () => void;
		children: Snippet;
	} = $props();

	let panelEl: HTMLElement | undefined = $state();
	const titleId = `sheet-title-${Math.random().toString(36).slice(2, 8)}`;

	$effect(() => {
		const el = panelEl;
		if (!el) return;
		const focusables = () =>
			Array.from(
				el.querySelectorAll<HTMLElement>(
					'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
				)
			);
		const firstInput = el.querySelector<HTMLElement>(
			'input:not([disabled]), textarea:not([disabled])'
		);
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
	class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:px-4"
	role="presentation"
	onclick={(event) => {
		if (event.target === event.currentTarget) onclose();
	}}
>
	<div
		bind:this={panelEl}
		role="dialog"
		aria-modal="true"
		aria-labelledby={titleId}
		class="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-card bg-paper p-6 shadow-postit sm:rounded-card"
	>
		<div class="mb-4 flex items-center justify-between gap-2">
			<h2 id={titleId} class="text-xl font-bold text-ink">{title}</h2>
			<button
				type="button"
				class="rounded-full p-1.5 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
				aria-label={copy.toast.close}
				onclick={onclose}
			>
				<X size={20} strokeWidth={1.75} aria-hidden="true" />
			</button>
		</div>
		{@render children()}
	</div>
</div>
