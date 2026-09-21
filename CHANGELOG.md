# Changelog

## 2026-09-21 — M1: Auth, Sessions, Rate-Limits, Account, Rechtsseiten

- scrypt-Hashing (`auth.ts`, N=65536/r=8/p=2, maxmem 256 MiB, Semaphor 2), Recovery-Phrasen via @scure/bip39 (12 Wörter, normalisiert, nur Hash gespeichert), Dummy-Hash bei unbekanntem Username.
- Sessions (`session.ts`): Cookie `fb_session` (32 B base64url), DB speichert nur sha256hex, TTL 30 d gleitend; Rate-Limits nach SPEC-6.5-Tabelle inkl. Capture-Limiter für M3; CSRF-Check + IP-Auflösung (ADDRESS_HEADER/XFF_DEPTH) in hooks.
- 10 API-Endpunkte (register/login/logout/recover, recovery-confirmed/-regenerate, account PATCH/DELETE, password, logout-all, export) — alle zod-strict, Mutationen liefern Ressource zurück.
- Seiten: /login, /register (Invite-Modus, 16+-Checkbox), /recover, Recovery-Screen mit Kopieren/Download/Bestätigungsschritt, /settings (Profil, Passwort-Dialog, Phrase, Sitzungen, Export, Konto löschen), /impressum + /datenschutz aus `legal.ts` mit Platzhalter-Markierung.
- 65 Tests grün (auth, repo users/sessions inkl. Mandantentrennung, Session-Sliding/Ablauf, Rate-Limit); check/test/build grün; Auth-Flows zusätzlich live gegen `node build` gecurlt (CSRF 403, Guards, Recovery-Roundtrip, 429 + Retry-After, Konto-Löschung).

## 2026-09-21 — M0: App-Skelett, DB, Docker, Shell

- SvelteKit-2/Svelte-5-Projekt manuell aufgesetzt (Runes, TS strict, adapter-node), Tailwind-4-Tokens nach SPEC 10.1, Fonts selbst gehostet (fontsource).
- SQLite-Schicht (`db.ts`, `migrate.ts`, `env.ts`) mit WAL/FK/busy_timeout; Migrationen 001 + 002 wörtlich aus SPEC; Runner beim Serverstart.
- App-Shell mit Sidebar/Tabbar, vier Minimal-Routen (Pläne, Kalender, Journal, Settings), `/healthz`, Security-Header + CSP.
- Docker-Deployment-Dateien (Multi-Stage Dockerfile, compose, Caddyfile, .env.example) und Skripte `icons`/`backup`/`smoke`.
- `date.ts` mit DST-Tests (Europe/Berlin 2026) und Migrationstests gegen `:memory:` — 23 Tests grün; check/test/build alle grün; Healthz live gecurlt.
- Offen: Docker-Build selbst nicht ausgeführt (siehe `.sdd/reports/m0-report.md`).
