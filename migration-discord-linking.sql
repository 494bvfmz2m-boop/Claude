-- Xyphros — Discord account linking + login throttling
-- Run this once against the shared `daane_xyphros` database (the same
-- database XyphrosPortal uses — see includes/config.php / config.local.php).
--
-- Safe to run more than once: every statement below is idempotent
-- (IF NOT EXISTS / guarded). Back up the database first as always.

-- ---------------------------------------------------------------------
-- 1. Discord account linking columns on the shared `users` table.
-- ---------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS discord_id VARCHAR(32) NULL DEFAULT NULL AFTER unlimited,
    ADD COLUMN IF NOT EXISTS discord_username VARCHAR(100) NULL DEFAULT NULL AFTER discord_id,
    ADD COLUMN IF NOT EXISTS discord_avatar VARCHAR(255) NULL DEFAULT NULL AFTER discord_username,
    ADD COLUMN IF NOT EXISTS discord_linked_at DATETIME NULL DEFAULT NULL AFTER discord_avatar;

-- One Discord account can only ever be linked to one Xyphros account.
-- (MySQL treats NULL as distinct from every other value in a UNIQUE
-- index, so unlinked accounts — discord_id NULL — are unaffected.)
ALTER TABLE users
    ADD UNIQUE INDEX IF NOT EXISTS uniq_users_discord_id (discord_id);

-- ---------------------------------------------------------------------
-- 2. Login brute-force throttling (see XyphrosAuth::isLoginThrottled()
--    and LOGIN_MAX_ATTEMPTS / LOGIN_THROTTLE_WINDOW in config.php).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL,
    ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_login_attempts_email_time (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
