const db = require('./database');

function parseJSON(str, fallback) {
  try {
    return JSON.parse(str ?? '');
  } catch {
    return fallback;
  }
}

const GuildSettings = {
  get(guildId) {
    const row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
    return row || { guild_id: guildId, transcript_channel_id: null };
  },
  upsert(guildId, { transcriptChannelId }) {
    db.prepare(`
      INSERT INTO guild_settings (guild_id, transcript_channel_id, updated_at)
      VALUES (@guildId, @transcriptChannelId, datetime('now'))
      ON CONFLICT(guild_id) DO UPDATE SET
        transcript_channel_id = excluded.transcript_channel_id,
        updated_at = datetime('now')
    `).run({ guildId, transcriptChannelId: transcriptChannelId || null });
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

module.exports = { GuildSettings, TicketTypes, Panels, Tickets, EmbedTemplates };
