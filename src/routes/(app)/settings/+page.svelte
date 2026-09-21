<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import RecoveryScreen from '$lib/components/RecoveryScreen.svelte';
	import { copy } from '$lib/shared/copy.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const user = $derived(data.user);
	const accountCopy = copy.settings.account;

	// Profile section.
	let displayName = $state(data.user.displayName);
	let tz = $state(data.user.tz);
	let weekStart = $state(String(data.user.weekStart));
	let profileBusy = $state(false);
	let profileSaved = $state(false);
	let profileErrors = $state<Record<string, string>>({});

	const timezoneSuggestions = [
		'Europe/Berlin',
		'Europe/Vienna',
		'Europe/Zurich',
		'Europe/London',
		'Europe/Paris',
		'UTC'
	];

	async function saveProfile() {
		profileBusy = true;
		profileSaved = false;
		profileErrors = {};
		try {
			const response = await fetch('/api/account', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					displayName,
					tz,
					weekStart: Number(weekStart)
				})
			});
			const result = (await response.json().catch(() => null)) as {
				fields?: Record<string, string>;
				error?: string;
			} | null;
			if (response.ok) {
				profileSaved = true;
				await invalidateAll();
				return;
			}
			profileErrors = result?.fields ?? { _: result?.error ?? copy.errors.generic };
		} catch {
			profileErrors = { _: copy.errors.generic };
		} finally {
			profileBusy = false;
		}
	}

	// Password change (ConfirmDialog, P5 exception).
	let showPasswordDialog = $state(false);
	let passwordCurrent = $state('');
	let passwordNew = $state('');
	let passwordBusy = $state(false);
	let passwordError = $state('');
	let passwordDone = $state(false);

	function openPasswordDialog() {
		passwordCurrent = '';
		passwordNew = '';
		passwordError = '';
		showPasswordDialog = true;
	}

	async function changePassword() {
		passwordBusy = true;
		passwordError = '';
		try {
			const response = await fetch('/api/account/password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					currentPassword: passwordCurrent,
					newPassword: passwordNew
				})
			});
			if (response.ok) {
				showPasswordDialog = false;
				passwordDone = true;
				await invalidateAll();
				return;
			}
			const result = (await response.json().catch(() => null)) as {
				fields?: Record<string, string>;
				error?: string;
			} | null;
			passwordError =
				result?.fields?.currentPassword ??
				result?.fields?.newPassword ??
				result?.error ??
				copy.errors.generic;
		} catch {
			passwordError = copy.errors.generic;
		} finally {
			passwordBusy = false;
		}
	}

	// Recovery phrase regeneration.
	let phrasePassword = $state('');
	let phraseBusy = $state(false);
	let phraseError = $state('');
	let newPhrase = $state('');

	async function regeneratePhrase() {
		phraseBusy = true;
		phraseError = '';
		try {
			const response = await fetch('/api/account/recovery-regenerate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password: phrasePassword })
			});
			const result = (await response.json().catch(() => null)) as {
				recoveryPhrase?: string;
				fields?: Record<string, string>;
				error?: string;
			} | null;
			if (response.ok && result?.recoveryPhrase) {
				newPhrase = result.recoveryPhrase;
				phrasePassword = '';
				return;
			}
			phraseError =
				result?.fields?.password ?? result?.error ?? copy.errors.generic;
		} catch {
			phraseError = copy.errors.generic;
		} finally {
			phraseBusy = false;
		}
	}

	async function finishPhrase() {
		newPhrase = '';
		await invalidateAll();
	}

	// Sessions.
	let sessionBusy = $state(false);
	let logoutAllDone = $state(false);

	async function logout() {
		sessionBusy = true;
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			await goto('/login');
		} finally {
			sessionBusy = false;
		}
	}

	async function logoutAll() {
		sessionBusy = true;
		logoutAllDone = false;
		try {
			const response = await fetch('/api/account/logout-all', { method: 'POST' });
			if (response.ok) logoutAllDone = true;
		} finally {
			sessionBusy = false;
		}
	}

	// Account deletion (ConfirmDialog, SPEC 6.7).
	let showDeleteDialog = $state(false);
	let deleteUsername = $state('');
	let deletePassword = $state('');
	let deleteBusy = $state(false);
	let deleteError = $state('');

	function openDeleteDialog() {
		deleteUsername = '';
		deletePassword = '';
		deleteError = '';
		showDeleteDialog = true;
	}

	async function deleteAccount() {
		deleteBusy = true;
		deleteError = '';
		try {
			const response = await fetch('/api/account', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: deleteUsername, password: deletePassword })
			});
			if (response.ok) {
				await goto('/login');
				return;
			}
			const result = (await response.json().catch(() => null)) as {
				fields?: Record<string, string>;
				error?: string;
			} | null;
			deleteError =
				result?.fields?.username ??
				result?.fields?.password ??
				result?.error ??
				copy.errors.generic;
		} catch {
			deleteError = copy.errors.generic;
		} finally {
			deleteBusy = false;
		}
	}
