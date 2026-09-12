-- Support chat/ticket system.
-- Run this once against the shared `daane_xyphros` database (same DB as
-- everything else — phpMyAdmin, or `mysql -u ... -p daane_xyphros < migration-support-tickets.sql`).
-- Safe to re-run: every statement is idempotent.

CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    subject VARCHAR(160) NOT NULL,
    status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    last_message_at DATETIME NOT NULL,
    last_sender ENUM('user', 'staff') NOT NULL DEFAULT 'user',
    unread_by_staff TINYINT(1) NOT NULL DEFAULT 1,
    unread_by_user TINYINT(1) NOT NULL DEFAULT 0,
    closed_by VARCHAR(36) NULL,
    closed_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_support_tickets_user (user_id),
    INDEX idx_support_tickets_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS support_messages (
    id VARCHAR(36) NOT NULL,
    -- Plain DATETIME is only second-precision, so two messages sent in the
    -- same second would tie under it — `seq` is what polling/ordering
    -- actually relies on; created_at is for display only.
    seq BIGINT NOT NULL AUTO_INCREMENT,
    ticket_id VARCHAR(36) NOT NULL,
    sender_type ENUM('user', 'staff') NOT NULL,
    sender_id VARCHAR(36) NOT NULL,
    sender_name VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (seq),
    UNIQUE KEY idx_support_messages_id (id),
    INDEX idx_support_messages_ticket (ticket_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
