const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { AppSettings, BetaAllowlist } = require('../../db/repo');
const client = require('../../bot/client');
const { DISCORD_ID } = require('../lib/resolveMember');
const dmForm = require('../../bot/dmForm');

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
  const attachForm = req.body.attachForm === 'on';

  if (!DISCORD_ID.test(userId)) {
    return redirectWithNotice(res, false, "Enter a valid Discord user ID.");
  }
  if (!description) {
    return redirectWithNotice(res, false, 'A message is required.');
  }

  const sendDefault = async (user) => {
    const embed = new EmbedBuilder().setColor(color).setDescription(description).setTimestamp();
    if (title) embed.setTitle(title);
    await user.send({ embeds: [embed] });
  };

  try {
    const user = await client.users.fetch(userId);
    if (attachForm) {
      const result = await dmForm.sendWithForm(client, {
        recipientId: user.id,
        recipientTag: user.tag,
        context: 'manual',
        defaultSend: () => sendDefault(user),
      });
      return redirectWithNotice(res, true, result === 'form' ? `Sent the form to ${user.tag}.` : `Sent to ${user.tag}.`);
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

router.post('/dm-form', requireOwner, (req, res) => {
  const enabled = req.body.enabled === 'on';
  const title = (req.body.title || '').trim().slice(0, 200);
  const intro = (req.body.intro || '').trim().slice(0, 1000);
  const questions = [1, 2, 3, 4, 5]
    .map((i) => (req.body[`question${i}`] || '').trim())
    .filter(Boolean)
    .slice(0, 5);

  AppSettings.setDmForm({ enabled, title, intro, questions });
  return redirectWithNotice(res, true, 'Application form saved.', 'dm-form');
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