</script>

<svelte:head>
	<title>{copy.settings.title} · {copy.appName}</title>
</svelte:head>

<h1 class="text-3xl font-bold">{copy.settings.title}</h1>

{#if !user.recoveryConfirmedAt}
	<div
		class="mt-6 flex flex-col gap-2 rounded-card border border-sand bg-sand/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
		role="status"
	>
		<div>
			<p class="font-bold text-ink">{accountCopy.recoveryBannerTitle}</p>
			<p class="mt-1 text-sm text-ink-soft">{accountCopy.recoveryBannerText}</p>
		</div>
		<a
			href="#phrase-section"
			class="shrink-0 rounded-pill bg-butter px-4 py-2 text-center text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
		>
			{accountCopy.recoveryBannerAction}
		</a>
	</div>
{/if}

{#if newPhrase}
	<div class="mt-6">
		<RecoveryScreen phrase={newPhrase} onfinish={finishPhrase} />
	</div>
{/if}

<div class="mt-6 flex flex-col gap-6">
	<section
		class="rounded-card border border-paper-dark bg-paper p-6 shadow-postit"
		aria-labelledby="profile-heading"
	>
		<h2 id="profile-heading" class="text-xl font-bold text-ink">
			{accountCopy.profileTitle}
		</h2>
		<form
			class="mt-4 flex flex-col gap-4"
			onsubmit={(event) => {
				event.preventDefault();
				saveProfile();
			}}
		>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{accountCopy.displayName}</span>
				<input
					type="text"
					class="max-w-sm rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
					bind:value={displayName}
					minlength="1"
					maxlength="30"
					required
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{accountCopy.timezone}</span>
				<input
					type="text"
					class="max-w-sm rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
					bind:value={tz}
					list="timezone-suggestions"
					required
					aria-describedby="tz-hint{profileErrors.tz ? ' tz-error' : ''}"
				/>
				<datalist id="timezone-suggestions">
					{#each timezoneSuggestions as zone (zone)}
						<option value={zone}></option>
					{/each}
				</datalist>
				<span id="tz-hint" class="text-xs text-ink-soft">{accountCopy.timezoneHint}</span>
				{#if profileErrors.tz}
					<span id="tz-error" class="text-sm text-ink" role="alert">{profileErrors.tz}</span>
				{/if}
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{accountCopy.weekStart}</span>
				<select
					class="max-w-sm rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
					bind:value={weekStart}
				>
					<option value="1">{accountCopy.weekDays[1]}</option>
					<option value="6">{accountCopy.weekDays[6]}</option>
					<option value="0">{accountCopy.weekDays[0]}</option>
				</select>
			</label>

			{#if profileErrors._}
				<p class="text-sm font-semibold text-ink" role="alert">{profileErrors._}</p>
			{/if}
			{#if profileSaved}
				<p class="text-sm font-semibold text-ink" role="status">{accountCopy.saved}</p>
			{/if}

			<div>
				<button
					type="submit"
					class="rounded-pill bg-butter px-5 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
					disabled={profileBusy}
				>
					{accountCopy.save}
				</button>
			</div>
		</form>
	</section>

	<section
		class="rounded-card border border-paper-dark bg-paper p-6 shadow-postit"
		aria-labelledby="password-heading"
	>
		<h2 id="password-heading" class="text-xl font-bold text-ink">
			{accountCopy.passwordTitle}
		</h2>
		<p class="mt-1 text-sm text-ink-soft">{accountCopy.passwordHint}</p>
		{#if passwordDone}
			<p class="mt-3 text-sm font-semibold text-ink" role="status">
				{accountCopy.passwordChanged}
			</p>
		{/if}
		<button
			type="button"
			class="mt-4 rounded-pill bg-sky px-5 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
			onclick={openPasswordDialog}
		>
			{accountCopy.changePassword}
		</button>
	</section>

	<section
		id="phrase-section"
		class="rounded-card border border-paper-dark bg-paper p-6 shadow-postit"
		aria-labelledby="phrase-heading"
	>
		<h2 id="phrase-heading" class="text-xl font-bold text-ink">
			{accountCopy.recoveryTitle}
		</h2>
		<p class="mt-1 text-sm text-ink-soft">{accountCopy.recoveryHint}</p>
		<form
			class="mt-4 flex flex-col gap-3"
			onsubmit={(event) => {
				event.preventDefault();
				regeneratePhrase();
			}}
		>
			<label class="flex flex-col gap-1">
				<span class="text-sm font-semibold text-ink">{copy.auth.password}</span>
				<input
					type="password"
					class="max-w-sm rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
					bind:value={phrasePassword}
					autocomplete="current-password"
					required
				/>
			</label>
			{#if phraseError}
				<p class="text-sm font-semibold text-ink" role="alert">{phraseError}</p>
			{/if}
			<div>
				<button
					type="submit"
					class="rounded-pill bg-mint px-5 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
					disabled={phraseBusy}
				>
					{accountCopy.recoverySubmit}
				</button>
			</div>
		</form>
	</section>

	<section
		class="rounded-card border border-paper-dark bg-paper p-6 shadow-postit"
		aria-labelledby="sessions-heading"
	>
		<h2 id="sessions-heading" class="text-xl font-bold text-ink">
			{accountCopy.sessionsTitle}
		</h2>
		{#if logoutAllDone}
			<p class="mt-2 text-sm font-semibold text-ink" role="status">
				{accountCopy.logoutAllDone}
			</p>
		{/if}
		<div class="mt-4 flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-pill bg-paper-dark px-5 py-2.5 text-sm font-bold text-ink transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
				onclick={logout}
				disabled={sessionBusy}
			>
				{accountCopy.logout}
			</button>
			<button
				type="button"
				class="rounded-pill bg-paper-dark px-5 py-2.5 text-sm font-bold text-ink transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
				onclick={logoutAll}
				disabled={sessionBusy}
			>
				{accountCopy.logoutAll}
			</button>
		</div>
	</section>

	<section
		class="rounded-card border border-paper-dark bg-paper p-6 shadow-postit"
		aria-labelledby="data-heading"
	>
		<h2 id="data-heading" class="text-xl font-bold text-ink">{accountCopy.dataTitle}</h2>
		<p class="mt-1 text-sm text-ink-soft">{accountCopy.dataText}</p>
		<a
			href="/api/account/export"
			class="mt-4 inline-block rounded-pill bg-sage px-5 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
		>
			{accountCopy.export}
		</a>
	</section>

	<section
		class="rounded-card border border-blush bg-blush/20 p-6"
		aria-labelledby="danger-heading"
	>
		<h2 id="danger-heading" class="text-xl font-bold text-ink">
			{accountCopy.dangerTitle}
		</h2>
		<p class="mt-1 text-sm text-ink-soft">{accountCopy.dangerText}</p>
		<button
			type="button"
			class="mt-4 rounded-pill bg-blush px-5 py-2.5 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
			onclick={openDeleteDialog}
		>
			{accountCopy.deleteButton}
		</button>
	</section>
</div>

{#if showPasswordDialog}
	<ConfirmDialog
		title={accountCopy.passwordTitle}
		text={accountCopy.passwordDialogText}
		confirmLabel={accountCopy.confirm}
		busy={passwordBusy}
		onconfirm={changePassword}
		oncancel={() => (showPasswordDialog = false)}
	>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-semibold text-ink">{accountCopy.currentPassword}</span>
			<input
				type="password"
				class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
				bind:value={passwordCurrent}
				autocomplete="current-password"
				required
			/>
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-semibold text-ink">{accountCopy.newPassword}</span>
			<input
				type="password"
				class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
				bind:value={passwordNew}
				autocomplete="new-password"
				minlength="10"
				maxlength="128"
				required
			/>
		</label>
		{#if passwordError}
			<p class="text-sm font-semibold text-ink" role="alert">{passwordError}</p>
		{/if}
	</ConfirmDialog>
{/if}

{#if showDeleteDialog}
	<ConfirmDialog
		title={accountCopy.deleteDialogTitle}
		text={accountCopy.deleteDialogText}
		confirmLabel={accountCopy.deleteConfirm}
		danger
		busy={deleteBusy}
		onconfirm={deleteAccount}
		oncancel={() => (showDeleteDialog = false)}
	>
		<label class="flex flex-col gap-1">
			<span class="text-sm font-semibold text-ink">{copy.auth.username}</span>
			<input
				type="text"
				class="rounded-lg border border-paper-dark bg-paper px-3 py-2 text-ink"
				bind:value={deleteUsername}
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
				bind:value={deletePassword}
				autocomplete="current-password"
				required
			/>
		</label>
		{#if deleteError}
			<p class="text-sm font-semibold text-ink" role="alert">{deleteError}</p>
		{/if}
	</ConfirmDialog>
{/if}
