<script lang="ts">
	import { page } from '$app/state';
	import { CalendarDays, NotebookPen, Settings, StickyNote } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';

	// Desktop navigation (SPEC 10.3): full sidebar >= 1024px, icon rail 768–1024px.
	const items = [
		{ href: '/plans', label: copy.nav.plans, icon: StickyNote },
		{ href: '/calendar', label: copy.nav.calendar, icon: CalendarDays },
		{ href: '/journal', label: copy.nav.journal, icon: NotebookPen },
		{ href: '/settings', label: copy.nav.settings, icon: Settings }
	];
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
</aside>
