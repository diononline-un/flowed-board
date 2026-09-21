<script lang="ts">
	import { X } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';
	import { dismissToast, type ToastItem } from '$lib/state/toasts.svelte.js';

	// Single toast (SPEC 10.4): message, optional action (e.g. undo), close.
	let { toast }: { toast: ToastItem } = $props();

	let actionBusy = $state(false);

	async function runAction() {
		if (!toast.action || actionBusy) return;
		actionBusy = true;
		try {
			await toast.action.run();
		} finally {
			dismissToast(toast.id);
		}
	}
</script>

<div
	role="status"
	class="pointer-events-auto flex items-center gap-3 rounded-pill bg-ink px-4 py-2.5 text-sm font-semibold text-paper shadow-postit"
>
	<span>{toast.message}</span>
	{#if toast.action}
		<button
			type="button"
			class="rounded-pill bg-butter px-3 py-1 text-xs font-bold text-ink transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
			onclick={runAction}
			disabled={actionBusy}
		>
			{toast.action.label}
		</button>
	{/if}
	<button
		type="button"
		class="text-paper/70 transition-colors duration-fast hover:text-paper"
		aria-label={copy.toast.close}
		onclick={() => dismissToast(toast.id)}
	>
		<X size={16} strokeWidth={1.75} aria-hidden="true" />
	</button>
</div>
