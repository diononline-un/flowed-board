# FlowBoard — Build-Spec v1 (One-Shot)

> Arbeitstitel: **FlowBoard**. Selbstgehostete Web-App für Wochenplanung, Habit-Tracking und Journaling. Gamifiziert, aber ohne Druck. Zielgruppe 16–30, ADHS-/OCD-freundlich.
> Dieses Dokument ist vollständig und die einzige Quelle der Wahrheit für einen einzelnen, autonomen Build-Lauf.

---

## 0. Anweisungen an das Build-Modell (zuerst lesen)

1. **Verbindlichkeit.** MUSS = Pflicht. SOLL = Default, Abweichung nur mit Begründung in `DECISIONS.md`. KANN = optional.
2. **Nicht raten, was hier steht.** Bei echten Lücken: die konservativste, einfachste Option wählen, eine Zeile in `DECISIONS.md` notieren, weiterbauen. **Keine Rückfragen an den Menschen.**
3. **Reihenfolge.** Erst Skelett + Lockfile (M0), dann Meilensteine M1 → M7 strikt in Reihenfolge (Abschnitt 2). Nach jedem Meilenstein müssen `npm run check`, `npm test` und `npm run build` grün sein, dann Git-Commit. Keinen späteren Meilenstein beginnen, solange der aktuelle rot ist.
4. **Keine erfundenen APIs.** Bei Unsicherheit über eine Library-API: installierte Typen in `node_modules` lesen oder die im Spec genannte Alternative nehmen. Keine Pakete außerhalb der Liste in Abschnitt 3 ohne Eintrag in `DECISIONS.md`.
5. **Svelte 5 Runes-Syntax ist Pflicht:** `$state`, `$derived`, `$effect`, `$props`, `{#snippet}`/`{@render}`, Event-Attribute wie `onclick=`. **Verboten:** `export let`, `$:`, `on:click`, `<slot>`, Svelte-4-Stores für lokalen State.
6. **Tailwind CSS 4:** `@import "tailwindcss";` + `@theme { … }` in `src/app.css`, Plugin `@tailwindcss/vite`. Keine `tailwind.config.js`.
7. **Sprache.** Alle sichtbaren Texte Deutsch, Du-Form, zentral in `src/lib/shared/copy.ts`. Code, Bezeichner, Kommentare, Commits Englisch.
8. **Keine externen Requests aus dem Browser** (kein CDN, keine Google Fonts, kein Analytics). Schriften selbst gehostet über npm-Pakete.
9. **Vollständigkeit.** Kein `// TODO`, kein Platzhalter, kein „…" im Kernpfad (M0–M7). Jede im Spec genannte Route, Tabelle und Funktion existiert und ist funktionsfähig.
10. **Sicherheit vor Bequemlichkeit.** Jede DB-Abfrage auf Nutzerdaten filtert nach `user_id` (Abschnitt 6.6). Nie `{@html}` mit Nutzerinhalt.

---

## 1. Produkt

### 1.1 Vision
Ein niederschwelliges Self-Improvement-Tool: Nutzer tippen oder diktieren, was ansteht. Eine KI sortiert das in Post-its ein. Ziele, Gewohnheiten und ein kurzes Journal laufen in einer ruhigen, warmen Oberfläche zusammen. Es soll sich nicht wie Projektmanagement anfühlen, sondern wie ein aufgeräumter Schreibtisch im Café.

### 1.2 Persona
16–30 Jahre, digital versiert, in Umbruchphase (Schule, Studium, Berufseinstieg). Interessiert an Self-Improvement, scheitert aber an Komplexität und Einrichtungsaufwand (z. B. Notion). Nutzt überwiegend das Handy (iPhone), zusätzlich Desktop-Browser.

### 1.3 Designprinzipien (jedes testbar)
| # | Prinzip | Konkret |
|---|---|---|
| P1 | **Null Setup** | Nach Registrierung + 4 überspringbaren Onboarding-Schritten ist die App mit Beispielinhalten sofort nutzbar. |
| P2 | **Eine Eingabe, überall erreichbar** | Quick Capture ist auf jedem Screen mit einem Tap (Mobile-FAB) oder `Ctrl/Cmd+K` (Desktop) erreichbar. |
| P3 | **Kein Schuld-Design** | Kein Rot für Überfälliges, keine Streaks die „reißen", keine „Du hast X verpasst"-Texte, keine Zähler für Überfälliges. |
| P4 | **Vorhersehbar** | Nichts sortiert sich hinter dem Rücken des Nutzers um. Manuelle Reihenfolge bleibt. Post-its stehen standardmäßig gerade (Neigung ist opt-in). |
| P5 | **Rückgängig statt Bestätigen** | Löschen/Erledigen = sofort + Toast „Rückgängig" (8 s). Bestätigungsdialoge nur bei Kontolöschung und Passwortänderung. |
| P6 | **Ein Hauptziel pro Screen** | Pro Screen genau ein primärer Button. |
| P7 | **Belohnen, nicht bestrafen** | Gamification ist rein additiv (XP fallen nie), abschaltbar, ohne Ranglisten. |
| P8 | **Ruhige Bewegung** | Animationen 120–360 ms, weich, vollständig abschaltbar (`prefers-reduced-motion` + Setting). |

### 1.4 Non-Goals v1
Team-/Sharing-Funktionen, E-Mail-Versand, Social Login, native Apps, echter Offline-Modus, Dark Mode, Ende-zu-Ende-Verschlüsselung, mehrsprachige UI (nur Deutsch), Zeit-Raster-Kalender (Stundenraster), Datei-Anhänge, wiederkehrende Post-its (Wiederholung läuft nur über Habits), Kollaboration, Ranglisten.

### 1.5 Erfolgskriterien
- `docker compose up -d` startet die App; Registrierung, Login, Logout, Recovery funktionieren ohne weitere Konfiguration außer `.env`.
- Ein neuer Nutzer kann in unter 60 Sekunden nach Registrierung sein erstes Post-it per Quick Capture anlegen.
- Alle Akzeptanzkriterien (Abschnitt 8) sind per Test oder dokumentiertem Handcheck erfüllt.
- Journal-Inhalte verlassen den Server nie in Richtung LLM.
- Lighthouse (mobile) Accessibility ≥ 90, keine Konsolenfehler im Normalbetrieb.

---

## 2. Scope & Meilensteine

| M | Inhalt | Ergebnis |
|---|---|---|
| **M0** | Skelett, Docker, DB + Migrations, `/healthz`, Design-Tokens, App-Shell (Sidebar/Tabbar), Test-Setup, `date.ts` | App startet, leere Shell |
| **M1** | Auth (Username + Passwort + Recovery-Phrase), Sessions, Rate-Limits, Account-Seiten (Passwort ändern, Phrase neu, Export, Löschen), Rechtsseiten | Registrieren/Login/Recovery funktionieren |
| **M2** | Pläne: Post-its, Ziele + Key Results, Board mit 3 Lanes, Drag-and-Drop + Menü-Alternative, Undo, Aufräumen-Sheet | Board voll nutzbar |
| **M3** | Quick Capture: LLM-Parsing, Vorschau, Commit, Undo, Fallback, Consent, Rate-Limit | Eingabe → Post-its |
| **M4** | Kalender (Woche/Monat) + Tracker (Habits, Logs, Fortschritt) | Kalender + Zähler |
| **M5** | Journal: Vorlagen, Einträge, proaktive Erinnerung (in-app), Verlauf | Journaling |
| **M6** | Onboarding, Seed-Inhalte, Gamification (XP, Level, Badges) | „Fertig serviert" |
| **M7** | Settings vollständig, PWA-Manifest + Icons, A11y-Pass, README, Smoke-Skript, Politur | Release-fähig |
| *M8* | *Modul A: Discord-Bot (optional, Abschnitt 14)* | *nur wenn M0–M7 grün und Budget übrig* |
| *M9* | *Modul B: Web Push (optional, Abschnitt 14)* | *nur nach M8 oder separat* |

