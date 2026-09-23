<script lang="ts">
	import { BADGE_DEFINITIONS } from '$lib/shared/badges.js';
	import { copy } from '$lib/shared/copy.js';
	import { formatDe } from '$lib/shared/date.js';

	// Badge grid (SPEC 5.6, 10.4). Every badge of the catalogue is shown; the
	// earned ones carry their date, the open ones stay visible as a "not yet"
	// hint. Additive only: nothing here ranks users against each other (P7).
	let {
		earned
	}: {
		// id -> earnedAt (ISO) for the badges the user owns.
		earned: Record<string, string>;
	} = $props();

	const badges = $derived(
		BADGE_DEFINITIONS.map((badge) => ({
			...badge,
			earnedAt: earned[badge.id] ?? null
		}))
	);
</script>

<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
	{#each badges as badge (badge.id)}
		<li
			class="flex flex-col items-center gap-1 rounded-card border px-3 py-4 text-center {badge.earnedAt
				? 'border-lilac bg-lilac/30'
				: 'border-paper-dark bg-paper opacity-70'}"
		>
			<span class="text-2xl" aria-hidden="true">{badge.emoji}</span>
			<span class="text-sm font-bold text-ink">{badge.name}</span>
			<span class="text-xs text-ink-soft">{badge.description}</span>
			<span class="mt-1 text-[0.7rem] font-semibold text-ink-soft">
				{#if badge.earnedAt}
					{copy.gamification.badgeEarnedOn(formatDe(badge.earnedAt.slice(0, 10)))}
				{:else}
					{copy.gamification.badgeOpen}
				{/if}
			</span>
			<span class="sr-only">
				{badge.earnedAt ? copy.gamification.badgeEarned : copy.gamification.badgeOpen}
			</span>
		</li>
	{/each}
</ul>
