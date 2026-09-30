-- 0002_indexes.sql: indexes for efficient filtering/sorting/pagination

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_user_type ON applications(user_id, job_type);
CREATE INDEX IF NOT EXISTS idx_applications_user_date ON applications(user_id, application_date DESC);
CREATE INDEX IF NOT EXISTS idx_applications_user_company ON applications(user_id, company);
CREATE INDEX IF NOT EXISTS idx_applications_followup ON applications(user_id, follow_up_date);
CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_app_id ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_user_scheduled ON interviews(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_app_id ON notes(application_id);
