<script lang="ts">
	import { ChevronLeft, ChevronRight, Plus } from 'lucide-svelte';
	import CalendarGrid from '$lib/components/CalendarGrid.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import HabitBar from '$lib/components/HabitBar.svelte';
	import HabitSheet, { type HabitFormPayload } from '$lib/components/HabitSheet.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PostitSheet, { type PostitFormPayload } from '$lib/components/PostitSheet.svelte';
	import { pushErrorToast, pushToast } from '$lib/state/toasts.svelte.js';
	import { applyXp, type XpResponsePayload } from '$lib/state/xp.svelte.js';
	import {
	daysInMonthView,
	daysInWeekView,
	rangeOf,
	shiftWindow,
	windowLabel
} from '$lib/shared/calendar.js';
	import { copy } from '$lib/shared/copy.js';
	import { formatDe } from '$lib/shared/date.js';
	import { habitProgress, type HabitProgress } from '$lib/shared/habit.js';
	import type {
		PostitColor,
		PublicGoal,
		PublicHabit,
		PublicHabitLog,
		PublicPostit
	} from '$lib/shared/types.js';
	import type { PageData } from './$types';

	// Calendar + tracker (SPEC 8.4): week/month grid with the user's week
	// start, the habit bar with SPEC 5.5 progress and the tap target for
	// today, optimistic updates with rollback + error toast (SPEC 3.1).
	let { data }: { data: PageData } = $props();

	const today = $derived(data.today);
	const weekStartDay = $derived(data.user.weekStart);
	const activeGoals = $derived(data.goals.filter((goal) => goal.status === 'active'));

	// --- Window -------------------------------------------------------------

	let view = $state<'week' | 'month'>(data.view);
	// Reference day of the shown window; "Heute" resets it.
	let anchor = $state(data.today);

	const days = $derived(
		view === 'week' ? daysInWeekView(anchor, weekStartDay) : daysInMonthView(anchor, weekStartDay)
	);
	const label = $derived(windowLabel(view, days, anchor));

	// --- Post-its -----------------------------------------------------------

	let postits = $state<PublicPostit[]>(data.postits);
	// Range the post-its were loaded for (server-side on first render, then
	// refetched whenever the user navigates the window).
	let loadedRange = $state(
		rangeOf(
			data.view === 'week'
				? daysInWeekView(data.today, weekStartDay)
				: daysInMonthView(data.today, weekStartDay)
		)
	);

	$effect(() => {
		postits = data.postits;
	});

	// Covers exactly the shown window (strings compare lexicographically).
	const shownPostits = $derived(
		postits.filter(
			(postit) => postit.date !== null && postit.date >= loadedRange.from && postit.date <= loadedRange.to
		)
	);

	const postitsByDay = $derived.by(() => {
		const map = new Map<string, PublicPostit[]>();
		for (const postit of shownPostits) {
			if (!postit.date) continue;
			const list = map.get(postit.date) ?? [];
			list.push(postit);
			map.set(postit.date, list);
		}
		// Sorted by time (SPEC 8.4); undated times come last, then position.
		for (const list of map.values()) {
			list.sort((a, b) => {
				const aTime = a.time ?? '99:99';
				const bTime = b.time ?? '99:99';
				if (aTime !== bTime) return aTime < bTime ? -1 : 1;
				return a.position - b.position;
			});
		}
		return map;
	});

	const windowIsEmpty = $derived(shownPostits.length === 0);

	let windowRequest = 0;

	// Refetch the shown window from the API when the user navigates (SPEC 3.1:
	// reads go through +page.server.ts initially, this is the range change).
	// Out-of-range post-its are dropped so the client array cannot grow
	// without bound while stepping through weeks.
	async function loadWindow() {
		const range = rangeOf(days);
		const request = ++windowRequest;
		const previous = loadedRange;
		loadedRange = range;
		const result = await api<{ items: PublicPostit[] }>(
			`/api/postits?from=${range.from}&to=${range.to}`,
			'GET'
		);
		if (request !== windowRequest) return;
		if (!result) {
			loadedRange = previous;
			pushErrorToast(copy.plans.toast.error);
			return;
		}
		const keep = postits.filter(
			(postit) => postit.date === null || postit.date < range.from || postit.date > range.to
		);
		postits = [...keep, ...result.items];
	}

	function change(newView: 'week' | 'month') {
		if (newView === view) return;
		view = newView;
		void loadWindow();
	}

	function step(direction: 1 | -1) {
		anchor = shiftWindow(view, anchor, weekStartDay, direction);
		void loadWindow();
	}

	function goToday() {
		anchor = today;
		void loadWindow();
	}

	// --- API plumbing -------------------------------------------------------

	async function api<T>(path: string, method: string, body?: unknown): Promise<T | null> {
		try {
			const response = await fetch(path, {
				method,
				headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
				body: body !== undefined ? JSON.stringify(body) : undefined
			});
			if (!response.ok) return null;
			return (await response.json()) as T;
		} catch {
			return null;
		}
	}

	function replacePostit(updated: PublicPostit) {
		postits = postits.map((postit) => (postit.id === updated.id ? updated : postit));
	}

	// --- Post-it editing (AC10: changing the date moves it between horizons
	// on the board — purely derived from `date` on every board load) ---------

	let editingPostit = $state<PublicPostit | null>(null);
	let expandedDay = $state<string | null>(null);
	let formBusy = $state(false);
	let formError = $state('');
	const expandedPostits = $derived(expandedDay ? (postitsByDay.get(expandedDay) ?? []) : []);

	async function submitPostitForm(payload: PostitFormPayload) {
		const target = editingPostit;
		if (!target) return;
		formBusy = true;
		formError = '';
		const snapshot = postits.map((postit) => ({ ...postit }));
		postits = postits.map((postit) =>
			postit.id === target.id ? { ...postit, ...payload } : postit
		);
		const result = await api<{ postit: PublicPostit }>(
			`/api/postits/${target.id}`,
			'PATCH',
			payload
		);
		formBusy = false;
		if (!result) {
			postits = snapshot;
			formError = copy.plans.toast.error;
			return;
		}
		replacePostit(result.postit);
		editingPostit = null;
		pushToast(copy.calendar.toast.postitSaved);
	}

	// --- Habits -------------------------------------------------------------

	let habits = $state<PublicHabit[]>(data.habits);
	// Archived habits live in their own, collapsed section so archiving is
	// reversible from the UI (M7 polish).
	let archivedHabits = $state<PublicHabit[]>(data.archivedHabits);
	let showArchived = $state(false);
	let logDates = $state<Record<string, string[]>>(data.logDates);
	let busyHabitId = $state<string | null>(null);

	$effect(() => {
		habits = data.habits;
		archivedHabits = data.archivedHabits;
		logDates = data.logDates;
	});

	function progressOf(habit: PublicHabit): HabitProgress {
		return habitProgress(
			{
				cadence: habit.cadence,
				target_count: habit.targetCount,
				range_start: habit.rangeStart,
				range_end: habit.rangeEnd,
				max_per_day: habit.maxPerDay,
				created_at: habit.createdAt
			},
			logDates[habit.id] ?? [],
			today,
			weekStartDay
		);
	}

	// AC11: one tap = one log; the server caps it at max_per_day, the button
	// is disabled afterwards and the hint appears.
	async function logHabit(habit: PublicHabit, delta: 1 | -1) {
		const snapshot = logDates[habit.id] ?? [];
		const optimistic = [...snapshot];
		if (delta === 1) {
			optimistic.push(today);
		} else {
			const index = optimistic.lastIndexOf(today);
			if (index === -1) return;
			optimistic.splice(index, 1);
		}
		logDates = { ...logDates, [habit.id]: optimistic };
		busyHabitId = habit.id;
		const result = await api<{ habit: PublicHabit; todayCount: number; xp?: XpResponsePayload }>(
			`/api/habits/${habit.id}/logs`,
			'POST',
			{ date: today, delta }
		);
		busyHabitId = null;
		if (!result) {
			logDates = { ...logDates, [habit.id]: snapshot };
			pushErrorToast(copy.calendar.log.error);
			return;
		}
		// SPEC 5.6: 10 XP per habit and day (a second tap on the same day does
		// not earn again); the toast only appears when gamification is on.
		applyXp(result.xp);
		// Reconcile with the server count (a post-it log may already exist).
		const next = (logDates[habit.id] ?? []).filter((date) => date !== today);
		for (let i = 0; i < result.todayCount; i += 1) next.push(today);
		logDates = { ...logDates, [habit.id]: next };
	}

	let habitSheetOpen = $state(false);
	let editingHabit = $state<PublicHabit | null>(null);

	function openNewHabit() {
		editingHabit = null;
		formError = '';
		habitSheetOpen = true;
	}

	function openEditHabit(habit: PublicHabit) {
		editingHabit = habit;
		formError = '';
		habitSheetOpen = true;
	}

	// The `archivedAt` flag of the server answer decides which list a habit
	// belongs to, so archiving and unarchiving both reconcile through here.
	function replaceHabit(updated: PublicHabit) {
		const active = updated.archivedAt === null;
		habits = active
			? habits.some((habit) => habit.id === updated.id)
				? habits.map((habit) => (habit.id === updated.id ? updated : habit))
				: [...habits, updated]
			: habits.filter((habit) => habit.id !== updated.id);
		archivedHabits = active
			? archivedHabits.filter((habit) => habit.id !== updated.id)
			: archivedHabits.some((habit) => habit.id === updated.id)
				? archivedHabits.map((habit) => (habit.id === updated.id ? updated : habit))
				: [...archivedHabits, updated];
	}

	async function submitHabitForm(payload: HabitFormPayload) {
		formBusy = true;
		formError = '';
		try {
			if (editingHabit) {
				const result = await api<{ habit: PublicHabit }>(
					`/api/habits/${editingHabit.id}`,
					'PATCH',
					payload
				);
				if (!result) {
					formError = copy.calendar.log.error;
					return;
				}
				replaceHabit(result.habit);
				pushToast(copy.calendar.toast.updated);
			} else {
				const result = await api<{ habit: PublicHabit }>('/api/habits', 'POST', payload);
				if (!result) {
					formError = copy.calendar.log.error;
					return;
				}
				habits = [...habits, result.habit];
				logDates = { ...logDates, [result.habit.id]: [] };
				pushToast(copy.calendar.toast.created);
			}
			habitSheetOpen = false;
		} finally {
			formBusy = false;
		}
	}

	async function setArchived(habit: PublicHabit, archived: boolean) {
		const habitSnapshot = habits;
		const archivedSnapshot = archivedHabits;
		const dateSnapshot = logDates;
		busyHabitId = habit.id;
		habits = archived
			? habits.filter((entry) => entry.id !== habit.id)
			: habits.map((entry) => (entry.id === habit.id ? { ...entry, archivedAt: null } : entry));
		archivedHabits = archived
			? [...archivedHabits.filter((entry) => entry.id !== habit.id), { ...habit, archivedAt: new Date().toISOString() }]
			: archivedHabits.filter((entry) => entry.id !== habit.id);
		const result = await api<{ habit: PublicHabit }>(`/api/habits/${habit.id}`, 'PATCH', {
			archived
		});
		if (!result) {
			habits = habitSnapshot;
			archivedHabits = archivedSnapshot;
			logDates = dateSnapshot;
			busyHabitId = null;
			pushErrorToast(copy.calendar.log.error);
			return;
		}
		replaceHabit(result.habit);
		habitSheetOpen = false;
		if (!archived) {
			// Back on the bar the progress line needs the log dates again.
			const logs = await api<{ items: PublicHabitLog[] }>(`/api/habits/${habit.id}/logs`, 'GET');
			logDates = { ...logDates, [habit.id]: (logs?.items ?? []).map((log) => log.logDate) };
		}
		busyHabitId = null;
		pushToast(archived ? copy.calendar.toast.archived : copy.calendar.toast.unarchived);
	}

	async function deleteHabit(habit: PublicHabit) {
		const snapshot = habits;
		const dateSnapshot = logDates;
		habits = habits.filter((entry) => entry.id !== habit.id);
		const result = await api<{ habit: PublicHabit }>(`/api/habits/${habit.id}`, 'DELETE');
		if (!result) {
			habits = snapshot;
			logDates = dateSnapshot;
			pushErrorToast(copy.calendar.log.error);
			return;
		}
		habitSheetOpen = false;
		pushToast(copy.calendar.toast.deleted, {
			action: {
				label: copy.plans.toast.undo,
				run: async () => {
					const restored = await api<{ habit: PublicHabit }>(
						`/api/habits/${habit.id}/restore`,
						'POST'
					);
					if (!restored) {
						pushErrorToast(copy.calendar.log.error);
						return;
					}
					habits = [...habits, restored.habit];
					logDates = { ...logDates, [habit.id]: dateSnapshot[habit.id] ?? [] };
				}
			}
		});
	}
