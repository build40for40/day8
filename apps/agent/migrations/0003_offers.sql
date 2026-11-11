CREATE TABLE offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  helper_first_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  notified_at TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE UNIQUE INDEX offers_one_pending ON offers (item_id) WHERE status = 'pending';
