<script lang="ts">
	import { page } from '$app/state';
	import { CalendarDays, NotebookPen, Plus, Settings, StickyNote } from 'lucide-svelte';
	import LevelBadge from './LevelBadge.svelte';
	import { openCapture } from '$lib/state/capture.svelte.js';
	import { xpStore } from '$lib/state/xp.svelte.js';
	import { copy } from '$lib/shared/copy.js';

	// Desktop navigation (SPEC 10.3): full sidebar >= 1024px, icon rail
	// 768–1024px. The Quick-Capture input sits fixed at the top (SPEC 10.3).
	// The level chip is additive and only shown when gamification is on
	// (SPEC 5.6, P7).
	const items = [
		{ href: '/plans', label: copy.nav.plans, icon: StickyNote },
		{ href: '/calendar', label: copy.nav.calendar, icon: CalendarDays },
		{ href: '/journal', label: copy.nav.journal, icon: NotebookPen },
		{ href: '/settings', label: copy.nav.settings, icon: Settings }
	];

	let captureDraft = $state('');

	function submitCapture() {
		openCapture(captureDraft.trim());
		captureDraft = '';
	}
</script>

<aside
	class="hidden border-r border-paper-dark bg-paper md:flex md:w-16 md:flex-col lg:w-60"
	aria-label="Hauptnavigation"
>
	<a
		href="/plans"
		class="flex items-center gap-2 px-3 py-5 font-hand text-2xl font-bold text-ink"
	>
		<span aria-hidden="true" class="inline-block h-6 w-6 rounded-md bg-butter shadow-postit"></span>
		<span class="hidden lg:inline">{copy.appName}</span>
	</a>
	<div class="px-2 pb-3">
		<form
			class="hidden lg:block"
			onsubmit={(event) => {
				event.preventDefault();
				submitCapture();
			}}
		>
			<label class="sr-only" for="sidebar-capture">{copy.capture.inputLabel}</label>
			<input
				id="sidebar-capture"
				type="text"
				inputmode="text"
				maxlength="2000"
				placeholder={copy.capture.sidebarPlaceholder}
				class="w-full rounded-pill border border-paper-dark bg-paper px-3 py-2 text-sm text-ink shadow-postit"
				bind:value={captureDraft}
			/>
		</form>
		<button
			type="button"
			aria-label={copy.capture.fabLabel}
			title={copy.capture.fabLabel}
			class="flex w-full items-center justify-center gap-3 rounded-pill bg-butter px-3 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] lg:hidden"
			onclick={() => openCapture()}
		>
			<Plus size={18} strokeWidth={2} aria-hidden="true" />
		</button>
	</div>
	<nav class="flex flex-1 flex-col gap-1 px-2">
		{#each items as item (item.href)}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				title={item.label}
				class="flex items-center gap-3 rounded-pill px-3 py-2 text-sm font-semibold transition-colors duration-fast {active
					? 'bg-butter text-ink'
					: 'text-ink-soft hover:bg-paper-dark hover:text-ink'}"
			>
				<item.icon size={20} strokeWidth={1.75} aria-hidden="true" />
				<span class="hidden lg:inline">{item.label}</span>
			</a>
		{/each}
	</nav>
	{#if xpStore.gamification}
		<div class="hidden px-3 pb-4 lg:block">
			<LevelBadge total={xpStore.total} showName />
		</div>
	{/if}
</aside>
