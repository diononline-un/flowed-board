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
