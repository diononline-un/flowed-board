<script lang="ts">
	import { CalendarPlus, Pencil, Settings2 } from 'lucide-svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import JournalEntrySheet, {
		type JournalEntryPayload
	} from '$lib/components/JournalEntrySheet.svelte';
	import JournalTemplateSheet, {
		type JournalTemplatePayload
	} from '$lib/components/JournalTemplateSheet.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Sheet from '$lib/components/Sheet.svelte';
	import { pushErrorToast, pushToast } from '$lib/state/toasts.svelte.js';
	import { applyXp, type XpResponsePayload } from '$lib/state/xp.svelte.js';
	import { copy } from '$lib/shared/copy.js';
	import { formatDe } from '$lib/shared/date.js';
	import {
		summarizeJournalValues,
		type DueJournalTemplate
	} from '$lib/shared/journalTemplates.js';
	import type { PublicJournalEntry, PublicJournalTemplate } from '$lib/shared/types.js';
	import type { PageData } from './$types';

	// Journal (SPEC 8.5): the "Heute" card is the in-app reminder, the entry
	// sheet renders the fields by type, the history lists entries grouped by
	// date (with the frozen field snapshot, AC14) and the management sheet
	// creates, edits and deactivates templates. Writes go through the API with
	// optimistic updates and rollback (SPEC 3.1).
	let { data }: { data: PageData } = $props();

	const today = $derived(data.today);

	let templates = $state<PublicJournalTemplate[]>(data.templates);
	let entries = $state<PublicJournalEntry[]>(data.entries);
	let due = $state<DueJournalTemplate<PublicJournalTemplate>[]>(data.due);

	$effect(() => {
		templates = data.templates;
		entries = data.entries;
		due = data.due;
	});

	const activeTemplates = $derived(templates.filter((template) => template.active));
	const templateById = $derived(new Map(templates.map((template) => [template.id, template])));

	// Newest day first, inside a day the scheduled slots ascending, manual
	// entries last — the order the API returns and optimistic edits keep.
	function sortEntries(list: PublicJournalEntry[]): PublicJournalEntry[] {
		return [...list].sort((a, b) => {
			if (a.entryDate !== b.entryDate) return a.entryDate < b.entryDate ? 1 : -1;
			const aSlot = a.slot ?? '99:99';
			const bSlot = b.slot ?? '99:99';
			if (aSlot !== bSlot) return aSlot < bSlot ? -1 : 1;
			return a.createdAt < b.createdAt ? -1 : 1;
		});
	}

	const groups = $derived.by(() => {
		const out: Array<{ date: string; entries: PublicJournalEntry[] }> = [];
		for (const entry of entries) {
			const last = out[out.length - 1];
			if (last && last.date === entry.entryDate) last.entries.push(entry);
			else out.push({ date: entry.entryDate, entries: [entry] });
		}
		return out;
	});

	// A deactivated (or meanwhile deleted) template: the entry keeps its own
	// snapshot and is still readable and editable (AC14).
	function isInactive(entry: PublicJournalEntry): boolean {
		const template = entry.templateId ? templateById.get(entry.templateId) : undefined;
		return !template || !template.active;
	}

	// The frozen fields differ from the current template definition.
	function snapshotHint(entry: PublicJournalEntry): boolean {
		const template = entry.templateId ? templateById.get(entry.templateId) : undefined;
		if (!template) return true;
		return (
			template.name !== entry.templateName ||
			JSON.stringify(template.fields) !== JSON.stringify(entry.fields)
		);
	}

	// The entry sheet always works on a template shape; a missing template is
	// reconstructed from the entry's snapshot.
	function templateForEntry(entry: PublicJournalEntry): PublicJournalTemplate {
		const template = entry.templateId ? templateById.get(entry.templateId) : undefined;
		if (template) return template;
		return {
			id: entry.templateId ?? '',
			name: entry.templateName,
			emoji: null,
			fields: entry.fields,
			schedule: null,
			active: false,
			seedKey: null,
			position: 0,
			createdAt: entry.createdAt,
			updatedAt: entry.updatedAt
		};
	}

	// --- API plumbing -------------------------------------------------------

	type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

	async function api<T>(path: string, method: string, body?: unknown): Promise<ApiResult<T>> {
		try {
			const response = await fetch(path, {
				method,
				headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
				body: body !== undefined ? JSON.stringify(body) : undefined
			});
			if (!response.ok) {
				let message: string = copy.journal.toast.error;
				try {
					const payload = (await response.json()) as { error?: unknown };
					if (typeof payload.error === 'string' && payload.error !== '') message = payload.error;
				} catch {
					// keep the generic message
				}
				return { ok: false, status: response.status, error: message };
			}
			return { ok: true, data: (await response.json()) as T };
		} catch {
			return { ok: false, status: 0, error: copy.journal.toast.error };
		}
	}

	// The due list is server truth (SPEC 5.7); after a write we reconcile with
	// it instead of recomputing the rule in the client.
	async function refreshDue() {
		const result = await api<{ items: DueJournalTemplate<PublicJournalTemplate>[] }>(
			'/api/journal/due',
			'GET'
		);
		if (result.ok) due = result.data.items;
	}

	// --- Entry form ---------------------------------------------------------

	let entryForm = $state<{
		template: PublicJournalTemplate;
		entry: PublicJournalEntry | null;
		slot: string | null;
	} | null>(null);
	let entryBusy = $state(false);
	let entryError = $state('');

	function openDueEntry(item: DueJournalTemplate<PublicJournalTemplate>) {
		entryError = '';
		entryForm = { template: item.template, entry: null, slot: item.slot };
	}

	function openBackfill(template: PublicJournalTemplate) {
		backfillOpen = false;
		entryError = '';
		entryForm = { template, entry: null, slot: null };
	}

	function openEditEntry(entry: PublicJournalEntry) {
		entryError = '';
		entryForm = { template: templateForEntry(entry), entry, slot: entry.slot };
	}

	async function submitEntry(payload: JournalEntryPayload) {
		const target = entryForm;
		if (!target) return;
		entryBusy = true;
		entryError = '';

		if (target.entry) {
			const snapshot = entries;
			const optimistic: PublicJournalEntry = {
				...target.entry,
				values: payload.values,
				updatedAt: new Date().toISOString()
			};
			entries = sortEntries(entries.map((entry) => (entry.id === optimistic.id ? optimistic : entry)));
			const result = await api<{ entry: PublicJournalEntry }>(
				`/api/journal/entries/${target.entry.id}`,
				'PATCH',
				{ values: payload.values }
			);
			entryBusy = false;
			if (!result.ok) {
				entries = snapshot;
				entryError = result.error;
				return;
			}
			entries = sortEntries(
				entries.map((entry) => (entry.id === result.data.entry.id ? result.data.entry : entry))
			);
			entryForm = null;
			pushToast(copy.journal.toast.entrySaved);
			return;
		}

		const now = new Date().toISOString();
		const optimistic: PublicJournalEntry = {
			id: `pending-${now}`,
			templateId: target.template.id,
			templateName: target.template.name,
			entryDate: payload.entryDate,
			slot: payload.slot,
			fields: target.template.fields,
			values: payload.values,
			createdAt: now,
			updatedAt: now
		};
		const entrySnapshot = entries;
		const dueSnapshot = due;
		entries = sortEntries([...entries, optimistic]);
		due = due.filter(
			(item) => !(item.template.id === target.template.id && item.slot === payload.slot)
		);

		const result = await api<{ entry: PublicJournalEntry; xp?: XpResponsePayload }>(
			'/api/journal/entries',
			'POST',
			{
				templateId: target.template.id,
				entryDate: payload.entryDate,
				slot: payload.slot,
				values: payload.values
			}
		);
		entryBusy = false;
		if (!result.ok) {
			entries = entrySnapshot;
			due = dueSnapshot;
			entryError = result.error;
			return;
		}
		// SPEC 5.6: 15 XP per entry, plus the journal_starter/journal_regular
		// badges at three and fifteen entries.
		applyXp(result.data.xp);
		entries = sortEntries(
			entries.map((entry) => (entry.id === optimistic.id ? result.data.entry : entry))
		);
		entryForm = null;
		pushToast(copy.journal.toast.entryCreated);
		void refreshDue();
	}

	// --- "Nachtragen" picker ------------------------------------------------

	let backfillOpen = $state(false);

	// --- Template management ------------------------------------------------

	let templatesOpen = $state(false);
	let editingTemplate = $state<PublicJournalTemplate | null>(null);
	let creatingTemplate = $state(false);
	let templateBusy = $state(false);
	let templateError = $state('');

	function openTemplateForm(template: PublicJournalTemplate | null) {
		editingTemplate = template;
		creatingTemplate = template === null;
		templateError = '';
	}

	function closeTemplateForm() {
		editingTemplate = null;
		creatingTemplate = false;
		templateError = '';
	}

	async function submitTemplate(payload: JournalTemplatePayload) {
		templateBusy = true;
		templateError = '';
		try {
			if (editingTemplate) {
				const id = editingTemplate.id;
				const snapshot = templates;
				templates = templates.map((template) =>
					template.id === id ? { ...template, ...payload } : template
				);
				const result = await api<{ template: PublicJournalTemplate }>(
					`/api/journal/templates/${id}`,
					'PATCH',
					payload
				);
				if (!result.ok) {
					templates = snapshot;
					templateError = result.error;
					return;
				}
				templates = templates.map((template) =>
					template.id === id ? result.data.template : template
				);
				pushToast(copy.journal.toast.templateSaved);
			} else {
				const result = await api<{ template: PublicJournalTemplate }>(
					'/api/journal/templates',
					'POST',
					payload
				);
				if (!result.ok) {
					templateError = result.error;
					return;
				}
				templates = [...templates, result.data.template];
				pushToast(copy.journal.toast.templateCreated);
			}
			closeTemplateForm();
			void refreshDue();
		} finally {
			templateBusy = false;
		}
	}

	async function toggleTemplateActive(template: PublicJournalTemplate) {
		const next = !template.active;
		const snapshot = templates;
		const dueSnapshot = due;
		templates = templates.map((entry) =>
			entry.id === template.id ? { ...entry, active: next } : entry
		);
		if (!next) due = due.filter((item) => item.template.id !== template.id);
		const result = await api<{ template: PublicJournalTemplate }>(
			`/api/journal/templates/${template.id}`,
			'PATCH',
			{ active: next }
		);
		if (!result.ok) {
			templates = snapshot;
			due = dueSnapshot;
			pushErrorToast(result.error);
			return;
		}
		templates = templates.map((entry) =>
			entry.id === template.id ? result.data.template : entry
		);
		pushToast(next ? copy.journal.toast.templateActivated : copy.journal.toast.templateDeactivated);
		void refreshDue();
	}
