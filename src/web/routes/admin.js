const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { AppSettings, BetaAllowlist, DmFormTemplates, Contacts } = require('../../db/repo');
const client = require('../../bot/client');
const { DISCORD_ID } = require('../lib/resolveMember');
const dmForm = require('../../bot/dmForm');

const QUESTION_MAX_LEN = 300;
const MAX_RECIPIENTS = 50;

const router = express.Router();

function requireOwner(req, res, next) {
  if (!req.session || !req.session.isOwner) {
    return res.status(403).render('error', { message: 'Owner access only.' });
  }
  next();
}

function redirectWithNotice(res, ok, text, anchor = 'send-dm') {
  const qs = new URLSearchParams({ ok: ok ? '1' : '0', msg: text });
  res.redirect(`/admin?${qs.toString()}#${anchor}`);
}

router.get('/', requireOwner, async (req, res) => {
  const notice = req.query.msg ? { ok: req.query.ok === '1', text: req.query.msg } : null;
  const guilds = [...client.guilds.cache.values()]
    .map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount, iconURL: g.iconURL({ size: 32 }) }))
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

  res.render('admin', {
    settings: AppSettings.get(),
    allowlist: BetaAllowlist.list(),
    templates: DmFormTemplates.list(),
    contacts,
    guilds,
    notice,
  });
});

router.post('/beta-lock', requireOwner, (req, res) => {
  AppSettings.setBetaLocked(req.body.enabled === 'on');
  res.redirect('/admin');
});

router.post('/allowlist/add', requireOwner, (req, res) => {
  const id = (req.body.discordUserId || '').trim();
  if (/^\d{5,25}$/.test(id)) BetaAllowlist.add(id);
  res.redirect('/admin');
});

router.post('/allowlist/remove', requireOwner, (req, res) => {
  BetaAllowlist.remove(req.body.discordUserId);
  res.redirect('/admin');
});

router.post('/send-dm', requireOwner, async (req, res) => {
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
  return redirectWithNotice(res, failed.length === 0, text);
});

router.post('/contacts/add', requireOwner, async (req, res) => {
  const id = (req.body.discordUserId || '').trim();
  const note = (req.body.note || '').trim().slice(0, 200);

  if (!DISCORD_ID.test(id)) {
    return redirectWithNotice(res, false, 'Enter a valid Discord user ID.', 'contacts');
  }
  try {
    const user = await client.users.fetch(id);
    Contacts.add(id, note);
    return redirectWithNotice(res, true, `Added ${user.tag} to contacts.`, 'contacts');
  } catch (err) {
    return redirectWithNotice(res, false, `Couldn't find that user: ${err.message}`, 'contacts');
  }
});

router.post('/contacts/remove', requireOwner, (req, res) => {
  Contacts.remove(req.body.discordUserId);
  return redirectWithNotice(res, true, 'Removed.', 'contacts');
});

router.post('/dm-form-templates/save', requireOwner, (req, res) => {
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
    return redirectWithNotice(res, true, `"${name}" updated.`, 'dm-form');
  }
  DmFormTemplates.create({ name, title, intro, questions });
  return redirectWithNotice(res, true, `"${name}" created.`, 'dm-form');
});

router.post('/dm-form-templates/delete', requireOwner, (req, res) => {
  const id = Number(req.body.templateId);
  const template = DmFormTemplates.get(id);
  if (template) DmFormTemplates.remove(id);
  return redirectWithNotice(res, true, template ? `"${template.name}" deleted.` : 'Already gone.', 'dm-form');
});

router.post('/leave-guild', requireOwner, async (req, res) => {
  const guildId = (req.body.guildId || '').trim();
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return redirectWithNotice(res, false, "ModSentry isn't in that server (anymore).", 'remove-server');
  }
  const name = guild.name;
  try {
    await guild.leave();
    return redirectWithNotice(res, true, `Left ${name}.`, 'remove-server');
  } catch (err) {
    return redirectWithNotice(res, false, `Couldn't leave ${name}: ${err.message}`, 'remove-server');
  }
});

module.exports = router;
