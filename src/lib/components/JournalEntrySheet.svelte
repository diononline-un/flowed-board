<script lang="ts" module>
	import type { JournalValues as JournalValuesType } from '$lib/shared/schemas.js';

	// Payload collected by the form; the parent owns the API call. For an
	// existing entry only `values` are used — date and slot are its identity
	// (SPEC 7, AC13).
	export interface JournalEntryPayload {
		entryDate: string;
		slot: string | null;
		values: JournalValuesType;
	}
</script>

<script lang="ts">
	import { copy } from '$lib/shared/copy.js';
	import { formatDe } from '$lib/shared/date.js';
	import { validateJournalValues } from '$lib/shared/journalTemplates.js';
	import type { JournalValues } from '$lib/shared/schemas.js';
	import type { PublicJournalEntry, PublicJournalTemplate } from '$lib/shared/types.js';
	import JournalFieldInput, { type JournalFieldValue } from './JournalFieldInput.svelte';
	import Sheet from './Sheet.svelte';

	// Entry form (SPEC 8.5): renders the fields of the template — or, when an
	// existing entry is edited, the field snapshot it was written with
	// (AC14). Backfilling is allowed for today and earlier days (SPEC 5.7).
	let {
		template,
		entry = null,
		slot = null,
		today,
		busy = false,
		error = '',
		snapshotHint = false,
		onclose,
		onsubmit
	}: {
		template: PublicJournalTemplate;
		entry?: PublicJournalEntry | null;
		slot?: string | null;
		today: string;
		busy?: boolean;
		error?: string;
		snapshotHint?: boolean;
		onclose: () => void;
		onsubmit: (payload: JournalEntryPayload) => void;
	} = $props();

	// Editing uses the frozen snapshot of the entry, creating the template's
	// current definitions.
	const fields = $derived(entry ? entry.fields : template.fields);
	const editing = $derived(entry !== null);
	const slotOptions = $derived(template.schedule?.times ?? []);

	const initialFields = entry ? entry.fields : template.fields;
	const initialValues: Record<string, JournalFieldValue> = {};
	for (const field of initialFields) {
		const value = entry?.values[field.id];
		initialValues[field.id] =
			typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
				? value
				: undefined;
	}

	let entryDate = $state(entry?.entryDate ?? today);
	let chosenSlot = $state(entry ? (entry.slot ?? '') : (slot ?? ''));
	let values = $state<Record<string, JournalFieldValue>>(initialValues);
	let showErrors = $state(false);

	function collect(): JournalValues {
		const out: JournalValues = {};
		for (const [key, value] of Object.entries(values)) {
			if (value === undefined) continue;
			out[key] = value;
		}
		return out;
	}

	const result = $derived(validateJournalValues(fields, collect()));
	const fieldErrors = $derived.by(() => {
		const map: Record<string, string> = {};
		if (result.ok) return map;
		for (const issue of result.errors) {
			if (!(issue.fieldId in map)) map[issue.fieldId] = issue.message;
		}
		return map;
	});

	function submit() {
		showErrors = true;
		if (!result.ok) return;
		onsubmit({
			entryDate,
			slot: chosenSlot === '' ? null : chosenSlot,
			values: result.values
		});
	}
</script>

<Sheet
	title={editing ? copy.journal.entryEditTitle : copy.journal.entryNewTitle}
	{onclose}
>
	<form
		class="flex flex-col gap-4"
		onsubmit={(event) => {
			event.preventDefault();
			submit();
		}}
	>
		<div class="flex items-center gap-2">
			{#if template.emoji}<span aria-hidden="true" class="text-xl">{template.emoji}</span>{/if}
			<div>
				<p class="text-base font-bold text-ink">{entry ? entry.templateName : template.name}</p>
				<p class="text-xs text-ink-soft">
					{formatDe(entry ? entry.entryDate : entryDate, 'long')}
					{#if editing && entry}
						· {entry.slot ? copy.journal.entrySlot(entry.slot) : copy.journal.entryNoSlot}
					{/if}
				</p>
			</div>
		</div>

		{#if snapshotHint}
			<p class="rounded-card bg-paper-dark/60 px-3 py-2 text-xs text-ink-soft">
				{copy.journal.entrySnapshotHint}
			</p>
		{/if}

		{#if !editing}
			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1">
					<span class="text-sm font-semibold text-ink">{copy.journal.form.date}</span>
					<input
						type="date"
						class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
						bind:value={entryDate}
						max={today}
						required
					/>
				</label>
				{#if slotOptions.length > 0}
					<label class="flex flex-col gap-1">
						<span class="text-sm font-semibold text-ink">{copy.journal.form.slot}</span>
						<select
							class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
							bind:value={chosenSlot}
						>
							<option value="">{copy.journal.form.slotNone}</option>
							{#each slotOptions as option (option)}
								<option value={option}>{copy.journal.entrySlot(option)}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>
		{/if}

		{#each fields as field (field.id)}
			<JournalFieldInput
				{field}
				value={values[field.id]}
				error={showErrors ? (fieldErrors[field.id] ?? '') : ''}
				onchange={(value) => (values[field.id] = value)}
			/>
		{/each}

		{#if error}
			<p id="entry-form-error" class="text-sm font-semibold text-ink" role="alert">{error}</p>
		{/if}

		<div class="mt-1 flex items-center justify-end gap-2">
			<button
				type="button"
				class="rounded-pill px-4 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink disabled:opacity-50"
				disabled={busy}
				onclick={onclose}
			>
				{copy.journal.form.cancel}
			</button>
			<button
				type="submit"
				class="rounded-pill bg-mint px-5 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
				disabled={busy}
			>
				{editing ? copy.journal.form.save : copy.journal.form.create}
			</button>
		</div>
	</form>
</Sheet>
