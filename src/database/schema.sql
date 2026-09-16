CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  welcome_channel_id TEXT,
  welcome_message TEXT DEFAULT 'Welcome {user} to **{server}**! We now have {membercount} members.',
  leave_channel_id TEXT,
  leave_message TEXT DEFAULT '{user} has left **{server}**. We now have {membercount} members.',
  log_channel_id TEXT,
  mod_log_channel_id TEXT,
  order_channel_id TEXT,
  mute_role_id TEXT,
  ticket_category_id TEXT,
  ticket_staff_role_id TEXT,
  ticket_log_channel_id TEXT,
  ticket_counter INTEGER DEFAULT 0,
  antiraid_enabled INTEGER DEFAULT 0,
  antiraid_join_threshold INTEGER DEFAULT 10,
  antiraid_join_window_ms INTEGER DEFAULT 10000,
  antiraid_min_account_age_days INTEGER DEFAULT 7,
  antiraid_action TEXT DEFAULT 'kick'
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mod_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  ticket_number INTEGER,
  status TEXT DEFAULT 'open',
  claimed_by TEXT,
  created_at INTEGER NOT NULL,
  closed_at INTEGER
);

CREATE TABLE IF NOT EXISTS giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  prize TEXT NOT NULL,
  winner_count INTEGER DEFAULT 1,
  host_id TEXT NOT NULL,
  end_time INTEGER NOT NULL,
  ended INTEGER DEFAULT 0,
  entries TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  order_ref TEXT NOT NULL,
  customer TEXT,
  product TEXT,
  amount TEXT,
  status TEXT DEFAULT 'received',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings (guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets (guild_id, status);
CREATE INDEX IF NOT EXISTS idx_giveaways_active ON giveaways (ended, end_time);
CREATE INDEX IF NOT EXISTS idx_orders_guild ON orders (guild_id, created_at);
