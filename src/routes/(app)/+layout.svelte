<script lang="ts">
	import type { Snippet } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Tabbar from '$lib/components/Tabbar.svelte';
	import ToastHost from '$lib/components/ToastHost.svelte';
	import { formatDe } from '$lib/shared/date.js';
	import type { LayoutData } from './$types';

	// App shell (SPEC 10.3): sidebar on desktop, bottom tab bar on mobile,
	// content capped at 1100px and centered.
	let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<div class="flex min-h-dvh">
	<Sidebar />
	<main class="min-w-0 flex-1">
		<div class="mx-auto max-w-[1100px] px-4 pt-6 pb-24 md:px-8 md:pb-10">
			<p class="mb-4 text-sm text-ink-soft">{formatDe(data.today, 'long')}</p>
			{@render children()}
		</div>
	</main>
</div>
<Tabbar />
<ToastHost />
