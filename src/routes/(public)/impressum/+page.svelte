<script lang="ts">
	import { copy } from '$lib/shared/copy.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{copy.legal.impressumTitle} · {copy.appName}</title>
</svelte:head>

<article class="rounded-card border border-paper-dark bg-paper p-6 shadow-postit">
	<div class="flex items-center gap-3">
		<h1 class="text-2xl font-bold text-ink">{copy.legal.impressumTitle}</h1>
		<span class="rounded-pill bg-sand px-3 py-1 text-xs font-bold text-ink">
			⚠ {copy.legal.placeholderBadge}
		</span>
	</div>
	<p class="mt-3 rounded-lg bg-sand/40 px-4 py-3 text-sm leading-relaxed text-ink">
		{data.doc.placeholderNotice}
	</p>

	{#each data.doc.sections as section (section.heading)}
		<section class="mt-6">
			<h2 class="text-lg font-bold text-ink">{section.heading}</h2>
			{#each section.paragraphs as paragraph, index (index)}
				<p class="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-soft">
					{paragraph}
				</p>
			{/each}
		</section>
	{/each}
</article>