</script>

<svelte:head>
	<title>{copy.calendar.title} · {copy.appName}</title>
</svelte:head>

<div class="flex flex-wrap items-center justify-between gap-2">
	<h1 class="text-3xl font-bold">{copy.calendar.title}</h1>
	<div class="flex items-center gap-1.5" role="group" aria-label={copy.calendar.viewLabel}>
		{#each ['week', 'month'] as option (option)}
			<button
				type="button"
				class="rounded-pill border px-3 py-1.5 text-sm font-bold transition-colors duration-fast {view ===
				option
					? 'border-ink bg-ink text-paper'
					: 'border-paper-dark bg-paper text-ink-soft hover:text-ink'}"
				aria-pressed={view === option}
				onclick={() => change(option as 'week' | 'month')}
			>
				{option === 'week' ? copy.calendar.views.week : copy.calendar.views.month}
			</button>
		{/each}
	</div>
</div>

<div class="mt-4 flex items-center justify-between gap-2">
	<div class="flex items-center gap-1">
		<button
			type="button"
			class="rounded-full p-2 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
			aria-label={copy.calendar.previous}
			onclick={() => step(-1)}
		>
			<ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
		</button>
		<p class="min-w-40 text-center text-sm font-bold text-ink">{label}</p>
		<button
			type="button"
			class="rounded-full p-2 text-ink-soft transition-colors duration-fast hover:bg-paper-dark hover:text-ink"
			aria-label={copy.calendar.next}
			onclick={() => step(1)}
		>
			<ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
		</button>
	</div>
	<button
		type="button"
		class="rounded-pill border border-paper-dark bg-paper px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors duration-fast hover:text-ink"
		onclick={goToday}
	>
		{copy.calendar.todayButton}
	</button>
