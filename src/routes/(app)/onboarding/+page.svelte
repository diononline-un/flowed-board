<script lang="ts">
	import { Check } from 'lucide-svelte';
	import CaptureFlow from '$lib/components/CaptureFlow.svelte';
	import LevelBadge from '$lib/components/LevelBadge.svelte';
	import XpBar from '$lib/components/XpBar.svelte';
	import { applyXp, type XpResponsePayload } from '$lib/state/xp.svelte.js';
	import { pushErrorToast } from '$lib/state/toasts.svelte.js';
	import { copy } from '$lib/shared/copy.js';
	import { SEED_HABIT } from '$lib/shared/seed.js';
	import type { PageData } from './$types';

	// Onboarding (SPEC 8.6): four steps, each one skippable, progress dots on
	// top. Step 2 embeds the Quick Capture flow of M3 (same component as the
	// sheet), step 3 offers the example habit, step 4 picks the journal rhythm
	// that the seed applies to the standard templates.
	//
	// Finishing (and skipping, which equals finishing) posts once to
	// /api/onboarding/complete: it seeds the content, applies the rhythm and
	// stamps `onboarding_done_at` (AC15) — the value that keeps this page from
	// ever coming back (AC16, layout guard).
	let { data }: { data: PageData } = $props();

	const onboardingCopy = copy.onboarding;
	const TOTAL_STEPS = 4;

	let step = $state(1);
	let busy = $state(false);

	// Step 1
	let displayName = $state(data.user.displayName);

	// Step 3
	let habitEnabled = $state(true);
	let habitTitle = $state(SEED_HABIT.title);
	let habitTarget = $state(SEED_HABIT.targetCount);

	// Step 4
	let rhythm = $state<'morning' | 'evening' | 'off'>('evening');

	// Step 2 feedback, so the user sees that something landed.
	let capturedCount = $state(0);
	let captureResetKey = $state(0);

	const canContinue = $derived(step === 1 ? displayName.trim().length > 0 : true);

	function next() {
		if (step < TOTAL_STEPS) {
			step += 1;
			return;
		}
		void finish();
	}

	function back() {
		if (step > 1) step -= 1;
	}

	// "Überspringen" only moves on: everything is submitted together at the end
	// (or not at all), which is what makes the complete skip work (AC15).
	function skip() {
		if (step < TOTAL_STEPS) {
			step += 1;
			return;
		}
		void finish();
	}

	function skipAll() {
		void finish();
	}

	async function finish() {
		if (busy) return;
		busy = true;
		try {
			const response = await fetch('/api/onboarding/complete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					displayName: displayName.trim() === '' ? undefined : displayName.trim(),
					journalRhythm: rhythm,
					habit: habitEnabled
						? {
								title: habitTitle.trim() === '' ? SEED_HABIT.title : habitTitle.trim(),
								emoji: SEED_HABIT.emoji,
								cadence: 'week',
								targetCount: habitTarget
							}
						: null
				})
			});
			const body = (await response.json().catch(() => null)) as {
				xp?: XpResponsePayload;
			} | null;
			if (!response.ok) {
				pushErrorToast(onboardingCopy.error);
				return;
			}
			applyXp(body?.xp);
			// A real navigation: the layout guard then sees the stamped
			// `onboarding_done_at` and lets the app through (AC16).
			window.location.href = '/plans';
		} catch {
			pushErrorToast(onboardingCopy.error);
		} finally {
			busy = false;
		}
	}

	function onCaptureApplied(info: { count: number }) {
		capturedCount += info.count;
		captureResetKey += 1;
	}
</script>

<svelte:head>
	<title>{onboardingCopy.title} · {copy.appName}</title>
</svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6">
	<header>
		<h1 class="font-hand text-3xl font-bold text-ink">{onboardingCopy.title}</h1>
		<p class="mt-1 text-sm text-ink-soft">{onboardingCopy.intro}</p>

		<div class="mt-4 flex items-center gap-3">
			<ol class="flex items-center gap-2" aria-label={onboardingCopy.progressLabel}>
				{#each Array(TOTAL_STEPS) as _, index (index)}
					{@const active = index + 1 <= step}
					<li
						class="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold {active
							? 'border-lilac bg-lilac text-ink'
							: 'border-paper-dark bg-paper text-ink-soft'}"
						aria-current={index + 1 === step ? 'step' : undefined}
					>
						{#if index + 1 < step}
							<Check size={14} strokeWidth={2.5} aria-hidden="true" />
							<span class="sr-only">{index + 1}</span>
						{:else}
							{index + 1}
						{/if}
					</li>
				{/each}
			</ol>
			<span class="text-xs font-semibold text-ink-soft">
				{onboardingCopy.stepLabel(step, TOTAL_STEPS)}
			</span>
		</div>
	</header>

	{#if data.user.prefs.gamification}
		<section
			class="rounded-card border border-paper-dark bg-paper p-4 shadow-postit"
			aria-label={copy.gamification.title}
		>
			<div class="flex flex-wrap items-center gap-3">
				<LevelBadge total={data.xp.total} showName />
				<span class="text-xs font-semibold text-ink-soft">
					{onboardingCopy.dueChip(data.dueToday)}
				</span>
				<span class="text-xs font-semibold text-ink-soft">
					{onboardingCopy.weekChip(data.week.done, data.week.total)}
				</span>
			</div>
			<div class="mt-3">
				<XpBar total={data.xp.total} compact />
			</div>
		</section>
	{/if}

	<section
		class="rounded-card border border-paper-dark bg-paper p-6 shadow-postit"
		aria-labelledby="onboarding-step-heading"
	>
		{#if step === 1}
			<h2 id="onboarding-step-heading" class="text-xl font-bold text-ink">
				{onboardingCopy.nameTitle}
			</h2>
			<p class="mt-1 text-sm text-ink-soft">{onboardingCopy.nameHint}</p>
			<label class="mt-4 flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{copy.settings.account.displayName}</span>
				<input
					type="text"
					class="max-w-sm rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
					bind:value={displayName}
					minlength="1"
					maxlength="30"
					required
				/>
			</label>
		{:else if step === 2}
			<h2 id="onboarding-step-heading" class="text-xl font-bold text-ink">
				{onboardingCopy.weekTitle}
			</h2>
			<p class="mt-1 mb-4 text-sm text-ink-soft">{onboardingCopy.weekHint}</p>
			{#if capturedCount > 0}
				<p class="mb-3 rounded-card bg-mint/40 px-3 py-2 text-sm text-ink" role="status">
					{copy.capture.created(capturedCount)}
					· {onboardingCopy.seeded}
				</p>
			{/if}
			<CaptureFlow
				prefs={data.user.prefs}
				providerName={data.llmProviderName}
				today={data.today}
				resetKey={captureResetKey}
				onApplied={onCaptureApplied}
			/>
		{:else if step === 3}
			<h2 id="onboarding-step-heading" class="text-xl font-bold text-ink">
				{onboardingCopy.habitTitle}
			</h2>
			<p class="mt-1 text-sm text-ink-soft">{onboardingCopy.habitHint}</p>
			<label class="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
				<input type="checkbox" class="h-4 w-4 accent-ink" bind:checked={habitEnabled} />
				{onboardingCopy.habitTitleLabel}
			</label>
			{#if habitEnabled}
				<div class="mt-3 flex flex-col gap-3 sm:flex-row">
					<label class="flex flex-1 flex-col gap-1">
						<span class="text-sm font-semibold text-ink">{onboardingCopy.habitTitleLabel}</span>
						<input
							type="text"
							class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
							bind:value={habitTitle}
							maxlength="80"
						/>
					</label>
					<label class="flex w-full flex-col gap-1 sm:w-40">
						<span class="text-sm font-semibold text-ink">
							{onboardingCopy.habitTargetLabel}
						</span>
						<input
							type="number"
							min="1"
							max="100"
							class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
							bind:value={habitTarget}
						/>
					</label>
				</div>
				<button
					type="button"
					class="mt-3 rounded-pill bg-mint px-4 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
					onclick={() => {
						habitTitle = SEED_HABIT.title;
						habitTarget = SEED_HABIT.targetCount;
						habitEnabled = true;
					}}
				>
					{onboardingCopy.habitSuggestion}: {SEED_HABIT.title}
				</button>
			{:else}
				<p class="mt-3 text-sm text-ink-soft">{onboardingCopy.habitSkipped}</p>
			{/if}
		{:else}
			<h2 id="onboarding-step-heading" class="text-xl font-bold text-ink">
				{onboardingCopy.rhythmTitle}
			</h2>
			<p class="mt-1 text-sm text-ink-soft">{onboardingCopy.rhythmHint}</p>
			<div class="mt-4 flex flex-col gap-2">
				{#each ['morning', 'evening', 'off'] as option (option)}
					<label
						class="flex cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-sm font-semibold text-ink {rhythm ===
						option
							? 'border-lilac bg-lilac/30'
							: 'border-paper-dark bg-paper'}"
					>
						<input
							type="radio"
							name="journal-rhythm"
							value={option}
							checked={rhythm === option}
							onchange={() => (rhythm = option as 'morning' | 'evening' | 'off')}
							class="h-4 w-4 accent-ink"
						/>
						{onboardingCopy.rhythms[option as 'morning' | 'evening' | 'off']}
					</label>
				{/each}
			</div>
		{/if}
	</section>

	<div class="flex flex-wrap items-center gap-2">
		{#if step > 1}
			<button
				type="button"
				class="rounded-pill border border-paper-dark bg-paper px-4 py-2.5 text-sm font-bold text-ink transition-colors duration-fast hover:bg-paper-dark"
				onclick={back}
			>
				{onboardingCopy.back}
			</button>
		{/if}
		<button
			type="button"
			disabled={!canContinue || busy}
			class="rounded-pill bg-butter px-5 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-60"
			onclick={next}
		>
			{step === TOTAL_STEPS ? onboardingCopy.finish : onboardingCopy.next}
		</button>
		{#if step < TOTAL_STEPS}
			<button
				type="button"
				disabled={busy}
				class="rounded-pill px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:text-ink"
				onclick={skip}
			>
				{onboardingCopy.skip}
			</button>
		{/if}
		<button
			type="button"
			disabled={busy}
			class="rounded-pill px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:text-ink"
			onclick={skipAll}
		>
			{onboardingCopy.skipAll}
		</button>
	</div>
</div>
