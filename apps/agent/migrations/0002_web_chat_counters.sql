CREATE TABLE web_chat_counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX web_chat_counters_expiry ON web_chat_counters (expires_at);