</div>

<div class="mt-3">
	<CalendarGrid
		days={days}
		{weekStartDay}
		{view}
		{today}
		{postitsByDay}
		onexpandday={(day) => (expandedDay = day)}
		oneditpostit={(postit) => {
			formError = '';
			editingPostit = postit;
		}}
	/>
</div>

{#if windowIsEmpty}
	<EmptyState title={copy.calendar.emptyTitle} hint={copy.calendar.emptyHint} />
{/if}

<section class="mt-8" aria-label={copy.calendar.habitsTitle}>
	<div class="flex items-center justify-between gap-2">
		<h2 class="text-xl font-bold">{copy.calendar.habitsTitle}</h2>
		<button
			type="button"
			class="flex items-center gap-1.5 rounded-pill bg-mint px-4 py-2 text-sm font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02]"
			onclick={openNewHabit}
		>
			<Plus size={16} strokeWidth={2} aria-hidden="true" />
			{copy.calendar.newHabit}
		</button>
	</div>
	{#if habits.length === 0}
		<p class="mt-3 text-sm text-ink-soft">{copy.calendar.habitsEmpty}</p>
	{:else}
		<div class="mt-3 flex flex-col gap-3">
			{#each habits as habit (habit.id)}
				<HabitBar
					{habit}
					progress={progressOf(habit)}
					busy={busyHabitId === habit.id}
					onlog={(delta) => void logHabit(habit, delta)}
					onedit={() => openEditHabit(habit)}
				/>
			{/each}
		</div>
	{/if}

	<!-- Archived habits stay reachable: the section is the way back (M7 polish). -->
	{#if archivedHabits.length > 0 || showArchived}
		<div class="mt-5 rounded-card border border-paper-dark bg-paper-dark/30 p-4">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h3 class="text-sm font-bold text-ink">
					{copy.calendar.habitsArchived} ({archivedHabits.length})
				</h3>
				<button
					type="button"
					class="rounded-pill border border-paper-dark bg-paper px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors duration-fast hover:text-ink"
					aria-expanded={showArchived}
					onclick={() => (showArchived = !showArchived)}
				>
					{showArchived ? copy.calendar.hideArchived : copy.calendar.showArchived}
				</button>
			</div>
			{#if showArchived}
				<p class="mt-2 text-xs text-ink-soft">{copy.calendar.archivedHint}</p>
				{#if archivedHabits.length === 0}
					<p class="mt-2 text-sm text-ink-soft">{copy.calendar.archivedEmpty}</p>
				{:else}
					<ul class="mt-3 flex flex-col gap-2">
						{#each archivedHabits as habit (habit.id)}
							<li
								class="flex flex-wrap items-center justify-between gap-2 rounded-card border border-paper-dark bg-paper px-3 py-2"
							>
								<span class="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
									{habit.emoji ? `${habit.emoji} ` : ''}{habit.title}
									<span class="ml-1 text-xs font-semibold text-ink-soft">
										{copy.calendar.form.cadences[habit.cadence]}
									</span>
								</span>
								<button
									type="button"
									class="rounded-pill bg-mint px-3 py-1.5 text-xs font-bold text-ink shadow-postit transition-transform duration-fast hover:scale-[1.02] disabled:opacity-50"
									disabled={busyHabitId === habit.id}
									onclick={() => void setArchived(habit, false)}
								>
									{copy.calendar.restoreHabit}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	{/if}
</section>

{#if editingPostit}
	<PostitSheet
		postit={editingPostit}
		goals={activeGoals}
		busy={formBusy}
		error={formError}
		onclose={() => (editingPostit = null)}
		onsubmit={submitPostitForm}
	/>
{/if}

{#if expandedDay}
	<Modal
		title="{formatDe(expandedDay, 'long')} · {expandedPostits.length}"
		onclose={() => (expandedDay = null)}
	>
		<div class="flex flex-col gap-2">
			{#each expandedPostits as postit (postit.id)}
				<button
					type="button"
					class="rounded-card border border-paper-dark bg-paper px-3 py-2 text-left text-sm font-semibold text-ink transition-colors duration-fast hover:bg-paper-dark {postit.doneAt
						? 'line-through opacity-80'
						: ''}"
					onclick={() => {
						expandedDay = null;
						formError = '';
						editingPostit = postit;
					}}
				>
					{#if postit.time}<span class="text-ink-soft">{postit.time} </span>{/if}{postit.title}
				</button>
			{/each}
		</div>
	</Modal>
{/if}

{#if habitSheetOpen}
	<HabitSheet
		habit={editingHabit}
		goals={activeGoals}
		tz={data.user.tz}
		busy={formBusy}
		error={formError}
		onclose={() => (habitSheetOpen = false)}
		onsubmit={submitHabitForm}
		onarchive={
			editingHabit ? () => void setArchived(editingHabit!, editingHabit!.archivedAt === null) : undefined
		}
		ondelete={editingHabit ? () => void deleteHabit(editingHabit!) : undefined}
	/>
{/if}
