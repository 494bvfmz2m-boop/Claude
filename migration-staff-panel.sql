-- Staff panel merge: the "Plexer Pass Tracker" product tab on
-- /staff/access and /staff/broadcasts (and the matching flag on
-- /staff/accounts) needs this column to exist on the shared `users`
-- table — it's read/written exactly like the existing
-- is_xyphros_staff/is_portal_staff columns. Safe to re-run.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_subtracker_staff TINYINT(1) NOT NULL DEFAULT 0;
