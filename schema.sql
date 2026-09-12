-- SlothSMP database schema
-- Paste this whole file into phpMyAdmin's SQL tab (with your database
-- selected) and click Go — or `mysql -u slothsmp_web -p slothsmp_web < schema.sql`
-- if you have shell access.
--
-- Safe to run more than once: every CREATE TABLE only creates something if
-- it's missing, and every INSERT uses IGNORE so it never duplicates or
-- overwrites an existing account/role. Nothing here ever deletes data.

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(190) NOT NULL,
    username VARCHAR(24) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    verified TINYINT(1) NOT NULL DEFAULT 0,
    verify_token VARCHAR(64) NULL,
    reset_token VARCHAR(64) NULL,
    reset_expires DATETIME NULL,
    is_super_op TINYINT(1) NOT NULL DEFAULT 0,
    staff_sort_order INT NULL,
    two_factor_method VARCHAR(10) NULL,
    totp_secret VARCHAR(64) NULL,
    minecraft_username VARCHAR(16) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_email (email),
    UNIQUE KEY uniq_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#f4b342',
    color2 VARCHAR(7) NULL,
    protected TINYINT(1) NOT NULL DEFAULT 0,
    staff TINYINT(1) NOT NULL DEFAULT 0,
    weight INT NOT NULL DEFAULT 0,
    perm_manage_posts TINYINT(1) NOT NULL DEFAULT 0,
    perm_manage_users TINYINT(1) NOT NULL DEFAULT 0,
    perm_manage_roles TINYINT(1) NOT NULL DEFAULT 0,
    perm_manage_settings TINYINT(1) NOT NULL DEFAULT 0,
    perm_manage_tickets TINYINT(1) NOT NULL DEFAULT 0,
    perm_manage_store TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adds columns introduced after this table may already have existed on your
-- host (e.g. upgrading from an older deployment) — does nothing if a column
-- is already there. Uses INFORMATION_SCHEMA rather than "ADD COLUMN IF NOT
-- EXISTS" since that syntax isn't supported on every MySQL/MariaDB version.
SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'minecraft_username'
);
SET @add_col_sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN minecraft_username VARCHAR(16) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'perm_manage_store'
);
SET @add_col_sql = IF(@col_exists = 0,
    'ALTER TABLE roles ADD COLUMN perm_manage_store TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Make sure the Core role always has store-viewing permission, even if it
-- was created before that permission existed.
UPDATE roles SET perm_manage_store = 1 WHERE id = 'management';

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL,
    role_id VARCHAR(64) NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'post',
    author_id INT NULL,
    author_name VARCHAR(24) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    submitted_name VARCHAR(64) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    guest_email VARCHAR(190) NULL,
    access_token VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    author_id INT NULL,
    author_name VARCHAR(64) NOT NULL,
    is_staff TINYINT(1) NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_replies_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_replies_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Throttling for brute-force-prone endpoints (login, 2FA codes, registration,
-- password reset requests, ticket creation). Rows self-expire — each check
-- deletes its own bucket/identifier's rows once they age out of the window.
CREATE TABLE IF NOT EXISTS rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bucket VARCHAR(40) NOT NULL,
    identifier VARCHAR(190) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_bucket_identifier_created (bucket, identifier, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Completed Tebex store orders, logged from the payment webhook
-- (api/tebex_webhook.php) for the admin Store page. The storefront and
-- checkout flow work fine even if this table stays empty — it's purely a
-- convenience log, not something the purchase flow depends on.
CREATE TABLE IF NOT EXISTS tebex_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(191) NOT NULL,
    basket_ident VARCHAR(191) NULL,
    minecraft_username VARCHAR(64) NULL,
    email VARCHAR(190) NULL,
    total DECIMAL(10,2) NULL,
    currency VARCHAR(10) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'completed',
    raw_payload MEDIUMTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_transaction (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the protected Core role (id stays "management" so nothing else has to change).
INSERT IGNORE INTO roles (id, name, color, color2, protected, staff, weight, perm_manage_posts, perm_manage_users, perm_manage_roles, perm_manage_settings, perm_manage_tickets, perm_manage_store)
VALUES ('management', 'Core', '#f4b342', NULL, 1, 1, 100, 1, 1, 1, 1, 1, 1);

-- Seed the first admin account. Email: Management@slothsmp.com / Password: Spont.Sloth.10
-- CHANGE THIS PASSWORD after your first login (see README).
INSERT IGNORE INTO users (email, username, password_hash, verified)
VALUES ('Management@slothsmp.com', 'Management', '$2y$10$P5vDAeF/8vckNtwdFzXR9.X90UOBm0DgTN9HmNVlKJbZ905GoFthO', 1);

-- Link the seed account to the Core role.
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT id, 'management' FROM users WHERE email = 'Management@slothsmp.com';

-- Flip the super-op flag for the designated owner account, if it exists yet.
-- If the account hasn't been created yet, this just affects 0 rows — no
-- error, and includes/config.php's SUPER_OP_EMAILS list covers it as a
-- fallback until this row exists.
UPDATE users SET is_super_op = 1 WHERE email = 'spontanedonder@hotmail.com';
