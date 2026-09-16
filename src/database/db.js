const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// CREATE TABLE IF NOT EXISTS won't add new columns to a table that already
// exists from a previous deploy, so backfill any columns schema.sql has
// gained since then (keeps upgrades on a persisted volume, e.g. Coolify, painless).
const NEW_COLUMNS = {
  honeypot_enabled: 'INTEGER DEFAULT 0',
  honeypot_channel_id: 'TEXT',
};
const existingColumns = new Set(db.prepare('PRAGMA table_info(guild_settings)').all().map((c) => c.name));
for (const [name, definition] of Object.entries(NEW_COLUMNS)) {
  if (!existingColumns.has(name)) {
    db.exec(`ALTER TABLE guild_settings ADD COLUMN ${name} ${definition}`);
  }
}

const SETTINGS_COLUMNS = new Set([
  'welcome_channel_id', 'welcome_message', 'leave_channel_id', 'leave_message',
  'log_channel_id', 'mod_log_channel_id', 'order_channel_id', 'mute_role_id',
  'ticket_category_id', 'ticket_staff_role_id', 'ticket_log_channel_id', 'ticket_counter',
  'antiraid_enabled', 'antiraid_join_threshold', 'antiraid_join_window_ms',
  'antiraid_min_account_age_days', 'antiraid_action',
  'honeypot_enabled', 'honeypot_channel_id',
]);

function getGuildSettings(guildId) {
  let row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  }
  return row;
}

function updateGuildSettings(guildId, fields) {
  getGuildSettings(guildId);
  const keys = Object.keys(fields).filter((k) => SETTINGS_COLUMNS.has(k));
  if (keys.length === 0) return getGuildSettings(guildId);
  const setClause = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => fields[k]);
  db.prepare(`UPDATE guild_settings SET ${setClause} WHERE guild_id = ?`).run(...values, guildId);
  return getGuildSettings(guildId);
}

function nextTicketNumber(guildId) {
  getGuildSettings(guildId);
  db.prepare('UPDATE guild_settings SET ticket_counter = ticket_counter + 1 WHERE guild_id = ?').run(guildId);
  return db.prepare('SELECT ticket_counter FROM guild_settings WHERE guild_id = ?').get(guildId).ticket_counter;
}

module.exports = { db, getGuildSettings, updateGuildSettings, nextTicketNumber };
