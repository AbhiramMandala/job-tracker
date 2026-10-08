-- 0006_discover.sql: native job discovery (no external provider service).
--
-- 1. discover_searches: per-user search history. results_json holds only
--    normalized Worker-side job snapshots (capped at save time), never raw
--    provider payloads, so job details + pagination are served from Tracker data.
-- 2. applications.provider / provider_job_id: provenance for natively
--    discovered jobs. jobsetu_job_id is left untouched for historical rows;
--    new native records use provider columns instead. The partial unique index
--    enforces one row per (user, provider, provider_job) going forward
--    (NULLs never conflict, so manual rows are unaffected).

CREATE TABLE IF NOT EXISTS discover_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  experience TEXT NOT NULL DEFAULT '',
  job_count INTEGER NOT NULL DEFAULT 0,
  results_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_discover_searches_user_created
  ON discover_searches(user_id, created_at DESC);

ALTER TABLE applications ADD COLUMN provider TEXT;
ALTER TABLE applications ADD COLUMN provider_job_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_user_provider
  ON applications(user_id, provider, provider_job_id)
  WHERE provider_job_id IS NOT NULL;
