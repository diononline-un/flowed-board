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
