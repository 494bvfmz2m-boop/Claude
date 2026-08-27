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
        staff_list_color: '#a8e6ff', warning_thresholds: [], ticket_banned_role_id: null,
        welcome_channel_id: null, welcome_message: null, leave_channel_id: null, leave_message: null,
        autorole_id: null, link_filter_mode: 'off', message_log_channel_id: null,
        verification_enabled: false, verification_channel_id: null, verification_role_id: null,
        verification_message: null, verification_message_id: null,
        stats_members_channel_id: null, stats_online_channel_id: null, stats_boosts_channel_id: null,
      };
    }
    return {
      ...row,
      swear_filter_enabled: !!row.swear_filter_enabled,
      swear_words: parseJSON(row.swear_words, []),
      warning_thresholds: parseJSON(row.warning_thresholds, []),
      verification_enabled: !!row.verification_enabled,
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
    db.prepare('UPDATE guild_settings SET staff_list_color = ? WHERE guild_id = ?').run(color || '#a8e6ff', guildId);
  },
  setWarningThresholds(guildId, thresholds) {
    ensureGuildSettingsRow(guildId);
    db.prepare('UPDATE guild_settings SET warning_thresholds = ? WHERE guild_id = ?')
      .run(JSON.stringify(thresholds || []), guildId);
  },
  setTicketBannedRole(guildId, roleId) {
    ensureGuildSettingsRow(guildId);
    db.prepare("UPDATE guild_settings SET ticket_banned_role_id = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(roleId || null, guildId);
  },
  setWelcomeChannel(guildId, channelId) {
    ensureGuildSettingsRow(guildId);
    db.prepare("UPDATE guild_settings SET welcome_channel_id = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(channelId || null, guildId);
  },
  setWelcomeMessage(guildId, message) {
    ensureGuildSettingsRow(guildId);
    db.prepare("UPDATE guild_settings SET welcome_message = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(message || null, guildId);
  },
  setLeaveChannel(guildId, channelId) {
    ensureGuildSettingsRow(guildId);
    db.prepare("UPDATE guild_settings SET leave_channel_id = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(channelId || null, guildId);
  },
  setLeaveMessage(guildId, message) {
    ensureGuildSettingsRow(guildId);
    db.prepare("UPDATE guild_settings SET leave_message = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(message || null, guildId);
  },
  setAutorole(guildId, roleId) {
    ensureGuildSettingsRow(guildId);
    db.prepare("UPDATE guild_settings SET autorole_id = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(roleId || null, guildId);
  },
  setLinkFilter(guildId, mode) {
    ensureGuildSettingsRow(guildId);
    const safeMode = ['off', 'invites', 'all'].includes(mode) ? mode : 'off';
    db.prepare("UPDATE guild_settings SET link_filter_mode = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(safeMode, guildId);
  },
  setMessageLogChannel(guildId, channelId) {
    ensureGuildSettingsRow(guildId);
    db.prepare("UPDATE guild_settings SET message_log_channel_id = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(channelId || null, guildId);
  },
  setVerification(guildId, { enabled, channelId, roleId, message }) {
    ensureGuildSettingsRow(guildId);
    db.prepare(`
      UPDATE guild_settings SET verification_enabled = ?, verification_channel_id = ?, verification_role_id = ?,
        verification_message = ?, updated_at = datetime('now')
      WHERE guild_id = ?
    `).run(enabled ? 1 : 0, channelId || null, roleId || null, message || null, guildId);
  },
  setVerificationMessage(guildId, messageId) {
    ensureGuildSettingsRow(guildId);
    db.prepare('UPDATE guild_settings SET verification_message_id = ? WHERE guild_id = ?').run(messageId || null, guildId);
  },
  setStatsChannels(guildId, { membersChannelId, onlineChannelId, boostsChannelId }) {
    ensureGuildSettingsRow(guildId);
    db.prepare(`
      UPDATE guild_settings SET stats_members_channel_id = ?, stats_online_channel_id = ?, stats_boosts_channel_id = ?,
        updated_at = datetime('now')
      WHERE guild_id = ?
    `).run(membersChannelId || null, onlineChannelId || null, boostsChannelId || null, guildId);
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

const DmFormTemplates = {
  list() {
    return db.prepare('SELECT * FROM dm_form_templates ORDER BY name').all()
      .map((row) => ({ ...row, questions: JSON.parse(row.questions || '[]') }));
  },
  get(id) {
    const row = db.prepare('SELECT * FROM dm_form_templates WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, questions: JSON.parse(row.questions || '[]') };
  },
  create({ name, title, intro, questions }) {
    const result = db.prepare(
      'INSERT INTO dm_form_templates (name, title, intro, questions) VALUES (?, ?, ?, ?)',
    ).run(name, title, intro || null, JSON.stringify(questions || []));
    return result.lastInsertRowid;
  },
  update(id, { name, title, intro, questions }) {
    db.prepare(
      "UPDATE dm_form_templates SET name = ?, title = ?, intro = ?, questions = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(name, title, intro || null, JSON.stringify(questions || []), id);
  },
  remove(id) {
    db.prepare('DELETE FROM dm_form_templates WHERE id = ?').run(id);
  },
};

const DmFormSends = {
  create({ recipientId, recipientTag, templateName, title, intro, questions }) {
    const result = db.prepare(`
      INSERT INTO dm_form_sends (recipient_id, recipient_tag, context, template_name, title, intro, questions)
      VALUES (?, ?, 'manual', ?, ?, ?, ?)
    `).run(recipientId, recipientTag || null, templateName || null, title, intro || null, JSON.stringify(questions || []));
    return result.lastInsertRowid;
  },
  get(id) {
    const row = db.prepare('SELECT * FROM dm_form_sends WHERE id = ?').get(id);
    if (!row) return null;
    return {
      ...row,
      questions: JSON.parse(row.questions || '[]'),
      answers: row.answers ? JSON.parse(row.answers) : null,
      responded: !!row.responded,
    };
  },
  list(limit = 15) {
    return db.prepare('SELECT * FROM dm_form_sends ORDER BY id DESC LIMIT ?').all(limit)
      .map((row) => ({
        ...row,
        questions: JSON.parse(row.questions || '[]'),
        answers: row.answers ? JSON.parse(row.answers) : null,
        responded: !!row.responded,
      }));
  },
  count() {
    return db.prepare('SELECT COUNT(*) AS n FROM dm_form_sends').get().n;
  },
  countPending() {
    return db.prepare('SELECT COUNT(*) AS n FROM dm_form_sends WHERE responded = 0').get().n;
  },
  markResponded(id, answers) {
    db.prepare("UPDATE dm_form_sends SET responded = 1, answers = ?, responded_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(answers), id);
  },
};

const Contacts = {
  list() {
    return db.prepare('SELECT discord_user_id, note, added_at FROM contacts ORDER BY added_at DESC').all();
  },
  has(discordUserId) {
    return !!db.prepare('SELECT 1 FROM contacts WHERE discord_user_id = ?').get(discordUserId);
  },
  add(discordUserId, note) {
    db.prepare('INSERT OR IGNORE INTO contacts (discord_user_id, note) VALUES (?, ?)').run(discordUserId, note || null);
  },
  remove(discordUserId) {
    db.prepare('DELETE FROM contacts WHERE discord_user_id = ?').run(discordUserId);
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
  // Page size + 1 extra row so the route can tell whether a "next page" link
  // is worth showing, without a separate COUNT(*) query.
  listFiltered(guildId, { moderatorId, action, limit = 25, offset = 0 } = {}) {
    const clauses = ['guild_id = ?'];
    const params = [guildId];
    if (moderatorId) { clauses.push('moderator_id = ?'); params.push(moderatorId); }
    if (action) { clauses.push('action = ?'); params.push(action); }
    params.push(limit + 1, offset);
    return db.prepare(`SELECT * FROM mod_actions WHERE ${clauses.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params);
  },
  distinctModerators(guildId) {
    return db.prepare('SELECT DISTINCT moderator_id, moderator_tag FROM mod_actions WHERE guild_id = ? ORDER BY moderator_tag').all(guildId);
  },
  distinctActions(guildId) {
    return db.prepare('SELECT DISTINCT action FROM mod_actions WHERE guild_id = ? ORDER BY action').all(guildId).map((r) => r.action);
  },
};

const TicketTypes = {
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM ticket_types WHERE guild_id = ? ORDER BY id').all(guildId)
      .map(t => ({ ...t, support_role_ids: parseJSON(t.support_role_ids, []), generate_transcript: !!t.generate_transcript }));
  },
  get(id) {
    const t = db.prepare('SELECT * FROM ticket_types WHERE id = ?').get(id);
    if (!t) return null;
    return { ...t, support_role_ids: parseJSON(t.support_role_ids, []), generate_transcript: !!t.generate_transcript };
  },
  create(guildId, data) {
    const info = db.prepare(`
      INSERT INTO ticket_types
        (guild_id, name, emoji, category_channel_id, support_role_ids, name_pattern, max_open_per_user, welcome_title, welcome_description, welcome_color, generate_transcript)
      VALUES (@guildId, @name, @emoji, @categoryChannelId, @supportRoleIds, @namePattern, @maxOpenPerUser, @welcomeTitle, @welcomeDescription, @welcomeColor, @generateTranscript)
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
      welcomeColor: data.welcomeColor || '#a8e6ff',
      generateTranscript: data.generateTranscript === false ? 0 : 1,
    });
    return info.lastInsertRowid;
  },
  update(id, data) {
    db.prepare(`
      UPDATE ticket_types SET
        name = @name, emoji = @emoji, category_channel_id = @categoryChannelId,
        support_role_ids = @supportRoleIds, name_pattern = @namePattern,
        max_open_per_user = @maxOpenPerUser, welcome_title = @welcomeTitle,
        welcome_description = @welcomeDescription, welcome_color = @welcomeColor,
        generate_transcript = @generateTranscript
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
      welcomeColor: data.welcomeColor || '#a8e6ff',
      generateTranscript: data.generateTranscript === false ? 0 : 1,
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
      color: data.color || '#a8e6ff',
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
      color: data.color || '#a8e6ff',
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
  countOpenForGuild(guildId) {
    return db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status != 'closed'").get(guildId).n;
  },
  clearClosedForGuild(guildId) {
    return db.prepare("DELETE FROM tickets WHERE guild_id = ? AND status = 'closed'").run(guildId).changes;
  },
};

const ReactionRolePanels = {
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ? ORDER BY id').all(guildId)
      .map((p) => ({ ...p, mappings: parseJSON(p.mappings, []), exclusive: !!p.exclusive }));
  },
  get(id) {
    const p = db.prepare('SELECT * FROM reaction_role_panels WHERE id = ?').get(id);
    if (!p) return null;
    return { ...p, mappings: parseJSON(p.mappings, []), exclusive: !!p.exclusive };
  },
  getByMessage(messageId) {
    const p = db.prepare('SELECT * FROM reaction_role_panels WHERE message_id = ?').get(messageId);
    if (!p) return null;
    return { ...p, mappings: parseJSON(p.mappings, []), exclusive: !!p.exclusive };
  },
  create(guildId, data) {
    const info = db.prepare(`
      INSERT INTO reaction_role_panels (guild_id, title, description, color, mappings, exclusive)
      VALUES (@guildId, @title, @description, @color, @mappings, @exclusive)
    `).run({
      guildId,
      title: data.title || 'Reaction Roles',
      description: data.description || 'React to get a role!',
      color: data.color || '#a8e6ff',
      mappings: JSON.stringify(data.mappings || []),
      exclusive: data.exclusive ? 1 : 0,
    });
    return info.lastInsertRowid;
  },
  update(id, data) {
    db.prepare(`
      UPDATE reaction_role_panels SET title = @title, description = @description, color = @color, mappings = @mappings,
        exclusive = @exclusive
      WHERE id = @id
    `).run({
      id,
      title: data.title || 'Reaction Roles',
      description: data.description || 'React to get a role!',
      color: data.color || '#a8e6ff',
      mappings: JSON.stringify(data.mappings || []),
      exclusive: data.exclusive ? 1 : 0,
    });
  },
  setDeployed(id, channelId, messageId) {
    db.prepare('UPDATE reaction_role_panels SET channel_id = ?, message_id = ? WHERE id = ?').run(channelId, messageId, id);
  },
  delete(id) {
    db.prepare('DELETE FROM reaction_role_panels WHERE id = ?').run(id);
  },
};

const DashboardRoleAccess = {
  listForGuild(guildId) {
    return db.prepare('SELECT role_id, areas FROM dashboard_role_access WHERE guild_id = ?').all(guildId)
      .map((r) => ({ roleId: r.role_id, areas: parseJSON(r.areas, []) }));
  },
  // Replaces the whole grant set for this guild in one go -- the Permissions
  // page always submits the complete role/area grid, so there's no partial
  // update to reconcile. Roles with an empty area list are dropped entirely
  // rather than stored as a no-op row.
  replaceAll(guildId, grants) {
    const tx = db.transaction((rows) => {
      db.prepare('DELETE FROM dashboard_role_access WHERE guild_id = ?').run(guildId);
      const insert = db.prepare('INSERT INTO dashboard_role_access (guild_id, role_id, areas) VALUES (?, ?, ?)');
      rows.forEach(({ roleId, areas }) => {
        if (areas.length > 0) insert.run(guildId, roleId, JSON.stringify(areas));
      });
    });
    tx(grants);
  },
};

const CommandPermissions = {
  listForGuild(guildId) {
    return db.prepare('SELECT role_id, action FROM command_permissions WHERE guild_id = ?').all(guildId)
      .map((r) => ({ roleId: r.role_id, action: r.action }));
  },
  // Same all-or-nothing replace as DashboardRoleAccess.replaceAll -- the
  // Permissions page always submits the full role/action grid.
  replaceAll(guildId, grants) {
    const tx = db.transaction((rows) => {
      db.prepare('DELETE FROM command_permissions WHERE guild_id = ?').run(guildId);
      const insert = db.prepare('INSERT INTO command_permissions (guild_id, role_id, action) VALUES (?, ?, ?)');
      rows.forEach(({ roleId, actions }) => {
        actions.forEach((action) => insert.run(guildId, roleId, action));
      });
    });
    tx(grants);
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

const Polls = {
  create(data) {
    const info = db.prepare(`
      INSERT INTO polls (guild_id, channel_id, message_id, question, options, ends_at)
      VALUES (@guildId, @channelId, @messageId, @question, @options, @endsAt)
    `).run({
      guildId: data.guildId,
      channelId: data.channelId,
      messageId: data.messageId,
      question: data.question,
      options: JSON.stringify(data.options || []),
      endsAt: data.endsAt || null,
    });
    return info.lastInsertRowid;
  },
  // Open polls with an end time that has already passed -- what the
  // scheduler closes out on each sweep.
  listDue(nowIso) {
    return db.prepare('SELECT * FROM polls WHERE closed = 0 AND ends_at IS NOT NULL AND ends_at <= ?')
      .all(nowIso)
      .map((p) => ({ ...p, options: parseJSON(p.options, []) }));
  },
  markClosed(id) {
    db.prepare('UPDATE polls SET closed = 1 WHERE id = ?').run(id);
  },
};

const Tags = {
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM tags WHERE guild_id = ? ORDER BY name COLLATE NOCASE').all(guildId);
  },
  get(guildId, name) {
    return db.prepare('SELECT * FROM tags WHERE guild_id = ? AND name = ? COLLATE NOCASE').get(guildId, name);
  },
  create(guildId, name, content, createdBy) {
    const info = db.prepare('INSERT INTO tags (guild_id, name, content, created_by) VALUES (?, ?, ?, ?)')
      .run(guildId, name, content, createdBy || null);
    return info.lastInsertRowid;
  },
  update(id, content) {
    db.prepare('UPDATE tags SET content = ? WHERE id = ?').run(content, id);
  },
  delete(id) {
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  },
};

const Giveaways = {
  create(data) {
    const info = db.prepare(`
      INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winner_count, required_role_id, hosted_by, ends_at)
      VALUES (@guildId, @channelId, @messageId, @prize, @winnerCount, @requiredRoleId, @hostedBy, @endsAt)
    `).run({
      guildId: data.guildId,
      channelId: data.channelId,
      messageId: data.messageId,
      prize: data.prize,
      winnerCount: data.winnerCount || 1,
      requiredRoleId: data.requiredRoleId || null,
      hostedBy: data.hostedBy || null,
      endsAt: data.endsAt,
    });
    return info.lastInsertRowid;
  },
  get(id) {
    const g = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
    if (!g) return null;
    return { ...g, entries: parseJSON(g.entries, []) };
  },
  getByMessage(messageId) {
    const g = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
    if (!g) return null;
    return { ...g, entries: parseJSON(g.entries, []) };
  },
  listDue(nowIso) {
    return db.prepare('SELECT * FROM giveaways WHERE ended = 0 AND ends_at <= ?').all(nowIso)
      .map((g) => ({ ...g, entries: parseJSON(g.entries, []) }));
  },
  setEntries(id, entries) {
    db.prepare('UPDATE giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(entries), id);
  },
  markEnded(id) {
    db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(id);
  },
  // Pulls the end time to right now instead of ending it directly here, so
  // the scheduler's next sweep closes it through the one normal path (picks
  // winners, edits the message, announces) rather than duplicating that.
  endNow(id) {
    db.prepare('UPDATE giveaways SET ends_at = ? WHERE id = ? AND ended = 0').run(new Date().toISOString(), id);
  },
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY id DESC').all(guildId)
      .map((g) => ({ ...g, entries: parseJSON(g.entries, []) }));
  },
  delete(id) {
    db.prepare('DELETE FROM giveaways WHERE id = ?').run(id);
  },
};

const Events = {
  create(data) {
    const info = db.prepare(`
      INSERT INTO events (guild_id, channel_id, message_id, title, description, event_time, hosted_by)
      VALUES (@guildId, @channelId, @messageId, @title, @description, @eventTime, @hostedBy)
    `).run({
      guildId: data.guildId,
      channelId: data.channelId,
      messageId: data.messageId,
      title: data.title,
      description: data.description || null,
      eventTime: data.eventTime || null,
      hostedBy: data.hostedBy || null,
    });
    return info.lastInsertRowid;
  },
  getByMessage(messageId) {
    const e = db.prepare('SELECT * FROM events WHERE message_id = ?').get(messageId);
    if (!e) return null;
    return { ...e, going: parseJSON(e.going, []), maybe: parseJSON(e.maybe, []), not_going: parseJSON(e.not_going, []) };
  },
  setResponse(id, going, maybe, notGoing) {
    db.prepare('UPDATE events SET going = ?, maybe = ?, not_going = ? WHERE id = ?')
      .run(JSON.stringify(going), JSON.stringify(maybe), JSON.stringify(notGoing), id);
  },
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM events WHERE guild_id = ? ORDER BY id DESC').all(guildId)
      .map((e) => ({ ...e, going: parseJSON(e.going, []), maybe: parseJSON(e.maybe, []), not_going: parseJSON(e.not_going, []) }));
  },
  delete(id) {
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
  },
};

const ScheduledAnnouncements = {
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM scheduled_announcements WHERE guild_id = ? ORDER BY next_run').all(guildId);
  },
  get(id) {
    return db.prepare('SELECT * FROM scheduled_announcements WHERE id = ?').get(id);
  },
  create(guildId, data) {
    const info = db.prepare(`
      INSERT INTO scheduled_announcements (guild_id, channel_id, message, recurrence, next_run, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(guildId, data.channelId, data.message, data.recurrence || 'none', data.nextRun, data.createdBy || null);
    return info.lastInsertRowid;
  },
  listDue(nowIso) {
    return db.prepare('SELECT * FROM scheduled_announcements WHERE active = 1 AND next_run <= ?').all(nowIso);
  },
  reschedule(id, nextRun) {
    db.prepare('UPDATE scheduled_announcements SET next_run = ? WHERE id = ?').run(nextRun, id);
  },
  deactivate(id) {
    db.prepare('UPDATE scheduled_announcements SET active = 0 WHERE id = ?').run(id);
  },
  delete(id) {
    db.prepare('DELETE FROM scheduled_announcements WHERE id = ?').run(id);
  },
};

module.exports = { GuildSettings, TicketTypes, Panels, Tickets, EmbedTemplates, Warnings, StaffRanks, AppSettings, BetaAllowlist, ModActions, ReactionRolePanels, DashboardRoleAccess, CommandPermissions, DmFormSends, DmFormTemplates, Contacts, Polls, Tags, Giveaways, Events, ScheduledAnnouncements };
