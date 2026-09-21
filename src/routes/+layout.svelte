<script lang="ts">
	import type { Snippet } from 'svelte';
	import { copy } from '$lib/shared/copy.js';
	import '../app.css';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<title>{copy.appName}</title>
</svelte:head>

{@render children()}
