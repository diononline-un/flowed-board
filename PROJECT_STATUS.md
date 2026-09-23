---
repo: flowed-board
status: in-development
progress: 80
tags: [sveltekit, svelte5, sqlite, selfhosted, docker]
last_updated: 2026-09-24
---

# FlowBoard

Selbstgehostete App für Wochenplanung, Habit-Tracking und Journaling (SvelteKit 2 + Svelte 5, SQLite, Docker). Build läuft meilensteinweise nach SPEC.md (M0–M7), Branch `build/initial`.

## next_steps
- [x] M0: Skelett, Docker, DB + Migrations, /healthz, Design-Tokens, App-Shell, date.ts
- [x] M1: Auth (Username/Passwort/Recovery-Phrase), Sessions, Account-Seiten, Rechtsseiten
- [x] M2: Board (Post-its, Ziele, Key Results, Drag-and-Drop, Undo)
- [x] M3: Quick Capture (LLM-Parsing, Fallback, Consent)
- [x] M4: Kalender + Habits (Logs, Fortschritt, Wochen-/Monatsansicht)
- [x] M5: Journal (Vorlagen, Einträge, In-App-Erinnerung über die Heute-Karte, Verlauf)
- [x] M6: Onboarding, Seed-Inhalte, Gamification (XP, Level, Badges)
- [ ] M7: Settings vollständig, PWA-Manifest + Icons, A11y-Pass, README, Smoke-Skript, Politur
- [ ] M7-Nachtrag: `purge.ts` (SPEC 6.8 — Hartes Löschen nach 14 Tagen, abgelaufene Sessions, `ai_usage` > 7 Tage); Controller-Ruling: wird in M7 gebaut
