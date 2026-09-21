<script lang="ts">
	import { page } from '$app/state';
	import { CalendarDays, NotebookPen, Settings, StickyNote } from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';

	// Mobile navigation (SPEC 10.3): bottom tab bar below 768px.
	const items = [
		{ href: '/plans', label: copy.nav.plans, icon: StickyNote },
		{ href: '/calendar', label: copy.nav.calendar, icon: CalendarDays },
		{ href: '/journal', label: copy.nav.journal, icon: NotebookPen },
		{ href: '/settings', label: copy.nav.settings, icon: Settings }
	];
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-40 border-t border-paper-dark bg-paper md:hidden"
	aria-label="Hauptnavigation"
>
	<div class="mx-auto flex max-w-[1100px] items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
		{#each items as item (item.href)}
			{@const active = page.url.pathname.startsWith(item.href)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				class="flex flex-1 flex-col items-center gap-0.5 rounded-t-lg px-1 py-2 text-[0.7rem] font-semibold transition-colors duration-fast {active
					? 'text-ink'
					: 'text-ink-soft hover:text-ink'}"
			>
				<item.icon size={22} strokeWidth={1.75} aria-hidden="true" />
				<span>{item.label}</span>
				<span
					aria-hidden="true"
					class="h-1 w-6 rounded-pill {active ? 'bg-butter' : 'bg-transparent'}"
				></span>
			</a>
		{/each}
	</div>
</nav>
