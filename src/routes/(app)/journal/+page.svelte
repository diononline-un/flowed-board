<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { copy } from '$lib/shared/copy.js';
</script>

<svelte:head>
	<title>{copy.journal.title} · {copy.appName}</title>
</svelte:head>

<h1 class="text-3xl font-bold">{copy.journal.title}</h1>
<EmptyState title={copy.journal.emptyTitle} hint={copy.journal.emptyHint} />
