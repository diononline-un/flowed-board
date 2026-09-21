---
repo: flowed-board
status: in-development
progress: 50
tags: [sveltekit, svelte5, sqlite, selfhosted, docker]
last_updated: 2026-09-21
---

# FlowBoard

Selbstgehostete App für Wochenplanung, Habit-Tracking und Journaling (SvelteKit 2 + Svelte 5, SQLite, Docker). Build läuft meilensteinweise nach SPEC.md (M0–M7), Branch `build/initial`.

## next_steps
- [x] M0: Skelett, Docker, DB + Migrations, /healthz, Design-Tokens, App-Shell, date.ts
- [x] M1: Auth (Username/Passwort/Recovery-Phrase), Sessions, Account-Seiten, Rechtsseiten
- [x] M2: Board (Post-its, Ziele, Key Results, Drag-and-Drop, Undo)
- [x] M3: Quick Capture (LLM-Parsing, Fallback, Consent)
- [ ] M4: Kalender + Habits
