# DECISIONS

One line per deviation from a SPEC-SOLL or conservative gap-fill (SPEC 0.1/0.2).

- 2026-09-21 — Local toolchain is Node 24 (SPEC targets 22 for Docker); code restricted to Node-22 APIs, Docker image pins `node:22-bookworm-slim`.
- 2026-09-21 — `env.ts`: every value from SPEC 13.1 has a default (`ORIGIN` defaults to `http://localhost:3000`); startup aborts on *invalid* values, so local `node build` works without `.env` (SPEC names no explicit required values).
- 2026-09-21 — Installed `@fontsource-variable/caveat` instead of `@fontsource/caveat`: SPEC 3 lists the static package, but the SPEC-10.1 token requires the family name `Caveat Variable`, which only the variable package ships (SPEC conflict; token kept verbatim).
- 2026-09-21 — Installed `@types/better-sqlite3` (devDependency): better-sqlite3 ships no TypeScript types (package outside SPEC-3 list, needed for `npm run check`).
- 2026-09-21 — Dockerfile runner stage also copies `migrations/`, `scripts/` and `package.json` (SPEC 13.2 lists only `build/` + `static/`; the migration runner and `backup.mjs` need them at runtime).
- 2026-09-21 — Root route `/` redirects 303 to `/plans` (SPEC defines no index route).
- 2026-09-21 — `scripts/backup.mjs` target dir is `BACKUP_DIR` env, default `/data/backups` (SPEC 13.4 path kept as default).
- 2026-09-21 — Generated PWA icons (`static/icons/`) are gitignored and rebuilt via the `prebuild` hook, so `npm run build` includes `npm run icons` (SPEC 13.2).
- 2026-09-21 — `svelte-dnd-action` installed in M0 per brief but unused until M2.
- 2026-09-21 — npm cache redirected to workspace-local `.npm-cache` on this machine (user cache dir `~/.npm` has wrong ownership; gitignored, local-only concern).
- 2026-09-21 — bip39 wordlist import uses `@scure/bip39/wordlists/english.js` with `.js` suffix (SPEC 3 names the path without it; the exports map of @scure/bip39 2.4.0 only exposes suffixed subpaths).
- 2026-09-21 — `POST /api/account/logout-all` deletes all sessions *except the current one* (SPEC 7 table) instead of literally all (SPEC 6.4 sentence); the API contract is the more specific source, otherwise the endpoint would log out its own caller.
- 2026-09-21 — `/impressum` and `/datenschutz` stay readable for logged-in users (SPEC 6.4 redirects `(public)` with user to `/plans`); legal information must remain reachable for everyone (SPEC 12), redirect exemption limited to these two pages.
- 2026-09-21 — `POST /api/postits/cleanup` payload is `{ids: string[], action: 'today'|'plusWeek'|'done'|'delete'}` (M2 brief left the form open; SPEC 7 names only `{ids:[]}`); date actions keep an existing `horizon_override` untouched (P4).
- 2026-09-21 — `tsconfig.json` sets `skipLibCheck: true`: svelte-dnd-action's own `dist/index.d.ts` (`setFeatureFlag` without return type) fails `strict`/`noImplicitAny`; library-internal typings are not our code to fix.
- 2026-09-21 — svelte-dnd-action 0.9.79 works with Svelte 5.57 as-is (`use:dndzone` + `onconsider`/`onfinalize` attributes, typed via its `DndZoneAttributes`); the fallback pointer-events implementation in `src/lib/dnd.ts` was not needed.
- 2026-09-21 — New rows get `position = max(position)+1` per scope (goals/post-its per user, key results per goal); drag reorders rewrite lane-local positions 1..n (SPEC defines REAL positions but no allocation rule).
- 2026-09-21 — Key-result delete undo re-creates an equal key result (new id, same values/position) because SPEC 7 defines no key-result restore endpoint (P5 undo kept without inventing API surface).
- 2026-09-21 — Goal detail page lives at `/plans/goals/[id]` (M2 brief allowed the choice).
- 2026-09-21 — Capture consent gate runs *before* the daily-counter consumption (SPEC 9.1 lists the limit check first): users without consent never burn quota for calls that cannot happen; observable behavior is otherwise identical.
- 2026-09-21 — `POST /api/capture/parse` returns an additive `fallback: boolean` next to `items` (SPEC 9.1 names only `{items}`); the client needs the flag to show the SPEC-9.4 fallback hint.
- 2026-09-21 — Capture commit never auto-creates goals/habits from suggestions (M3 brief), although the SPEC-7 table says "Post-its/Ziele"; only exact-title matching against existing own rows.
- 2026-09-21 — Past dates in LLM answers are clamped to today (mechanism for SPEC 9.1 "nie in der Vergangenheit", which names none).
- 2026-09-21 — The capture input relies on the Sheet focus trap focusing the first input instead of the `autofocus` attribute (SPEC 8.1 wording kept functionally, a11y-linter-clean).
- 2026-09-21 — Habit window, counter and pace logic live in a new `src/lib/shared/habit.ts` instead of extending `progress.ts` (M4 brief allowed either): `progress.ts` is the SPEC-5.4 goal rule, habits are a separate SPEC-5.5 domain and the calendar grid helpers sit next to them in `shared/calendar.ts`.
- 2026-09-21 — `completedPeriods` counts finished weeks (or months) from `created_at` up to the last closed period and includes the running window in "Beste Woche/Bester Monat", so the value never sinks by skipping a period (P3/P7); the displayed "Wochen/Monate geschafft" only ever counts closed windows, which is what SPEC 5.5 asks for.
- 2026-09-21 — A `week`/`month` habit created in the past can still receive backdated tap logs (SPEC 5.5 only restricts future dates and the 60-day limit); only `range` habits reject days outside `[range_start, range_end]` with 422.
- 2026-09-21 — `DELETE /api/habits/:id` soft-deletes the habit and leaves its `habit_logs` rows untouched (restoring via `POST /api/habits/:id/restore` brings the counters back exactly; SPEC 7 says "archivieren (soft-delete)" and defines no log cascade).
- 2026-09-21 — `POST /api/habits/:id/logs` answers additions with 201, removals (`delta:-1`) with 200 and returns `{habit, log|null, dayCount, todayCount}` — the client needs the authoritative per-day count to reconcile the optimistic update (SPEC 7 names only "Log +1/−1").
- 2026-09-21 — The calendar keeps the shown window in client state and refetches `/api/postits?from,to` when the user navigates; the initial render still comes from `+page.server.ts` (SPEC 3.1), and out-of-range post-its are dropped so the client array cannot grow without bound while stepping through weeks.
- 2026-09-21 — The calendar defaults to the week view and switches to the month view only via the toggle (M4 brief: "Wochenansicht (Default)"); the `?view=month` query parameter is accepted for the first render.
