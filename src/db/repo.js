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
        staff_list_color: '#a32ee2', warning_thresholds: [], ticket_banned_role_id: null,
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
    const row = db.prepare('SELECT beta_locked, maintenance_enabled, maintenance_message, tebex_webhook_secret FROM app_settings WHERE id = 1').get();
    return {
      betaLocked: !!(row && row.beta_locked),
      maintenanceEnabled: !!(row && row.maintenance_enabled),
      maintenanceMessage: row ? row.maintenance_message : null,
      tebexWebhookSecret: row ? row.tebex_webhook_secret : null,
    };
  },
  setBetaLocked(enabled) {
    db.prepare('UPDATE app_settings SET beta_locked = ? WHERE id = 1').run(enabled ? 1 : 0);
  },
  setMaintenance(enabled, message) {
    db.prepare('UPDATE app_settings SET maintenance_enabled = ?, maintenance_message = ? WHERE id = 1').run(enabled ? 1 : 0, message || null);
  },
  setTebexWebhookSecret(secret) {
    db.prepare('UPDATE app_settings SET tebex_webhook_secret = ? WHERE id = 1').run(secret || null);
  },
};

const AfkStatus = {
  get(guildId, userId) {
    return db.prepare('SELECT * FROM afk_status WHERE guild_id = ? AND user_id = ?').get(guildId, userId) || null;
  },
  // originalNickname is whatever their nickname was *before* they ever went
  // AFK -- if they were already AFK when this runs (updating their message),
  // the caller passes the existing record's original_nickname back through
  // so it never gets clobbered with the current "[AFK] ..." one.
  set(guildId, userId, message, originalNickname) {
    db.prepare(`
      INSERT INTO afk_status (guild_id, user_id, message, original_nickname) VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET message = excluded.message, original_nickname = excluded.original_nickname, started_at = datetime('now')
    `).run(guildId, userId, message || null, originalNickname || null);
  },
  clear(guildId, userId) {
    db.prepare('DELETE FROM afk_status WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  },
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM afk_status WHERE guild_id = ?').all(guildId);
  },
};

const StaffNotes = {
  list() {
    return db.prepare('SELECT * FROM staff_notes ORDER BY id DESC').all();
  },
  add(authorId, authorTag, note) {
    db.prepare('INSERT INTO staff_notes (author_id, author_tag, note) VALUES (?, ?, ?)').run(authorId, authorTag || null, note);
  },
  remove(id) {
    db.prepare('DELETE FROM staff_notes WHERE id = ?').run(id);
  },
};

const BetaRequests = {
  create(discordUserId, discordTag, message) {
    const info = db.prepare('INSERT INTO beta_requests (discord_user_id, discord_tag, message) VALUES (?, ?, ?)')
      .run(discordUserId, discordTag || null, message || null);
    return info.lastInsertRowid;
  },
  get(id) {
    return db.prepare('SELECT * FROM beta_requests WHERE id = ?').get(id) || null;
  },
  hasPending(discordUserId) {
    return !!db.prepare("SELECT 1 FROM beta_requests WHERE discord_user_id = ? AND status = 'pending'").get(discordUserId);
  },
  listPending() {
    return db.prepare("SELECT * FROM beta_requests WHERE status = 'pending' ORDER BY id DESC").all();
  },
  decide(id, status, decidedBy) {
    db.prepare("UPDATE beta_requests SET status = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?")
      .run(status, decidedBy, id);
  },
};

const DashboardAdmins = {
  list() {
    return db.prepare('SELECT discord_user_id, note, added_by, added_at FROM dashboard_admins ORDER BY added_at DESC').all();
  },
  has(discordUserId) {
    return !!db.prepare('SELECT 1 FROM dashboard_admins WHERE discord_user_id = ?').get(discordUserId);
  },
  add(discordUserId, note, addedBy) {
    db.prepare('INSERT OR IGNORE INTO dashboard_admins (discord_user_id, note, added_by) VALUES (?, ?, ?)')
      .run(discordUserId, note || null, addedBy || null);
  },
  remove(discordUserId) {
    db.prepare('DELETE FROM dashboard_admins WHERE discord_user_id = ?').run(discordUserId);
  },
};

// Scoped /staff access, below full-admin (DashboardAdmins) -- a named role
// grants only its listed areas (web/lib/staffAreas.js) to whoever's added
// as a member, rather than everything a full admin gets. A user can belong
// to more than one role; their actual access is the union of all of them.
const StaffRoles = {
  list() {
    return db.prepare('SELECT * FROM staff_roles ORDER BY name COLLATE NOCASE').all()
      .map((r) => ({ ...r, areas: parseJSON(r.areas, []) }));
  },
  get(id) {
    const row = db.prepare('SELECT * FROM staff_roles WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, areas: parseJSON(row.areas, []) };
  },
  create(name, areas) {
    const info = db.prepare('INSERT INTO staff_roles (name, areas) VALUES (?, ?)').run(name, JSON.stringify(areas || []));
    return info.lastInsertRowid;
  },
  update(id, name, areas) {
    db.prepare('UPDATE staff_roles SET name = ?, areas = ? WHERE id = ?').run(name, JSON.stringify(areas || []), id);
  },
  delete(id) {
    db.prepare('DELETE FROM staff_role_members WHERE staff_role_id = ?').run(id);
    db.prepare('DELETE FROM staff_roles WHERE id = ?').run(id);
  },
  membersFor(id) {
    return db.prepare('SELECT * FROM staff_role_members WHERE staff_role_id = ? ORDER BY added_at DESC').all(id);
  },
  addMember(roleId, discordUserId, note, addedBy) {
    db.prepare('INSERT OR IGNORE INTO staff_role_members (staff_role_id, discord_user_id, note, added_by) VALUES (?, ?, ?, ?)')
      .run(roleId, discordUserId, note || null, addedBy || null);
  },
  removeMember(roleId, discordUserId) {
    db.prepare('DELETE FROM staff_role_members WHERE staff_role_id = ? AND discord_user_id = ?').run(roleId, discordUserId);
  },
  // Every custom role a given Discord user belongs to.
  rolesForUser(discordUserId) {
    return db.prepare(`
      SELECT sr.* FROM staff_roles sr
      JOIN staff_role_members srm ON srm.staff_role_id = sr.id
      WHERE srm.discord_user_id = ?
    `).all(discordUserId).map((r) => ({ ...r, areas: parseJSON(r.areas, []) }));
  },
  // The union of areas granted by every role a user belongs to -- what
  // requireStaffArea actually checks against.
  areasForUser(discordUserId) {
    const areas = new Set();
    for (const role of StaffRoles.rolesForUser(discordUserId)) {
      role.areas.forEach((a) => areas.add(a));
    }
    return areas;
  },
};

const AdminAuditLog = {
  log(actorId, actorTag, action, detail) {
    db.prepare('INSERT INTO admin_audit_log (actor_id, actor_tag, action, detail) VALUES (?, ?, ?, ?)')
      .run(actorId, actorTag || null, action, detail || null);
  },
  list(limit = 100) {
    return db.prepare('SELECT * FROM admin_audit_log ORDER BY id DESC LIMIT ?').all(limit);
  },
};

const ServerNotes = {
  getAll() {
    const rows = db.prepare('SELECT guild_id, note FROM server_notes').all();
    return Object.fromEntries(rows.map((r) => [r.guild_id, r.note]));
  },
  list() {
    return db.prepare('SELECT * FROM server_notes ORDER BY updated_at DESC').all();
  },
  // Saving an empty note deletes the row instead of storing blank text --
  // one route handles both "set" and "clear" this way.
  set(guildId, note, updatedBy) {
    if (!note) {
      db.prepare('DELETE FROM server_notes WHERE guild_id = ?').run(guildId);
      return;
    }
    db.prepare(`
      INSERT INTO server_notes (guild_id, note, updated_by) VALUES (?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET note = excluded.note, updated_by = excluded.updated_by, updated_at = datetime('now')
    `).run(guildId, note, updatedBy || null);
  },
};

const GlobalBlocklist = {
  list() {
    return db.prepare('SELECT discord_user_id, reason, added_by, added_at FROM global_blocklist ORDER BY added_at DESC').all();
  },
  has(discordUserId) {
    return !!db.prepare('SELECT 1 FROM global_blocklist WHERE discord_user_id = ?').get(discordUserId);
  },
  add(discordUserId, reason, addedBy) {
    db.prepare('INSERT OR IGNORE INTO global_blocklist (discord_user_id, reason, added_by) VALUES (?, ?, ?)')
      .run(discordUserId, reason || null, addedBy || null);
  },
  remove(discordUserId) {
    db.prepare('DELETE FROM global_blocklist WHERE discord_user_id = ?').run(discordUserId);
  },
};

const Stats = {
  overview() {
    return {
      ticketsTotal: db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n,
      ticketsOpen: db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status = 'open'").get().n,
      modActionsTotal: db.prepare('SELECT COUNT(*) AS n FROM mod_actions').get().n,
      warningsTotal: db.prepare('SELECT COUNT(*) AS n FROM warnings').get().n,
      giveawaysActive: db.prepare('SELECT COUNT(*) AS n FROM giveaways WHERE ended = 0').get().n,
      pollsActive: db.prepare('SELECT COUNT(*) AS n FROM polls WHERE closed = 0').get().n,
    };
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

const EmojiBook = {
  list() {
    return db.prepare('SELECT id, name, emoji_id, animated, note, added_at FROM emoji_book ORDER BY added_at DESC').all();
  },
  has(emojiId) {
    return !!db.prepare('SELECT 1 FROM emoji_book WHERE emoji_id = ?').get(emojiId);
  },
  add(name, emojiId, animated, note) {
    db.prepare('INSERT OR IGNORE INTO emoji_book (name, emoji_id, animated, note) VALUES (?, ?, ?, ?)')
      .run(name, emojiId, animated ? 1 : 0, note || null);
  },
  remove(id) {
    db.prepare('DELETE FROM emoji_book WHERE id = ?').run(id);
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
  listForTargetAllGuilds(targetId, limit = 50) {
    return db.prepare('SELECT * FROM mod_actions WHERE target_id = ? ORDER BY id DESC LIMIT ?').all(targetId, limit);
  },
  countThisWeekForGuild(guildId) {
    return db.prepare("SELECT COUNT(*) AS n FROM mod_actions WHERE guild_id = ? AND created_at >= datetime('now', '-7 days')").get(guildId).n;
  },
};

const TicketTypes = {
  // Only ones currently usable -- excludes anything a tier downgrade
  // disabled (see bot/tierEnforcement.js). Used everywhere a fresh list of
  // "your ticket types" is needed: the dashboard, panel building, the
  // create-panel picker, limit counting.
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM ticket_types WHERE guild_id = ? AND tier_disabled = 0 ORDER BY id').all(guildId)
      .map(t => ({ ...t, support_role_ids: parseJSON(t.support_role_ids, []), generate_transcript: !!t.generate_transcript }));
  },
  // Every ticket type regardless of tier_disabled -- for tierEnforcement's
  // own reconciliation (it needs to see what's disabled to re-enable it)
  // and for showing the owner what's temporarily unavailable.
  listAllForGuild(guildId) {
    return db.prepare('SELECT * FROM ticket_types WHERE guild_id = ? ORDER BY id').all(guildId)
      .map(t => ({ ...t, support_role_ids: parseJSON(t.support_role_ids, []), generate_transcript: !!t.generate_transcript }));
  },
  // Deliberately NOT filtered by tier_disabled -- an already-open ticket
  // still needs to resolve its type's welcome color/support roles/etc even
  // after the type itself gets disabled, and openTicket (bot/tickets.js)
  // checks tier_disabled explicitly before letting anyone open a NEW one.
  get(id) {
    const t = db.prepare('SELECT * FROM ticket_types WHERE id = ?').get(id);
    if (!t) return null;
    return { ...t, support_role_ids: parseJSON(t.support_role_ids, []), generate_transcript: !!t.generate_transcript };
  },
  setTierDisabled(id, disabled) {
    db.prepare('UPDATE ticket_types SET tier_disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id);
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
      welcomeColor: data.welcomeColor || '#a32ee2',
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
      welcomeColor: data.welcomeColor || '#a32ee2',
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
      color: data.color || '#a32ee2',
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
      color: data.color || '#a32ee2',
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
  // Only ones currently usable -- see TicketTypes.listForGuild's comment.
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ? AND tier_disabled = 0 ORDER BY id').all(guildId)
      .map((p) => ({ ...p, mappings: parseJSON(p.mappings, []), exclusive: !!p.exclusive }));
  },
  listAllForGuild(guildId) {
    return db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ? ORDER BY id').all(guildId)
      .map((p) => ({ ...p, mappings: parseJSON(p.mappings, []), exclusive: !!p.exclusive }));
  },
  get(id) {
    const p = db.prepare('SELECT * FROM reaction_role_panels WHERE id = ?').get(id);
    if (!p) return null;
    return { ...p, mappings: parseJSON(p.mappings, []), exclusive: !!p.exclusive };
  },
  // Not filtered by tier_disabled -- bot/reactionRoles.js's reaction
  // handler needs to find a disabled panel too, specifically so it can
  // recognize the reaction belongs to one and silently ignore it (see that
  // file) rather than falling through as if no panel matched at all.
  getByMessage(messageId) {
    const p = db.prepare('SELECT * FROM reaction_role_panels WHERE message_id = ?').get(messageId);
    if (!p) return null;
    return { ...p, mappings: parseJSON(p.mappings, []), exclusive: !!p.exclusive };
  },
  setTierDisabled(id, disabled) {
    db.prepare('UPDATE reaction_role_panels SET tier_disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id);
  },
  create(guildId, data) {
    const info = db.prepare(`
      INSERT INTO reaction_role_panels (guild_id, title, description, color, mappings, exclusive)
      VALUES (@guildId, @title, @description, @color, @mappings, @exclusive)
    `).run({
      guildId,
      title: data.title || 'Reaction Roles',
      description: data.description || 'React to get a role!',
      color: data.color || '#a32ee2',
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
      color: data.color || '#a32ee2',
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
  listForUserAllGuilds(userId) {
    return db.prepare('SELECT * FROM warnings WHERE user_id = ? ORDER BY id DESC').all(userId);
  },
  countTodayForGuild(guildId) {
    return db.prepare("SELECT COUNT(*) AS n FROM warnings WHERE guild_id = ? AND date(created_at) = date('now')").get(guildId).n;
  },
  clearForUser(guildId, userId) {
    const info = db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
    return info.changes;
  },
};

const StaffRanks = {
  // Ordered lowest (rank 1) to highest, within one hierarchy. skip_promote
  // marks a rank as display-only -- a placeholder/divider role (e.g. "--
  // Staff --") that's part of the ladder for display purposes but that
  // /promote and /demote should step over, never land someone on.
  listForHierarchy(hierarchyId) {
    return db.prepare('SELECT role_id, rank, skip_promote FROM staff_ranks WHERE hierarchy_id = ? ORDER BY rank ASC').all(hierarchyId)
      .map((r) => ({ ...r, skip_promote: !!r.skip_promote }));
  },
  // Rebuilds the whole ordered list from scratch (add/remove/reorder all
  // funnel through here) -- skip_promote is looked up per role_id first and
  // carried over, so reordering or adding/removing a different role never
  // resets which ranks are marked as placeholders.
  replaceAllForHierarchy(hierarchyId, guildId, roleIdsInOrder) {
    const tx = db.transaction((ids) => {
      const skipFlags = new Map(
        db.prepare('SELECT role_id, skip_promote FROM staff_ranks WHERE hierarchy_id = ?').all(hierarchyId)
          .map((r) => [r.role_id, r.skip_promote]),
      );
      db.prepare('DELETE FROM staff_ranks WHERE hierarchy_id = ?').run(hierarchyId);
      const insert = db.prepare('INSERT INTO staff_ranks (guild_id, hierarchy_id, role_id, rank, skip_promote) VALUES (?, ?, ?, ?, ?)');
      ids.forEach((roleId, i) => insert.run(guildId, hierarchyId, roleId, i + 1, skipFlags.get(roleId) || 0));
    });
    tx(roleIdsInOrder);
  },
  setSkipPromote(hierarchyId, roleId, skip) {
    db.prepare('UPDATE staff_ranks SET skip_promote = ? WHERE hierarchy_id = ? AND role_id = ?').run(skip ? 1 : 0, hierarchyId, roleId);
  },
};

// A guild can run more than one named, ranked-role list ("hierarchy") --
// e.g. a "Staff" ladder plus a separate "Donators" tier board. Exactly one
// hierarchy per guild is ever the primary (is_primary = 1): that's the one
// /promote, /demote, and every rank-based permission check operate on.
// Renaming a hierarchy is purely cosmetic and never touches is_primary, so
// it's always safe. Every other hierarchy is display-only -- it just posts
// its own auto-updating embed.
const Hierarchies = {
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM hierarchies WHERE guild_id = ? ORDER BY is_primary DESC, id ASC').all(guildId)
      .map((h) => ({ ...h, only_show_highest: !!h.only_show_highest, is_primary: !!h.is_primary }));
  },
  get(id) {
    const row = db.prepare('SELECT * FROM hierarchies WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, only_show_highest: !!row.only_show_highest, is_primary: !!row.is_primary };
  },
  getPrimary(guildId) {
    const row = db.prepare('SELECT * FROM hierarchies WHERE guild_id = ? AND is_primary = 1').get(guildId);
    if (!row) return null;
    return { ...row, only_show_highest: !!row.only_show_highest, is_primary: !!row.is_primary };
  },
  // The first hierarchy a guild creates automatically becomes primary --
  // every guild that has any hierarchy at all has exactly one primary one.
  create(guildId, name) {
    const hasAny = db.prepare('SELECT 1 FROM hierarchies WHERE guild_id = ?').get(guildId);
    const info = db.prepare('INSERT INTO hierarchies (guild_id, name, is_primary) VALUES (?, ?, ?)')
      .run(guildId, name, hasAny ? 0 : 1);
    return info.lastInsertRowid;
  },
  rename(id, name) {
    db.prepare('UPDATE hierarchies SET name = ? WHERE id = ?').run(name, id);
  },
  setOnlyShowHighest(id, enabled) {
    db.prepare('UPDATE hierarchies SET only_show_highest = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  },
  setPrimary(guildId, id) {
    const tx = db.transaction(() => {
      db.prepare('UPDATE hierarchies SET is_primary = 0 WHERE guild_id = ?').run(guildId);
      db.prepare('UPDATE hierarchies SET is_primary = 1 WHERE id = ? AND guild_id = ?').run(id, guildId);
    });
    tx();
  },
  setListChannel(id, channelId) {
    db.prepare('UPDATE hierarchies SET channel_id = ?, message_id = NULL WHERE id = ?').run(channelId || null, id);
  },
  setListMessage(id, messageId) {
    db.prepare('UPDATE hierarchies SET message_id = ? WHERE id = ?').run(messageId || null, id);
  },
  setColor(id, color) {
    db.prepare('UPDATE hierarchies SET color = ? WHERE id = ?').run(color || '#a32ee2', id);
  },
  // If the hierarchy being removed was the primary one and another
  // hierarchy still exists for this guild, that one is promoted to primary
  // so /promote and /demote don't just silently stop working.
  remove(id) {
    const tx = db.transaction(() => {
      const row = db.prepare('SELECT guild_id, is_primary FROM hierarchies WHERE id = ?').get(id);
      if (!row) return;
      db.prepare('DELETE FROM staff_ranks WHERE hierarchy_id = ?').run(id);
      db.prepare('DELETE FROM hierarchies WHERE id = ?').run(id);
      if (row.is_primary) {
        const next = db.prepare('SELECT id FROM hierarchies WHERE guild_id = ? ORDER BY id ASC LIMIT 1').get(row.guild_id);
        if (next) db.prepare('UPDATE hierarchies SET is_primary = 1 WHERE id = ?').run(next.id);
      }
    });
    tx();
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
  // Only ones currently usable -- see TicketTypes.listForGuild's comment.
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM tags WHERE guild_id = ? AND tier_disabled = 0 ORDER BY name COLLATE NOCASE').all(guildId);
  },
  listAllForGuild(guildId) {
    return db.prepare('SELECT * FROM tags WHERE guild_id = ? ORDER BY name COLLATE NOCASE').all(guildId);
  },
  // Excludes a disabled tag -- used by /tag get, so a disabled one doesn't
  // still respond. getAny below is for callers that need to find it
  // regardless (duplicate-name checks, /tag delete).
  get(guildId, name) {
    return db.prepare('SELECT * FROM tags WHERE guild_id = ? AND name = ? COLLATE NOCASE AND tier_disabled = 0').get(guildId, name);
  },
  getAny(guildId, name) {
    return db.prepare('SELECT * FROM tags WHERE guild_id = ? AND name = ? COLLATE NOCASE').get(guildId, name);
  },
  setTierDisabled(id, disabled) {
    db.prepare('UPDATE tags SET tier_disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id);
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

// One row = "when someone gains trigger_role_id, add add_role_id (and, if
// set, remove remove_role_id)" -- evaluated by bot/roleTriggers.js.
const RoleTriggers = {
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM role_triggers WHERE guild_id = ? ORDER BY id ASC').all(guildId);
  },
  create(guildId, { triggerRoleId, addRoleId, removeRoleId }) {
    const info = db.prepare(`
      INSERT INTO role_triggers (guild_id, trigger_role_id, add_role_id, remove_role_id)
      VALUES (?, ?, ?, ?)
    `).run(guildId, triggerRoleId, addRoleId, removeRoleId || null);
    return info.lastInsertRowid;
  },
  delete(id) {
    db.prepare('DELETE FROM role_triggers WHERE id = ?').run(id);
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
  countActiveForGuild(guildId) {
    return db.prepare('SELECT COUNT(*) AS n FROM giveaways WHERE guild_id = ? AND ended = 0').get(guildId).n;
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
  // Only ones currently usable -- see TicketTypes.listForGuild's comment.
  // Deliberately NOT also filtered by `active` here (unrelated column --
  // "already fired, one-off is done" -- the dashboard list has always
  // shown those too).
  listForGuild(guildId) {
    return db.prepare('SELECT * FROM scheduled_announcements WHERE guild_id = ? AND tier_disabled = 0 ORDER BY next_run').all(guildId);
  },
  listAllForGuild(guildId) {
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
    return db.prepare('SELECT * FROM scheduled_announcements WHERE active = 1 AND tier_disabled = 0 AND next_run <= ?').all(nowIso);
  },
  reschedule(id, nextRun) {
    db.prepare('UPDATE scheduled_announcements SET next_run = ? WHERE id = ?').run(nextRun, id);
  },
  deactivate(id) {
    db.prepare('UPDATE scheduled_announcements SET active = 0 WHERE id = ?').run(id);
  },
  setTierDisabled(id, disabled) {
    db.prepare('UPDATE scheduled_announcements SET tier_disabled = ? WHERE id = ?').run(disabled ? 1 : 0, id);
  },
  delete(id) {
    db.prepare('DELETE FROM scheduled_announcements WHERE id = ?').run(id);
  },
};

const Reminders = {
  create({ guildId, channelId, userId, message, remindAt, pingInChannel }) {
    const info = db.prepare(`
      INSERT INTO reminders (guild_id, channel_id, user_id, message, remind_at, ping_in_channel)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(guildId || null, channelId, userId, message || null, remindAt, pingInChannel ? 1 : 0);
    return info.lastInsertRowid;
  },
  // remind_at is stored as a JS Date.toISOString() string (same convention
  // as polls.ends_at / giveaways.ends_at), not SQLite's datetime('now')
  // format, so it compares correctly against another toISOString() value.
  listDue(nowIso) {
    return db.prepare('SELECT * FROM reminders WHERE remind_at <= ?').all(nowIso);
  },
  listForUser(userId) {
    return db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY remind_at ASC').all(userId);
  },
  getForUser(id, userId) {
    return db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(id, userId) || null;
  },
  remove(id) {
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
  },
};

// Tebex subscription tiers -- see database.js for why these are global
// rather than per-guild. A tier's package_ids is "any of these Tebex
// package IDs grants this tier"; features is the set of premium dashboard
// feature keys it unlocks (see web/lib/subscriptionGate.js).
const TebexTiers = {
  list() {
    return db.prepare('SELECT * FROM tebex_tiers ORDER BY level DESC, name COLLATE NOCASE').all()
      .map((t) => ({ ...t, package_ids: parseJSON(t.package_ids, []), features: parseJSON(t.features, []) }));
  },
  get(id) {
    const row = db.prepare('SELECT * FROM tebex_tiers WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, package_ids: parseJSON(row.package_ids, []), features: parseJSON(row.features, []) };
  },
  create(name, level, packageIds, features) {
    const info = db.prepare('INSERT INTO tebex_tiers (name, level, package_ids, features) VALUES (?, ?, ?, ?)')
      .run(name, level || 0, JSON.stringify(packageIds || []), JSON.stringify(features || []));
    return info.lastInsertRowid;
  },
  update(id, name, level, packageIds, features) {
    db.prepare('UPDATE tebex_tiers SET name = ?, level = ?, package_ids = ?, features = ? WHERE id = ?')
      .run(name, level || 0, JSON.stringify(packageIds || []), JSON.stringify(features || []), id);
  },
  delete(id) {
    // Soft-unlink rather than cascade-delete -- a subscriber row is a
    // record of who used to have a tier, worth keeping even once the tier
    // itself is gone.
    db.prepare('UPDATE tebex_subscribers SET tier_id = NULL WHERE tier_id = ?').run(id);
    db.prepare('DELETE FROM tebex_tiers WHERE id = ?').run(id);
  },
  // Every tier that lists this Tebex package ID as one of its own -- a
  // package can only realistically belong to one tier, but this returns
  // all matches rather than assuming that, so a misconfigured overlap is
  // visible instead of silently picking one.
  forPackageId(packageId) {
    return TebexTiers.list().filter((t) => t.package_ids.includes(String(packageId)));
  },
};

const TebexSubscribers = {
  get(discordUserId) {
    return db.prepare('SELECT * FROM tebex_subscribers WHERE discord_user_id = ?').get(discordUserId) || null;
  },
  list() {
    return db.prepare('SELECT * FROM tebex_subscribers ORDER BY updated_at DESC').all();
  },
  upsert(discordUserId, tierId, status, reference) {
    db.prepare(`
      INSERT INTO tebex_subscribers (discord_user_id, tier_id, status, tebex_reference, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(discord_user_id) DO UPDATE SET
        tier_id = excluded.tier_id, status = excluded.status,
        tebex_reference = excluded.tebex_reference, updated_at = datetime('now')
    `).run(discordUserId, tierId || null, status, reference || null);
  },
  // The tier a user currently has active, or null -- what
  // subscriptionGate.js actually checks. A cancelled/expired row still
  // exists (for history) but no longer resolves to a tier here.
  activeTierFor(discordUserId) {
    const row = db.prepare(`
      SELECT t.* FROM tebex_subscribers s
      JOIN tebex_tiers t ON t.id = s.tier_id
      WHERE s.discord_user_id = ? AND s.status = 'active'
    `).get(discordUserId);
    if (!row) return null;
    return { ...row, package_ids: parseJSON(row.package_ids, []), features: parseJSON(row.features, []) };
  },
  // Applies an active subscription to a specific server -- the buyer picks
  // this from the dashboard once, after purchase (see routes/subscription.js).
  // A no-op if they no longer have an active row (e.g. it lapsed in the
  // gap between page load and submit).
  setGuild(discordUserId, guildId) {
    db.prepare(`UPDATE tebex_subscribers SET guild_id = ?, updated_at = datetime('now') WHERE discord_user_id = ? AND status = 'active'`)
      .run(guildId, discordUserId);
  },
  // Whichever active subscription (if any) is currently applied to this
  // server -- what lib/tierLimits.js checks. A limit belongs to the
  // server, not to whoever's viewing the dashboard, so this looks up by
  // guild_id rather than by the logged-in Discord user.
  forGuild(guildId) {
    return db.prepare(`SELECT * FROM tebex_subscribers WHERE guild_id = ? AND status = 'active'`).get(guildId) || null;
  },
};

const TebexEvents = {
  log(type, rawJson, processed, note) {
    const info = db.prepare('INSERT INTO tebex_events (type, raw_json, processed, note) VALUES (?, ?, ?, ?)')
      .run(type || null, rawJson, processed ? 1 : 0, note || null);
    return info.lastInsertRowid;
  },
  recent(limit = 50) {
    return db.prepare('SELECT * FROM tebex_events ORDER BY id DESC LIMIT ?').all(limit);
  },
};

const CustomBots = {
  get(guildId) {
    return db.prepare('SELECT * FROM custom_bots WHERE guild_id = ?').get(guildId) || null;
  },
  list() {
    return db.prepare('SELECT * FROM custom_bots ORDER BY created_at DESC').all();
  },
  // Only ever called with an already-encrypted token -- see
  // web/lib/tokenCrypto.js. Re-uploading for the same guild replaces the
  // row outright (new token, reset status/identity) rather than merging.
  upsert(guildId, ownerDiscordId, encryptedToken) {
    db.prepare(`
      INSERT INTO custom_bots (guild_id, owner_discord_id, encrypted_token, status, updated_at)
      VALUES (?, ?, ?, 'pending', datetime('now'))
      ON CONFLICT(guild_id) DO UPDATE SET
        owner_discord_id = excluded.owner_discord_id, encrypted_token = excluded.encrypted_token,
        application_id = NULL, bot_user_id = NULL, bot_username = NULL, bot_avatar = NULL,
        status = 'pending', last_error = NULL, updated_at = datetime('now')
    `).run(guildId, ownerDiscordId, encryptedToken);
  },
  setConnected(guildId, { applicationId, botUserId, botUsername, botAvatar }) {
    db.prepare(`
      UPDATE custom_bots SET status = 'connected', last_error = NULL,
        application_id = ?, bot_user_id = ?, bot_username = ?, bot_avatar = ?, updated_at = datetime('now')
      WHERE guild_id = ?
    `).run(applicationId || null, botUserId || null, botUsername || null, botAvatar || null, guildId);
  },
  // Identity info fetched via a plain REST call (no gateway login needed)
  // right after a token is uploaded -- lets the invite link show up
  // immediately, before a live connection has ever been attempted.
  // Doesn't touch status, since "known who this bot is" isn't the same as
  // "confirmed it's actually in the server."
  setIdentity(guildId, { applicationId, botUsername, botAvatar }) {
    db.prepare(`
      UPDATE custom_bots SET application_id = ?, bot_username = ?, bot_avatar = ?, updated_at = datetime('now')
      WHERE guild_id = ?
    `).run(applicationId || null, botUsername || null, botAvatar || null, guildId);
  },
  setError(guildId, message) {
    db.prepare("UPDATE custom_bots SET status = 'error', last_error = ?, updated_at = datetime('now') WHERE guild_id = ?")
      .run(message || null, guildId);
  },
  setStopped(guildId) {
    db.prepare("UPDATE custom_bots SET status = 'stopped', updated_at = datetime('now') WHERE guild_id = ?").run(guildId);
  },
  remove(guildId) {
    db.prepare('DELETE FROM custom_bots WHERE guild_id = ?').run(guildId);
  },
};

module.exports = { GuildSettings, TicketTypes, Panels, Tickets, EmbedTemplates, Warnings, StaffRanks, Hierarchies, AppSettings, BetaAllowlist, BetaRequests, ModActions, ReactionRolePanels, DashboardRoleAccess, CommandPermissions, DmFormSends, DmFormTemplates, Contacts, Polls, Tags, RoleTriggers, Giveaways, Events, ScheduledAnnouncements, EmojiBook, DashboardAdmins, StaffRoles, AdminAuditLog, ServerNotes, GlobalBlocklist, Stats, StaffNotes, AfkStatus, Reminders, TebexTiers, TebexSubscribers, TebexEvents, CustomBots };