**Abbruchregel bei knappem Budget:** Kürzbar sind nur M6-Gamification (XP/Badges) und M7-PWA. Das Datenmodell dafür wird trotzdem angelegt. Alles andere in M0–M7 ist Pflicht.

---

## 3. Tech-Stack

| Bereich | Wahl | Hinweis |
|---|---|---|
| Runtime | Node.js 22 LTS | Docker-Image `node:22-bookworm-slim` |
| Framework | SvelteKit 2 + Svelte 5 (Runes), TypeScript strict | `@sveltejs/adapter-node` |
| Styling | Tailwind CSS 4 | `@tailwindcss/vite` |
| Datenbank | **SQLite** via `better-sqlite3` | WAL, `foreign_keys=ON`, `busy_timeout=5000`. Ein Prozess, eine Datei, kein zweiter Container. |
| Migrationen | Eigene, nummerierte `.sql`-Dateien in `migrations/` | Runner beim Serverstart, Tabelle `_migrations`, jede Migration in einer Transaktion |
| Validierung | `zod` | Alle API-Inputs und LLM-Output |
| Passwort-/Recovery-Hash | Node `crypto.scrypt` (async) | keine native Zusatzabhängigkeit |
| Recovery-Phrase | `@scure/bip39` + `@scure/bip39/wordlists/english` | 12 Wörter (128 Bit) |
| Schriften | `@fontsource-variable/nunito`, `@fontsource/caveat` | selbst gehostet |
| Drag-and-Drop | `svelte-dnd-action` | Falls inkompatibel mit installiertem Svelte 5: eigene Pointer-Events-Implementierung in `src/lib/dnd.ts` |
| Icons (PWA) | `sharp` (devDependency) | Skript `scripts/icons.mjs` |
| Tests | `vitest` | Unit + Service-Layer-Tests gegen `:memory:`-SQLite. **Kein** Playwright im Pflichtumfang. |
| LLM | OpenAI-kompatible Chat-Completions per `fetch` | Kein SDK. Default DeepSeek (`LLM_BASE_URL`, `LLM_MODEL` per Env) |
| Deployment | Docker + docker compose auf eigener VPS, Reverse Proxy (Caddy) davor | TLS im Proxy |

**Warum SQLite statt PocketBase:** Custom-Auth mit Recovery-Phrase, Multi-Tenancy über `user_id` und ein einziger Container lassen sich damit ohne Versionsdrift-Risiko (PocketBase-JS-Hooks/Migrations-API) in einem Lauf bauen. Bei Bedarf später zu Postgres migrierbar, weil der Zugriff nur über die Repo-Schicht läuft.

**Versionen:** Die aktuell stabilen Versionen nehmen, die `npm install` auflöst, exakt pinnen (kein `^`) in `package.json`, `package-lock.json` committen.

### 3.1 Repo-Struktur (verbindlich)

```
flowboard/
├─ SPEC.md  DECISIONS.md  README.md
├─ Dockerfile  docker-compose.yml  .env.example  Caddyfile.example  .dockerignore  .gitignore
├─ migrations/         001_init.sql  002_optional_modules.sql
├─ scripts/            icons.mjs  backup.mjs  smoke.mjs
├─ static/             favicon.svg  icon.svg  manifest.webmanifest  icons/
├─ bot/                (Modul A, optional)
└─ src/
   ├─ app.html  app.css  hooks.server.ts
   ├─ lib/
   │  ├─ server/   db.ts  migrate.ts  env.ts  http.ts  auth.ts  session.ts  ratelimit.ts
   │  │            llm.ts  capture.ts  xp.ts  purge.ts  legal.ts  repo/*.ts
   │  ├─ shared/   date.ts  horizon.ts  progress.ts  schemas.ts  types.ts
   │  │            copy.ts  journalTemplates.ts  seed.ts  badges.ts
   │  ├─ state/    *.svelte.ts   (globaler UI-State: toasts, sheets, capture)
   │  └─ components/  (Abschnitt 10.4)
   └─ routes/
      ├─ (public)/  login  register  recover  datenschutz  impressum
      ├─ (app)/     +layout.svelte(.server.ts)  plans  calendar  journal  settings  onboarding
      ├─ api/       (Abschnitt 7)
      └─ healthz/+server.ts
```

**Datenfluss:** Lesen über `+page.server.ts`/`+layout.server.ts` direkt aus der Repo-Schicht (kein Fetch gegen die eigene API). Schreiben über `fetch('/api/…')` mit **optimistischem UI-Update** und Rollback + Fehlertoast bei Fehler.

**npm-Scripts (Pflicht):** `dev`, `build`, `start` (`node build`), `check` (`svelte-check`), `test` (`vitest run`), `icons`, `backup`, `smoke`.

---

## 4. Datenmodell

### 4.0 Begriffe
| Begriff | Bedeutung |
|---|---|
| **Post-it** | Kleinste Einheit: eine Aufgabe/ein Gedanke. Hat optional Datum/Uhrzeit, optional Ziel, optional Habit. Erscheint auf dem Board (nach **Horizont**) und im Kalender (nach **Datum**). |
| **Horizont** | `short` / `mid` / `long`. **Abgeleitet** aus dem Datum (5.2), manuell überschreibbar (`horizon_override`). |
| **Ziel (Objective)** | Ein Vorhaben mit optionalem Zieldatum. Hat 0–5 Key Results. Post-its können einem Ziel zugeordnet sein. |
| **Key Result** | Messbares Teilergebnis eines Ziels: `number` (Start → Ziel) oder `check` (ja/nein). |
| **Habit** | Wiederkehrende Aktivität mit Zähler (z. B. 3x/Woche oder 100x in 2027). Logs pro Tag. Optional mit Ziel verknüpft. |
| **Journal-Vorlage** | Feldsammlung + Zeitplan. **Eintrag** = ausgefüllte Vorlage. |

### 4.1 Konventionen
- IDs: `crypto.randomUUID()` als TEXT.
- Zeitstempel: ISO-8601 UTC (`new Date().toISOString()`).
- Kalendertage: `YYYY-MM-DD` TEXT, **in der Zeitzone des Nutzers** berechnet. Uhrzeiten `HH:MM`.
- Soft-Delete über `deleted_at` (Undo); Purge nach 14 Tagen (Abschnitt 6.8).
- JSON-Spalten sind TEXT und werden beim Lesen mit zod geparst.

### 4.2 `migrations/001_init.sql`

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(username) BETWEEN 3 AND 24),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 30),
  password_hash TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  recovery_confirmed_at TEXT,
  tz TEXT NOT NULL DEFAULT 'Europe/Berlin',
  week_start INTEGER NOT NULL DEFAULT 1 CHECK (week_start IN (0, 1, 6)), -- JS getDay(): 0=So, 1=Mo, 6=Sa
  prefs TEXT NOT NULL DEFAULT '{}',
  onboarding_done_at TEXT,
  xp_total INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT,
  age_confirmed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,               -- sha256(token) als hex
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  note TEXT,
  emoji TEXT,
  color TEXT NOT NULL DEFAULT 'butter',
  target_date TEXT,
  horizon_override TEXT CHECK (horizon_override IN ('short', 'mid', 'long')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
  position REAL NOT NULL DEFAULT 0,
  is_example INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  deleted_at TEXT
);
CREATE INDEX idx_goals_user ON goals(user_id, status);

