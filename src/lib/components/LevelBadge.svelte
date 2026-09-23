<script lang="ts">
	import { copy } from '$lib/shared/copy.js';
	import { xpProgress } from '$lib/shared/xp.js';

	// Small level chip for the sidebar and the settings header (SPEC 5.6,
	// 10.4). Additive only: it shows the level, never a rank or a comparison.
	let { total, showName = false }: { total: number; showName?: boolean } = $props();

	const progress = $derived(xpProgress(total));
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-pill bg-lilac/60 px-2.5 py-1 text-xs font-bold text-ink"
	title={copy.gamification.levelLabel(progress.level, progress.name)}
>
	<span aria-hidden="true">☕</span>
	<span>{copy.gamification.levelShort(progress.level)}</span>
	{#if showName}
		<span class="font-semibold">· {progress.name}</span>
	{/if}
</span>
