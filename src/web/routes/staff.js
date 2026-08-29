const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const db = require('../../db/database');
const {
  AppSettings, BetaAllowlist, DmFormTemplates, Contacts, EmojiBook,
  DashboardAdmins, StaffRoles, AdminAuditLog, ServerNotes, GlobalBlocklist, Stats,
  Warnings, ModActions, GuildSettings, Hierarchies, TicketTypes, StaffNotes,
} = require('../../db/repo');
const client = require('../../bot/client');
const { DISCORD_ID } = require('../lib/resolveMember');
const { formatUptime } = require('../../bot/ownerKeywords');
const dmForm = require('../../bot/dmForm');
const { buildResultEmbed } = require('../../bot/betaRequests');
const { STAFF_AREAS, STAFF_AREA_KEYS } = require('../lib/staffAreas');

// Same "paste the raw <:name:id> markup" convention as reactionRoles.js's
// parseEmojiInput, but this needs the name and ID as separate fields (for
// display and for rebuilding the markup later) rather than a react/match key pair.
const CUSTOM_EMOJI = /^<(a)?:(\w+):(\d+)>$/;

const QUESTION_MAX_LEN = 300;
const MAX_RECIPIENTS = 50;

const router = express.Router();

// The true owner (OWNER_DISCORD_ID) -- can do everything below, plus manage
// who else counts as a full admin or a custom staff role, and pull a raw
// database backup. Kept separate from requireStaffArea/requireAnyStaffAccess
// so nobody delegated access can grant themselves (or anyone else) more,
// or lock the real owner out.
function requireOwner(req, res, next) {
  if (!req.session || !req.session.isOwner) {
    return res.status(403).render('error', { message: 'Owner access only.' });
  }
  next();
}

// Owner, full admin, or anyone with a custom staff role that's been granted
// this specific area (see web/lib/staffAreas.js and db/repo.js's
// StaffRoles) -- the scoped-access tier below full admin.
function requireStaffArea(area) {
  return (req, res, next) => {
    if (!req.session) return res.status(403).render('error', { message: 'Staff access only.' });
    if (req.session.isOwner || req.session.isAdmin) return next();
    if (req.session.staffAreas?.includes(area)) return next();
    return res.status(403).render('error', { message: "You don't have access to this." });
  };
}

// Anything readable by any staff tier at all -- owner, full admin, or a
// custom role with at least one area granted. Used for the main page and
// for tools with no meaningful area of their own (e.g. the shared notepad).
function requireAnyStaffAccess(req, res, next) {
  if (!req.session || !(req.session.isOwner || req.session.isAdmin || req.session.staffAreas?.length > 0)) {
    return res.status(403).render('error', { message: 'Staff access only.' });
  }
  next();
}

function redirectWithNotice(res, ok, text, anchor = 'send-dm') {
  const qs = new URLSearchParams({ ok: ok ? '1' : '0', msg: text });
  res.redirect(`/staff?${qs.toString()}#${anchor}`);
}

// Every mutating route below calls this once it succeeds -- the point of an
// audit log is knowing who did what once more than one person has access.
function logAudit(req, action, detail) {
  const actor = req.session.discordUser;
  AdminAuditLog.log(actor?.id || 'unknown', actor?.username || null, action, detail || null);
}

