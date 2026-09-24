<script lang="ts">
	import type { Snippet } from 'svelte';
	import { copy } from '$lib/shared/copy.js';

	// Confirmation dialog (SPEC 10.4): only used where P5 allows it
	// (account deletion, password change). Focus trap + Escape handling.
	let {
		title,
		text = '',
		confirmLabel,
		danger = false,
		busy = false,
		onconfirm,
		oncancel,
		children
	}: {
		title: string;
		text?: string;
		confirmLabel: string;
		danger?: boolean;
		busy?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
		children?: Snippet;
	} = $props();

	let dialogEl: HTMLElement | undefined = $state();

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		const focusables = () =>
			Array.from(
				el.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])')
			);
		const firstInput = el.querySelector<HTMLElement>('input:not([disabled])');
		(firstInput ?? focusables()[0])?.focus();

		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.preventDefault();
				oncancel();
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
		if (event.target === event.currentTarget) oncancel();
	}}
>
	<div
		bind:this={dialogEl}
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="confirm-dialog-title"
		class="w-full max-w-sm rounded-card bg-paper p-6 shadow-postit"
	>
		<h2 id="confirm-dialog-title" class="text-xl font-bold text-ink">{title}</h2>
		{#if text}
			<p class="mt-2 text-sm text-ink-soft">{text}</p>
		{/if}
		{#if children}
			<div class="mt-4 flex flex-col gap-3">{@render children()}</div>
		{/if}
		<div class="mt-6 flex justify-end gap-2">
			<button
				type="button"
				class="rounded-pill px-4 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink disabled:opacity-50"
				onclick={oncancel}
				disabled={busy}
			>
				{copy.settings.account.cancel}
			</button>
			<button
				type="button"
				class="rounded-pill px-4 py-2 text-sm font-bold shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50 {danger
					? 'bg-blush text-ink'
					: 'bg-butter text-ink'}"
				onclick={onconfirm}
				disabled={busy}
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</div>
