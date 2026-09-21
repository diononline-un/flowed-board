<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import CapturePreviewRow from './CapturePreviewRow.svelte';
	import Sheet from './Sheet.svelte';
	import { pushErrorToast, pushToast } from '$lib/state/toasts.svelte.js';
	import { copy } from '$lib/shared/copy.js';
	import type { CaptureItem, Prefs } from '$lib/shared/schemas.js';
	import type { PublicPostit } from '$lib/shared/types.js';

	// Quick Capture (SPEC 8.1/9): consent gate (9.5) -> input -> parse with
	// 8 s server-side cap -> editable preview -> commit -> undo toast (8 s).
	// Every failure path (network, 429, invalid answer) degrades to the SPEC
	// 9.4 fallback — the flow never breaks. Nothing is stored before the user
	// confirms the preview (AC2); without AI consent the raw text is stored
	// directly as one post-it dated today (AC4).
	let {
		prefs,
		providerName,
		today,
		initialText,
		onclose
	}: {
		prefs: Prefs;
		providerName: string;
		today: string;
		initialText: string;
		onclose: () => void;
	} = $props();

	type Phase = 'consent' | 'input' | 'loading' | 'preview';

	// Local copies of the consent flags so a decision made here applies
	// immediately; the PATCH response resyncs the layout data afterwards.
	let aiEnabled = $state(prefs.aiEnabled);
	let aiConsentAt = $state<string | null>(prefs.aiConsentAt);

	const aiAllowed = $derived(aiConsentAt !== null && aiEnabled);

	let phase = $state<Phase>(
		prefs.aiConsentAt === null && prefs.aiEnabled ? 'consent' : 'input'
	);
	let text = $state(initialText);
	let items = $state<CaptureItem[]>([]);
	let fallbackUsed = $state(false);
	let busy = $state(false);

	const applyDisabled = $derived(
		busy || items.length === 0 || items.some((item) => item.title.trim() === '')
	);

	function fallbackItem(raw: string): CaptureItem {
		return {
			title: raw.slice(0, 140),
			date: today,
			time: null,
			suggestedGoalTitle: null,
			suggestedHabit: null
		};
	}

	async function post(path: string, body: unknown): Promise<Response> {
		return fetch(path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
	}

	// SPEC 9.5 consent decision, persisted via PATCH /api/account (prefs).
	async function decideConsent(allow: boolean) {
		busy = true;
		try {
			const response = await fetch('/api/account', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prefs: allow
						? { aiConsentAt: new Date().toISOString(), aiEnabled: true }
						: { aiEnabled: false }
				})
			});
			if (!response.ok) {
				pushErrorToast(copy.capture.error);
				return;
			}
			if (allow) aiConsentAt = new Date().toISOString();
			aiEnabled = allow;
			phase = 'input';
			void invalidateAll();
		} catch {
			pushErrorToast(copy.capture.error);
		} finally {
			busy = false;
		}
	}

	async function submit() {
		const value = text.trim();
		if (value === '' || busy) return;
		// AC4 / decline path: no AI, store the raw text directly.
		if (!aiAllowed) {
			await commitItems([fallbackItem(value)]);
			return;
		}
		phase = 'loading';
		let response: Response;
		try {
			response = await post('/api/capture/parse', { text: value });
		} catch {
			// Network failure: still land in the preview with the fallback row.
			items = [fallbackItem(value)];
			fallbackUsed = true;
			phase = 'preview';
			return;
		}
		if (response.status === 429) {
			const body = (await response.json().catch(() => null)) as { error?: string } | null;
			if (body?.error === 'ai_limit_reached') {
				// SPEC 9.3: limit text, then straight to the fallback commit.
				pushToast(copy.capture.limitReached);
				await commitItems([fallbackItem(value)]);
			} else {
				pushErrorToast(copy.auth.errors.rateLimited);
				phase = 'input';
			}
			return;
		}
		const body = response.ok
			? ((await response.json().catch(() => null)) as {
					items?: CaptureItem[];
					fallback?: boolean;
				} | null)
			: null;
		if (!body || !Array.isArray(body.items) || body.items.length === 0) {
			items = [fallbackItem(value)];
			fallbackUsed = true;
		} else {
			items = body.items;
			fallbackUsed = body.fallback === true;
		}
		phase = 'preview';
	}

	async function commitItems(payload: CaptureItem[]) {
		busy = true;
		try {
			const response = await post('/api/capture/commit', { items: payload });
			const body = (await response.json().catch(() => null)) as {
				batchId?: string;
				created?: PublicPostit[];
			} | null;
			if (!response.ok || !body?.batchId || !body.created) {
				pushErrorToast(copy.capture.error);
				phase = items.length > 0 ? 'preview' : 'input';
				return;
			}
			const batchId = body.batchId;
			onclose();
			pushToast(copy.capture.created(body.created.length), {
				action: {
					label: copy.capture.undo,
					run: async () => {
						const undoResponse = await post('/api/capture/undo', { batchId });
						if (!undoResponse.ok) {
							pushErrorToast(copy.capture.error);
							return;
						}
						await invalidateAll();
					}
				}
			});
			await invalidateAll();
		} catch {
			pushErrorToast(copy.capture.error);
			phase = items.length > 0 ? 'preview' : 'input';
		} finally {
			busy = false;
		}
	}