router.get('/', requireAnyStaffAccess, async (req, res) => {
  const notice = req.query.msg ? { ok: req.query.ok === '1', text: req.query.msg } : null;
  const fullAccess = req.session.isOwner || req.session.isAdmin;
  const grantedAreas = new Set(req.session.staffAreas || []);
  const canSee = (area) => fullAccess || grantedAreas.has(area);
  const serverNotes = ServerNotes.getAll();
  const guilds = [...client.guilds.cache.values()]
    .map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount, iconURL: g.iconURL({ size: 32 }), note: serverNotes[g.id] || null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Discord's API serves any valid user by ID regardless of shared servers,
  // so contacts are only ever stored by ID -- username/avatar are always
  // fetched fresh here rather than going stale in the database.
  const contacts = await Promise.all(Contacts.list().map(async (c) => {
    try {
      const user = await client.users.fetch(c.discord_user_id);
      return { id: c.discord_user_id, note: c.note, tag: user.tag, avatarURL: user.displayAvatarURL({ size: 64 }), resolved: true };
    } catch {
      return { id: c.discord_user_id, note: c.note, tag: null, avatarURL: null, resolved: false };
    }
  }));

  const emojiBook = EmojiBook.list().map((e) => ({
    ...e,
    markup: `<${e.animated ? 'a' : ''}:${e.name}:${e.emoji_id}>`,
  }));

  const admins = await Promise.all(DashboardAdmins.list().map(async (a) => {
    try {
      const user = await client.users.fetch(a.discord_user_id);
      return { id: a.discord_user_id, note: a.note, addedBy: a.added_by, tag: user.tag, avatarURL: user.displayAvatarURL({ size: 64 }), resolved: true };
    } catch {
      return { id: a.discord_user_id, note: a.note, addedBy: a.added_by, tag: null, avatarURL: null, resolved: false };
    }
  }));

  const blocklist = GlobalBlocklist.list();

  // Custom staff roles + their resolved members -- owner-only data, but
  // cheap enough (no member fetch requiring guild.members.fetch()) that
  // there's no reason to gate it behind isOwner here rather than in the view.
  const staffRoles = req.session.isOwner ? await Promise.all(StaffRoles.list().map(async (role) => {
    const members = await Promise.all(StaffRoles.membersFor(role.id).map(async (m) => {
      try {
        const user = await client.users.fetch(m.discord_user_id);
        return { id: m.discord_user_id, note: m.note, tag: user.tag, avatarURL: user.displayAvatarURL({ size: 64 }), resolved: true };
      } catch {
        return { id: m.discord_user_id, note: m.note, tag: null, avatarURL: null, resolved: false };
      }
    }));
    return { ...role, members };
  })) : [];

  const overview = {
    ...Stats.overview(),
    servers: guilds.length,
    members: guilds.reduce((sum, g) => sum + (g.memberCount || 0), 0),
    admins: admins.length + 1, // + the owner, who isn't in the admins table
    uptime: client.isReady() ? formatUptime(client.uptime) : 'Bot offline',
  };

  const auditLog = AdminAuditLog.list(100);
  const notesList = ServerNotes.list().map((n) => ({ ...n, guildName: client.guilds.cache.get(n.guild_id)?.name || n.guild_id }));

  // Guild health: a quick scan for the handful of things that make a server
  // effectively half-configured (no mod log, no hierarchy, no ticket types)
  // -- purely informational, same spirit as the per-guild setup checklist,
  // just rolled up across every server at once instead of one at a time.
  const healthChecks = [...client.guilds.cache.values()].map((g) => {
    const settings = GuildSettings.get(g.id);
    const issues = [];
    if (!settings.mod_log_channel_id) issues.push('No mod log channel');
    if (Hierarchies.listForGuild(g.id).length === 0) issues.push('No staff hierarchy');
    if (TicketTypes.listForGuild(g.id).length === 0) issues.push('No ticket types');
    return { id: g.id, name: g.name, iconURL: g.iconURL({ size: 32 }), issues };
  }).filter((g) => g.issues.length > 0).sort((a, b) => b.issues.length - a.issues.length);

  const staffNotes = StaffNotes.list();

  let lookup = null;
  if (req.query.lookupId) {
    const id = req.query.lookupId.trim();
    if (!DISCORD_ID.test(id)) {
      lookup = { id, error: 'That doesn\'t look like a valid Discord user ID.' };
    } else {
      const user = await client.users.fetch(id).catch(() => null);
      const inGuilds = (await Promise.all(guilds.map(async (g) => {
        const guildObj = client.guilds.cache.get(g.id);
        const member = await guildObj.members.fetch(id).catch(() => null);
        return member ? { id: g.id, name: g.name } : null;
      }))).filter(Boolean);
      const guildName = (gid) => client.guilds.cache.get(gid)?.name || gid;
      lookup = {
        id,
        user: user ? { tag: user.tag, avatarURL: user.displayAvatarURL({ size: 64 }) } : null,
        inGuilds,
        warnings: Warnings.listForUserAllGuilds(id).map((w) => ({ ...w, guildName: guildName(w.guild_id) })),
        modActions: ModActions.listForTargetAllGuilds(id, 50).map((m) => ({ ...m, guildName: guildName(m.guild_id) })),
        isContact: Contacts.has(id),
        isAllowlisted: BetaAllowlist.has(id),
        isBlocklisted: GlobalBlocklist.has(id),
        isAdmin: DashboardAdmins.has(id) || id === config.ownerDiscordId,
      };
    }
  }

  res.render('staff', {
    settings: AppSettings.get(),
    allowlist: BetaAllowlist.list(),
    templates: DmFormTemplates.list(),
    contacts,
    emojiBook,
    admins,
    blocklist,
    overview,
    auditLog,
    serverNotesList: notesList,
    lookup,
    guilds,
    notice,
    ownerDiscordId: config.ownerDiscordId,
    healthChecks,
    staffNotes,
    staffRoles,
    staffAreaDefs: STAFF_AREAS,
    canSee,
  });
});

