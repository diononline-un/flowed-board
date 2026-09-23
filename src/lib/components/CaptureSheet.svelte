<script lang="ts">
	import CaptureFlow from './CaptureFlow.svelte';
	import Sheet from './Sheet.svelte';
	import { copy } from '$lib/shared/copy.js';
	import type { Prefs } from '$lib/shared/schemas.js';

	// Quick-Capture sheet (SPEC 8.1). The flow itself lives in CaptureFlow, so
	// the onboarding can embed the same component (SPEC 8.6 step 2); this file
	// only wraps it in the Sheet and closes it after a successful commit.
	let {
		prefs,
		providerName,
		today,
		initialText,
		onclose
	}: {
		prefs: Prefs;
		providerName: string;
		today: string;
		initialText: string;
		onclose: () => void;
	} = $props();

	const consentPending = $derived(prefs.aiConsentAt === null && prefs.aiEnabled);
</script>

<Sheet
	title={consentPending ? copy.capture.consentTitle : copy.capture.title}
	{onclose}
>
	<CaptureFlow
		{prefs}
		{providerName}
		{today}
		{initialText}
		closeOnApplied
		onApplied={onclose}
	/>
</Sheet>
