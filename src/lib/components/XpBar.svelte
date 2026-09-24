<script lang="ts">
	import { copy } from '$lib/shared/copy.js';
	import { xpProgress } from '$lib/shared/xp.js';

	// XP bar with level name and the XP left in the current level (SPEC 5.6,
	// 10.4). The bar spans the width of the current level (`bandWidth`), not the
	// cumulative threshold, so it really reaches 100 % at the level end. The
	// parent only renders it when `prefs.gamification` is on.
	let { total, compact = false }: { total: number; compact?: boolean } = $props();

	const progress = $derived(xpProgress(total));
</script>

<div class="flex flex-col gap-1.5">
	<div class="flex items-baseline justify-between gap-2 text-xs font-semibold text-ink">
		<span>{copy.gamification.levelLabel(progress.level, progress.name)}</span>
		<span class="text-ink-soft">{copy.gamification.xpLabel(progress.total)}</span>
	</div>
	<div
		class="h-2 w-full overflow-hidden rounded-pill bg-paper-dark"
		role="progressbar"
		aria-valuemin="0"
		aria-valuemax={progress.bandWidth}
		aria-valuenow={progress.intoLevel}
		aria-label={copy.gamification.title}
	>
		<div
			class="h-full rounded-pill bg-lilac transition-[width] duration-base"
			style:width="{Math.round(progress.ratio * 100)}%"
		></div>
	</div>
	{#if !compact}
		<p class="text-xs text-ink-soft">{copy.gamification.toNext(progress.toNextLevel)}</p>
	{/if}
</div>