router.post('/beta-lock', requireStaffArea('beta'), (req, res) => {
  AppSettings.setBetaLocked(req.body.enabled === 'on');
  logAudit(req, req.body.enabled === 'on' ? 'Enabled closed beta' : 'Disabled closed beta', null);
  res.redirect('/staff');
});

router.post('/maintenance', requireStaffArea('maintenance'), (req, res) => {
  const enabled = req.body.enabled === 'on';
  const message = (req.body.message || '').trim().slice(0, 300);
  AppSettings.setMaintenance(enabled, message);
  logAudit(req, enabled ? 'Enabled maintenance banner' : 'Disabled maintenance banner', message || null);
  return redirectWithNotice(res, true, enabled ? 'Maintenance banner is on.' : 'Maintenance banner is off.', 'maintenance');
});

router.post('/allowlist/add', requireStaffArea('beta'), (req, res) => {
  const id = (req.body.discordUserId || '').trim();
  if (DISCORD_ID.test(id)) {
    BetaAllowlist.add(id);
    logAudit(req, 'Added to beta allowlist', id);
  }
  res.redirect('/staff');
});

router.post('/allowlist/remove', requireStaffArea('beta'), (req, res) => {
  BetaAllowlist.remove(req.body.discordUserId);
  logAudit(req, 'Removed from beta allowlist', req.body.discordUserId);
  res.redirect('/staff');
});

router.post('/admins/add', requireOwner, async (req, res) => {
  const id = (req.body.discordUserId || '').trim();
  const note = (req.body.note || '').trim().slice(0, 200);

  if (!DISCORD_ID.test(id)) {
    return redirectWithNotice(res, false, 'Enter a valid Discord user ID.', 'admins');
  }
  if (config.ownerDiscordId && id === config.ownerDiscordId) {
    return redirectWithNotice(res, false, 'That\'s already you — the owner always has full access.', 'admins');
  }
  try {
    const user = await client.users.fetch(id);
    DashboardAdmins.add(id, note, req.session.discordUser.id);
    logAudit(req, 'Added an admin', `${user.tag} (${id})`);
    return redirectWithNotice(res, true, `Added ${user.tag} as an admin — they'll get full /staff access next time they log in.`, 'admins');
  } catch (err) {
    return redirectWithNotice(res, false, `Couldn't find that user: ${err.message}`, 'admins');
  }
});

