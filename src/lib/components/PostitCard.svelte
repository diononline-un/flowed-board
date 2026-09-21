<script lang="ts">
	import {
		ArrowRightLeft,
		Calendar,
		Check,
		Ellipsis,
		Pencil,
		Target,
		Trash2
	} from 'lucide-svelte';
	import { copy } from '$lib/shared/copy.js';
	import { formatDe } from '$lib/shared/date.js';
	import type { Horizon, PublicGoal, PublicPostit } from '$lib/shared/types.js';

	// Post-it card (SPEC 8.2, 10.2): paper gradient, shadow-postit, goal
	// color stripe, optional tilt (only with prefs.postitTilt, SPEC P4),
	// overdue chip in sand — never red (SPEC P3). The context menu makes
	// every board action reachable without drag (SPEC 8.2 / AC7).
	let {
		postit,
		goal = null,
		today,
		tilt = false,
		ontoggle,
		onedit,
		onchangedate,
		onassigngoal,
		onmove,
		ondelete
	}: {
		postit: PublicPostit;
		goal?: PublicGoal | null;
		today: string;
		tilt?: boolean;
		ontoggle: () => void;
		onedit: () => void;
		onchangedate: () => void;
		onassigngoal: () => void;
		onmove: (lane: Horizon) => void;
		ondelete: () => void;
	} = $props();

	const done = $derived(postit.doneAt !== null);
	const overdue = $derived(postit.date !== null && postit.date < today && !done);
	const stripeColor = $derived(postit.color ?? goal?.color ?? 'butter');
	// Deterministic tilt per card (±1.5°, SPEC 10.2), stable across renders.
	const tiltDeg = $derived.by(() => {
		if (!tilt) return 0;
		let hash = 0;
		for (const char of postit.id) hash = (hash * 31 + char.charCodeAt(0)) % 997;
		return ((hash % 2 === 0 ? 1 : -1) * (0.5 + (hash % 100) / 100)).toFixed(2);
	});

	const lanes: Horizon[] = ['short', 'mid', 'long'];

	let menuOpen = $state(false);
	let menuEl: HTMLElement | undefined = $state();

	function closeMenu() {
		menuOpen = false;
	}

	function toggleMenu(event: MouseEvent) {
		event.stopPropagation();
		menuOpen = !menuOpen;
	}

	$effect(() => {
		if (!menuOpen) return;
		const first = menuEl?.querySelector<HTMLElement>('button');
		first?.focus();
		function onPointerDown(event: PointerEvent) {
			if (menuEl && !menuEl.contains(event.target as Node)) closeMenu();
		}
		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.stopPropagation();
				closeMenu();
			}
		}
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeydown, true);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeydown, true);
		};
	});

	function pick(action: () => void) {
		closeMenu();
		action();
	}
</script>

<div class="transition-transform duration-fast hover:scale-[1.02]" role="listitem">
	<article
		class="relative rounded-card shadow-postit {done ? 'opacity-60' : ''}"
		style:background="linear-gradient(160deg, #FFFDF7 0%, #FBF3E0 100%)"
		style:transform={tilt ? `rotate(${tiltDeg}deg)` : undefined}
	>
		<span
			class="absolute inset-y-0 left-0 w-1.5 rounded-l-card"
			style:background-color="var(--color-{stripeColor})"
			title={goal?.title}
			aria-hidden="true"
		></span>
		<div class="flex items-start gap-2 py-3 pr-2 pl-4">
			<button
				type="button"
				class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ink-soft transition-colors duration-fast {done
					? 'border-transparent bg-mint'
					: 'hover:border-ink'}"
				aria-label={done ? copy.plans.actions.reopen : copy.plans.actions.markDone}
				aria-pressed={done}
				onclick={ontoggle}
			>
				{#if done}
					<Check size={14} strokeWidth={2.5} aria-hidden="true" />
				{/if}
			</button>
			<div class="min-w-0 flex-1">
				<p class="text-sm leading-snug font-semibold text-ink {done ? 'line-through' : ''}">
					{postit.title}
				</p>
				<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
					{#if postit.date}
						<span
							class="rounded-pill bg-paper-dark/80 px-2 py-0.5 text-xs font-semibold text-ink-soft"
						>
							{formatDe(postit.date, 'short')}{postit.time ? ` · ${postit.time}` : ''}
						</span>
					{/if}
					{#if overdue}
						<span class="rounded-pill bg-sand/70 px-2 py-0.5 text-xs font-semibold text-ink">
							{copy.plans.overdueChip}
						</span>
					{/if}
				</div>
			</div>
			<div class="relative">
				<button
					type="button"
					class="rounded-full p-1 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
					aria-label={copy.plans.actions.openMenu}
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					onclick={toggleMenu}
				>
					<Ellipsis size={18} strokeWidth={1.75} aria-hidden="true" />
				</button>
				{#if menuOpen}
					<div
						bind:this={menuEl}
						role="menu"
						class="absolute right-0 z-40 mt-1 w-52 rounded-card border border-paper-dark bg-paper p-1.5 shadow-postit"
					>
						<button type="button" role="menuitem" class="menu-item" onclick={() => pick(onedit)}>
							<Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
							{copy.plans.actions.edit}
						</button>
						<button
							type="button"
							role="menuitem"
							class="menu-item"
							onclick={() => pick(onchangedate)}
						>
							<Calendar size={16} strokeWidth={1.75} aria-hidden="true" />
							{copy.plans.actions.changeDate}
						</button>
						<button
							type="button"
							role="menuitem"
							class="menu-item"
							onclick={() => pick(onassigngoal)}
						>
							<Target size={16} strokeWidth={1.75} aria-hidden="true" />
							{copy.plans.actions.assignGoal}
						</button>
						<p class="px-2.5 pt-1.5 pb-0.5 text-xs font-bold text-ink-soft">
							{copy.plans.actions.moveTo}
						</p>
						{#each lanes as lane (lane)}
							<button
								type="button"
								role="menuitem"
								class="menu-item pl-8"
								onclick={() => pick(() => onmove(lane))}
							>
								<ArrowRightLeft size={14} strokeWidth={1.75} aria-hidden="true" />
								{copy.plans.lanes[lane]}
							</button>
						{/each}
						<hr class="my-1 border-paper-dark" />
						<button
							type="button"
							role="menuitem"
							class="menu-item"
							onclick={() => pick(ondelete)}
						>
							<Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
							{copy.plans.actions.delete}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</article>
</div>

<style>
	.menu-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		border-radius: 0.6rem;
		padding: 0.45rem 0.65rem;
		text-align: left;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-ink);
		transition: background-color var(--duration-fast);
	}
	.menu-item:hover,
	.menu-item:focus-visible {
		background-color: var(--color-paper-dark);
	}
</style>
