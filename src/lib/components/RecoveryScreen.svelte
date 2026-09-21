<script lang="ts">
	import { copy } from '$lib/shared/copy.js';

	// Recovery phrase screen (SPEC 6.3): shown once after register, recover
	// and regenerate. Offers copy/download, the verbatim 6.3a warning and an
	// optional client-side confirmation step (3 random word positions).
	let { phrase, onfinish }: { phrase: string; onfinish: () => void } = $props();

	const words = $derived(phrase.split(' '));

	let step = $state<'show' | 'confirm'>('show');
	let copied = $state(false);
	let copyFailed = $state(false);
	let positions = $state<number[]>([]);
	let answers = $state<string[]>(['', '', '']);
	let confirmFailed = $state(false);
	let busy = $state(false);

	async function copyPhrase() {
		try {
			await navigator.clipboard.writeText(phrase);
			copied = true;
			copyFailed = false;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copyFailed = true;
		}
	}

	function downloadPhrase() {
		const lines = [
			`${copy.appName} — ${copy.recovery.title}`,
			'',
			...words.map((word, index) => `${index + 1}. ${word}`),
			'',
			copy.recovery.warning
		];
		const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = copy.recovery.downloadName;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	function startConfirm() {
		// 3 distinct random word positions, ascending.
		const pool = words.map((_, index) => index);
		const picked: number[] = [];
		while (picked.length < 3 && pool.length > 0) {
			const index = Math.floor(Math.random() * pool.length);
			picked.push(pool.splice(index, 1)[0]!);
		}
		positions = picked.sort((a, b) => a - b);
		answers = ['', '', ''];
		confirmFailed = false;
		step = 'confirm';
	}

	async function submitConfirm() {
		const allCorrect = positions.every(
			(position, index) =>
				(answers[index] ?? '').trim().toLowerCase() === words[position]
		);
		if (!allCorrect) {
			confirmFailed = true;
			return;
		}
		busy = true;
		try {
			const response = await fetch('/api/account/recovery-confirmed', {
				method: 'POST'
			});
			if (response.ok) {
				onfinish();
				return;
			}
			confirmFailed = true;
		} catch {
			confirmFailed = true;
		} finally {
			busy = false;
		}
	}
</script>

<div class="rounded-card border border-paper-dark bg-paper p-6 shadow-postit">
	{#if step === 'show'}
		<h2 class="text-2xl font-bold text-ink">{copy.recovery.title}</h2>
		<p class="mt-1 text-sm text-ink-soft">{copy.recovery.intro}</p>

		<ol
			class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3"
			aria-label={copy.recovery.title}
		>
			{#each words as word, index (index)}
				<li class="flex items-baseline gap-2 rounded-lg bg-paper-dark/60 px-3 py-2">
					<span class="text-xs font-semibold text-ink-soft">{index + 1}.</span>
					<span class="font-mono text-sm font-bold text-ink">{word}</span>
				</li>
			{/each}
		</ol>

		<p class="mt-5 rounded-lg bg-sand/40 px-4 py-3 text-sm leading-relaxed text-ink">
			{copy.recovery.warning}
		</p>

		<div class="mt-5 flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-pill bg-butter px-4 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
				onclick={copyPhrase}
			>
				{copied ? copy.recovery.copied : copy.recovery.copy}
			</button>
			<button
				type="button"
				class="rounded-pill bg-mint px-4 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
				onclick={downloadPhrase}
			>
				{copy.recovery.download}
			</button>
		</div>
		{#if copyFailed}
			<p class="mt-2 text-sm text-ink-soft" role="alert">{copy.recovery.copyFailed}</p>
		{/if}

		<div class="mt-6 flex items-center justify-between gap-2">
			<button
				type="button"
				class="rounded-pill bg-sky px-5 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
				onclick={startConfirm}
			>
				{copy.recovery.confirmStart}
			</button>
			<button
				type="button"
				class="rounded-pill px-4 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
				onclick={onfinish}
			>
				{copy.recovery.later}
			</button>
		</div>
	{:else}
		<h2 class="text-2xl font-bold text-ink">{copy.recovery.confirmTitle}</h2>
		<p class="mt-1 text-sm text-ink-soft">{copy.recovery.confirmIntro}</p>

		<form
			class="mt-5 flex flex-col gap-3"
			onsubmit={(event) => {
				event.preventDefault();
				submitConfirm();
			}}
		>
			{#each positions as position, index (position)}
				<label class="flex flex-col gap-1">
					<span class="text-sm font-semibold text-ink">
						{copy.recovery.wordLabel(position + 1)}
					</span>
					<input
						type="text"
						class="rounded-lg border border-paper-dark bg-paper px-3 py-2 font-mono text-sm text-ink"
						bind:value={answers[index]}
						autocomplete="off"
						autocapitalize="none"
						spellcheck="false"
						required
					/>
				</label>
			{/each}

			{#if confirmFailed}
				<p class="text-sm font-semibold text-ink" role="alert">
					{copy.recovery.confirmWrong}
				</p>
			{/if}

			<div class="mt-3 flex items-center justify-between gap-2">
				<button
					type="submit"
					class="rounded-pill bg-sky px-5 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
					disabled={busy}
				>
					{copy.recovery.confirmSubmit}
				</button>
				<button
					type="button"
					class="rounded-pill px-4 py-2 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink disabled:opacity-50"
					onclick={onfinish}
					disabled={busy}
				>
					{copy.recovery.later}
				</button>
			</div>
		</form>
	{/if}
</div>
