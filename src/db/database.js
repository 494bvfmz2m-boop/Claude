const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  transcript_channel_id TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT,
  category_channel_id TEXT,
  support_role_ids TEXT NOT NULL DEFAULT '[]',
  name_pattern TEXT NOT NULL DEFAULT 'ticket-{username}',
  max_open_per_user INTEGER NOT NULL DEFAULT 1,
  welcome_title TEXT,
  welcome_description TEXT,
  welcome_color TEXT DEFAULT '#5865F2',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT,
  message_id TEXT,
  title TEXT NOT NULL DEFAULT 'Support',
  description TEXT NOT NULL DEFAULT 'Click below to open a ticket.',
  color TEXT DEFAULT '#5865F2',
  ticket_type_ids TEXT NOT NULL DEFAULT '[]',
  style TEXT NOT NULL DEFAULT 'buttons',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  ticket_type_id INTEGER,
  opener_id TEXT NOT NULL,
  claimed_by TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now')),
  closed_at TEXT,
  closed_by TEXT,
  close_reason TEXT
);

CREATE TABLE IF NOT EXISTS embed_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_guild ON ticket_types(guild_id);
CREATE INDEX IF NOT EXISTS idx_panels_guild ON panels(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id);
CREATE INDEX IF NOT EXISTS idx_embed_templates_guild ON embed_templates(guild_id);
`);

// Lightweight migrations for columns added after the initial release —
// CREATE TABLE IF NOT EXISTS only helps fresh installs, existing databases need this.
function addColumnIfMissing(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!existing.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

addColumnIfMissing('panels', 'style', "TEXT NOT NULL DEFAULT 'buttons'");

module.exports = db;
