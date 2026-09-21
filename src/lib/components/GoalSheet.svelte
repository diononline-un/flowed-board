<script lang="ts" module>
	import type { GoalStatus, PostitColor } from '$lib/shared/types.js';

	// Payload collected by the form; the parent owns the API call.
	export interface GoalFormPayload {
		title: string;
		targetDate: string | null;
		note?: string | null;
		emoji?: string | null;
		color?: PostitColor;
		status?: GoalStatus;
	}
</script>

<script lang="ts">
	import { copy } from '$lib/shared/copy.js';
	import type { PublicGoal } from '$lib/shared/types.js';
	import Sheet from './Sheet.svelte';

	// Goal form sheet (SPEC 8.3): create mode asks only for a title and an
	// optional target date; edit mode additionally exposes note, emoji,
	// color and status.
	let {
		goal = null,
		busy = false,
		error = '',
		onclose,
		onsubmit
	}: {
		goal?: PublicGoal | null;
		busy?: boolean;
		error?: string;
		onclose: () => void;
		onsubmit: (payload: GoalFormPayload) => void;
	} = $props();

	const formCopy = copy.plans.form;
	const colorChoices = Object.entries(copy.plans.colors) as [PostitColor, string][];
	const statusChoices = Object.entries(copy.plans.goal.statuses) as [GoalStatus, string][];

	let title = $state(goal?.title ?? '');
	let targetDate = $state(goal?.targetDate ?? '');
	let note = $state(goal?.note ?? '');
	let emoji = $state(goal?.emoji ?? '');
	let color = $state<PostitColor>(goal?.color ?? 'butter');
	let status = $state<GoalStatus>(goal?.status ?? 'active');

	const sheetTitle = $derived(goal ? copy.plans.goal.editGoal : copy.plans.newGoal);

	function submit() {
		const trimmed = title.trim();
		if (!trimmed) return;
		onsubmit({
			title: trimmed,
			targetDate: targetDate === '' ? null : targetDate,
			...(goal
				? {
						note: note.trim() === '' ? null : note.trim(),
						emoji: emoji.trim() === '' ? null : emoji.trim(),
						color,
						status
					}
				: {})
		});
	}
</script>

<Sheet title={sheetTitle} {onclose}>
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
				maxlength="140"
				required
				placeholder={formCopy.goalTitlePlaceholder}
			/>
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-semibold text-ink">{formCopy.targetDate}</span>
			<input
				type="date"
				class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
				bind:value={targetDate}
			/>
		</label>
		{#if goal}
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{formCopy.note}</span>
				<textarea
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={note}
					rows="2"
					maxlength="2000"
					placeholder={formCopy.notePlaceholder}
				></textarea>
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
					<span class="text-sm font-semibold text-ink">{copy.plans.goal.status}</span>
					<select
						class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
						bind:value={status}
					>
						{#each statusChoices as [value, label] (value)}
							<option {value}>{label}</option>
						{/each}
					</select>
				</label>
			</div>
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
		{/if}
		{#if error}
			<p class="text-sm font-semibold text-ink" role="alert">{error}</p>
		{/if}
		<div class="mt-2 flex justify-end gap-2">
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
				class="rounded-pill bg-butter px-5 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
				disabled={busy || title.trim() === ''}
			>
				{goal ? formCopy.save : formCopy.create}
			</button>
		</div>
	</form>
</Sheet>
