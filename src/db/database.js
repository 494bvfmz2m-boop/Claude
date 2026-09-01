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
  mod_log_channel_id TEXT,
  swear_filter_enabled INTEGER NOT NULL DEFAULT 0,
  swear_words TEXT NOT NULL DEFAULT '[]',
  staff_list_channel_id TEXT,
  staff_list_message_id TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hierarchies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Staff',
  color TEXT NOT NULL DEFAULT '#a32ee2',
  only_show_highest INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  channel_id TEXT,
  message_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_ranks (
  guild_id TEXT NOT NULL,
  hierarchy_id INTEGER NOT NULL,
  role_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  skip_promote INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hierarchy_id, role_id)
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
  welcome_color TEXT DEFAULT '#a32ee2',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT,
  message_id TEXT,
  title TEXT NOT NULL DEFAULT 'Support',
  description TEXT NOT NULL DEFAULT 'Click below to open a ticket.',
  color TEXT DEFAULT '#a32ee2',
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

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  beta_locked INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO app_settings (id, beta_locked) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS beta_allowlist (
  discord_user_id TEXT PRIMARY KEY,
  added_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mod_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  target_tag TEXT,
  moderator_id TEXT NOT NULL,
  moderator_tag TEXT,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'discord',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reaction_role_panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT,
  message_id TEXT,
  title TEXT NOT NULL DEFAULT 'Reaction Roles',
  description TEXT NOT NULL DEFAULT 'React to get a role!',
  color TEXT DEFAULT '#a32ee2',
  mappings TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dashboard_role_access (
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  areas TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (guild_id, role_id)
);

CREATE TABLE IF NOT EXISTS command_permissions (
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  action TEXT NOT NULL,
  PRIMARY KEY (guild_id, role_id, action)
);

CREATE TABLE IF NOT EXISTS dm_form_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id TEXT NOT NULL,
  recipient_tag TEXT,
  context TEXT NOT NULL DEFAULT 'manual',
  guild_id TEXT,
  guild_name TEXT,
  template_name TEXT,
  title TEXT NOT NULL,
  intro TEXT,
  questions TEXT NOT NULL DEFAULT '[]',
  responded INTEGER NOT NULL DEFAULT 0,
  answers TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  responded_at TEXT
);