CREATE TABLE key_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  kind TEXT NOT NULL DEFAULT 'number' CHECK (kind IN ('number', 'check')),
  start_value REAL NOT NULL DEFAULT 0,
  target_value REAL NOT NULL DEFAULT 1,
  current_value REAL NOT NULL DEFAULT 0,
  unit TEXT,
  position REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_kr_goal ON key_results(goal_id);

CREATE TABLE habits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  emoji TEXT,
  color TEXT NOT NULL DEFAULT 'mint',
  cadence TEXT NOT NULL CHECK (cadence IN ('week', 'month', 'range')),
  target_count INTEGER NOT NULL CHECK (target_count BETWEEN 1 AND 10000),
  range_start TEXT,
  range_end TEXT,
  max_per_day INTEGER NOT NULL DEFAULT 1 CHECK (max_per_day BETWEEN 1 AND 20),
  position REAL NOT NULL DEFAULT 0,
  is_example INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  deleted_at TEXT,
  CHECK (cadence <> 'range' OR (range_start IS NOT NULL AND range_end IS NOT NULL AND range_end >= range_start))
);
CREATE INDEX idx_habits_user ON habits(user_id);

CREATE TABLE postits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  habit_id TEXT REFERENCES habits(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  note TEXT,
  color TEXT,                         -- NULL = Farbe des Ziels, sonst 'butter'
  date TEXT,
  time TEXT,
  duration_min INTEGER CHECK (duration_min IS NULL OR duration_min BETWEEN 1 AND 1440),
  horizon_override TEXT CHECK (horizon_override IN ('short', 'mid', 'long')),
  position REAL NOT NULL DEFAULT 0,
  batch_id TEXT,                      -- Quick-Capture-Batch für Undo
  is_example INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  done_at TEXT,
  deleted_at TEXT
);
CREATE INDEX idx_postits_user_date ON postits(user_id, date) WHERE deleted_at IS NULL;
CREATE INDEX idx_postits_user_done ON postits(user_id, done_at);
CREATE INDEX idx_postits_batch ON postits(batch_id);

CREATE TABLE habit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'tap' CHECK (source IN ('tap', 'postit')),
  postit_id TEXT REFERENCES postits(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_logs_habit ON habit_logs(user_id, habit_id, log_date);

CREATE TABLE journal_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  emoji TEXT,
  fields TEXT NOT NULL,               -- JSON: JournalField[] (5.7)
  schedule TEXT,                      -- JSON: {times:string[], days:number[]} oder NULL = nur manuell
  active INTEGER NOT NULL DEFAULT 1,
  seed_key TEXT,                      -- 'morning' | 'evening' | 'quick' für Standardvorlagen
  position REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_jt_user ON journal_templates(user_id);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES journal_templates(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  slot TEXT,                          -- 'HH:MM' des Zeitplans oder NULL
  fields_snapshot TEXT NOT NULL,      -- JSON: Felder zum Zeitpunkt des Eintrags
  values_json TEXT NOT NULL,          -- JSON: { [fieldId]: string | number | boolean }
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_je_user_date ON journal_entries(user_id, entry_date);
CREATE UNIQUE INDEX uq_je_slot ON journal_entries(user_id, template_id, entry_date, slot) WHERE slot IS NOT NULL;

CREATE TABLE xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, kind, ref_id)      -- verhindert XP-Farming durch Erledigt/Rückgängig
);

