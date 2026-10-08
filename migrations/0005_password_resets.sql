-- 0005_password_resets.sql: single-use password reset tokens.
--
-- No plaintext secrets: only SHA-256 hashes of the token are stored.
-- Rows are deleted on use; expired rows are purged opportunistically.
-- Deleting a user cascades their outstanding reset rows.

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selector TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_password_resets_selector ON password_resets(selector);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
