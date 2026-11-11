CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  first_name TEXT,
  notes TEXT NOT NULL DEFAULT '',
  cursor_message_id INTEGER NOT NULL DEFAULT 0,
  delete_requested_at_message_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'other')),
  text TEXT NOT NULL,
  channel_message_id TEXT UNIQUE,
  sent_at TEXT NOT NULL,
  handled_at TEXT
);
CREATE INDEX messages_user ON messages (user_id, id);

CREATE TABLE lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'taken_down')),
  created_at TEXT NOT NULL
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL REFERENCES lists(id),
  number INTEGER NOT NULL,
  text TEXT NOT NULL,
  why TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'covered', 'removed')),
  source_message_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (list_id, number)
);
CREATE UNIQUE INDEX items_once_per_turn ON items (list_id, source_message_id, lower(trim(text)))
  WHERE source_message_id IS NOT NULL;

CREATE TABLE claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  helper_first_name TEXT,
  show_name INTEGER NOT NULL DEFAULT 1,
  said TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('told_by_user', 'forwarded_message')),
  source_message_id INTEGER,
  claimed_at TEXT NOT NULL
);
CREATE INDEX claims_item ON claims (item_id);
CREATE UNIQUE INDEX claims_once_per_turn ON claims (item_id, source_message_id)
  WHERE source_message_id IS NOT NULL;

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL REFERENCES lists(id),
  type TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX events_list ON events (list_id, id);

CREATE TABLE notes_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  notes TEXT NOT NULL,
  cursor_message_id INTEGER NOT NULL,
  replaced_at TEXT NOT NULL
);