router.post('/admins/remove', requireOwner, (req, res) => {
  DashboardAdmins.remove(req.body.discordUserId);
  logAudit(req, 'Removed an admin', req.body.discordUserId);
  return redirectWithNotice(res, true, 'Removed. They\'ll lose /staff access next time their session refreshes.', 'admins');
});

// ---------- Custom staff roles (scoped /staff access, owner-only to manage) ----------
router.post('/staff-roles/create', requireOwner, (req, res) => {
  const name = (req.body.name || '').trim().slice(0, 100);
  const areas = [].concat(req.body.areas || []).filter((a) => STAFF_AREA_KEYS.has(a));
  if (!name) {
    return redirectWithNotice(res, false, 'Give the role a name.', 'staff-roles');
  }
  StaffRoles.create(name, areas);
  logAudit(req, 'Created a staff role', `${name} (${areas.join(', ') || 'no areas'})`);
  return redirectWithNotice(res, true, `"${name}" created.`, 'staff-roles');
});

router.post('/staff-roles/:id/save', requireOwner, (req, res) => {
  const role = StaffRoles.get(Number(req.params.id));
  if (!role) return redirectWithNotice(res, false, "That role doesn't exist anymore.", 'staff-roles');
  const name = (req.body.name || '').trim().slice(0, 100);
  const areas = [].concat(req.body.areas || []).filter((a) => STAFF_AREA_KEYS.has(a));
  if (!name) {
    return redirectWithNotice(res, false, 'Give the role a name.', 'staff-roles');
  }
  StaffRoles.update(role.id, name, areas);
  logAudit(req, 'Updated a staff role', `${name} (${areas.join(', ') || 'no areas'})`);
  return redirectWithNotice(res, true, `"${name}" updated.`, 'staff-roles');
});

router.post('/staff-roles/:id/delete', requireOwner, (req, res) => {
  const role = StaffRoles.get(Number(req.params.id));
  if (role) {
    StaffRoles.delete(role.id);
    logAudit(req, 'Deleted a staff role', role.name);
  }
  return redirectWithNotice(res, true, role ? `"${role.name}" deleted.` : 'Already gone.', 'staff-roles');
});

router.post('/staff-roles/:id/members/add', requireOwner, async (req, res) => {
  const role = StaffRoles.get(Number(req.params.id));
  if (!role) return redirectWithNotice(res, false, "That role doesn't exist anymore.", 'staff-roles');
  const id = (req.body.discordUserId || '').trim();
  const note = (req.body.note || '').trim().slice(0, 200);
  if (!DISCORD_ID.test(id)) {
    return redirectWithNotice(res, false, 'Enter a valid Discord user ID.', 'staff-roles');
  }
  try {
    const user = await client.users.fetch(id);
    StaffRoles.addMember(role.id, id, note, req.session.discordUser.id);
    logAudit(req, 'Added a staff role member', `${user.tag} → ${role.name}`);
    return redirectWithNotice(res, true, `Added ${user.tag} to "${role.name}" — they'll get that access next time they log in.`, 'staff-roles');
  } catch (err) {
    return redirectWithNotice(res, false, `Couldn't find that user: ${err.message}`, 'staff-roles');
  }
});

router.post('/staff-roles/:id/members/remove', requireOwner, (req, res) => {
  const role = StaffRoles.get(Number(req.params.id));
  if (role) {
    StaffRoles.removeMember(role.id, req.body.discordUserId);
    logAudit(req, 'Removed a staff role member', `${req.body.discordUserId} ← ${role.name}`);
  }
  return redirectWithNotice(res, true, 'Removed. They\'ll lose that access next time their session refreshes.', 'staff-roles');
});

