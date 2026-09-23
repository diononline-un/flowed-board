<script lang="ts" module>
	import type { HabitCadence, PostitColor } from '$lib/shared/types.js';

	// Payload collected by the form; the parent owns the API call.
	export interface HabitFormPayload {
		title: string;
		emoji: string | null;
		color: PostitColor;
		cadence: HabitCadence;
		targetCount: number;
		rangeStart: string | null;
		rangeEnd: string | null;
		maxPerDay: number;
		goalId: string | null;
	}
</script>

<script lang="ts">
	import { copy } from '$lib/shared/copy.js';
	import { todayIn } from '$lib/shared/date.js';
	import type { PublicGoal, PublicHabit } from '$lib/shared/types.js';
	import Sheet from './Sheet.svelte';

	// Create/edit form for a habit (SPEC 8.4): title, emoji, color, cadence
	// (week/month/range with start+end), target 1–10000, max per day 1–20 and
	// an optional goal link. Archive and delete live here too.
	let {
		habit = null,
		goals,
		tz,
		busy = false,
		error = '',
		onclose,
		onsubmit,
		onarchive,
		ondelete
	}: {
		habit?: PublicHabit | null;
		goals: PublicGoal[];
		tz: string;
		busy?: boolean;
		error?: string;
		onclose: () => void;
		onsubmit: (payload: HabitFormPayload) => void;
		onarchive?: () => void;
		ondelete?: () => void;
	} = $props();

	const formCopy = copy.calendar.form;
	const cadences: HabitCadence[] = ['week', 'month', 'range'];
	// The post-it palette is the only color source (SPEC 10.1).
	const colorChoices = Object.entries(copy.plans.colors) as [PostitColor, string][];

	const today = todayIn(tz);

	let title = $state(habit?.title ?? '');
	let emoji = $state(habit?.emoji ?? '');
	let color = $state<PostitColor>(habit?.color ?? 'mint');
	let cadence = $state<HabitCadence>(habit?.cadence ?? 'week');
	let targetCount = $state(String(habit?.targetCount ?? 3));
	let rangeStart = $state(habit?.rangeStart ?? today);
	let rangeEnd = $state(habit?.rangeEnd ?? '');
	let maxPerDay = $state(String(habit?.maxPerDay ?? 1));
	let goalId = $state(habit?.goalId ?? '');

	const targetError = $derived.by(() => {
		const value = Number(targetCount);
		return Number.isInteger(value) && value >= 1 && value <= 10000
			? ''
			: copy.calendar.errors.targetInvalid;
	});
	const maxError = $derived.by(() => {
		const value = Number(maxPerDay);
		return Number.isInteger(value) && value >= 1 && value <= 20
			? ''
			: copy.calendar.errors.maxPerDayInvalid;
	});
	const rangeError = $derived(
		cadence !== 'range' || (rangeStart !== '' && rangeEnd !== '' && rangeEnd >= rangeStart)
			? ''
			: copy.calendar.errors.rangeRequired
	);

	function submit() {
		const trimmed = title.trim();
		if (!trimmed || targetError || maxError || rangeError) return;
		onsubmit({
			title: trimmed,
			emoji: emoji.trim() === '' ? null : emoji.trim(),
			color,
			cadence,
			targetCount: Number(targetCount),
			rangeStart: cadence === 'range' ? rangeStart : null,
			rangeEnd: cadence === 'range' ? rangeEnd : null,
			maxPerDay: Number(maxPerDay),
			goalId: goalId === '' ? null : goalId
		});
	}
</script>