</script>

<svelte:head>
	<title>{copy.journal.title} · {copy.appName}</title>
</svelte:head>

<div class="flex flex-wrap items-center justify-between gap-2">
	<h1 class="text-3xl font-bold">{copy.journal.title}</h1>
	<button
		type="button"
		class="flex items-center gap-1.5 rounded-pill border border-paper-dark bg-paper px-4 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:text-ink"
		onclick={() => (templatesOpen = true)}
	>
		<Settings2 size={16} strokeWidth={1.75} aria-hidden="true" />
		{copy.journal.templatesButton}
	</button>
</div>

<section class="mt-4 rounded-card border border-paper-dark bg-butter/40 p-5" aria-label={copy.journal.todayTitle}>
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="text-xl font-bold">{copy.journal.todayTitle}</h2>
		<p class="font-hand text-xl text-ink-soft">{formatDe(today, 'long')}</p>
	</div>

	{#if due.length === 0}
		<p class="mt-2 text-sm text-ink-soft">{copy.journal.todayEmpty}</p>
	{:else}
		<ul class="mt-3 flex flex-col gap-2">
			{#each due as item (item.template.id + item.slot)}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-card border border-paper-dark bg-paper px-4 py-3 text-left shadow-postit transition-transform duration-fast hover:scale-[1.01]"
						onclick={() => openDueEntry(item)}
					>
						<span aria-hidden="true" class="text-2xl">{item.template.emoji ?? '📝'}</span>
						<span class="flex flex-col">
							<span class="text-base font-bold text-ink">{item.template.name}</span>
							<span class="text-xs text-ink-soft">
								{copy.journal.dueLabel} · {copy.journal.entrySlot(item.slot)}
							</span>
						</span>
						<span class="ml-auto text-sm font-bold text-ink-soft">{copy.journal.fillNow}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<button
		type="button"
		class="mt-3 flex items-center gap-1.5 rounded-pill border border-paper-dark bg-paper px-4 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:text-ink"
		onclick={() => (backfillOpen = true)}
	>
		<CalendarPlus size={16} strokeWidth={1.75} aria-hidden="true" />
		{copy.journal.backfill}
	</button>
</section>

<section class="mt-8" aria-label={copy.journal.historyTitle}>
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="text-xl font-bold">{copy.journal.historyTitle}</h2>
		<p class="text-xs text-ink-soft">{copy.journal.historyLimited(data.historyDays)}</p>
	</div>

	{#if entries.length === 0}
		<EmptyState title={copy.journal.emptyTitle} hint={copy.journal.emptyHint} />
	{:else}
		<div class="mt-3 flex flex-col gap-5">
			{#each groups as group (group.date)}
				<div>
					<h3 class="text-sm font-bold text-ink-soft">{formatDe(group.date, 'long')}</h3>
					<ul class="mt-2 flex flex-col gap-2">
						{#each group.entries as entry (entry.id)}
							<li>
								<button
									type="button"
									class="flex w-full items-center gap-3 rounded-card border border-paper-dark bg-paper px-4 py-3 text-left transition-colors duration-fast hover:bg-paper-dark"
									onclick={() => openEditEntry(entry)}
								>
									<span aria-hidden="true" class="text-xl">
										{templateById.get(entry.templateId ?? '')?.emoji ?? '📝'}
									</span>
									<span class="flex min-w-0 flex-col">
										<span class="truncate text-sm font-bold text-ink">
											{entry.templateName}
											<span class="font-normal text-ink-soft">
												· {entry.slot ? copy.journal.entrySlot(entry.slot) : copy.journal.entryNoSlot}
											</span>
										</span>
										<span class="truncate text-xs text-ink-soft">
											{summarizeJournalValues(entry.fields, entry.values) || copy.journal.emptyValue}
										</span>
										{#if isInactive(entry)}
											<span class="mt-0.5 text-xs font-semibold text-ink-soft">
												{copy.journal.entryInactiveTemplate}
											</span>
										{/if}
									</span>
									<Pencil
										size={16}
										strokeWidth={1.75}
										class="ml-auto shrink-0 text-ink-soft"
										aria-hidden="true"
									/>
									<span class="sr-only">{copy.journal.openEntry}</span>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}
</section>

{#if entryForm}
	<JournalEntrySheet
		template={entryForm.template}
		entry={entryForm.entry}
		slot={entryForm.slot}
		{today}
		busy={entryBusy}
		error={entryError}
		snapshotHint={entryForm.entry ? snapshotHint(entryForm.entry) : false}
		onclose={() => (entryForm = null)}
		onsubmit={submitEntry}
	/>
{/if}

{#if backfillOpen}
	<Modal title={copy.journal.backfillTitle} onclose={() => (backfillOpen = false)}>
		<p class="text-sm text-ink-soft">{copy.journal.backfillHint}</p>
		<div class="mt-3 flex flex-col gap-2">
			{#if activeTemplates.length === 0}
				<p class="text-sm text-ink-soft">{copy.journal.templatesEmpty}</p>
			{:else}
				{#each activeTemplates as template (template.id)}
					<button
						type="button"
						class="flex items-center gap-2 rounded-card border border-paper-dark bg-paper px-3 py-2 text-left text-sm font-semibold text-ink transition-colors duration-fast hover:bg-paper-dark"
						onclick={() => openBackfill(template)}
					>
						<span aria-hidden="true">{template.emoji ?? '📝'}</span>
						{template.name}
					</button>
				{/each}
			{/if}
		</div>
	</Modal>
{/if}

{#if templatesOpen && !editingTemplate && !creatingTemplate}
	<Sheet title={copy.journal.templatesTitle} onclose={() => (templatesOpen = false)}>
		{#if templates.length === 0}
			<p class="text-sm text-ink-soft">{copy.journal.templatesEmpty}</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each templates as template (template.id)}
					<li
						class="flex items-center gap-2 rounded-card border border-paper-dark bg-paper px-3 py-2"
					>
						<span aria-hidden="true" class="text-xl">{template.emoji ?? '📝'}</span>
						<span class="flex min-w-0 flex-col">
							<span class="truncate text-sm font-bold text-ink">{template.name}</span>
							<span class="truncate text-xs text-ink-soft">
								{template.schedule
									? `${template.schedule.times.join(', ')} · ${template.schedule.days
											.map((day) => copy.journal.days[day as 0 | 1 | 2 | 3 | 4 | 5 | 6])
											.join(' ')}`
									: copy.journal.noSchedule}
								{#if !template.active}· {copy.journal.templateInactive}{/if}
							</span>
						</span>
						<button
							type="button"
							class="ml-auto rounded-pill px-2 py-1 text-xs font-semibold text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
							onclick={() => toggleTemplateActive(template)}
						>
							{template.active ? copy.journal.deactivate : copy.journal.activate}
						</button>
						<button
							type="button"
							class="rounded-full p-2 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
							aria-label="{copy.journal.editTemplate}: {template.name}"
							onclick={() => openTemplateForm(template)}
						>
							<Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="mt-3 text-xs text-ink-soft">{copy.journal.deactivateHint}</p>
		<div class="mt-4 flex justify-end">
			<button
				type="button"
				class="rounded-pill bg-mint px-5 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
				onclick={() => openTemplateForm(null)}
			>
				{copy.journal.newTemplate}
			</button>
		</div>
	</Sheet>
{/if}

{#if templatesOpen && (editingTemplate || creatingTemplate)}
	<JournalTemplateSheet
		template={editingTemplate}
		busy={templateBusy}
		error={templateError}
		onclose={closeTemplateForm}
		onsubmit={submitTemplate}
	/>
{/if}
