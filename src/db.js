const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const config = require('./config');

const dbPath = path.resolve(config.databaseFile);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    support_role_id TEXT
  );

  CREATE TABLE IF NOT EXISTS ticket_categories (
    guild_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, category_id)
  );

  CREATE TABLE IF NOT EXISTS faq_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    question TEXT NOT NULL,
    keywords TEXT NOT NULL DEFAULT '',
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_faq_guild ON faq_entries(guild_id);
`);

function ensureGuildConfig(guildId) {
  db.prepare(
    'INSERT OR IGNORE INTO guild_config (guild_id, support_role_id) VALUES (?, NULL)'
  ).run(guildId);
}

module.exports = {
  raw: db,

  getGuildConfig(guildId) {
    ensureGuildConfig(guildId);
    return db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
  },

  setSupportRole(guildId, roleId) {
    ensureGuildConfig(guildId);
    db.prepare('UPDATE guild_config SET support_role_id = ? WHERE guild_id = ?').run(
      roleId,
      guildId
    );
  },

  listTicketCategories(guildId) {
    return db
      .prepare('SELECT category_id FROM ticket_categories WHERE guild_id = ?')
      .all(guildId)
      .map((row) => row.category_id);
  },

  addTicketCategory(guildId, categoryId) {
    db.prepare(
      'INSERT OR IGNORE INTO ticket_categories (guild_id, category_id) VALUES (?, ?)'
    ).run(guildId, categoryId);
  },

  removeTicketCategory(guildId, categoryId) {
    db.prepare(
      'DELETE FROM ticket_categories WHERE guild_id = ? AND category_id = ?'
    ).run(guildId, categoryId);
  },

  isTicketCategory(guildId, categoryId) {
    if (!categoryId) return false;
    const row = db
      .prepare(
        'SELECT 1 FROM ticket_categories WHERE guild_id = ? AND category_id = ?'
      )
      .get(guildId, categoryId);
    return Boolean(row);
  },

  listFaqEntries(guildId) {
    return db
      .prepare('SELECT * FROM faq_entries WHERE guild_id = ? ORDER BY updated_at DESC')
      .all(guildId);
  },

  getFaqEntry(guildId, id) {
    return db
      .prepare('SELECT * FROM faq_entries WHERE guild_id = ? AND id = ?')
      .get(guildId, id);
  },

  addFaqEntry(guildId, { question, keywords, answer }) {
    const result = db
      .prepare(
        'INSERT INTO faq_entries (guild_id, question, keywords, answer) VALUES (?, ?, ?, ?)'
      )
      .run(guildId, question, keywords ?? '', answer);
    return result.lastInsertRowid;
  },

  updateFaqEntry(guildId, id, { question, keywords, answer }) {
    db.prepare(
      `UPDATE faq_entries
       SET question = ?, keywords = ?, answer = ?, updated_at = datetime('now')
       WHERE guild_id = ? AND id = ?`
    ).run(question, keywords ?? '', answer, guildId, id);
  },

  deleteFaqEntry(guildId, id) {
    db.prepare('DELETE FROM faq_entries WHERE guild_id = ? AND id = ?').run(guildId, id);
  },
};
