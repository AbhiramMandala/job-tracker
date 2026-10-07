-- 0003_jobsetu_provenance.sql: record which JobSetu job an application was
-- imported from, so the same job cannot be saved twice for the same user.
--
-- Strategy is non-destructive:
--   1. Add a nullable provenance column (NULL = manually created or unknown).
--   2. Backfill it ONLY where unambiguous: parse "Imported from JobSetu
--      (job #N, ...)" notes, but skip any user+job pair that already has
--      more than one row. Conflicting pre-existing rows keep jobsetu_job_id
--      NULL (NULLs never violate the partial unique index below), so no
--      user data is deleted, merged, or rejudged by this migration.
--   3. Partial unique index enforces one row per (user, job) going forward.

ALTER TABLE applications ADD COLUMN jobsetu_job_id INTEGER;

UPDATE applications
SET jobsetu_job_id = CAST(
  substr(
    notes,
    instr(notes, 'Imported from JobSetu (job #') + length('Imported from JobSetu (job #'),
    instr(
      substr(notes, instr(notes, 'Imported from JobSetu (job #') + length('Imported from JobSetu (job #')),
      ','
    ) - 1
  ) AS INTEGER
)
WHERE notes LIKE 'Imported from JobSetu (job #%,%'
  AND NOT EXISTS (
    SELECT 1 FROM applications AS other
    WHERE other.user_id = applications.user_id
      AND other.id != applications.id
      AND other.notes LIKE 'Imported from JobSetu (job #%,%'
      AND substr(
        other.notes,
        instr(other.notes, 'Imported from JobSetu (job #') + length('Imported from JobSetu (job #'),
        instr(
          substr(other.notes, instr(other.notes, 'Imported from JobSetu (job #') + length('Imported from JobSetu (job #')),
          ','
        ) - 1
      ) = substr(
        applications.notes,
        instr(applications.notes, 'Imported from JobSetu (job #') + length('Imported from JobSetu (job #'),
        instr(
          substr(applications.notes, instr(applications.notes, 'Imported from JobSetu (job #') + length('Imported from JobSetu (job #')),
          ','
        ) - 1
      )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_user_jobsetu
  ON applications(user_id, jobsetu_job_id)
  WHERE jobsetu_job_id IS NOT NULL;
