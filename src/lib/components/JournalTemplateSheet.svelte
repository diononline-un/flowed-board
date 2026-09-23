<script lang="ts" module>
	import type {
		JournalField as JournalFieldType,
		JournalSchedule as JournalScheduleType
	} from '$lib/shared/schemas.js';

	// Payload collected by the editor; the parent owns the API call. `active`
	// false deactivates the template without touching its entries (AC14).
	export interface JournalTemplatePayload {
		name: string;
		emoji: string | null;
		fields: JournalFieldType[];
		schedule: JournalScheduleType | null;
		active: boolean;
	}
</script>

<script lang="ts">
	import { Plus, Trash2 } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';
	import {
		journalFieldsSchema,
		journalScheduleSchema,
		type JournalField
	} from '$lib/shared/schemas.js';
	import type { PublicJournalTemplate } from '$lib/shared/types.js';
	import Sheet from './Sheet.svelte';

	// Template management (SPEC 8.5): name, emoji, active flag, schedule
	// (times/days) and a plain but complete field editor — type, label,
	// required and the type-specific options of SPEC 5.7. Everything is
	// checked against the shared zod schemas before it leaves the sheet.
	let {
		template = null,
		busy = false,
		error = '',
		onclose,
		onsubmit
	}: {
		template?: PublicJournalTemplate | null;
		busy?: boolean;
		error?: string;
		onclose: () => void;
		onsubmit: (payload: JournalTemplatePayload) => void;
	} = $props();

	type FieldType = 'scale' | 'text' | 'yesno' | 'choice' | 'number';

	interface FieldDraft {
		// Local key for the {#each} block; the id is what the entry stores.
		key: string;
		id: string;
		type: FieldType;
		label: string;
		required: boolean;
		scaleMax: 5 | 7 | 10;
		scaleStyle: 'faces' | 'numbers';
		placeholder: string;
		maxLength: string;
		options: string[];
		unit: string;
		numberMin: string;
		numberMax: string;
	}

	const fieldTypes: FieldType[] = ['scale', 'text', 'yesno', 'choice', 'number'];
	const scaleMaxima: Array<5 | 7 | 10> = [5, 7, 10];
	const weekdays = [0, 1, 2, 3, 4, 5, 6];

	function toDraft(field: JournalField, index: number): FieldDraft {
		const base: FieldDraft = {
			key: `field-${index}-${field.id}`,
			id: field.id,
			type: field.type,
			label: field.label,
			required: field.required,
			scaleMax: 5,
			scaleStyle: 'numbers',
			placeholder: '',
			maxLength: '500',
			options: ['', ''],
			unit: '',
			numberMin: '',
			numberMax: ''
		};
		if (field.type === 'scale') {
			base.scaleMax = field.max;
			base.scaleStyle = field.style;
		} else if (field.type === 'text') {
			base.placeholder = field.placeholder ?? '';
			base.maxLength = String(field.maxLength);
		} else if (field.type === 'choice') {
			base.options = [...field.options];
		} else if (field.type === 'number') {
			base.unit = field.unit ?? '';
			base.numberMin = field.min === undefined || field.min === null ? '' : String(field.min);
			base.numberMax = field.max === undefined || field.max === null ? '' : String(field.max);
		}
		return base;
	}

	// Field ids are stable keys of the values object; they are generated once
	// (from the running counter) and never derived from the label, so renaming
	// a field cannot orphan existing entries.
	function nextFieldId(existing: FieldDraft[]): string {
		let counter = existing.length + 1;
		while (existing.some((draft) => draft.id === `feld-${counter}`)) counter += 1;
		return `feld-${counter}`;
	}

	let name = $state(template?.name ?? '');
	let emoji = $state(template?.emoji ?? '');
	let active = $state(template?.active ?? true);
	let scheduleOn = $state(template?.schedule !== null && template?.schedule !== undefined);
	let times = $state<string[]>(template?.schedule ? [...template.schedule.times] : []);
	let days = $state<number[]>(template?.schedule ? [...template.schedule.days] : [...weekdays]);
	let drafts = $state<FieldDraft[]>(
		template ? template.fields.map((field, index) => toDraft(field, index)) : [toDraft(sampleField(), 0)]
	);
	let localError = $state('');

	// A brand-new template starts with one plain text field, the most common
	// case; every other type is one select away.
	function sampleField(): JournalField {
		return { id: 'feld-1', type: 'text', label: '', required: false, maxLength: 500 };
	}

	function addField() {
		const id = nextFieldId(drafts);
		drafts.push({
			key: `field-${Date.now()}-${id}`,
			id,
			type: 'text',
			label: '',
			required: false,
			scaleMax: 5,
			scaleStyle: 'numbers',
			placeholder: '',
			maxLength: '500',
			options: ['', ''],
			unit: '',
			numberMin: '',
			numberMax: ''
		});
	}

	function removeField(index: number) {
		drafts.splice(index, 1);
	}

	function addOption(draft: FieldDraft) {
		if (draft.options.length >= 8) return;
		draft.options.push('');
	}

	function removeOption(draft: FieldDraft, index: number) {
		if (draft.options.length <= 2) return;
		draft.options.splice(index, 1);
	}

	function addTime() {
		if (times.length >= 4) return;
		times.push('');
	}

	function removeTime(index: number) {
		times.splice(index, 1);
	}

	// A schedule without a time could never become due, so enabling the
	// reminder starts with one common time and every weekday (SPEC 5.7).
	function toggleSchedule(checked: boolean) {
		scheduleOn = checked;
		if (checked && times.length === 0) times = ['08:00'];
		if (checked && days.length === 0) days = [...weekdays];
	}

	function toggleDay(day: number, checked: boolean) {
		if (checked) {
			if (!days.includes(day)) days.push(day);
			days.sort((a, b) => a - b);
			return;
		}
		days = days.filter((entry) => entry !== day);
	}

	function draftToCandidate(draft: FieldDraft): Record<string, unknown> {
		const base = {
			id: draft.id,
			type: draft.type,
			label: draft.label.trim(),
			required: draft.required
		};
		if (draft.type === 'scale') {
			return { ...base, min: 1, max: draft.scaleMax, style: draft.scaleStyle };
		}
		if (draft.type === 'text') {
			const placeholder = draft.placeholder.trim();
			const maxLength = Number(draft.maxLength);
			return {
				...base,
				...(placeholder === '' ? {} : { placeholder }),
				maxLength: Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 500
			};
		}
		if (draft.type === 'choice') {
			return { ...base, options: draft.options.map((option) => option.trim()).filter(Boolean) };
		}
		if (draft.type === 'number') {
			const unit = draft.unit.trim();
			const min = draft.numberMin.trim() === '' ? null : Number(draft.numberMin);
			const max = draft.numberMax.trim() === '' ? null : Number(draft.numberMax);
			return {
				...base,
				...(unit === '' ? {} : { unit }),
				...(min === null || Number.isNaN(min) ? {} : { min }),
				...(max === null || Number.isNaN(max) ? {} : { max })
			};
		}
		return base;
	}

	function submit() {
		localError = '';
		if (name.trim() === '') {
			localError = copy.errors.invalidInput;
			return;
		}
		const parsedFields = journalFieldsSchema.safeParse(drafts.map(draftToCandidate));
		if (!parsedFields.success) {
			const issue = parsedFields.error.issues[0];
			localError = issue ? issue.message : copy.errors.invalidInput;
			return;
		}
		let schedule = null;
		if (scheduleOn) {
			const parsedSchedule = journalScheduleSchema.safeParse({
				times: times.filter((time) => time !== ''),
				days
			});
			if (!parsedSchedule.success) {
				const issue = parsedSchedule.error.issues[0];
				localError = issue ? issue.message : copy.errors.invalidInput;
				return;
			}
			schedule = parsedSchedule.data;
		}
		onsubmit({
			name: name.trim(),
			emoji: emoji.trim() === '' ? null : emoji.trim(),
			fields: parsedFields.data,
			schedule,
			active
		});
	}