CREATE TABLE user_badges (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE ai_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
```

### 4.3 `migrations/002_optional_modules.sql`
Wird in M0 mit angelegt (harmlos leer nutzbar), Features dazu gibt es erst in Modul A/B.

```sql
CREATE TABLE discord_links (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL UNIQUE,
  linked_at TEXT NOT NULL,
  nudges_enabled INTEGER NOT NULL DEFAULT 1,
  last_nudge_at TEXT,
  unanswered_nudges INTEGER NOT NULL DEFAULT 0,
  paused_until TEXT
);

CREATE TABLE link_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### 4.4 `users.prefs` (JSON, zod-Schema in `schemas.ts`, alle Felder optional mit Default)
```ts
{
  gamification: boolean        // default true
  postitTilt: boolean          // default false  (P4)
  reduceMotion: boolean        // default false  (zusätzlich zu prefers-reduced-motion)
  showDoneDays: number         // default 7, erlaubt 1|3|7|14
  aiConsentAt: string | null   // ISO, gesetzt nach Einwilligung; null = noch nicht gefragt
  aiEnabled: boolean           // default true (false = Quick Capture ohne KI)
}
```

---

## 5. Domänenregeln (exakt umsetzen, in `src/lib/shared/*` + Unit-Tests)

### 5.1 Zeit (`date.ts`) — ohne Fremdbibliothek
Reine Funktionen auf `YYYY-MM-DD`-Strings (Arithmetik über `Date.UTC`), Zeitzonen nur über `Intl.DateTimeFormat`:
`todayIn(tz, now?)`, `nowTimeIn(tz, now?)` (`HH:MM`), `weekdayOf(ymd)` (0–6), `addDays(ymd, n)`, `diffDays(a, b)` (a − b), `weekStart(ymd, weekStartDay)`, `monthStart/monthEnd(ymd)`, `isValidYmd`, `formatDe(ymd, style)` (z. B. „Mo., 21. Sep."), `isoWeekNumber(ymd)`, `isValidTimeZone(tz)`.
Tests MÜSSEN Sommerzeit-Wechsel in `Europe/Berlin` abdecken (2026-03-29 und 2026-10-25) sowie `week_start` ∈ {0, 1, 6}. **Nur der Server berechnet „heute"**; der Client bekommt `today` aus dem Layout-Load.

### 5.2 Effektiver Horizont (`horizon.ts`)
```ts
effectiveHorizon(item: {horizon_override, date?, target_date?}, today: string): 'short'|'mid'|'long' {
  if (item.horizon_override) return item.horizon_override
  const d = item.date ?? item.target_date
  if (!d) return 'short'
  const n = diffDays(d, today)     // d − today, Vergangenheit negativ
  if (n <= 14) return 'short'      // inkl. Vergangenheit
  if (n <= 90) return 'mid'
  return 'long'
}
```
Das Board zeigt Lanes nach `effectiveHorizon`, der Kalender nach `date`. Ein Post-it kann bewusst in „Langfristig" liegen und trotzdem nächste Woche im Kalender stehen — das ist gewollt und in der UI nicht als Widerspruch dargestellt.

### 5.3 Post-it-Status
- Erledigt ⇔ `done_at IS NOT NULL`. Es gibt nur `offen`/`erledigt`.
- Board zeigt erledigte Post-its in einer eingeklappten Sektion „Erledigt (n)" pro Lane, nur wenn `done_at` innerhalb `prefs.showDoneDays`. Im Kalender erscheinen sie durchgestrichen.
- **Überfällig** ⇔ `date < today AND done_at IS NULL`. Nur weiche Darstellung: Chip „verschoben?" in Sand/Amber, **nie Rot**, kein Zähler in der Navigation.
- Erledigen eines Post-its mit `habit_id` legt genau einen `habit_logs`-Eintrag (`source='postit'`, `log_date = date ?? today`) an, sofern `max_per_day` noch nicht erreicht ist. Wieder-Öffnen oder Soft-Delete entfernt diesen Log; Restore eines erledigten Post-its legt ihn wieder an.

### 5.4 Ziel-Fortschritt (`progress.ts`)
- KR `number`: `clamp((current − start) / (target − start), 0, 1)`. Ist `target == start`: 1 wenn `current >= target`, sonst 0.
- KR `check`: 0 oder 1.
- Ziel = Mittelwert der nicht gelöschten KRs. Ohne KRs: `erledigte / alle` verknüpften, nicht gelöschten Post-its; ohne Post-its: 0 mit Hinweis „Noch keine Schritte".
- Bei 100 %: **kein Auto-Abschluss**, sondern sanfter Vorschlag „Als erreicht markieren?".

### 5.5 Habits
Fenster für „aktuell": `week` = `[weekStart(today), +6]`, `month` = Kalendermonat, `range` = `[range_start, range_end]`.
- `count` = Summe der Logs im Fenster. Logs außerhalb des Fensters bei `range` sind nicht erlaubt (Fehler 422).
- Pro Tag höchstens `max_per_day` Logs. `POST …/logs {date, delta}`: `delta:+1` legt einen Log an, `delta:-1` löscht den jüngsten Tap-Log dieses Tages. `date` darf nicht in der Zukunft liegen und nicht älter als 60 Tage sein.
- **Kein Streak.** Stattdessen für `week`/`month`: „Wochen geschafft" bzw. „Monate geschafft" = Anzahl **abgeschlossener** Fenster seit `created_at`, in denen `count >= target`. Zusätzlich „Beste Woche: n". Der Wert sinkt nie durch Auslassen.
- **Tempo-Text nur für `range`** (neutral, Farbe Sage/Sand, nie Rot):
  - vor `range_start`: „Startet am {Datum}."
  - `count >= target`: „Geschafft 🎉"
  - nach `range_end` ohne Ziel: „Zeitraum vorbei: {count} von {target} — stark!"
  - sonst `expected = target * elapsedDays / totalDays`; wenn `count >= expected`: „Du liegst im Plan." Sonst: „Noch {remaining} bis zum Ziel — etwa {ceil(remaining / (daysLeft / 7))} pro Woche."

### 5.6 Gamification (`xp.ts`, `badges.ts`)
Nur wenn `prefs.gamification`. XP werden immer vergeben (Datenmodell), aber UI/Toasts nur bei aktivem Setting.

| kind | Punkte | `ref_id` (für Uniqueness) |
|---|---|---|
| `postit_done` | 5 | postit.id |
| `habit_log` | 10 | `${habit_id}:${log_date}` |
| `journal_entry` | 15 | `${template_id ?? 'x'}:${entry_date}:${slot ?? 'none'}` |
| `kr_done` | 20 | key_result.id |
| `goal_done` | 50 | goal.id |
| `capture_used` | 3 | batch_id |

`INSERT OR IGNORE` in `xp_events`; nur bei tatsächlichem Insert `users.xp_total += points`. XP sinken nie.
**Level:** `level = floor(sqrt(xp_total / 30)) + 1`. Namen: 1 Kaffeebohne · 2 Espresso · 3 Flat White · 4 Cappuccino · 5 Latte · 6 Mocha · 7 Affogato · 8 Barista · 9 Röstmeister:in · 10+ Café-Legende. XP bis nächstes Level: `30 * level²`.
**Badges** (`badges.ts`, Prüfung nach relevanten Events, einmalig in `user_badges`): `first_step` (erstes Post-it erledigt), `goal_setter` (erstes Ziel), `quick_writer` (erste KI-Eingabe committed), `week_win` (erstes Wochenziel eines Habits erreicht), `keeper` (Wochenziel in 4 verschiedenen Wochen, nicht zwingend aufeinanderfolgend), `journal_starter` (3 Einträge), `journal_regular` (15 Einträge), `halfway` (KR ≥ 50 %), `finisher` (erstes Ziel erreicht), `tidy_up` (Aufräumen-Sheet einmal durchlaufen).

### 5.7 Journal-Felder (zod-Schema `JournalField`)
```ts
{ id: string,                       // stabil, z. B. 'mood'
  type: 'scale' | 'text' | 'yesno' | 'choice' | 'number',
  label: string (1–80),
  required: boolean,
  // scale:  min (1), max (5|7|10), style: 'faces' | 'numbers'   (faces nur bei 1–5)
  // choice: options: string[] (2–8)
  // number: unit?: string, min?: number, max?: number
  // text:   placeholder?: string, maxLength ≤ 2000 }
```
`schedule`: `{ times: string[] (0–4 × 'HH:MM'), days: number[] (0–6) }`. `NULL` = nur manuell.
**Fällig** ⇔ Vorlage aktiv, heutiger Wochentag ∈ `days`, `nowTime >= time`, `nowTime < time + 6 h`, kein Eintrag mit `(template, today, slot)`. Später nachtragen bleibt über die „Heute"-Karte möglich.

---

## 6. Authentifizierung & Sicherheit

### 6.1 Konto
- **Username:** `^[a-z0-9][a-z0-9_.-]{2,23}$`, vor Prüfung kleingeschrieben und getrimmt. `display_name` = Username, änderbar (1–30 Zeichen).
- **Passwort:** 10–128 Zeichen, keine Zusammensetzungsregeln. Ablehnen wenn gleich Username, Teil einer kleinen eingebauten Liste häufiger Passwörter (mind. 25 Einträge, z. B. `passwort123`, `12345678910`, `qwertzuiop`) oder nur ein einziges wiederholtes Zeichen. UI-Hinweis: „Tipp: 3–4 zufällige Wörter sind stark und leicht zu merken."
- **Mindestalter:** Registrierung verlangt Checkbox „Ich bin mindestens 16 Jahre alt" (`age_confirmed_at`). Selbstauskunft, keine Verifikation.
- **Registrierungsmodus** per Env `REGISTRATION=open|invite|closed`. Bei `invite` muss `inviteCode` == `INVITE_CODE` (timing-safe).

### 6.2 Hashing (`auth.ts`)
`scrypt` mit `N=65536, r=8, p=2` (64 MiB), `maxmem=256 MiB`, 16 Byte Salt, 64 Byte Key. Format: `scrypt$N$r$p$<saltB64>$<hashB64>`. Vergleich mit `timingSafeEqual`. Async-Variante, gleichzeitige Hash-Operationen per einfachem Semaphor auf **2** begrenzen.

### 6.3 Recovery-Phrase
- Erzeugung: `generateMnemonic(wordlist, 128)` → 12 Wörter. Normalisierung vor Hash/Vergleich: klein, trim, Whitespace auf ein Leerzeichen. Gespeichert wird nur der scrypt-Hash (`recovery_hash`), **nie** die Phrase.
- **Registrierung:** Serverantwort enthält die Phrase **einmalig**. UI-Screen „Deine Wiederherstellungs-Phrase": 12 nummerierte Wörter, Buttons „Kopieren" und „Als Datei speichern" (`flowboard-recovery.txt`), Warntext (6.3a). Danach optionaler Bestätigungsschritt: 3 zufällige Positionen abfragen (client-seitig). Erfolg → `POST /api/account/recovery-confirmed`. „Später" ist erlaubt, dann zeigt Settings ein dauerhaftes, freundliches Banner „Phrase noch nicht bestätigt" (mit Option „Neue Phrase erzeugen").
- **6.3a Warntext:** „Ohne E-Mail können wir dein Passwort nicht zurücksetzen. Speichere diese 12 Wörter an einem sicheren Ort (Passwortmanager, Notizen-App mit Sperre oder Ausdruck). Wer sie hat, kann dein Konto übernehmen. Verlierst du Passwort **und** Phrase, ist dein Konto nicht wiederherstellbar."
- **Recover-Flow** (`/recover`): Username + 12 Wörter + neues Passwort → bei Erfolg: Passwort ersetzt, **alle Sessions gelöscht**, **neue Phrase erzeugt** (alte ungültig), neue Session, Anzeige der neuen Phrase (gleicher Screen wie oben). Bei unbekanntem Username: Dummy-Hash rechnen, gleiche Fehlermeldung („Angaben stimmen nicht").
- **Neue Phrase in Settings:** `POST /api/account/recovery-regenerate` nach erneuter Passworteingabe.

### 6.4 Sessions
- Cookie `fb_session` = 32 Zufallsbytes base64url. In der DB nur `sha256hex(token)` als `sessions.id`.
- `HttpOnly; SameSite=Lax; Path=/; Secure` (Secure, wenn `ORIGIN` mit `https://` beginnt). Laufzeit `SESSION_TTL_DAYS` (Default 30), **gleitend**: bei Nutzung mit weniger als der halben Restlaufzeit auf volle Laufzeit verlängern.
- Passwortänderung und Recovery löschen alle anderen Sessions. `POST /api/account/logout-all` löscht alle.
- `hooks.server.ts`: Cookie → `event.locals.user`. Gruppe `(app)` ohne Nutzer → Redirect `/login`. Gruppe `(public)` mit Nutzer → Redirect `/plans`. `/api/*` ohne Nutzer → 401 JSON. `users.last_activity_at` bei jeder authentifizierten Mutation und beim Login setzen (max. 1×/Minute schreiben).

### 6.5 Schutzmaßnahmen
| Thema | Regel |
|---|---|
| **CSRF** | In `hooks.server.ts` für alle nicht-GET/HEAD-Requests auf `/api/*`: `Origin`-Header MUSS `ORIGIN` entsprechen (oder `Sec-Fetch-Site: same-origin`), sonst 403. Unabhängig von `kit.csrf`. |
| **Rate-Limits** (In-Memory, gleitendes Fenster, `ratelimit.ts`) | Login: 10 / 15 min pro IP und 5 / 15 min pro Username+IP. Register: 5 / Stunde pro IP. Recover: 5 / Stunde pro Username und 20 / Stunde pro IP. Capture: 5 / Minute pro Nutzer. Antwort 429 + `Retry-After`. |
| **Client-IP** | Über `event.getClientAddress()`; hinter Proxy per Env `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`. |
| **Fehlermeldungen** | Login generisch: „Benutzername oder Passwort stimmt nicht." |
| **Security-Header** | `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy: camera=(), geolocation=(), microphone=(self)`, `X-Frame-Options: DENY`. **CSP** über `kit.csp` (mode `auto`): `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. HSTS setzt der Proxy. |
| **Input** | Jeder Endpoint validiert mit zod (`.strict()`), Body-Limit 512 KB (`BODY_SIZE_LIMIT`). |
| **Logging** | Nur Methode, Pfad, Status, Dauer. **Niemals** Capture-Text, Journal-Inhalte, Passwörter, Phrasen, Cookies. |
| **Secrets** | Nur aus Env, nie im Repo, `.env` in `.gitignore`. |

### 6.6 Mandantentrennung
Jede Funktion in `src/lib/server/repo/*` nimmt `userId` als **ersten** Parameter und filtert damit jede Abfrage. Zugriff auf fremde IDs liefert `null`/404 (nie 403, kein Existenz-Leak). Fremde `goal_id`/`habit_id`/`template_id` in Bodies werden abgelehnt (422). **Test-Pflicht:** Für jede Repo-Datei ein Test „User B kann Daten von User A nicht lesen, ändern, löschen".

### 6.7 Konto-Datenrechte
- **Export** (`GET /api/account/export`): JSON mit allen eigenen Zeilen (ohne `password_hash`, `recovery_hash`, Sessions), `Content-Disposition: attachment; filename="flowboard-export-YYYY-MM-DD.json"`.
- **Löschen** (`DELETE /api/account`): Body `{password, username}` müssen stimmen; harte Löschung des Users (Cascade), Cookie löschen, Redirect auf `/login` mit Hinweis.

### 6.8 Hintergrundjobs (`purge.ts`, `setInterval` alle 6 h + beim Start)
Zeilen mit `deleted_at` älter als 14 Tage hart löschen; abgelaufene Sessions und `link_codes` löschen; `ai_usage` älter als 7 Tage löschen. Fehler werden geloggt, brechen den Server nie.

---

## 7. API (alle Pfade unter `/api`, JSON, Auth via Cookie, alle Mutationen zod-validiert)

Konventionen: Listen-Endpoints geben `{items: T[]}`. Erfolg 200/201, Validierung 422 `{error, fields?}`, Rechte 401/404, Rate-Limit 429. Jede Mutation liefert die geänderte Ressource zurück (kein 204), damit der Client optimistische Updates abgleichen kann.

| Methode & Pfad | Zweck |
|---|---|
| `POST /api/auth/register` | `{username, password, ageConfirmed, inviteCode?}` → User + Session-Cookie + `{recoveryPhrase}` einmalig |
| `POST /api/auth/login` | `{username, password}` → Session-Cookie |
| `POST /api/auth/logout` | aktuelle Session löschen |
| `POST /api/auth/recover` | `{username, phrase, newPassword}` → neue Session + neue `{recoveryPhrase}` |
| `POST /api/account/recovery-confirmed` | markiert Phrase als bestätigt |
| `POST /api/account/recovery-regenerate` | `{password}` → neue `{recoveryPhrase}` |
| `PATCH /api/account` | `{displayName?, tz?, weekStart?, prefs?}` |
| `POST /api/account/password` | `{currentPassword, newPassword}` → löscht andere Sessions |
| `POST /api/account/logout-all` | alle Sessions außer aktueller löschen |
| `GET /api/account/export` | JSON-Download |
| `DELETE /api/account` | `{username, password}` → Konto löschen |
| `GET/POST /api/goals` | Liste / anlegen |
| `PATCH/DELETE /api/goals/:id` | ändern (inkl. `status`, `position`) / soft-delete |
| `POST /api/goals/:id/restore` | Undo |
| `POST/PATCH/DELETE /api/goals/:id/key-results[/:krId]` | Key-Results verwalten |
| `GET/POST /api/postits` | Liste (Query `from`, `to`, `horizon`, `goalId`) / anlegen |
| `PATCH/DELETE /api/postits/:id` | ändern (inkl. `date`, `position`, `done_at` setzen/löschen) / soft-delete |
| `POST /api/postits/:id/restore` | Undo |
| `POST /api/postits/reorder` | `{postits:[{id,position}]}` Batch für Drag-and-Drop |
| `POST /api/postits/cleanup` | `{ids:[]}` → Aufräumen-Sheet: gewählte Post-its neu terminieren/verschieben |
| `GET/POST /api/habits` | Liste / anlegen |
| `PATCH/DELETE /api/habits/:id` | ändern / archivieren (soft-delete) |
| `POST /api/habits/:id/logs` | `{date, delta}` → Log +1/−1 |
| `GET /api/habits/:id/logs` | Query `from,to` → Logliste fürs Kalender-Grid |
| `GET/POST/PATCH /api/journal/templates[/:id]` | Vorlagen verwalten |
| `GET /api/journal/entries` | Query `from,to` |
| `POST /api/journal/entries` | `{templateId, entryDate, slot?, values}` |
| `PATCH /api/journal/entries/:id` | `{values}` |
| `GET /api/journal/due` | fällige Vorlagen für heute (5.7) |
| `POST /api/capture/parse` | `{text}` → `{items: CaptureItem[]}`, **kein DB-Write** (Abschnitt 9) |
| `POST /api/capture/commit` | `{items: CaptureItem[]}` → erzeugt Post-its/Ziele mit `batch_id`, gibt `{batchId, created}` zurück |
| `POST /api/capture/undo` | `{batchId}` → soft-delete des Batches |
| `GET /api/summary` | Zahlen für Onboarding/Dashboard-Chips (heute fällig, Woche-Fortschritt, XP) |
| `GET /healthz` | `{ok:true}`, keine Auth |

---

## 8. Feature-Spezifikation & Akzeptanzkriterien

### 8.1 Quick Capture
UI: FAB unten rechts (Mobile) bzw. `Cmd/Ctrl+K`-Palette (Desktop), öffnet ein Sheet/Modal mit Textfeld (`<input type=text>`, `autofocus`, `inputmode=text`) — Diktat läuft über die native Tastatur-Diktierfunktion des Geräts, keine eigene Aufnahme-UI. Senden → `POST /api/capture/parse` (Ladezustand max. 8 s, Timeout mit Fallback 9.4) → **Vorschau-Liste** vorbefüllter Post-it-Karten (Titel, Datum, Ziel-Zuordnung, Habit-Zuordnung), jede Zeile editierbar/entfernbar vor dem Bestätigen → „Übernehmen" → `POST /api/capture/commit` → Toast „n Post-its erstellt · Rückgängig" → `POST /api/capture/undo` bei Klick.
**Akzeptanzkriterien:**
- AC1: Eingabe „Montag Sport, Dienstag und Mittwoch lernen" erzeugt 3 Vorschau-Zeilen mit korrekten Daten (nächster passender Wochentag, nicht rückwirkend).
- AC2: Nutzer kann vor dem Übernehmen jede Zeile bearbeiten oder löschen; nichts wird ohne Bestätigung gespeichert.
- AC3: „Rückgängig" nach Commit entfernt exakt den Batch, keine anderen Post-its.
- AC4: Ohne KI-Consent (9.5) wird das Eingabefeld trotzdem gespeichert — als ein einzelnes Post-it mit dem Rohtext als Titel, heute terminiert.

### 8.2 Board (Pläne)
Drei Spalten „Kurzfristig / Mittelfristig / Langfristig" (nach `effectiveHorizon`), darüber horizontale Ziel-Karten-Leiste (Filter). Post-it-Karte: Titel, optionales Datum-Chip, Ziel-Farbstreifen, Kontextmenü (⋯: Bearbeiten, Datum ändern, Ziel zuordnen, Verschieben in andere Lane via `horizon_override`, Löschen). Drag-and-Drop zwischen und innerhalb der Lanes (Fallback: Kontextmenü „Verschieben nach…" für Tastatur/Accessibility). „Aufräumen"-Button erscheint, wenn ≥ 5 überfällige Post-its existieren, öffnet ein Sheet mit Mehrfachauswahl: „Auf heute", „Um 1 Woche verschieben", „Erledigt", „Löschen".
**Akzeptanzkriterien:**
- AC5: Drag von Lane A nach B setzt `horizon_override` korrekt und die Karte bleibt nach Reload dort.
- AC6: Erledigen im Board triggert XP + ggf. Habit-Log (5.3), sichtbar ohne Reload (optimistisches Update).
- AC7: Ohne Maus/Touch (nur Tastatur) ist jede Board-Aktion über das Kontextmenü erreichbar.

### 8.3 Ziele & Key Results
Ziel-Detailseite: Titel, Notiz, Zieldatum, Fortschrittsbalken (5.4), Liste der Key Results (inline editierbar, Drag-Reorder), verknüpfte Post-its und Habits. „Neues Ziel"-Sheet fragt nur Titel + optional Zieldatum ab; KRs werden danach optional ergänzt.
**Akzeptanzkriterien:**
- AC8: Ziel ohne KRs zeigt Fortschritt aus verknüpften Post-its.
- AC9: Bei 100 % erscheint der Vorschlag „Als erreicht markieren?", kein Auto-Status-Wechsel.

### 8.4 Kalender & Tracker
Wochenansicht (Default, 7 Spalten, Mobile: horizontal scrollbar/swipebar) und Monatsansicht (Umschalter oben). Tag-Zelle zeigt Post-its (max. 3 + „+n mehr") sortiert nach `time`, unterhalb der Woche/des Monats eine Habit-Leiste mit kompaktem Fortschritt pro Habit (5.5-Text) und Tap-Ziel zum Loggen für „heute". Post-it antippen → Bearbeiten-Sheet mit Datum/Uhrzeit/Dauer.
**Akzeptanzkriterien:**
- AC10: Verschieben eines Post-its im Kalender (Datum ändern) aktualisiert automatisch dessen `effectiveHorizon`-Anzeige auf dem Board.
- AC11: Habit-Tap auf „heute" erzeugt genau einen Log, zweiter Tap bis `max_per_day` einen weiteren, danach ist der Button deaktiviert mit Hinweis „Maximum für heute erreicht".
- AC12: `range`-Habit zeigt den korrekten Tempo-Text aus 5.5 für alle vier Fälle (mit Testdaten in `xp.test.ts`/`habit.test.ts`).

### 8.5 Journal
„Heute"-Karte oben zeigt fällige Vorlagen (aus `/api/journal/due`) als große, freundliche Buttons. Eintragsformular rendert Felder nach `JournalField`-Typ (Scale als Buttons/Gesichter, Yes/No als zwei große Buttons, Choice als Chips, Text als Textarea mit Zeichenzähler, Number als Stepper). Verlauf darunter als Liste, gruppiert nach Datum, mit Vorlagen-Emoji.
**Akzeptanzkriterien:**
- AC13: Zwei Einträge derselben Vorlage am selben Tag mit unterschiedlichem `slot` sind beide möglich; gleicher `slot` zweimal → 409 mit Hinweis, bestehenden Eintrag zu bearbeiten.
- AC14: Deaktivieren einer Vorlage entfernt sie aus „Heute", bestehende Einträge bleiben im Verlauf lesbar (`fields_snapshot`).

### 8.6 Onboarding
4 Schritte, jeder überspringbar, Fortschrittspunkte oben: (1) Willkommen + Namenswahl, (2) „Was willst du diese Woche angehen?" → direkt Quick Capture eingebettet, (3) ein Beispiel-Habit anlegen oder Vorschlag übernehmen, (4) Journal-Rhythmus wählen (morgens/abends/aus) → setzt `schedule` der Standardvorlagen. Abschluss setzt `onboarding_done_at` und lädt Seed-Inhalte (8.7).
**Akzeptanzkriterien:**
- AC15: Kompletter Skip führt trotzdem zu einem nutzbaren Board mit Seed-Inhalten.
- AC16: Onboarding erscheint nie erneut nach Abschluss oder Skip (Layout-Guard prüft `onboarding_done_at`).

### 8.7 Seed-Inhalte (`seed.ts`, bei Registrierung serverseitig eingefügt, `is_example=1`)
1 Beispiel-Ziel „Ersten Monat gut starten" mit 2 Key Results, 3 Beispiel-Post-its (heute, in 3 Tagen, nächste Woche), 1 Beispiel-Habit (`week`, Ziel 3), 2 Standard-Journal-Vorlagen (`seed_key='morning'`: Stimmung-Skala + kurzer Text; `seed_key='evening'`: 3 Erfolge heute + Skala „Energie"), Vorlage `seed_key='quick'` (nur ein Textfeld, kein Zeitplan) immer verfügbar für spontane Einträge. Beispielinhalte sind normal löschbar/editierbar; `is_example` steuert nur einen dezenten „Beispiel"-Chip.

---

## 9. Quick-Capture-KI im Detail (`llm.ts`, `capture.ts`)

### 9.1 Ablauf
`POST /api/capture/parse {text}` → Rate-Limit + Tageslimit prüfen (9.3) → Consent prüfen (9.5) → Prompt bauen (9.2) → LLM-Call mit **8 s Timeout** (`AbortController`) → Antwort mit zod parsen → bei Fehler/Timeout: Fallback (9.4). **Kein** DB-Write in diesem Schritt. Response: `{items: CaptureItem[]}`.

```ts
type CaptureItem = {
  title: string                    // 1–140
  date: string | null              // YYYY-MM-DD, relativ zu "heute" aufgelöst, nie in der Vergangenheit
  time: string | null
  suggestedGoalTitle: string | null   // Freitext-Vorschlag, kein Fremdschlüssel
  suggestedHabit: { title: string; cadence: 'week'|'month'; targetCount: number } | null
}
```

### 9.2 Prompt (System-Prompt, fest in `llm.ts`, nicht vom Nutzer überschreibbar)
Enthält: heutiges Datum + Wochentag (Server-Zeitzone des Nutzers), `week_start`, die Anweisung „gib ausschließlich JSON nach diesem Schema zurück, keinen Fließtext", das JSON-Schema aus 9.1, die Regel „liegt kein Datum im Text vor, setze date auf null", die Regel „erkennst du eine wiederkehrende Aktivität (z. B. „3x die Woche"), fülle suggestedHabit, sonst null", Begrenzung auf max. 10 Items pro Anfrage.
**Response-Format:** `response_format: {type: 'json_object'}` wenn vom konfigurierten Endpoint unterstützt (Feature-Flag `LLM_JSON_MODE`, Default `true`), sonst Klammern aus der Antwort extrahieren.

### 9.3 Kosten & Limits
Env `AI_DAILY_LIMIT_PER_USER` (Default 30). Vor jedem Call: `ai_usage`-Zeile für `(user_id, today)` lesen/inkrementieren; über Limit → 429 `{error:'ai_limit_reached'}`, UI zeigt „Für heute ist das Tageslimit erreicht — dein Text wird ohne KI als Post-it gespeichert" und geht direkt in den Fallback-Pfad (9.4). Zentraler API-Key aus Env (`LLM_API_KEY`), keine Nutzer-eigenen Keys in v1.

### 9.4 Fallback (LLM nicht erreichbar, Timeout, ungültige Antwort, Limit erreicht)
`parse` liefert ein einzelnes `CaptureItem` mit `title = text.slice(0, 140)`, `date = today`, restliche Felder `null`. Die Vorschau zeigt einen Hinweis „Automatische Erkennung war gerade nicht möglich — dein Text wurde als Post-it übernommen." Kein Fehler-Screen, der Flow bricht nie ab.

### 9.5 Einwilligung & Datenschutz
Erste Nutzung von Quick Capture (oder Onboarding-Schritt 2) zeigt einen kurzen Consent-Screen: „Dein Text wird zur Verarbeitung an einen externen KI-Anbieter (DeepSeek) gesendet, um Post-its zu erstellen. Journal-Einträge sind davon **nie** betroffen." Buttons „Erlauben" (setzt `prefs.aiConsentAt`, `aiEnabled=true`) / „Ohne KI nutzen" (`aiEnabled=false`, dauerhaft Fallback-Pfad, in Settings jederzeit umstellbar). Ohne Entscheidung: Standardmäßig Fallback-Pfad, kein stiller Versand.
**Hartes Verbot:** Journal-Inhalte (`journal_entries`, `journal_templates.fields`-Werte) werden **nie** an `llm.ts` übergeben — es gibt dafür keinen Code-Pfad. Nur der rohe Capture-Text geht an das LLM, keine anderen Nutzerdaten (keine Titel anderer Post-its, keine Ziele als Kontext).

---

## 10. Design-System

### 10.1 Tokens (`src/app.css`, `@theme`)
```css
@theme {
  --color-paper: #FBF6EE;       --color-paper-dark: #F2EADA;
  --color-ink: #3A2E22;         --color-ink-soft: #6B5C4C;
  --color-butter: #FFE3A3;      --color-mint: #C8E6D0;
  --color-sky: #C9E1F0;         --color-blush: #F4CFC6;
  --color-sand: #E8C79A;        --color-sage: #A9C0A0;
  --color-lilac: #DAD0EE;
  --radius-card: 1.1rem;        --radius-pill: 999px;
  --shadow-postit: 0 2px 6px rgba(58,46,34,0.10), 0 1px 2px rgba(58,46,34,0.06);
  --font-hand: 'Caveat Variable', cursive;
  --font-body: 'Nunito Variable', sans-serif;
  --duration-fast: 150ms;  --duration-base: 220ms;  --duration-slow: 340ms;
}
```
Farben nur als semantische Post-it-/Habit-Farbwahl nutzbar (`butter, mint, sky, blush, sand, sage, lilac`), keine Nutzer-Hexcodes. Kein Dark Mode (1.4). Grundschrift `--font-body`; `--font-hand` nur für Akzente (Journal-Zitate, Empty-States) in Maßen, nie für Fließtext oder Formulare.

### 10.2 Formsprache
Karten `radius-card`, Buttons/Chips `radius-pill`. Post-its: leichte Papier-Textur per CSS-Gradient (kein Bild), `shadow-postit`, optionale ±1.5°-Neigung nur wenn `prefs.postitTilt` (Default aus). Hover/Focus: `scale(1.02)` + Schattenzunahme, `duration-fast`. Icon-Set: eine einzige Bibliothek (`lucide-svelte`), `stroke-width 1.75`, `rounded` Linecaps.

### 10.3 Layout
Mobile (< 768px): Bottom-Tabbar (Pläne, Kalender, Journal, Settings) + zentraler FAB für Capture. Desktop (≥ 1024px): linke Sidebar mit denselben 4 Punkten + Capture-Eingabe fest oben in der Sidebar. 768–1024px: Sidebar eingeklappt auf Icons. Max-Content-Width 1100px, zentriert.

### 10.4 Kernkomponenten (`src/lib/components/`)
`PostitCard`, `GoalCard`, `KeyResultRow`, `HabitBar`, `HabitLogButton`, `CalendarGrid` (Woche+Monat), `JournalFieldInput` (dispatcht nach Typ), `CaptureSheet`, `CapturePreviewRow`, `CleanupSheet`, `Toast`/`ToastHost`, `ConfirmDialog` (nur für 6.7), `EmptyState`, `XpBar`, `LevelBadge`, `BadgeGrid`, `Tabbar`, `Sidebar`, `Modal`/`Sheet` (Basis für alle Overlays, mit Fokus-Trap und `Escape`-Handling).

---

## 11. Accessibility & Qualität
- Alle interaktiven Elemente per Tastatur erreichbar, sichtbarer Fokusring (`outline` auf `--color-ink`, nie `outline:none` ohne Ersatz).
- Farbe nie alleiniger Träger von Bedeutung (Post-it-Farbe zusätzlich mit Ziel-Namen im Tooltip/Titel).
- Formulare: `<label>` für jedes Feld, Fehlermeldungen mit `aria-describedby`.
- Drag-and-Drop hat immer eine Nicht-Drag-Alternative (8.2).
- Kontrast mindestens WCAG AA auf allen Textfarben-Hintergrund-Paaren aus 10.1 (bei Definition prüfen, notfalls `--color-ink` statt `--color-ink-soft` für Fließtext unter 16px).
- `prefers-reduced-motion: reduce` UND `prefs.reduceMotion` deaktivieren alle nicht-funktionalen Transitions.

---

## 12. Rechtliches (Platzhalter-Seiten, Pflicht da öffentlich erreichbar)
`/impressum` und `/datenschutz` als statische Svelte-Seiten mit klar markiertem Platzhaltertext („⚠ Muster — vor Livegang durch echten Impressums-/Datenschutztext ersetzen, z. B. anwaltlich geprüft"). Datenschutz-Text muss inhaltlich nennen: welche Daten gespeichert werden (Account, Pläne, Journal), dass Capture-Texte an einen externen KI-Anbieter gehen (mit Namen aus `LLM_PROVIDER_NAME`-Env), dass Journal-Daten das System nicht verlassen, Speicherort (eigene VPS, Land aus `HOSTING_COUNTRY`-Env), Auskunfts-/Lösch-/Exportrechte mit Verweis auf Settings. Footer der öffentlichen Seiten verlinkt beide.

---

## 13. Deployment

### 13.1 `.env.example`
```
NODE_ENV=production
ORIGIN=https://flowboard.example.com
PORT=3000
SESSION_TTL_DAYS=30
REGISTRATION=open
INVITE_CODE=
DB_PATH=/data/flowboard.db
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=
LLM_MODEL=deepseek-chat
LLM_JSON_MODE=true
LLM_PROVIDER_NAME=DeepSeek
AI_DAILY_LIMIT_PER_USER=30
HOSTING_COUNTRY=Deutschland
ADDRESS_HEADER=
XFF_DEPTH=1
BODY_SIZE_LIMIT=524288
```

### 13.2 `Dockerfile` (Multi-Stage)
Stage `builder`: `node:22-bookworm-slim`, `npm ci`, `npm run build` (inkl. `npm run icons`). Stage `runner`: `node:22-bookworm-slim`, nur Production-Deps (`npm ci --omit=dev`), `COPY --from=builder build/ build/` + `static/`, non-root User, `VOLUME /data`, `EXPOSE 3000`, `HEALTHCHECK` gegen `/healthz`, `CMD ["node","build"]`.

### 13.3 `docker-compose.yml`
Ein Service `app` (obiges Image), `env_file: .env`, Volume `flowboard-data:/data`, `restart: unless-stopped`. Optional (auskommentiert, nur wenn Modul A gebaut wird) Service `bot`. `Caddyfile.example` zeigt einen Minimal-Reverse-Proxy mit automatischem TLS.

### 13.4 Backups
`scripts/backup.mjs`: nutzt SQLite Online-Backup-API (`better-sqlite3` `.backup()`) auf `/data/backups/flowboard-YYYY-MM-DD.db`, behält die letzten 14. Per `npm run backup`; README dokumentiert Cron-Beispiel (`0 3 * * * docker exec … node scripts/backup.mjs`) — läuft **nicht** automatisch im Container, um keinen zweiten Prozess im selben Container zu brauchen.

### 13.5 README.md (Pflichtinhalt)
Voraussetzungen, `.env` ausfüllen, `docker compose up -d --build`, wo die Daten liegen, wie man einen Recovery-Phrase-Verlust behandelt (nicht möglich — Hinweis), wie man `npm run backup` einrichtet, wie man Modul A/B nachträglich aktiviert, bekannte Grenzen (kein Dark Mode, kein Multi-Language, KI-Kosten selbst im Blick behalten).

---

## 14. Optionale Module (nur nach M0–M7, jeweils eigenständig committen)

### 14.1 Modul A — Discord-Bot (Re-Engagement, rein optional)
- Eigener Ordner `bot/` (eigenes `package.json`, `discord.js` v14), eigener Docker-Service, kommuniziert **nur** über neue interne Endpoints `POST /api/internal/nudge-candidates` (Bearer `INTERNAL_API_KEY`) und `POST /api/internal/link` — kein direkter DB-Zugriff.
- **Opt-in Pflicht:** Nutzer verknüpft sein Konto in Settings über einen 6-stelligen Code (`link_codes`, 10 Min gültig) und einen Bot-Command `/link <code>`. Vor der Verknüpfung passiert nichts.
- **Trigger:** täglicher Cron im Bot (z. B. `node-cron`, 1×/Tag): fragt Nutzer mit `nudges_enabled=1`, `last_activity_at < now-4d`, `(last_nudge_at IS NULL OR last_nudge_at < now-4d)`, `unanswered_nudges < 3`, `(paused_until IS NULL OR paused_until < now)`.
- **Nachricht** (DM, nur wenn Bot und Nutzer einen gemeinsamen Server teilen — sonst wird das beim Link-Vorgang geprüft und der Nutzer entsprechend informiert): „Hey, du warst ein paar Tage weg. Gibt es etwas, wie ich dich unterstützen kann? 🌱" + 2 Buttons „Alles gut, ich bin nur beschäftigt" (setzt `paused_until = +7d`) und „Zeig mir was ansteht" (Link zur App).
- Antwortet der Nutzer 3× nicht (kein Klick, kein Login binnen 4 Tagen danach), pausiert der Bot automatisch 30 Tage (`unanswered_nudges`-Reset danach). Jederzeit abschaltbar/entkoppelbar in Settings.
- **Vor Bau prüfen:** aktuelle Discord-Richtlinien zu unaufgeforderten DMs/Automatisierung; DM-Zustellung schlägt fehl, wenn kein gemeinsamer Server besteht oder DMs vom Empfänger deaktiviert sind — dieser Fall wird geloggt (Zähler, kein Retry-Sturm), nicht als Fehler eskaliert.

### 14.2 Modul B — Web Push (Alternative/Ergänzung zu A, unabhängig baubar)
Statt/zusätzlich zu Discord: PWA-Push über `web-push` (VAPID), Tabelle `push_subscriptions` bereits in 4.3 angelegt. Gleiche Trigger-Logik wie 14.1, aber lokal im Hauptserver als Cron statt separatem Bot-Prozess. Erfordert nutzerseitige Push-Erlaubnis im Browser (Settings-Toggle „Erinnerungen erlauben").

---

## 15. Tests (Pflicht, `vitest`)
- `date.test.ts`: alle Funktionen aus 5.1, inkl. DST-Fälle.
- `horizon.test.ts`, `progress.test.ts`, `xp.test.ts`, `badges.test.ts`: Tabellen aus 5.2/5.4/5.6 mit Grenzwerten.
- `habit.test.ts`: Fensterberechnung, `max_per_day`, alle 4 Tempo-Text-Fälle aus 5.5.
- `auth.test.ts`: Hash/Verify-Roundtrip, falsches Passwort, Recovery-Roundtrip inkl. Session-Invalidierung.
- `repo/*.test.ts`: pro Repo-Datei mindestens CRUD + der Mandantentrennungs-Test aus 6.6, gegen `:memory:`-DB mit den echten Migrationen.
- `capture.test.ts`: Fallback-Pfad (9.4) ohne echten Netzwerkaufruf (LLM-Client gemockt), Tageslimit-Grenze (9.3), Consent-Gate (9.5) — inklusive Test, dass kein Code-Pfad Journal-Daten an `llm.ts` übergibt.
- `scripts/smoke.mjs`: Gegen einen laufenden Container per `fetch`: `/healthz` → 200; Register → Login → Post-it anlegen → Post-it sehen → Logout → Login erneut. `npm run smoke` mit `BASE_URL`-Env, exit code ≠ 0 bei Fehlschlag.

---

## 16. Glossar der Datei-Verantwortlichkeiten (Kurzreferenz)
`db.ts` Verbindung+Pragmas · `migrate.ts` Runner · `env.ts` typisiertes Env mit zod, Absturz bei fehlenden Pflichtwerten · `http.ts` gemeinsame Fehler-/Response-Helfer für `+server.ts`-Routen · `auth.ts` Hashing · `session.ts` Cookie/Session-CRUD · `ratelimit.ts` In-Memory-Limiter · `llm.ts` Prompt+Fetch+Parsing für 9.2 · `capture.ts` Orchestriert 9.1–9.4 · `xp.ts` 5.6-Logik · `purge.ts` 6.8 · `legal.ts` liefert Texte für Abschnitt 12 · `repo/*.ts` einzige Schicht mit SQL, ein File pro Tabelle/Aggregat (`users.ts, sessions.ts, goals.ts, keyResults.ts, habits.ts, habitLogs.ts, postits.ts, journalTemplates.ts, journalEntries.ts, xpEvents.ts, badges.ts`).

---

**Ende der Spezifikation. Bei jedem Konflikt zwischen Abschnitten gilt Abschnitt 0.**
