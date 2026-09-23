<script lang="ts" module>
	import type { PostitColor } from '$lib/shared/types.js';

	// Payload collected by the form; the parent owns the API call.
	export interface PostitFormPayload {
		title: string;
		note: string | null;
		date: string | null;
		time: string | null;
		durationMin: number | null;
		goalId: string | null;
		color: PostitColor | null;
	}
</script>

<script lang="ts">
	import { copy } from '$lib/shared/copy.js';
	import type { PublicGoal, PublicPostit } from '$lib/shared/types.js';
	import Sheet from './Sheet.svelte';

	// Create/edit form for a post-it (SPEC 8.2 menu "Bearbeiten" + board
	// "Neues Post-it").
	let {
		postit = null,
		goals,
		busy = false,
		error = '',
		onclose,
		onsubmit
	}: {
		postit?: PublicPostit | null;
		goals: PublicGoal[];
		busy?: boolean;
		error?: string;
		onclose: () => void;
		onsubmit: (payload: PostitFormPayload) => void;
	} = $props();

	const formCopy = copy.plans.form;
	const colorChoices: { value: PostitColor | null; label: string }[] = [
		{ value: null, label: formCopy.colorGoal },
		...(Object.entries(copy.plans.colors) as [PostitColor, string][]).map(
			([value, label]) => ({ value, label })
		)
	];

	let title = $state(postit?.title ?? '');
	let note = $state(postit?.note ?? '');
	let date = $state(postit?.date ?? '');
	let time = $state(postit?.time ?? '');
	let duration = $state(postit?.durationMin ? String(postit.durationMin) : '');
	let goalId = $state(postit?.goalId ?? '');
	let color = $state<PostitColor | ''>(postit?.color ?? '');

	const titleText = $derived(postit ? formCopy.save : formCopy.create);
	const sheetTitle = $derived(postit ? copy.plans.actions.edit : copy.plans.newPostit);

	function submit() {
		const trimmed = title.trim();
		if (!trimmed) return;
		const durationNum = duration.trim() === '' ? null : Number(duration);
		onsubmit({
			title: trimmed,
			note: note.trim() === '' ? null : note.trim(),
			date: date === '' ? null : date,
			time: time === '' ? null : time,
			durationMin: Number.isFinite(durationNum) ? durationNum : null,
			goalId: goalId === '' ? null : goalId,
			color: color === '' ? null : color
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
				placeholder={formCopy.titlePlaceholder}
				aria-describedby={error ? 'postit-form-error' : undefined}
			/>
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-semibold text-ink">{formCopy.note}</span>
			<textarea
				class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
				bind:value={note}
				rows="2"
				maxlength="2000"
				placeholder={formCopy.notePlaceholder}
				aria-describedby={error ? 'postit-form-error' : undefined}
			></textarea>
		</label>
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{formCopy.date}</span>
				<input
					type="date"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={date}
					aria-describedby={error ? 'postit-form-error' : undefined}
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{formCopy.time}</span>
				<input
					type="time"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={time}
					aria-describedby={error ? 'postit-form-error' : undefined}
				/>
			</label>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{formCopy.duration}</span>
				<input
					type="number"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={duration}
					min="1"
					max="1440"
					inputmode="numeric"
					aria-describedby={error ? 'postit-form-error' : undefined}
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{formCopy.goal}</span>
				<select
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={goalId}
					aria-describedby={error ? 'postit-form-error' : undefined}
				>
					<option value="">{formCopy.noGoal}</option>
					{#each goals as goal (goal.id)}
						<option value={goal.id}>{goal.title}</option>
					{/each}
				</select>
			</label>
		</div>
		<fieldset aria-describedby={error ? 'postit-form-error' : undefined}>
			<legend class="text-sm font-semibold text-ink">{formCopy.color}</legend>
			<div class="mt-1.5 flex flex-wrap gap-1.5">
				{#each colorChoices as choice (choice.label)}
					<button
						type="button"
						class="flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold transition-transform duration-fast hover:scale-[1.02] {color ===
						(choice.value ?? '')
							? 'border-ink text-ink'
							: 'border-paper-dark text-ink-soft'}"
						aria-pressed={color === (choice.value ?? '')}
						onclick={() => (color = choice.value ?? '')}
					>
						<span
							class="h-3 w-3 rounded-full"
							style:background-color={choice.value
								? `var(--color-${choice.value})`
								: 'var(--color-paper-dark)'}
							aria-hidden="true"
						></span>
						{choice.label}
					</button>
				{/each}
			</div>
		</fieldset>
		{#if error}
			<p id="postit-form-error" class="text-sm font-semibold text-ink" role="alert">{error}</p>
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
				{titleText}
			</button>
		</div>
	</form>
</Sheet>