router.post('/send-dm', requireStaffArea('send_dm'), async (req, res) => {
  const title = (req.body.title || '').trim();
  const description = (req.body.description || '').trim();
  const color = req.body.color || '#a8e6ff';
  const templateId = req.body.templateId ? Number(req.body.templateId) : null;
  const saveNew = req.body.saveNew === 'on';

  const contactIds = [].concat(req.body.contactIds || []).filter((id) => DISCORD_ID.test(id));
  const extraIds = (req.body.extraIds || '').split(/[\s,]+/).map((s) => s.trim()).filter((id) => DISCORD_ID.test(id));
  const recipientIds = [...new Set([...contactIds, ...extraIds])];

  if (recipientIds.length === 0) {
    return redirectWithNotice(res, false, 'Pick at least one contact or add a user ID.');
  }
  if (recipientIds.length > MAX_RECIPIENTS) {
    return redirectWithNotice(res, false, `That's ${recipientIds.length} recipients — ${MAX_RECIPIENTS} max per send.`);
  }

  const template = templateId ? DmFormTemplates.get(templateId) : null;
  if (!template && !description) {
    return redirectWithNotice(res, false, 'A message is required.');
  }

  const sendDefault = async (user) => {
    const embed = new EmbedBuilder().setColor(color).setDescription(description).setTimestamp();
    if (title) embed.setTitle(title);
    await user.send({ embeds: [embed] });
  };

  // Most common per-recipient failure: the bot doesn't share a server with
  // them, or they have DMs from server members turned off -- caught per ID
  // so one bad recipient doesn't sink the rest of the send.
  const results = await Promise.all(recipientIds.map(async (id) => {
    try {
      const user = await client.users.fetch(id);
      if (template) {
        await dmForm.sendWithForm(client, {
          recipientId: user.id,
          recipientTag: user.tag,
          template,
          defaultSend: () => sendDefault(user),
        });
      } else {
        await sendDefault(user);
      }
      if (saveNew && !Contacts.has(id)) Contacts.add(id);
      return { id, ok: true, tag: user.tag };
    } catch (err) {
      return { id, ok: false, error: err.message };
    }
  }));

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  let text = template
    ? `Sent "${template.name}" to ${succeeded.length} of ${recipientIds.length}.`
    : `Sent to ${succeeded.length} of ${recipientIds.length}.`;
  if (failed.length > 0) {
    text += ` Failed: ${failed.map((r) => `${r.id} (${r.error})`).join('; ')}`;
  }
  logAudit(req, 'Sent a DM', `${succeeded.length}/${recipientIds.length} succeeded`);
  return redirectWithNotice(res, failed.length === 0, text);
});

router.post('/broadcast-owners', requireStaffArea('broadcast'), async (req, res) => {
  const title = (req.body.title || '').trim();
  const description = (req.body.description || '').trim();
  const color = req.body.color || '#a8e6ff';

  if (!description) {
    return redirectWithNotice(res, false, 'A message is required.', 'broadcast');
  }

  const guilds = [...client.guilds.cache.values()];
  const results = await Promise.all(guilds.map(async (g) => {
    try {
      const owner = await g.fetchOwner();
      const embed = new EmbedBuilder().setColor(color).setDescription(description).setTimestamp();
      if (title) embed.setTitle(title);
      await owner.send({ embeds: [embed] });
      return { guild: g.name, ok: true };
    } catch (err) {
      return { guild: g.name, ok: false, error: err.message };
    }
  }));

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  logAudit(req, 'Broadcast to server owners', `${succeeded}/${guilds.length} succeeded`);

  let text = `Sent to ${succeeded} of ${guilds.length} server owners.`;
  if (failed.length > 0) text += ` Couldn't reach: ${failed.map((r) => r.guild).join(', ')}`;
  return redirectWithNotice(res, failed.length === 0, text, 'broadcast');
});

router.post('/contacts/add', requireStaffArea('contacts'), async (req, res) => {
  const id = (req.body.discordUserId || '').trim();
  const note = (req.body.note || '').trim().slice(0, 200);

  if (!DISCORD_ID.test(id)) {
    return redirectWithNotice(res, false, 'Enter a valid Discord user ID.', 'contacts');
  }
  try {
    const user = await client.users.fetch(id);
    Contacts.add(id, note);
    logAudit(req, 'Added a contact', `${user.tag} (${id})`);
    return redirectWithNotice(res, true, `Added ${user.tag} to contacts.`, 'contacts');
  } catch (err) {
    return redirectWithNotice(res, false, `Couldn't find that user: ${err.message}`, 'contacts');
  }
});

