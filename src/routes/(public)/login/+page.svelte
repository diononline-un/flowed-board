<script lang="ts">
	import { goto } from '$app/navigation';
	import { copy } from '$lib/shared/copy.js';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit() {
		busy = true;
		error = '';
		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});
			if (response.ok) {
				await goto('/plans');
				return;
			}
			const data = (await response.json().catch(() => null)) as {
				error?: string;
			} | null;
			error = data?.error ?? copy.errors.generic;
		} catch {
			error = copy.errors.generic;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{copy.auth.loginTitle} · {copy.appName}</title>
</svelte:head>

<div class="rounded-card border border-paper-dark bg-paper p-6 shadow-postit">
	<h1 class="text-2xl font-bold text-ink">{copy.auth.loginTitle}</h1>
	<p class="mt-1 text-sm text-ink-soft">{copy.auth.loginSubtitle}</p>

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
			<span class="text-sm font-semibold text-ink">{copy.auth.password}</span>
			<input
				type="password"
				class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
				bind:value={password}
				autocomplete="current-password"
				required
			/>
		</label>

		{#if error}
			<p class="text-sm font-semibold text-ink" role="alert">{error}</p>
		{/if}

		<button
			type="submit"
			class="mt-2 rounded-pill bg-butter px-5 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
			disabled={busy}
		>
			{copy.auth.loginSubmit}
		</button>
	</form>

	<div class="mt-5 flex flex-col gap-1 text-sm">
		<a class="font-semibold text-ink underline-offset-2 hover:underline" href="/recover">
			{copy.auth.forgotLink}
		</a>
		<p class="text-ink-soft">
			{copy.auth.noAccount}
			<a class="font-semibold text-ink underline-offset-2 hover:underline" href="/register">
				{copy.auth.registerLink}
			</a>
		</p>
	</div>
</div>
