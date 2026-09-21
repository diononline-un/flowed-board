<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { copy } from '$lib/shared/copy.js';

	// Public pages (login, register, recover, legal): calm centered frame
	// without app navigation. Footer links the legal pages (SPEC 12).
	let { children }: { children: Snippet } = $props();

	const isLegal = $derived(
		page.url.pathname === '/impressum' || page.url.pathname === '/datenschutz'
	);
</script>

<div class="flex min-h-dvh flex-col">
	<header class="flex items-center justify-center px-4 pt-8">
		<a href="/" class="flex items-center gap-2 font-hand text-3xl font-bold text-ink">
			<span
				aria-hidden="true"
				class="inline-block h-7 w-7 rounded-md bg-butter shadow-postit"
			></span>
			{copy.appName}
		</a>
	</header>
	<main class="flex flex-1 items-start justify-center px-4 py-10">
		<div class="w-full {isLegal ? 'max-w-2xl' : 'max-w-md'}">
			{@render children()}
		</div>
	</main>
	<footer class="flex items-center justify-center gap-4 px-4 pb-6 text-sm text-ink-soft">
		<a class="underline-offset-2 hover:underline" href="/impressum">
			{copy.legal.impressumTitle}
		</a>
		<span aria-hidden="true">·</span>
		<a class="underline-offset-2 hover:underline" href="/datenschutz">
			{copy.legal.datenschutzTitle}
		</a>
	</footer>
</div>
