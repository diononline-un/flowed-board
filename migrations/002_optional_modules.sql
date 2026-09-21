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