</script>

<Sheet title={template ? copy.journal.editTemplate : copy.journal.newTemplate} {onclose}>
	<form
		class="flex flex-col gap-4"
		onsubmit={(event) => {
			event.preventDefault();
			submit();
		}}
	>
		<div class="grid grid-cols-3 gap-3">
			<label class="col-span-2 flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{copy.journal.form.name}</span>
				<input
					type="text"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={name}
					maxlength="40"
					required
					placeholder={copy.journal.form.namePlaceholder}
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{copy.journal.form.emoji}</span>
				<input
					type="text"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
					bind:value={emoji}
					maxlength="8"
				/>
			</label>
		</div>

		<label class="flex items-center gap-2 text-sm font-semibold text-ink">
			<input type="checkbox" bind:checked={active} />
			{copy.journal.form.active}
		</label>

		<fieldset class="rounded-card border border-paper-dark px-3 py-3">
			<legend class="px-1 text-sm font-semibold text-ink">{copy.journal.form.schedule}</legend>
			<label class="mt-1 flex items-center gap-2 text-sm text-ink">
				<input
					type="checkbox"
					checked={scheduleOn}
					onchange={(event) => toggleSchedule(event.currentTarget.checked)}
				/>
				{copy.journal.form.scheduleToggle}
			</label>
			<p class="mt-1 text-xs text-ink-soft">{copy.journal.form.scheduleManualHint}</p>
			{#if scheduleOn}
				<div class="mt-3 flex flex-col gap-2">
					<span class="text-sm font-semibold text-ink">{copy.journal.form.times}</span>
					{#each times as _time, index (index)}
						<div class="flex items-center gap-2">
							<input
								type="time"
								class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
								value={times[index]}
								aria-label="{copy.journal.form.times} {index + 1}"
								oninput={(event) => (times[index] = event.currentTarget.value)}
							/>
							<button
								type="button"
								class="rounded-full p-2 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
								aria-label={copy.journal.form.removeTime}
								onclick={() => removeTime(index)}
							>
								<Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
							</button>
						</div>
					{/each}
					<button
						type="button"
						class="flex w-fit items-center gap-1.5 rounded-pill border border-paper-dark px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:text-ink disabled:opacity-50"
						disabled={times.length >= 4}
						onclick={addTime}
					>
						<Plus size={14} strokeWidth={2} aria-hidden="true" />
						{copy.journal.form.addTime}
					</button>
					<span class="text-sm font-semibold text-ink">{copy.journal.form.days}</span>
					<div class="flex flex-wrap gap-1.5">
						{#each weekdays as day (day)}
							<label
								class="flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold {days.includes(
									day
								)
									? 'border-ink text-ink'
									: 'border-paper-dark text-ink-soft'}"
							>
								<input
									type="checkbox"
									checked={days.includes(day)}
									onchange={(event) => toggleDay(day, event.currentTarget.checked)}
								/>
								{copy.journal.days[day as 0 | 1 | 2 | 3 | 4 | 5 | 6]}
							</label>
						{/each}
					</div>
				</div>
			{/if}
		</fieldset>

		<fieldset class="flex flex-col gap-3">
			<legend class="text-sm font-semibold text-ink">{copy.journal.form.fields}</legend>
			{#each drafts as draft, index (draft.key)}
				<div class="flex flex-col gap-2 rounded-card border border-paper-dark bg-paper-dark/30 px-3 py-3">
					<div class="flex items-start gap-2">
						<label class="flex flex-1 flex-col gap-1">
							<span class="text-xs font-semibold text-ink-soft">
								{copy.journal.form.fieldLabel}
							</span>
							<input
								type="text"
								class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
								bind:value={draft.label}
								maxlength="80"
								placeholder={copy.journal.form.fieldLabelPlaceholder}
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs font-semibold text-ink-soft">
								{copy.journal.form.fieldType}
							</span>
							<select
								class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
								bind:value={draft.type}
							>
								{#each fieldTypes as option (option)}
									<option value={option}>{copy.journal.types[option]}</option>
								{/each}
							</select>
						</label>
						<button
							type="button"
							class="mt-5 rounded-full p-2 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
							aria-label="{copy.journal.form.removeField}: {draft.label || draft.id}"
							onclick={() => removeField(index)}
						>
							<Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
						</button>
					</div>
					<label class="flex items-center gap-2 text-sm text-ink">
						<input type="checkbox" bind:checked={draft.required} />
						{copy.journal.form.required}
					</label>

					{#if draft.type === 'scale'}
						<div class="grid grid-cols-2 gap-3">
							<label class="flex flex-col gap-1">
								<span class="text-xs font-semibold text-ink-soft">
									{copy.journal.form.scaleMax}
								</span>
								<select
									class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
									bind:value={draft.scaleMax}
								>
									{#each scaleMaxima as option (option)}
										<option value={option}>{option}</option>
									{/each}
								</select>
							</label>
							<label class="flex flex-col gap-1">
								<span class="text-xs font-semibold text-ink-soft">
									{copy.journal.form.scaleStyle}
								</span>
								<select
									class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
									bind:value={draft.scaleStyle}
								>
									<option value="numbers">{copy.journal.scaleStyles.numbers}</option>
									<option value="faces" disabled={draft.scaleMax !== 5}>
										{copy.journal.scaleStyles.faces}
									</option>
								</select>
							</label>
						</div>
					{:else if draft.type === 'text'}
						<div class="grid grid-cols-2 gap-3">
							<label class="flex flex-col gap-1">
								<span class="text-xs font-semibold text-ink-soft">
									{copy.journal.form.placeholder}
								</span>
								<input
									type="text"
									class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
									bind:value={draft.placeholder}
									maxlength="80"
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="text-xs font-semibold text-ink-soft">
									{copy.journal.form.maxLength}
								</span>
								<input
									type="number"
									class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
									bind:value={draft.maxLength}
									min="1"
									max="2000"
								/>
							</label>
						</div>
					{:else if draft.type === 'choice'}
						<div class="flex flex-col gap-2">
							<span class="text-xs font-semibold text-ink-soft">{copy.journal.form.options}</span>
							{#each draft.options as _option, optionIndex (optionIndex)}
								<div class="flex items-center gap-2">
									<input
										type="text"
										class="flex-1 rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
										value={draft.options[optionIndex]}
										maxlength="40"
										oninput={(event) => (draft.options[optionIndex] = event.currentTarget.value)}
									/>
									<button
										type="button"
										class="rounded-full p-2 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink disabled:opacity-50"
										aria-label={copy.journal.form.removeOption}
										disabled={draft.options.length <= 2}
										onclick={() => removeOption(draft, optionIndex)}
									>
										<Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
									</button>
								</div>
							{/each}
							<button
								type="button"
								class="flex w-fit items-center gap-1.5 rounded-pill border border-paper-dark px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:text-ink disabled:opacity-50"
								disabled={draft.options.length >= 8}
								onclick={() => addOption(draft)}
							>
								<Plus size={14} strokeWidth={2} aria-hidden="true" />
								{copy.journal.form.addOption}
							</button>
						</div>
					{:else if draft.type === 'number'}
						<div class="grid grid-cols-3 gap-3">
							<label class="flex flex-col gap-1">
								<span class="text-xs font-semibold text-ink-soft">
									{copy.journal.form.unit}
								</span>
								<input
									type="text"
									class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
									bind:value={draft.unit}
									maxlength="20"
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="text-xs font-semibold text-ink-soft">
									{copy.journal.form.minValue}
								</span>
								<input
									type="number"
									class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
									bind:value={draft.numberMin}
								/>
							</label>
							<label class="flex flex-col gap-1">
								<span class="text-xs font-semibold text-ink-soft">
									{copy.journal.form.maxValue}
								</span>
								<input
									type="number"
									class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-sm text-ink"
									bind:value={draft.numberMax}
								/>
							</label>
						</div>
					{/if}
				</div>
			{/each}
			<button
				type="button"
				class="flex w-fit items-center gap-1.5 rounded-pill bg-butter px-4 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
				onclick={addField}
			>
				<Plus size={16} strokeWidth={2} aria-hidden="true" />
				{copy.journal.form.addField}
			</button>
		</fieldset>

		{#if localError}
			<p class="text-sm font-semibold text-ink" role="alert">{localError}</p>
		{/if}
		{#if error}
			<p class="text-sm font-semibold text-ink" role="alert">{error}</p>
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
				disabled={busy || name.trim() === ''}
			>
				{template ? copy.journal.form.save : copy.journal.form.create}
			</button>
		</div>
	</form>
</Sheet>
