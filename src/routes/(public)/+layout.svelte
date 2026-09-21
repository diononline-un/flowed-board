<script lang="ts">
	import type { Snippet } from 'svelte';

	// Public pages (login, register, recover, legal — content arrives with M1).
	// Centered, calm frame without app navigation.
	let { children }: { children: Snippet } = $props();
</script>

<div class="flex min-h-dvh items-center justify-center px-4 py-10">
	<div class="w-full max-w-md">
		{@render children()}
	</div>
</div>