router.post('/contacts/remove', requireStaffArea('contacts'), (req, res) => {
  Contacts.remove(req.body.discordUserId);
  logAudit(req, 'Removed a contact', req.body.discordUserId);
  return redirectWithNotice(res, true, 'Removed.', 'contacts');
});

router.post('/emoji-book/add', requireStaffArea('emoji_book'), (req, res) => {
  const raw = (req.body.markup || '').trim();
  const note = (req.body.note || '').trim().slice(0, 200);
  const match = CUSTOM_EMOJI.exec(raw);

  if (!match) {
    return redirectWithNotice(res, false, 'Paste a custom emoji — type \\:name: in Discord and copy the result, e.g. <:name:1234567890>.', 'emoji-book');
  }
  const [, animatedFlag, name, emojiId] = match;
  if (EmojiBook.has(emojiId)) {
    return redirectWithNotice(res, false, `"${name}" is already saved.`, 'emoji-book');
  }
  EmojiBook.add(name, emojiId, !!animatedFlag, note);
  logAudit(req, 'Added a saved emoji', `${name} (${emojiId})`);
  return redirectWithNotice(res, true, `Saved "${name}" to the emoji book.`, 'emoji-book');
});

router.post('/emoji-book/remove', requireStaffArea('emoji_book'), (req, res) => {
  EmojiBook.remove(Number(req.body.id));
  logAudit(req, 'Removed a saved emoji', String(req.body.id));
  return redirectWithNotice(res, true, 'Removed.', 'emoji-book');
});

router.post('/blocklist/add', requireStaffArea('blocklist'), (req, res) => {
  const id = (req.body.discordUserId || '').trim();
  const reason = (req.body.reason || '').trim().slice(0, 200);

  if (!DISCORD_ID.test(id)) {
    return redirectWithNotice(res, false, 'Enter a valid Discord user ID.', 'blocklist');
  }
  GlobalBlocklist.add(id, reason, req.session.discordUser.id);
  logAudit(req, 'Blocklisted a user', `${id}${reason ? ` — ${reason}` : ''}`);
  return redirectWithNotice(res, true, 'Blocked bot-wide — refused tickets and auto-kicked from any server they join.', 'blocklist');
});

router.post('/blocklist/remove', requireStaffArea('blocklist'), (req, res) => {
  GlobalBlocklist.remove(req.body.discordUserId);
  logAudit(req, 'Unblocklisted a user', req.body.discordUserId);
  return redirectWithNotice(res, true, 'Removed.', 'blocklist');
});

router.post('/server-notes/save', requireStaffArea('server_notes'), (req, res) => {
  const guildId = (req.body.guildId || '').trim();
  const note = (req.body.note || '').trim().slice(0, 500);
  const guild = client.guilds.cache.get(guildId);

  if (!guild) {
    return redirectWithNotice(res, false, "ModSentry isn't in that server (anymore).", 'server-notes');
  }
  ServerNotes.set(guildId, note, req.session.discordUser.id);
  logAudit(req, note ? 'Set a server note' : 'Cleared a server note', guild.name);
  return redirectWithNotice(res, true, note ? `Note saved for ${guild.name}.` : `Note cleared for ${guild.name}.`, 'server-notes');
});

