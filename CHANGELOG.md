# Changelog

## 2026-09-21 — M0: App-Skelett, DB, Docker, Shell

- SvelteKit-2/Svelte-5-Projekt manuell aufgesetzt (Runes, TS strict, adapter-node), Tailwind-4-Tokens nach SPEC 10.1, Fonts selbst gehostet (fontsource).
- SQLite-Schicht (`db.ts`, `migrate.ts`, `env.ts`) mit WAL/FK/busy_timeout; Migrationen 001 + 002 wörtlich aus SPEC; Runner beim Serverstart.
- App-Shell mit Sidebar/Tabbar, vier Minimal-Routen (Pläne, Kalender, Journal, Settings), `/healthz`, Security-Header + CSP.
- Docker-Deployment-Dateien (Multi-Stage Dockerfile, compose, Caddyfile, .env.example) und Skripte `icons`/`backup`/`smoke`.
- `date.ts` mit DST-Tests (Europe/Berlin 2026) und Migrationstests gegen `:memory:` — 23 Tests grün; check/test/build alle grün; Healthz live gecurlt.
- Offen: Docker-Build selbst nicht ausgeführt (siehe `.sdd/reports/m0-report.md`).