</script>

<Sheet
	title={phase === 'consent' ? copy.capture.consentTitle : copy.capture.title}
	{onclose}
>
	{#if phase === 'consent'}
		<p class="text-sm leading-relaxed text-ink">
			{#each copy.capture.consentText(providerName).split('**') as part, index (index)}
				{#if index % 2 === 1}<strong>{part}</strong>{:else}{part}{/if}
			{/each}
		</p>
		<div class="mt-5 flex flex-col gap-2 sm:flex-row">
			<button
				type="button"
				disabled={busy}
				class="flex-1 rounded-pill bg-butter px-4 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-60"
				onclick={() => decideConsent(true)}
			>
				{copy.capture.consentAllow}
			</button>
			<button
				type="button"
				disabled={busy}
				class="flex-1 rounded-pill border border-paper-dark bg-paper px-4 py-2.5 text-sm font-bold text-ink transition-colors duration-fast hover:bg-paper-dark disabled:opacity-60"
				onclick={() => decideConsent(false)}
			>
				{copy.capture.consentDecline}
			</button>
		</div>
	{:else if phase === 'input' || phase === 'loading'}
		<form
			class="flex flex-col gap-3"
			onsubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			<label class="flex flex-col gap-1" for="capture-input">
				<span class="text-sm font-semibold text-ink">{copy.capture.inputLabel}</span>
				<input
					id="capture-input"
					type="text"
					inputmode="text"
					maxlength="2000"
					placeholder={copy.capture.inputPlaceholder}
					disabled={phase === 'loading'}
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2.5 text-base text-ink"
					bind:value={text}
				/>
			</label>
			{#if phase === 'loading'}
				<p class="flex items-center gap-2 text-sm text-ink-soft" role="status">
					<span
						class="inline-block h-3 w-3 animate-pulse rounded-full bg-butter motion-reduce:animate-none"
						aria-hidden="true"
					></span>
					{copy.capture.loading}
				</p>
			{/if}
			<button
				type="submit"
				disabled={phase === 'loading' || text.trim() === ''}
				class="rounded-pill bg-butter px-4 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-60"
			>
				{copy.capture.send}
			</button>
		</form>
	{:else}
		{#if fallbackUsed}
			<p class="mb-3 rounded-card bg-sand/50 px-3 py-2 text-sm text-ink" role="status">
				{copy.capture.fallbackHint}
			</p>
		{:else}
			<p class="mb-3 text-sm text-ink-soft">{copy.capture.previewHint}</p>
		{/if}
		<ul class="flex flex-col gap-2.5">
			{#each items as item, index (index)}
				<CapturePreviewRow
					{item}
					onremove={() => (items = items.filter((_, i) => i !== index))}
				/>
			{/each}
		</ul>
		<button
			type="button"
			disabled={applyDisabled}
			class="mt-4 w-full rounded-pill bg-butter px-4 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-60"
			onclick={() => commitItems(items)}
		>
			{copy.capture.apply}
		</button>
	{/if}
</Sheet>
