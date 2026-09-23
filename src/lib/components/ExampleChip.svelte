<script lang="ts">
	import { copy } from '$lib/shared/copy.js';

	// The only thing `is_example` drives: a small, quiet "Beispiel" chip on the
	// seeded rows (SPEC 8.7). Everything else about them is ordinary content —
	// editable, deletable, no special treatment.
</script>

<span
	class="rounded-pill border border-paper-dark bg-paper/80 px-2 py-0.5 text-[0.7rem] font-semibold text-ink-soft"
	title={copy.gamification.exampleChip}
>
	{copy.gamification.exampleChip}
</span>