CREATE TABLE IF NOT EXISTS dm_form_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  intro TEXT,
  questions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  discord_user_id TEXT PRIMARY KEY,
  note TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  prize TEXT NOT NULL,
  winner_count INTEGER NOT NULL DEFAULT 1,
  required_role_id TEXT,
  hosted_by TEXT,
  entries TEXT NOT NULL DEFAULT '[]',
  ends_at TEXT NOT NULL,
  ended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_time TEXT,
  hosted_by TEXT,
  going TEXT NOT NULL DEFAULT '[]',
  maybe TEXT NOT NULL DEFAULT '[]',
  not_going TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message TEXT NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'none',
  next_run TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS afk_status (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT,
  original_nickname TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS staff_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id TEXT NOT NULL,
  author_tag TEXT,
  note TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS beta_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL,
  discord_tag TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dashboard_admins (
  discord_user_id TEXT PRIMARY KEY,
  note TEXT,
  added_by TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);

-- Scoped /staff access, below full-admin: a named role grants only the
-- listed areas (see web/lib/staffAreas.js) rather than everything
-- dashboard_admins gets. Owner-managed only.
CREATE TABLE IF NOT EXISTS staff_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  areas TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_role_members (
  staff_role_id INTEGER NOT NULL,
  discord_user_id TEXT NOT NULL,
  note TEXT,
  added_by TEXT,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (staff_role_id, discord_user_id)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,
  actor_tag TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS server_notes (
  guild_id TEXT PRIMARY KEY,
  note TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS global_blocklist (
  discord_user_id TEXT PRIMARY KEY,
  reason TEXT,
  added_by TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emoji_book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji_id TEXT NOT NULL,
  animated INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT,
  remind_at TEXT NOT NULL,
  ping_in_channel INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '[]',
  ends_at TEXT,
  closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  trigger_role_id TEXT NOT NULL,
  add_role_id TEXT NOT NULL,
  remove_role_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_guild ON ticket_types(guild_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_role_access_guild ON dashboard_role_access(guild_id);
CREATE INDEX IF NOT EXISTS idx_command_permissions_guild ON command_permissions(guild_id);
CREATE INDEX IF NOT EXISTS idx_mod_actions_guild ON mod_actions(guild_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_reaction_role_panels_guild ON reaction_role_panels(guild_id);
CREATE INDEX IF NOT EXISTS idx_reaction_role_panels_message ON reaction_role_panels(message_id);
CREATE INDEX IF NOT EXISTS idx_panels_guild ON panels(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id);
CREATE INDEX IF NOT EXISTS idx_embed_templates_guild ON embed_templates(guild_id);
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_staff_ranks_guild ON staff_ranks(guild_id, rank);
CREATE INDEX IF NOT EXISTS idx_hierarchies_guild ON hierarchies(guild_id);
CREATE INDEX IF NOT EXISTS idx_beta_requests_status ON beta_requests(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_beta_requests_user ON beta_requests(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_form_sends_recipient ON dm_form_sends(recipient_id);
CREATE INDEX IF NOT EXISTS idx_polls_open ON polls(closed, ends_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_emoji_book_emoji_id ON emoji_book(emoji_id);
CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_actions_target ON mod_actions(target_id);
CREATE INDEX IF NOT EXISTS idx_tags_guild ON tags(guild_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_guild_name ON tags(guild_id, name);
CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id);
CREATE INDEX IF NOT EXISTS idx_giveaways_open ON giveaways(ended, ends_at);
CREATE INDEX IF NOT EXISTS idx_events_guild ON events(guild_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_announcements_guild ON scheduled_announcements(guild_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_announcements_due ON scheduled_announcements(active, next_run);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_role_triggers_guild ON role_triggers(guild_id);
CREATE INDEX IF NOT EXISTS idx_staff_role_members_user ON staff_role_members(discord_user_id);
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
addColumnIfMissing('guild_settings', 'mod_log_channel_id', 'TEXT');
addColumnIfMissing('guild_settings', 'swear_filter_enabled', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('guild_settings', 'swear_words', "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('guild_settings', 'staff_list_channel_id', 'TEXT');
addColumnIfMissing('guild_settings', 'staff_list_message_id', 'TEXT');
addColumnIfMissing('guild_settings', 'staff_list_color', "TEXT NOT NULL DEFAULT '#a32ee2'");
addColumnIfMissing('guild_settings', 'warning_thresholds', "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('guild_settings', 'ticket_banned_role_id', 'TEXT');
addColumnIfMissing('ticket_types', 'generate_transcript', 'INTEGER NOT NULL DEFAULT 1');
addColumnIfMissing('guild_settings', 'welcome_channel_id', 'TEXT');
addColumnIfMissing('guild_settings', 'welcome_message', 'TEXT');
addColumnIfMissing('guild_settings', 'leave_channel_id', 'TEXT');
addColumnIfMissing('guild_settings', 'leave_message', 'TEXT');
addColumnIfMissing('guild_settings', 'autorole_id', 'TEXT');
addColumnIfMissing('guild_settings', 'link_filter_mode', "TEXT NOT NULL DEFAULT 'off'");
addColumnIfMissing('app_settings', 'dm_form_enabled', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('app_settings', 'dm_form_title', 'TEXT');
addColumnIfMissing('app_settings', 'dm_form_intro', 'TEXT');
addColumnIfMissing('app_settings', 'dm_form_questions', "TEXT NOT NULL DEFAULT '[]'");
addColumnIfMissing('dm_form_sends', 'template_name', 'TEXT');
addColumnIfMissing('app_settings', 'dm_templates_seeded', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('guild_settings', 'message_log_channel_id', 'TEXT');
addColumnIfMissing('guild_settings', 'verification_enabled', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('guild_settings', 'verification_channel_id', 'TEXT');
addColumnIfMissing('guild_settings', 'verification_role_id', 'TEXT');
addColumnIfMissing('guild_settings', 'verification_message', 'TEXT');
addColumnIfMissing('guild_settings', 'verification_message_id', 'TEXT');
addColumnIfMissing('guild_settings', 'stats_members_channel_id', 'TEXT');
addColumnIfMissing('guild_settings', 'stats_online_channel_id', 'TEXT');
addColumnIfMissing('guild_settings', 'stats_boosts_channel_id', 'TEXT');
addColumnIfMissing('reaction_role_panels', 'exclusive', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('app_settings', 'maintenance_enabled', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('app_settings', 'maintenance_message', 'TEXT');

// staff_ranks pre-dates the multi-hierarchy feature -- rebuild it onto the
// new schema (adds hierarchy_id, and a role can now belong to more than one
// hierarchy so the old (guild_id, role_id) uniqueness no longer holds) and
// backfill every existing guild's ranks into a new "Staff" hierarchy so
// /promote, /demote, and the posted staff list keep working exactly as
// before. SQLite can't ALTER a primary key, hence the rename-and-copy.
const staffRanksCols = db.prepare('PRAGMA table_info(staff_ranks)').all().map((c) => c.name);
if (!staffRanksCols.includes('hierarchy_id')) {
  const migrate = db.transaction(() => {
    db.exec('ALTER TABLE staff_ranks RENAME TO staff_ranks_old');
    db.exec(`
      CREATE TABLE staff_ranks (
        guild_id TEXT NOT NULL,
        hierarchy_id INTEGER NOT NULL,
        role_id TEXT NOT NULL,
        rank INTEGER NOT NULL,
        skip_promote INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (hierarchy_id, role_id)
      );
    `);

    const oldGuilds = db.prepare('SELECT DISTINCT guild_id FROM staff_ranks_old').all().map((r) => r.guild_id);
    // A guild with an auto-updating list configured but no ranks yet still
    // deserves its "Staff" hierarchy carried forward, channel and all.
    const settingsGuilds = db.prepare('SELECT guild_id FROM guild_settings WHERE staff_list_channel_id IS NOT NULL').all().map((r) => r.guild_id);
    const guildIds = [...new Set([...oldGuilds, ...settingsGuilds])];

    const insertHierarchy = db.prepare(`
      INSERT INTO hierarchies (guild_id, name, color, is_primary, channel_id, message_id)
      VALUES (?, 'Staff', ?, 1, ?, ?)
    `);
    const insertRank = db.prepare('INSERT INTO staff_ranks (guild_id, hierarchy_id, role_id, rank) VALUES (?, ?, ?, ?)');
    const getOldRanks = db.prepare('SELECT role_id, rank FROM staff_ranks_old WHERE guild_id = ?');
    const getSettings = db.prepare('SELECT staff_list_channel_id, staff_list_message_id, staff_list_color FROM guild_settings WHERE guild_id = ?');

    for (const guildId of guildIds) {
      const settings = getSettings.get(guildId) || {};
      const info = insertHierarchy.run(
        guildId,
        settings.staff_list_color || '#a32ee2',
        settings.staff_list_channel_id || null,
        settings.staff_list_message_id || null,
      );
      const hierarchyId = info.lastInsertRowid;
      for (const r of getOldRanks.all(guildId)) {
        insertRank.run(guildId, hierarchyId, r.role_id, r.rank);
      }
    }

    db.exec('DROP TABLE staff_ranks_old');
  });
  migrate();
}
db.exec('CREATE INDEX IF NOT EXISTS idx_staff_ranks_hierarchy ON staff_ranks(hierarchy_id, rank)');
addColumnIfMissing('staff_ranks', 'skip_promote', 'INTEGER NOT NULL DEFAULT 0');

// One-time seed of a couple of starter form templates -- only ever runs
// once (gated on the flag, not on the table being empty) so deleting them
// doesn't bring them back on the next restart.
const seeded = db.prepare('SELECT dm_templates_seeded FROM app_settings WHERE id = 1').get();
if (seeded && !seeded.dm_templates_seeded) {
  const insertTemplate = db.prepare(
    'INSERT INTO dm_form_templates (name, title, intro, questions) VALUES (?, ?, ?, ?)',
  );
  insertTemplate.run(
    'Beta access request',
    'Request beta access',
    "Tell us a bit about your server before we add you to the beta.",
    JSON.stringify([
      "What's your server's name, and can you share an invite link?",
      'Roughly how many members do you have?',
      'What made you want to try XyphrosMod?',
    ]),
  );
  insertTemplate.run(
    'Team application',
    'Team application',
    "Thanks for your interest in joining the team! Answer a few quick questions and we'll get back to you.",
    JSON.stringify([
      'What role are you applying for?',
      'What relevant experience do you have?',
      'How many hours a week can you realistically commit?',
      'Anything else we should know?',
    ]),
  );
  db.prepare('UPDATE app_settings SET dm_templates_seeded = 1 WHERE id = 1').run();
}

module.exports = db;
