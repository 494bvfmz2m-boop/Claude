const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { AppSettings, BetaAllowlist, DmFormTemplates } = require('../../db/repo');
const client = require('../../bot/client');
const { DISCORD_ID } = require('../lib/resolveMember');
const dmForm = require('../../bot/dmForm');

const QUESTION_MAX_LEN = 300;

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

router.get('/', requireOwner, (req, res) => {
  const notice = req.query.msg ? { ok: req.query.ok === '1', text: req.query.msg } : null;
  const guilds = [...client.guilds.cache.values()]
    .map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount, iconURL: g.iconURL({ size: 32 }) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.render('admin', {
    settings: AppSettings.get(),
    allowlist: BetaAllowlist.list(),
    templates: DmFormTemplates.list(),
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
  const userId = (req.body.userId || '').trim();
  const title = (req.body.title || '').trim();
  const description = (req.body.description || '').trim();
  const color = req.body.color || '#5865F2';
  const templateId = req.body.templateId ? Number(req.body.templateId) : null;

  if (!DISCORD_ID.test(userId)) {
    return redirectWithNotice(res, false, "Enter a valid Discord user ID.");
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

  try {
    const user = await client.users.fetch(userId);
    if (template) {
      await dmForm.sendWithForm(client, {
        recipientId: user.id,
        recipientTag: user.tag,
        template,
        defaultSend: () => sendDefault(user),
      });
      return redirectWithNotice(res, true, `Sent "${template.name}" to ${user.tag}.`);
    }
    await sendDefault(user);
    return redirectWithNotice(res, true, `Sent to ${user.tag}.`);
  } catch (err) {
    // Most common cause: the bot doesn't share a server with them, or they
    // have DMs from server members turned off -- Discord's own error message
    // already says which, so just surface it rather than guessing.
    return redirectWithNotice(res, false, `Couldn't send: ${err.message}`);
  }
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
    return redirectWithNotice(res, false, "Quellum isn't in that server (anymore).", 'remove-server');
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
