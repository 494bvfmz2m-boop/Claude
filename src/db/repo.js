const db = require('./database');

function parseJSON(str, fallback) {
  try {
    return JSON.parse(str ?? '');
  } catch {
    return fallback;
  }
}

function ensureGuildSettingsRow(guildId) {
  db.prepare(`
    INSERT INTO guild_settings (guild_id) VALUES (?)
    ON CONFLICT(guild_id) DO NOTHING
  `).run(guildId);
}

const GuildSettings = {
  get(guildId) {
    const row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
    if (!row) {
      return {
        guild_id: guildId, transcript_channel_id: null, mod_log_channel_id: null,
        swear_filter_enabled: false, swear_words: [], staff_list_channel_id: null, staff_list_message_id: null,
        staff_list_color: '#5865F2', warning_thresholds: [],
      };
    }
    return {
      ...row,
      swear_filter_enabled: !!row.swear_filter_enabled,
      swear_words: parseJSON(row.swear_words, []),
      warning_thresholds: parseJSON(row.warning_thresholds, []),
    };
  },
  setTranscriptChannel(guildId, channelId) {
    ensureGuildSettingsRow(guildId);
    db.prepare("UPDATE guild_settings SET transcript_channel_id = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(channelId || null, guildId);
  },
  setModLogChannel(guildId, channelId) {
    ensureGuildSettingsRow(guildId);
    db.prepare("UPDATE guild_settings SET mod_log_channel_id = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(channelId || null, guildId);
  },
  setSwearFilter(guildId, { enabled, words }) {
    ensureGuildSettingsRow(guildId);
    db.prepare(`
      UPDATE guild_settings SET swear_filter_enabled = ?, swear_words = ?, updated_at = datetime('now')
      WHERE guild_id = ?
    `).run(enabled ? 1 : 0, JSON.stringify(words || []), guildId);
  },
  setStaffListChannel(guildId, channelId) {
    ensureGuildSettingsRow(guildId);
    db.prepare(`
      UPDATE guild_settings SET staff_list_channel_id = ?, staff_list_message_id = NULL, updated_at = datetime('now')
      WHERE guild_id = ?
    `).run(channelId || null, guildId);
  },
  setStaffListMessage(guildId, messageId) {
    ensureGuildSettingsRow(guildId);
    db.prepare('UPDATE guild_settings SET staff_list_message_id = ? WHERE guild_id = ?').run(messageId || null, guildId);
  },
  setStaffListColor(guildId, color) {
    ensureGuildSettingsRow(guildId);
    db.prepare('UPDATE guild_settings SET staff_list_color = ? WHERE guild_id = ?').run(color || '#5865F2', guildId);
  },
  setWarningThresholds(guildId, thresholds) {
    ensureGuildSettingsRow(guildId);
    db.prepare('UPDATE guild_settings SET warning_thresholds = ? WHERE guild_id = ?')
      .run(JSON.stringify(thresholds || []), guildId);
  },
};

const AppSettings = {
  get() {
    const row = db.prepare('SELECT beta_locked FROM app_settings WHERE id = 1').get();
    return { betaLocked: !!(row && row.beta_locked) };
  },
  setBetaLocked(enabled) {
    db.prepare('UPDATE app_settings SET beta_locked = ? WHERE id = 1').run(enabled ? 1 : 0);
  },
};

const BetaAllowlist = {
  list() {
    return db.prepare('SELECT discord_user_id, added_at FROM beta_allowlist ORDER BY added_at').all();
  },
  has(discordUserId) {
    return !!db.prepare('SELECT 1 FROM beta_allowlist WHERE discord_user_id = ?').get(discordUserId);
  },
  add(discordUserId) {
    db.prepare('INSERT OR IGNORE INTO beta_allowlist (discord_user_id) VALUES (?)').run(discordUserId);
  },
  remove(discordUserId) {
    db.prepare('DELETE FROM beta_allowlist WHERE discord_user_id = ?').run(discordUserId);
  },
};

const ModActions = {
  log(guildId, { action, targetId, targetTag, moderatorId, moderatorTag, reason, source }) {
    db.prepare(`
      INSERT INTO mod_actions (guild_id, action, target_id, target_tag, moderator_id, moderator_tag, reason, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, action, targetId || null, targetTag || null, moderatorId, moderatorTag || null, reason || null, source || 'discord');
  },
  listForGuild(guildId, limit = 50) {
    return db.prepare('SELECT * FROM mod_actions WHERE guild_id = ? ORDER BY id DESC LIMIT ?').all(guildId, limit);
  },
};

const TicketTypes = {
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM ticket_types WHERE guild_id = ? ORDER BY id').all(guildId)
      .map(t => ({ ...t, support_role_ids: parseJSON(t.support_role_ids, []) }));
  },
  get(id) {
    const t = db.prepare('SELECT * FROM ticket_types WHERE id = ?').get(id);
    if (!t) return null;
    return { ...t, support_role_ids: parseJSON(t.support_role_ids, []) };
  },
  create(guildId, data) {
    const info = db.prepare(`
      INSERT INTO ticket_types
        (guild_id, name, emoji, category_channel_id, support_role_ids, name_pattern, max_open_per_user, welcome_title, welcome_description, welcome_color)
      VALUES (@guildId, @name, @emoji, @categoryChannelId, @supportRoleIds, @namePattern, @maxOpenPerUser, @welcomeTitle, @welcomeDescription, @welcomeColor)
    `).run({
      guildId,
      name: data.name,
      emoji: data.emoji || null,
      categoryChannelId: data.categoryChannelId || null,
      supportRoleIds: JSON.stringify(data.supportRoleIds || []),
      namePattern: data.namePattern || 'ticket-{username}',
      maxOpenPerUser: data.maxOpenPerUser ?? 1,
      welcomeTitle: data.welcomeTitle || null,
      welcomeDescription: data.welcomeDescription || null,
      welcomeColor: data.welcomeColor || '#5865F2',
    });
    return info.lastInsertRowid;
  },
  update(id, data) {
    db.prepare(`
      UPDATE ticket_types SET
        name = @name, emoji = @emoji, category_channel_id = @categoryChannelId,
        support_role_ids = @supportRoleIds, name_pattern = @namePattern,
        max_open_per_user = @maxOpenPerUser, welcome_title = @welcomeTitle,
        welcome_description = @welcomeDescription, welcome_color = @welcomeColor
      WHERE id = @id
    `).run({
      id,
      name: data.name,
      emoji: data.emoji || null,
      categoryChannelId: data.categoryChannelId || null,
      supportRoleIds: JSON.stringify(data.supportRoleIds || []),
      namePattern: data.namePattern || 'ticket-{username}',
      maxOpenPerUser: data.maxOpenPerUser ?? 1,
      welcomeTitle: data.welcomeTitle || null,
      welcomeDescription: data.welcomeDescription || null,
      welcomeColor: data.welcomeColor || '#5865F2',
    });
  },
  delete(id) {
    db.prepare('DELETE FROM ticket_types WHERE id = ?').run(id);
  },
};

const Panels = {
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM panels WHERE guild_id = ? ORDER BY id').all(guildId)
      .map(p => ({ ...p, ticket_type_ids: parseJSON(p.ticket_type_ids, []) }));
  },
  get(id) {
    const p = db.prepare('SELECT * FROM panels WHERE id = ?').get(id);
    if (!p) return null;
    return { ...p, ticket_type_ids: parseJSON(p.ticket_type_ids, []) };
  },
  create(guildId, data) {
    const info = db.prepare(`
      INSERT INTO panels (guild_id, title, description, color, ticket_type_ids, style)
      VALUES (@guildId, @title, @description, @color, @ticketTypeIds, @style)
    `).run({
      guildId,
      title: data.title || 'Support',
      description: data.description || 'Click below to open a ticket.',
      color: data.color || '#5865F2',
      ticketTypeIds: JSON.stringify(data.ticketTypeIds || []),
      style: data.style === 'select' ? 'select' : 'buttons',
    });
    return info.lastInsertRowid;
  },
  update(id, data) {
    db.prepare(`
      UPDATE panels SET title = @title, description = @description, color = @color,
        ticket_type_ids = @ticketTypeIds, style = @style
      WHERE id = @id
    `).run({
      id,
      title: data.title || 'Support',
      description: data.description || 'Click below to open a ticket.',
      color: data.color || '#5865F2',
      ticketTypeIds: JSON.stringify(data.ticketTypeIds || []),
      style: data.style === 'select' ? 'select' : 'buttons',
    });
  },
  setDeployed(id, channelId, messageId) {
    db.prepare('UPDATE panels SET channel_id = ?, message_id = ? WHERE id = ?').run(channelId, messageId, id);
  },
  delete(id) {
    db.prepare('DELETE FROM panels WHERE id = ?').run(id);
  },
};

const Tickets = {
  create(guildId, { channelId, ticketTypeId, openerId }) {
    const info = db.prepare(`
      INSERT INTO tickets (guild_id, channel_id, ticket_type_id, opener_id, status)
      VALUES (?, ?, ?, ?, 'open')
    `).run(guildId, channelId, ticketTypeId, openerId);
    return info.lastInsertRowid;
  },
  getByChannel(channelId) {
    return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
  },
  updateType(id, ticketTypeId) {
    db.prepare('UPDATE tickets SET ticket_type_id = ? WHERE id = ?').run(ticketTypeId, id);
  },
  get(id) {
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  },
  countOpenForUser(guildId, ticketTypeId, openerId) {
    return db.prepare(`
      SELECT COUNT(*) AS n FROM tickets
      WHERE guild_id = ? AND ticket_type_id = ? AND opener_id = ? AND status != 'closed'
    `).get(guildId, ticketTypeId, openerId).n;
  },
  claim(id, staffId) {
    db.prepare("UPDATE tickets SET claimed_by = ?, status = 'claimed' WHERE id = ?").run(staffId, id);
  },
  close(id, { closedBy, reason }) {
    db.prepare(`
      UPDATE tickets SET status = 'closed', closed_at = datetime('now'), closed_by = ?, close_reason = ?
      WHERE id = ?
    `).run(closedBy, reason || null, id);
  },
  listForGuild(guildId, limit = 50) {
    return db.prepare('SELECT * FROM tickets WHERE guild_id = ? ORDER BY id DESC LIMIT ?').all(guildId, limit);
  },
  clearClosedForGuild(guildId) {
    return db.prepare("DELETE FROM tickets WHERE guild_id = ? AND status = 'closed'").run(guildId).changes;
  },
};

const EmbedTemplates = {
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM embed_templates WHERE guild_id = ? ORDER BY id DESC').all(guildId)
      .map(e => ({ ...e, data: parseJSON(e.data, {}) }));
  },
  get(id) {
    const e = db.prepare('SELECT * FROM embed_templates WHERE id = ?').get(id);
    if (!e) return null;
    return { ...e, data: parseJSON(e.data, {}) };
  },
  create(guildId, name, data) {
    const info = db.prepare('INSERT INTO embed_templates (guild_id, name, data) VALUES (?, ?, ?)')
      .run(guildId, name, JSON.stringify(data));
    return info.lastInsertRowid;
  },
  update(id, name, data) {
    db.prepare("UPDATE embed_templates SET name = ?, data = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name, JSON.stringify(data), id);
  },
  delete(id) {
    db.prepare('DELETE FROM embed_templates WHERE id = ?').run(id);
  },
};

const Warnings = {
  add(guildId, userId, moderatorId, reason) {
    db.prepare('INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)')
      .run(guildId, userId, moderatorId, reason || null);
  },
  listForUser(guildId, userId) {
    return db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY id DESC').all(guildId, userId);
  },
  clearForUser(guildId, userId) {
    const info = db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
    return info.changes;
  },
};

const StaffRanks = {
  // Ordered lowest (rank 1) to highest.
  listForGuild(guildId) {
    return db.prepare('SELECT role_id, rank FROM staff_ranks WHERE guild_id = ? ORDER BY rank ASC').all(guildId);
  },
  replaceAll(guildId, roleIdsInOrder) {
    const tx = db.transaction((ids) => {
      db.prepare('DELETE FROM staff_ranks WHERE guild_id = ?').run(guildId);
      const insert = db.prepare('INSERT INTO staff_ranks (guild_id, role_id, rank) VALUES (?, ?, ?)');
      ids.forEach((roleId, i) => insert.run(guildId, roleId, i + 1));
    });
    tx(roleIdsInOrder);
  },
};

module.exports = { GuildSettings, TicketTypes, Panels, Tickets, EmbedTemplates, Warnings, StaffRanks, AppSettings, BetaAllowlist, ModActions };
