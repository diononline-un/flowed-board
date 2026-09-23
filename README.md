# FlowBoard

Selbstgehostete App für Wochenplanung, Habits und Journaling. Eine Eingabe
(Quick Capture), ein Board mit drei Horizonten, Kalender, Habit-Tracker und ein
ruhiges Journal — gebaut mit SvelteKit 2 + Svelte 5, SQLite und Docker.

## Voraussetzungen

- Docker mit Compose (`docker compose version`) — der empfohlene Weg.
- Für Entwicklung ohne Docker: Node.js 22 oder neuer und npm.
- Ein Reverse-Proxy mit TLS (Beispiel: `Caddyfile.example`) — die App selbst
  terminiert kein HTTPS.

## 1. `.env` ausfüllen

```sh
cp .env.example .env
```

Dann `.env` bearbeiten. Alle Werte haben sinnvolle Vorgaben, wirklich anpassen
musst du vor allem `ORIGIN`, `LLM_API_KEY` und — wenn du Einladungen willst —
`INVITE_CODE`.

| Variable | Bedeutung | Vorgabe |
|---|---|---|
| `NODE_ENV` | Laufzeitmodus des Servers | `production` |
| `ORIGIN` | Öffentliche Adresse der App. Muss exakt der URL im Browser entsprechen (CSRF-Prüfung, `Secure`-Cookie) | `https://flowboard.example.com` |
| `PORT` | Port, auf dem der Container lauscht | `3000` |
| `SESSION_TTL_DAYS` | Laufzeit einer Anmeldung in Tagen (gleitend verlängert) | `30` |
| `REGISTRATION` | `open`, `invite` oder `closed` | `open` |
| `INVITE_CODE` | Pflicht bei `REGISTRATION=invite` | leer |
| `DB_PATH` | Pfad der SQLite-Datei im Container | `/data/flowboard.db` |
| `LLM_BASE_URL` | Basis-URL der OpenAI-kompatiblen Chat-API | `https://api.deepseek.com/v1` |
| `LLM_API_KEY` | Schlüssel des KI-Anbieters. Ohne Schlüssel läuft Quick Capture im Fallback (Text wird unverändert übernommen) | leer |
| `LLM_MODEL` | Modellname beim Anbieter | `deepseek-chat` |
| `LLM_JSON_MODE` | `true` fordert JSON-Antworten an | `true` |
| `LLM_PROVIDER_NAME` | Anbietername, erscheint im Einwilligungstext und im Datenschutz | `DeepSeek` |
| `AI_DAILY_LIMIT_PER_USER` | KI-Aufrufe pro Nutzer und Tag | `30` |
| `HOSTING_COUNTRY` | Land des Servers, erscheint im Datenschutztext | `Deutschland` |
| `ADDRESS_HEADER` | Header mit der echten Client-IP hinter einem Proxy (z. B. `X-Forwarded-For`) | leer |
| `XFF_DEPTH` | Wie viele Einträge von rechts gezählt werden, wenn `ADDRESS_HEADER` gesetzt ist | `1` |
| `BODY_SIZE_LIMIT` | Maximale Größe eines Request-Bodys in Bytes | `524288` |
| `BACKUP_DIR` | Zielordner für `npm run backup` | `/data/backups` |

## 2. Starten

```sh
docker compose up -d --build
```

Danach ist die App unter deiner `ORIGIN`-Adresse erreichbar. Der Container läuft
als non-root, hat einen Healthcheck gegen `/healthz` und kommt dank
`restart: unless-stopped` nach einem Neustart des Servers von selbst wieder hoch.

Erster Schritt im Browser: Konto anlegen. Du bekommst dabei einmalig deine
Wiederherstellungs-Phrase aus 12 Wörtern zu sehen.

## Wo liegen die Daten?

Alles liegt in einer SQLite-Datei im Docker-Volume `flowboard-data`, gemountet
auf `/data`:

- `/data/flowboard.db` — Konten, Ziele, Post-its, Habits, Journal-Einträge
- `/data/flowboard.db-wal`, `/data/flowboard.db-shm` — WAL-Dateien, die dazu gehören
- `/data/backups/` — Sicherungen, siehe unten

Ohne das Volume sind die Daten weg, sobald der Container neu erstellt wird. Ein
`docker compose down` **ohne** `-v` lässt das Volume in Ruhe.