<Sheet title={habit ? copy.calendar.editHabit : copy.calendar.newHabit} {onclose}>
	<form
		class="flex flex-col gap-3"
		onsubmit={(event) => {
			event.preventDefault();
			submit();
		}}
	>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-semibold text-ink">{formCopy.title}</span>
			<input
				type="text"
				class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
				bind:value={title}
				maxlength="80"
				required
				placeholder={formCopy.titlePlaceholder}
			/>
		</label>
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{formCopy.emoji}</span>
				<input
					type="text"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={emoji}
					maxlength="8"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{formCopy.cadence}</span>
				<select
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={cadence}
				>
					{#each cadences as option (option)}
						<option value={option}>{formCopy.cadences[option]}</option>
					{/each}
				</select>
			</label>
		</div>
		{#if cadence === 'range'}
			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1">
					<span class="text-sm font-semibold text-ink">{formCopy.rangeStart}</span>
					<input
						type="date"
						class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
						bind:value={rangeStart}
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-sm font-semibold text-ink">{formCopy.rangeEnd}</span>
					<input
						type="date"
						class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
						bind:value={rangeEnd}
					/>
				</label>
			</div>
		{/if}
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{formCopy.targetCount}</span>
				<input
					type="number"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={targetCount}
					min="1"
					max="10000"
					inputmode="numeric"
					aria-describedby={targetError ? 'habit-target-error' : undefined}
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{formCopy.maxPerDay}</span>
				<input
					type="number"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={maxPerDay}
					min="1"
					max="20"
					inputmode="numeric"
					aria-describedby={maxError ? 'habit-max-error' : undefined}
				/>
			</label>
		</div>
		{#if targetError}
			<p id="habit-target-error" class="text-xs font-semibold text-ink">{targetError}</p>
		{/if}
		{#if maxError}
			<p id="habit-max-error" class="text-xs font-semibold text-ink">{maxError}</p>
		{/if}
		{#if rangeError}
			<p class="text-xs font-semibold text-ink">{rangeError}</p>
		{/if}
		<label class="flex flex-col gap-1">
			<span class="text-sm font-semibold text-ink">{formCopy.goal}</span>
			<select
				class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
				bind:value={goalId}
			>
				<option value="">{formCopy.noGoal}</option>
				{#each goals as goal (goal.id)}
					<option value={goal.id}>{goal.title}</option>
				{/each}
			</select>
		</label>
		<fieldset>
			<legend class="text-sm font-semibold text-ink">{formCopy.color}</legend>
			<div class="mt-1.5 flex flex-wrap gap-1.5">
				{#each colorChoices as [value, label] (value)}
					<button
						type="button"
						class="flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold transition-transform duration-fast hover:scale-[1.02] {color ===
						value
							? 'border-ink text-ink'
							: 'border-paper-dark text-ink-soft'}"
						aria-pressed={color === value}
						onclick={() => (color = value)}
					>
						<span
							class="h-3 w-3 rounded-full"
							style:background-color="var(--color-{value})"
							aria-hidden="true"
						></span>
						{label}
					</button>
				{/each}
			</div>
		</fieldset>
		{#if error}
			<p class="text-sm font-semibold text-ink" role="alert">{error}</p>
		{/if}
		<div class="mt-2 flex flex-wrap items-center justify-end gap-2">
			{#if habit && ondelete}
				<button
					type="button"
					class="mr-auto rounded-pill px-3 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink disabled:opacity-50"
					disabled={busy}
					onclick={ondelete}
				>
					{copy.calendar.deleteHabit}
				</button>
			{/if}
			{#if habit && onarchive}
				<button
					type="button"
					class="rounded-pill px-3 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink disabled:opacity-50"
					disabled={busy}
					onclick={onarchive}
				>
					{habit.archivedAt ? copy.calendar.unarchive : copy.calendar.archive}
				</button>
			{/if}
			<button
				type="button"
				class="rounded-pill px-4 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink disabled:opacity-50"
				onclick={onclose}
				disabled={busy}
			>
				{formCopy.cancel}
			</button>
			<button
				type="submit"
				class="rounded-pill bg-mint px-5 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
				disabled={busy || title.trim() === '' || Boolean(targetError || maxError || rangeError)}
			>
				{habit ? formCopy.save : formCopy.create}
			</button>
		</div>
		{#if habit}
			<p class="mt-1 text-right text-xs text-ink-soft">{formCopy.deleteHint}</p>
		{/if}
	</form>
</Sheet>
