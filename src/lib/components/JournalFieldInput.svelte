<script lang="ts">
	import { Minus, Plus } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';
	import type { JournalField } from '$lib/shared/types.js';

	// One journal field, dispatched by type (SPEC 8.5, 10.4): scale as
	// buttons/faces, yes/no as two large buttons, choice as chips, text as a
	// textarea with a character counter, number as a stepper. The parent owns
	// the value; every interaction reports the new one.
	export type JournalFieldValue = string | number | boolean | undefined;

	let {
		field,
		value,
		error = '',
		onchange
	}: {
		field: JournalField;
		value: JournalFieldValue;
		error?: string;
		onchange: (value: JournalFieldValue) => void;
	} = $props();

	const inputId = `journal-field-${field.id}`;
	const errorId = `${inputId}-error`;
	// SPEC 5.7: faces exist for a 1–5 scale only.
	const faceEmojis = ['😞', '🙁', '😐', '🙂', '😄'];

	const scaleValues = $derived.by(() =>
		field.type === 'scale'
			? Array.from({ length: field.max - field.min + 1 }, (_entry, index) => field.min + index)
			: []
	);
	const textValue = $derived(typeof value === 'string' ? value : '');
	const textMax = $derived(field.type === 'text' ? field.maxLength : 2000);
	const placeholder = $derived(field.type === 'text' ? (field.placeholder ?? '') : '');
	const unit = $derived(field.type === 'number' ? (field.unit ?? '') : '');
	const lowerBound = $derived(
		field.type === 'number' && typeof field.min === 'number' ? field.min : null
	);
	const upperBound = $derived(
		field.type === 'number' && typeof field.max === 'number' ? field.max : null
	);
	const numberValue = $derived.by(() => {
		if (typeof value === 'number') return value;
		if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
			return Number(value);
		}
		return null;
	});
	const canDecrease = $derived(numberValue === null || lowerBound === null || numberValue > lowerBound);
	const canIncrease = $derived(numberValue === null || upperBound === null || numberValue < upperBound);
	const requiredMark = $derived(field.required ? copy.journal.form.requiredMark : '');

	function step(delta: number) {
		if (field.type !== 'number') return;
		const base = numberValue ?? lowerBound ?? 0;
		let next = base + delta;
		if (lowerBound !== null && next < lowerBound) next = lowerBound;
		if (upperBound !== null && next > upperBound) next = upperBound;
		onchange(next);
	}

	// Faces only exist on a 1–5 scale (SPEC 5.7), so the lookup is safe and
	// falls back to the plain number for anything else.
	function scaleAriaLabel(option: number): string {
		const face = copy.journal.faceLabels[option as 1 | 2 | 3 | 4 | 5];
		return `${field.label}: ${face ?? option}`;
	}

	function stepButtonClass(enabled: boolean): string {
		return `rounded-full border border-paper-dark p-2 transition-colors duration-fast ${enabled ? 'text-ink hover:bg-paper-dark' : 'text-ink-soft opacity-50'}`;
	}
</script>