## Passwort vergessen? Phrase verloren?

- Passwort vergessen, Phrase vorhanden: `/recover` öffnen und Benutzername, die
  12 Wörter und ein neues Passwort eingeben. Die alte Phrase wird dabei
  ungültig, du bekommst eine neue.
- **Phrase verloren und Passwort vergessen: nicht wiederherstellbar.** Es gibt
  keine E-Mail-Adresse und keinen Support-Weg zurück ins Konto — das ist
  Absicht. Bewahre die 12 Wörter deshalb in einem Passwortmanager oder als
  Ausdruck auf.
- Phrase noch nicht bestätigt? Settings zeigt so lange ein Banner mit der
  Möglichkeit, eine neue Phrase zu erzeugen.

## Backups einrichten

`npm run backup` nutzt die Online-Backup-API von SQLite, schreibt
`flowboard-YYYY-MM-DD.db` nach `BACKUP_DIR` und behält die letzten 14 Dateien.
Der Lauf passiert **nicht** automatisch im Container (kein zweiter Prozess im
selben Container), sondern per Cron auf dem Host:

```sh
# täglich um 3 Uhr; Container-Namen aus `docker compose ps` einsetzen
0 3 * * * docker exec flowboard-app-1 node scripts/backup.mjs
```

Wiederherstellen: Container stoppen, die gewünschte Sicherung nach
`/data/flowboard.db` kopieren (vorher `-wal`- und `-shm`-Dateien entfernen),
Container starten.

## Modul A/B nachträglich aktivieren

Die Tabellen beider optionaler Module (`discord_links`, `link_codes`,
`push_subscriptions`) legt die Migration `002_optional_modules.sql` schon an,
die Dienste in `docker-compose.yml` sind auskommentiert:

- **Modul A — Discord-Bot (Re-Engagement):** Ordner `bot/` mit eigenem
  `package.json` anlegen, dann den `bot:`-Service in `docker-compose.yml`
  einkommentieren und `docker compose up -d --build` erneut ausführen. Der Bot
  spricht ausschließlich über die internen Endpoints (`INTERNAL_API_KEY`) und
  fasst die Datenbank nie direkt an.
- **Modul B — Web Push:** läuft im Hauptserver, die Tabelle
  `push_subscriptions` ist vorbereitet; ein zusätzlicher Compose-Service ist
  dafür nicht nötig.

Beide Module sind in v1 nicht gebaut. Die Verknüpfung läuft über einen
6-stelligen Code in Settings und bleibt immer ein Opt-in.

## Entwicklung

```sh
npm install
npm run dev          # Entwicklungsserver mit HMR
npm run check        # svelte-check (TypeScript + Svelte)
npm test             # vitest gegen :memory:-SQLite mit den echten Migrationen
npm run build        # Produktions-Build (erzeugt vorher die PWA-Icons)
npm run smoke        # Smoke-Test gegen eine laufende Instanz
```

`npm run smoke` prüft eine erreichbare Instanz:

```sh
BASE_URL=http://localhost:3000 npm run smoke
```

Das Skript legt ein Testkonto an, meldet sich an, erstellt ein Post-it, prüft es
in der Liste, meldet sich ab und wieder an. Es endet mit Exit-Code ≠ 0, sobald
ein Schritt fehlschlägt — jeder Schritt nennt sich in der Fehlermeldung.

Qualitätsgatter vor jedem Commit: `npm run check`, `npm test`, `npm run build`.

## Bekannte Grenzen

- **Kein Dark Mode.** Die App ist auf ein helles, warmes Papier-Design ausgelegt.
- **Nur Deutsch.** Die Oberfläche ist einsprachig (Du-Form); Code, Kommentare
  und Commits sind englisch.
- **KI-Kosten trägst du selbst.** Quick Capture ruft einen externen Anbieter mit
  deinem Schlüssel auf. `AI_DAILY_LIMIT_PER_USER` begrenzt die Aufrufe pro Nutzer
  und Tag, abgerechnet wird über dein Anbieterkonto.
- **Kein Offline-Modus.** Die App ist als PWA installierbar, braucht aber eine
  Verbindung; einen Service Worker mit Offline-Cache gibt es bewusst nicht.
- Keine Team-Funktionen, kein E-Mail-Versand, kein Social Login, kein
  Zeit-Raster-Kalender — alles Non-Goals von v1.
