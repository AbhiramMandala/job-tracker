-- 0004_rbac.sql: role-based access control.
--
-- Adds a `role` column to users with a safe default ('student') so all
-- existing users keep working without privilege changes. New code assigns
-- 'student' on registration; admins are promoted explicitly.
-- Valid roles: 'student', 'admin' (enforced in application code).

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student';

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