<div class="flex flex-col gap-1.5">
	{#if field.type === 'scale'}
		<fieldset aria-describedby={error ? errorId : undefined}>
			<legend class="text-sm font-semibold text-ink">
				{field.label}{#if requiredMark}<span class="text-ink-soft"> · {requiredMark}</span>{/if}
			</legend>
			<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
				{#each scaleValues as option (option)}
					<button
						type="button"
						class="min-w-11 rounded-card border px-3 py-2 text-sm font-bold transition-transform duration-fast hover:scale-[1.02] {value ===
						option
							? 'border-ink bg-butter text-ink'
							: 'border-paper-dark bg-paper text-ink-soft'}"
						aria-pressed={value === option}
						aria-label={field.style === 'faces' ? scaleAriaLabel(option) : `${field.label}: ${option}`}
						onclick={() => onchange(option)}
					>
						{#if field.style === 'faces'}
							<span aria-hidden="true" class="text-lg">{faceEmojis[option - 1]}</span>
						{:else}
							{option}
						{/if}
					</button>
				{/each}
			</div>
		</fieldset>
	{:else if field.type === 'yesno'}
		<fieldset aria-describedby={error ? errorId : undefined}>
			<legend class="text-sm font-semibold text-ink">
				{field.label}{#if requiredMark}<span class="text-ink-soft"> · {requiredMark}</span>{/if}
			</legend>
			<div class="mt-1.5 flex gap-2">
				{#each [{ value: true, label: copy.journal.values.yes }, { value: false, label: copy.journal.values.no }] as option (option.label)}
					<button
						type="button"
						class="flex-1 rounded-card border px-4 py-3 text-base font-bold transition-transform duration-fast hover:scale-[1.02] {value ===
						option.value
							? 'border-ink bg-mint text-ink'
							: 'border-paper-dark bg-paper text-ink-soft'}"
						aria-pressed={value === option.value}
						onclick={() => onchange(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</fieldset>
	{:else if field.type === 'choice'}
		<fieldset aria-describedby={error ? errorId : undefined}>
			<legend class="text-sm font-semibold text-ink">
				{field.label}{#if requiredMark}<span class="text-ink-soft"> · {requiredMark}</span>{/if}
			</legend>
			<div class="mt-1.5 flex flex-wrap gap-1.5">
				{#each field.options as option (option)}
					<button
						type="button"
						class="rounded-pill border px-3 py-1.5 text-sm font-semibold transition-transform duration-fast hover:scale-[1.02] {value ===
						option
							? 'border-ink bg-sky text-ink'
							: 'border-paper-dark bg-paper text-ink-soft'}"
						aria-pressed={value === option}
						onclick={() => onchange(option)}
					>
						{option}
					</button>
				{/each}
			</div>
		</fieldset>
	{:else if field.type === 'text'}
		<label class="flex flex-col gap-1" for={inputId}>
			<span class="text-sm font-semibold text-ink">
				{field.label}{#if requiredMark}<span class="text-ink-soft"> · {requiredMark}</span>{/if}
			</span>
			<textarea
				id={inputId}
				class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
				rows="3"
				maxlength={textMax}
				placeholder={placeholder}
				value={textValue}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? errorId : undefined}
				oninput={(event) => onchange(event.currentTarget.value)}
			></textarea>
			<span class="text-right text-xs text-ink-soft">
				{copy.journal.values.counter(textValue.length, textMax)}
			</span>
		</label>
	{:else}
		<div class="flex flex-col gap-1">
			<span class="text-sm font-semibold text-ink" id="{inputId}-label">
				{field.label}{#if requiredMark}<span class="text-ink-soft"> · {requiredMark}</span>{/if}
			</span>
			<div class="flex items-center gap-2" role="group" aria-labelledby="{inputId}-label">
				<button
					type="button"
					class={stepButtonClass(canDecrease)}
					aria-label={copy.journal.values.decrease}
					disabled={!canDecrease}
					onclick={() => step(-1)}
				>
					<Minus size={16} strokeWidth={1.75} aria-hidden="true" />
				</button>
				<input
					id={inputId}
					type="number"
					class="w-24 rounded-lg border border-paper-dark bg-paper px-3 py-2 text-center text-sm text-ink"
					value={numberValue ?? ''}
					min={lowerBound ?? undefined}
					max={upperBound ?? undefined}
					inputmode="decimal"
					aria-invalid={error ? 'true' : undefined}
					aria-describedby={error ? errorId : undefined}
					oninput={(event) => {
						const raw = event.currentTarget.value;
						onchange(raw === '' ? undefined : Number(raw));
					}}
				/>
				{#if unit}<span class="text-sm text-ink-soft">{unit}</span>{/if}
				<button
					type="button"
					class={stepButtonClass(canIncrease)}
					aria-label={copy.journal.values.increase}
					disabled={!canIncrease}
					onclick={() => step(1)}
				>
					<Plus size={16} strokeWidth={1.75} aria-hidden="true" />
				</button>
			</div>
		</div>
	{/if}
	{#if error}
		<p id={errorId} class="text-xs font-semibold text-ink" role="alert">{error}</p>
	{/if}
</div>
