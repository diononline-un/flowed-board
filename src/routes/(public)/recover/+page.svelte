<script lang="ts">
	import { goto } from '$app/navigation';
	import RecoveryScreen from '$lib/components/RecoveryScreen.svelte';
	import { copy } from '$lib/shared/copy.js';

	let username = $state('');
	let phrase = $state('');
	let newPassword = $state('');
	let error = $state('');
	let fieldErrors = $state<Record<string, string>>({});
	let busy = $state(false);
	let recoveryPhrase = $state('');

	async function submit() {
		busy = true;
		error = '';
		fieldErrors = {};
		try {
			const response = await fetch('/api/auth/recover', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, phrase, newPassword })
			});
			const result = (await response.json().catch(() => null)) as {
				recoveryPhrase?: string;
				error?: string;
				fields?: Record<string, string>;
			} | null;
			if (response.ok && result?.recoveryPhrase) {
				recoveryPhrase = result.recoveryPhrase;
				return;
			}
			fieldErrors = result?.fields ?? {};
			error =
				Object.keys(fieldErrors).length === 0
					? (result?.error ?? copy.errors.generic)
					: '';
		} catch {
			error = copy.errors.generic;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{copy.auth.recoverTitle} · {copy.appName}</title>
</svelte:head>

{#if recoveryPhrase}
	<RecoveryScreen phrase={recoveryPhrase} onfinish={() => goto('/plans')} />
{:else}
	<div class="rounded-card border border-paper-dark bg-paper p-6 shadow-postit">
		<h1 class="text-2xl font-bold text-ink">{copy.auth.recoverTitle}</h1>
		<p class="mt-1 text-sm text-ink-soft">{copy.auth.recoverSubtitle}</p>

		<form
			class="mt-6 flex flex-col gap-4"
			onsubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{copy.auth.username}</span>
				<input
					type="text"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
					bind:value={username}
					autocomplete="username"
					autocapitalize="none"
					required
				/>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{copy.auth.phraseLabel}</span>
				<textarea
					class="min-h-24 rounded-lg border border-paper-dark bg-paper px-3 py-2 font-mono text-sm text-ink"
					bind:value={phrase}
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					required
					aria-describedby="recover-phrase-hint"
				></textarea>
				<span id="recover-phrase-hint" class="text-xs text-ink-soft">
					{copy.auth.phraseHint}
				</span>
			</label>

			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{copy.auth.newPassword}</span>
				<input
					type="password"
					class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
					bind:value={newPassword}
					autocomplete="new-password"
					minlength="10"
					maxlength="128"
					required
					aria-describedby="recover-password-hint{fieldErrors.newPassword
						? ' recover-password-error'
						: ''}"
				/>
				<span id="recover-password-hint" class="text-xs text-ink-soft">
					{copy.auth.passwordHint}
				</span>
				{#if fieldErrors.newPassword}
					<span id="recover-password-error" class="text-sm text-ink" role="alert">
						{fieldErrors.newPassword}
					</span>
				{/if}
			</label>

			{#if error}
				<p class="text-sm font-semibold text-ink" role="alert">{error}</p>
			{/if}

			<button
				type="submit"
				class="mt-2 rounded-pill bg-butter px-5 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
				disabled={busy}
			>
				{copy.auth.recoverSubmit}
			</button>
		</form>

		<p class="mt-5 text-sm">
			<a class="font-semibold text-ink underline-offset-2 hover:underline" href="/login">
				{copy.auth.backToLogin}
			</a>
		</p>
	</div>
{/if}
