<script lang="ts">
	// Friendly empty state (no guilt, no red — SPEC 1.3 P3).
	let { title, hint = '' }: { title: string; hint?: string } = $props();
</script>

<div
	class="mt-8 flex flex-col items-center gap-2 rounded-card border border-paper-dark bg-paper-dark/40 px-6 py-12 text-center"
>
	<p class="text-lg font-bold text-ink">{title}</p>
	{#if hint}
		<p class="font-hand text-2xl text-ink-soft">{hint}</p>
	{/if}
</div>