router.post('/dm-form-templates/save', requireStaffArea('dm_form'), (req, res) => {
  const id = req.body.templateId ? Number(req.body.templateId) : null;
  const name = (req.body.name || '').trim().slice(0, 100);
  const title = (req.body.title || '').trim().slice(0, 200);
  const intro = (req.body.intro || '').trim().slice(0, 1000);
  const questions = [1, 2, 3, 4, 5]
    .map((i) => (req.body[`question${i}`] || '').trim().slice(0, QUESTION_MAX_LEN))
    .filter(Boolean)
    .slice(0, 5);

  if (!name || !title || questions.length === 0) {
    return redirectWithNotice(res, false, 'A name, a title, and at least one question are required.', 'dm-form');
  }

  if (id && DmFormTemplates.get(id)) {
    DmFormTemplates.update(id, { name, title, intro, questions });
    logAudit(req, 'Updated a form template', name);
    return redirectWithNotice(res, true, `"${name}" updated.`, 'dm-form');
  }
  DmFormTemplates.create({ name, title, intro, questions });
  logAudit(req, 'Created a form template', name);
  return redirectWithNotice(res, true, `"${name}" created.`, 'dm-form');
});

router.post('/dm-form-templates/delete', requireStaffArea('dm_form'), (req, res) => {
  const id = Number(req.body.templateId);
  const template = DmFormTemplates.get(id);
  if (template) {
    DmFormTemplates.remove(id);
    logAudit(req, 'Deleted a form template', template.name);
  }
  return redirectWithNotice(res, true, template ? `"${template.name}" deleted.` : 'Already gone.', 'dm-form');
});

router.get('/backup', requireOwner, async (req, res) => {
  const tmpPath = path.join(os.tmpdir(), `modsentry-backup-${Date.now()}.sqlite`);
  try {
    // An online backup via better-sqlite3's own API, not a raw file copy --
    // safe to run while the bot is writing to the WAL-mode database.
    await db.backup(tmpPath);
    logAudit(req, 'Downloaded a database backup', null);
    res.download(tmpPath, `modsentry-backup-${new Date().toISOString().slice(0, 10)}.sqlite`, () => {
      fs.unlink(tmpPath, () => {});
    });
  } catch (err) {
    fs.unlink(tmpPath, () => {});
    return redirectWithNotice(res, false, `Backup failed: ${err.message}`, 'backup');
  }
});

router.post('/leave-guild', requireStaffArea('remove_server'), async (req, res) => {
  const guildId = (req.body.guildId || '').trim();
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return redirectWithNotice(res, false, "ModSentry isn't in that server (anymore).", 'remove-server');
  }
  const name = guild.name;
  try {
    await guild.leave();
    logAudit(req, 'Left a server', name);
    return redirectWithNotice(res, true, `Left ${name}.`, 'remove-server');
  } catch (err) {
    return redirectWithNotice(res, false, `Couldn't leave ${name}: ${err.message}`, 'remove-server');
  }
});

router.post('/staff-notes/add', requireAnyStaffAccess, (req, res) => {
  const note = (req.body.note || '').trim().slice(0, 500);
  if (!note) return redirectWithNotice(res, false, 'Write something first.', 'staff-notes');
  const actor = req.session.discordUser;
  StaffNotes.add(actor.id, actor.username, note);
  logAudit(req, 'Left a staff note', null);
  return redirectWithNotice(res, true, 'Note pinned.', 'staff-notes');
});

router.post('/staff-notes/remove', requireAnyStaffAccess, (req, res) => {
  StaffNotes.remove(Number(req.body.id));
  logAudit(req, 'Removed a staff note', null);
  return redirectWithNotice(res, true, 'Removed.', 'staff-notes');
});

router.post('/test-beta-dm/send', requireStaffArea('beta'), async (req, res) => {
  try {
    const user = await client.users.fetch(req.session.discordUser.id);
    await user.send({ embeds: [buildResultEmbed(true, { test: true })] });
    await user.send({ embeds: [buildResultEmbed(false, { test: true })] });
    return redirectWithNotice(res, true, `Sent 2 test beta DMs to ${user.tag} — check your DMs.`, 'test-beta-dm');
  } catch (err) {
    return redirectWithNotice(res, false, `Couldn't DM you: ${err.message} — make sure your DMs are open and you share a server with ModSentry.`, 'test-beta-dm');
  }
});

module.exports = router;
