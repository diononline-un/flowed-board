<script lang="ts">
	import type { Snippet } from 'svelte';
	import CaptureSheet from '$lib/components/CaptureSheet.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Tabbar from '$lib/components/Tabbar.svelte';
	import ToastHost from '$lib/components/ToastHost.svelte';
	import { captureState, closeCapture, openCapture } from '$lib/state/capture.svelte.js';
	import { syncXp } from '$lib/state/xp.svelte.js';
	import { formatDe } from '$lib/shared/date.js';
	import type { LayoutData } from './$types';

	// App shell (SPEC 10.3): sidebar on desktop, bottom tab bar on mobile,
	// content capped at 1100px and centered. Quick Capture opens via
	// Cmd/Ctrl+K (SPEC 8.1), the sidebar input or the tab-bar FAB.
	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	// Keeps the XP chip in the shell in sync with the server value (SPEC 5.6).
	$effect(() => {
		syncXp(data.xp.total, data.user.prefs.gamification);
	});

	$effect(() => {
		function onKeydown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				openCapture();
			}
		}
		document.addEventListener('keydown', onKeydown);
		return () => document.removeEventListener('keydown', onKeydown);
	});
</script>

<!-- SPEC 11 / P8: `prefs.reduceMotion` switches every non-functional transition
     off, exactly like the media query does. The class sits on one wrapper that
     contains the whole shell — tab bar, toasts and overlays included. -->
<div class:reduce-motion={data.user.prefs.reduceMotion}>
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
	{#if captureState.open}
		<CaptureSheet
			prefs={data.user.prefs}
			providerName={data.llmProviderName}
			today={data.today}
			initialText={captureState.initialText}
			onclose={closeCapture}
		/>
	{/if}
</div>
