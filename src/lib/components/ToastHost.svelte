<script lang="ts">
	import Toast from './Toast.svelte';
	import { toastStore } from '$lib/state/toasts.svelte.js';

	// Fixed toast stack (SPEC 10.4): bottom center, above the mobile tab bar.
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6"
	aria-live="polite"
>
	{#each toastStore.items as toast (toast.id)}
		<Toast {toast} />
	{/each}
</div>
