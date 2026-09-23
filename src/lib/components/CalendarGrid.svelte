<script lang="ts">
	import { copy } from '$lib/shared/copy.js';
	import { weekdayOf } from '$lib/shared/date.js';
	import type { PublicPostit } from '$lib/shared/types.js';

	// Calendar grid (SPEC 8.4, 10.4): week (7 columns from the user's
	// week_start, horizontally scrollable on mobile) and month view. A day
	// cell shows at most three post-its sorted by time plus a "+n mehr"
	// button; done post-its are struck through (SPEC 5.3).
	let {
		days,
		weekStartDay,
		view,
		today,
		postitsByDay,
		onexpandday,
		oneditpostit
	}: {
		days: string[];
		weekStartDay: 0 | 1 | 6;
		view: 'week' | 'month';
		today: string;
		postitsByDay: Map<string, PublicPostit[]>;
		onexpandday: (day: string) => void;
		oneditpostit: (postit: PublicPostit) => void;
	} = $props();

	const MAX_VISIBLE = 3;

	// Column headers follow the user's week start (SPEC 5.1 week_start).
	// 2026-09-21 is a Monday, so the seven reference days are stable.
	const weekdayLabels = $derived(
		Array.from({ length: 7 }, (_, index) => {
			const offset = (weekStartDay - 1 + index + 7) % 7;
			const reference = new Date(Date.UTC(2026, 8, 21 + offset, 12));
			return new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'short' }).format(
				reference
			);
		})
	);

	// Month cells are padded to whole weeks so the grid stays readable.
	const leadingBlanks = $derived(
		view === 'week' ? 0 : (weekdayOf(days[0] ?? today) - weekStartDay + 7) % 7
	);

	function dayNumber(day: string): string {
		return String(Number(day.slice(8, 10)));
	}

	function dayLabel(day: string): string {
		return new Intl.DateTimeFormat('de-DE', {
			timeZone: 'UTC',
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		}).format(new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12)));
	}

	function visible(postits: PublicPostit[]): PublicPostit[] {
		return postits.slice(0, MAX_VISIBLE);
	}
</script>

<div class="overflow-x-auto pb-2">
	<div class="min-w-[42rem]">
		{#if view === 'week'}
			<div class="mb-1.5 grid grid-cols-7 gap-2">
				{#each weekdayLabels as label, index (index)}
					<p class="text-xs font-bold text-ink-soft">{label}</p>
				{/each}
			</div>
		{/if}
		<div class="grid grid-cols-7 gap-2" role="list">
			{#each Array(leadingBlanks) as _, index (index)}
				<div aria-hidden="true"></div>
			{/each}
			{#each days as day (day)}
				{@const dayPostits = postitsByDay.get(day) ?? []}
				{@const hidden = dayPostits.length - MAX_VISIBLE}
				<div
					role="listitem"
					aria-label={copy.calendar.dayPostits(dayLabel(day))}
					class="min-h-24 rounded-card border p-1.5 {day === today
						? 'border-ink bg-butter/30'
						: 'border-paper-dark bg-paper'}"
				>
					<p class="mb-1 text-xs font-bold {day === today ? 'text-ink' : 'text-ink-soft'}">
						{dayNumber(day)}
					</p>
					<div class="flex flex-col gap-1">
						{#each visible(dayPostits) as postit (postit.id)}
							<button
								type="button"
								class="w-full rounded-lg border border-paper-dark/70 bg-paper-dark/40 px-1.5 py-1 text-left text-[0.7rem] leading-snug font-semibold text-ink transition-colors duration-fast hover:bg-paper-dark {postit.doneAt
									? 'line-through opacity-60'
									: ''}"
								onclick={() => oneditpostit(postit)}
							>
								<span class="flex items-start gap-1">
									<span
										class="mt-1 h-2 w-2 shrink-0 rounded-full"
										style:background-color="var(--color-{postit.color ?? 'butter'})"
										aria-hidden="true"
									></span>
									<span class="min-w-0 flex-1">
										{#if postit.time}<span class="text-ink-soft">{postit.time} </span>{/if}{postit.title}
									</span>
								</span>
							</button>
						{/each}
						{#if hidden > 0}
							<button
								type="button"
								class="rounded-lg px-1.5 py-0.5 text-left text-[0.7rem] font-bold text-ink-soft transition-colors duration-fast hover:text-ink"
								onclick={() => onexpandday(day)}
							>
								{copy.calendar.moreInDay(hidden)}
							</button>
						{/if}
						{#if dayPostits.length === 0 && view === 'month'}
							<p class="px-0.5 text-[0.7rem] text-ink-soft/70">{copy.calendar.dayEmpty}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
