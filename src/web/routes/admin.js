const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { AppSettings, BetaAllowlist } = require('../../db/repo');
const client = require('../../bot/client');
const { DISCORD_ID } = require('../lib/resolveMember');

const router = express.Router();

function requireOwner(req, res, next) {
  if (!req.session || !req.session.isOwner) {
    return res.status(403).render('error', { message: 'Owner access only.' });
  }
  next();
}

function redirectWithNotice(res, ok, text) {
  const qs = new URLSearchParams({ ok: ok ? '1' : '0', msg: text });
  res.redirect(`/admin?${qs.toString()}#send-dm`);
}

router.get('/', requireOwner, (req, res) => {
  const notice = req.query.msg ? { ok: req.query.ok === '1', text: req.query.msg } : null;
  res.render('admin', {
    settings: AppSettings.get(),
    allowlist: BetaAllowlist.list(),
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

  if (!DISCORD_ID.test(userId)) {
    return redirectWithNotice(res, false, "Enter a valid Discord user ID.");
  }
  if (!description) {
    return redirectWithNotice(res, false, 'A message is required.');
  }

  const embed = new EmbedBuilder().setColor(color).setDescription(description).setTimestamp();
  if (title) embed.setTitle(title);

  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
    return redirectWithNotice(res, true, `Sent to ${user.tag}.`);
  } catch (err) {
    // Most common cause: the bot doesn't share a server with them, or they
    // have DMs from server members turned off -- Discord's own error message
    // already says which, so just surface it rather than guessing.
    return redirectWithNotice(res, false, `Couldn't send: ${err.message}`);
  }
});

module.exports = router;
