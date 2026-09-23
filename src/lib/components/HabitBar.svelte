<script lang="ts">
	import ExampleChip from './ExampleChip.svelte';
	import { Ellipsis } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';
	import { formatDe } from '$lib/shared/date.js';
	import type { HabitProgress } from '$lib/shared/habit.js';
	import type { PublicHabit } from '$lib/shared/types.js';
	import HabitLogButton from './HabitLogButton.svelte';

	// Compact habit row (SPEC 8.4, 10.4): window progress, the SPEC 5.5
	// counter line ("Wochen/Monate geschafft", "Beste Woche: n" — never a
	// streak, never sinking) and the tap target for today. `range` habits add
	// the neutral pace line in sage/sand, never red.
	let {
		habit,
		progress,
		busy = false,
		onlog,
		onedit
	}: {
		habit: PublicHabit;
		progress: HabitProgress;
		busy?: boolean;
		onlog: (delta: 1 | -1) => void;
		onedit: () => void;
	} = $props();

	const percent = $derived(Math.round(progress.ratio * 100));
	// Sage marks good news (achieved / on plan), sand the neutral rest (P3).
	const tone = $derived(
		progress.pace === null || progress.pace.state === 'achieved'
			? 'sage'
			: progress.pace.state === 'onTrack'
				? 'sage'
				: 'sand'
	);

	const periodLabel = $derived(
		progress.periods.unit === 'month'
			? copy.calendar.periodsDone.month(progress.periods.completed)
			: habit.cadence === 'range'
				? copy.calendar.periodsDone.range(progress.periods.completed)
				: copy.calendar.periodsDone.week(progress.periods.completed)
	);
	const bestLabel = $derived(
		progress.periods.unit === 'month'
			? copy.calendar.bestMonth(progress.periods.best)
			: copy.calendar.bestWeek(progress.periods.best)
	);
	const paceText = $derived.by(() => {
		const pace = progress.pace;
		if (!pace) return null;
		if (pace.state === 'upcoming') {
			return copy.calendar.pace.upcoming(formatDe(habit.rangeStart ?? '', 'short'));
		}
		if (pace.state === 'achieved') return copy.calendar.pace.achieved;
		if (pace.state === 'expired') {
			return copy.calendar.pace.expired(progress.count, progress.target);
		}
		if (pace.state === 'onTrack') return copy.calendar.pace.onTrack;
		return copy.calendar.pace.behind(pace.remaining, pace.perWeek);
	});
</script>

<article
	class="rounded-card border border-paper-dark bg-paper p-3 shadow-postit"
	style:border-left-width="4px"
	style:border-left-color="var(--color-{tone})"
>
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				{#if habit.emoji}
					<span aria-hidden="true">{habit.emoji}</span>
				{/if}
				<h3 class="truncate text-sm font-bold text-ink">{habit.title}</h3>
				<span class="rounded-pill bg-paper-dark/70 px-2 py-0.5 text-xs font-semibold text-ink-soft">
					{copy.calendar.form.cadences[habit.cadence]}
				</span>
				{#if habit.isExample}
					<ExampleChip />
				{/if}
			</div>
			<p class="mt-1 text-sm font-semibold text-ink">
				{copy.calendar.progressCount(progress.count, progress.target)}
				<span class="text-xs font-semibold text-ink-soft">
					· {copy.calendar.windowLabel(formatDe(progress.window.from, 'dayMonth'), formatDe(progress.window.to, 'dayMonth'))}
				</span>
			</p>
			<div
				class="mt-1.5 h-2 w-full max-w-64 overflow-hidden rounded-pill bg-paper-dark"
				role="progressbar"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={percent}
				aria-label={copy.calendar.progressCount(progress.count, progress.target)}
			>
				<div
					class="h-full rounded-pill transition-[width] duration-base"
					style:width="{percent}%"
					style:background-color="var(--color-{habit.color})"
				></div>
			</div>
			<p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-ink-soft">
				<span>{periodLabel}</span>
				<span aria-hidden="true">·</span>
				<span>{bestLabel}</span>
			</p>
			{#if paceText}
				<p class="mt-1 text-xs font-bold {tone === 'sage' ? 'text-sage' : 'text-ink-soft'}">
					{paceText}
				</p>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<div class="flex flex-col items-end gap-1">
				<HabitLogButton
					{habit}
					todayCount={progress.todayCount}
					busy={busy}
					onlog={(delta) => onlog(delta)}
				/>
				{#if !progress.canLogToday}
					<p class="text-xs font-semibold text-ink-soft">{copy.calendar.log.limitReached}</p>
				{/if}
			</div>
			<button
				type="button"
				class="rounded-full p-1.5 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
				aria-label="{habit.title}: {copy.calendar.openMenu}"
				onclick={onedit}
			>
				<Ellipsis size={18} strokeWidth={1.75} aria-hidden="true" />
			</button>
		</div>
	</div>
</article>
