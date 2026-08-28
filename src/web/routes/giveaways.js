const express = require('express');
const { Giveaways } = require('../../db/repo');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');
const { buildGiveawayMessage, finalizeGiveaway, parseDuration } = require('../../bot/giveaway');

const router = express.Router({ mergeParams: true });
router.use(requireArea('giveaways'));

router.get('/giveaways', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('giveaways', { guild, giveaways: Giveaways.listForGuild(guild.id) });
});

router.get('/giveaways/new', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('giveawayForm', { guild, options: guildChannelOptions(guild) });
});

router.post('/giveaways', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const prize = (req.body.prize || '').trim();
  const winnerCount = Math.max(1, parseInt(req.body.winners, 10) || 1);
  const requiredRoleId = req.body.requiredRoleId || null;
  const ms = parseDuration(req.body.duration);

  if (!prize) {
    return res.status(400).render('error', { message: 'A prize is required.' });
  }
  if (!ms) {
    return res.status(400).render('error', { message: "Couldn't parse that duration -- use something like 10m, 2h, or 1d (max 30d)." });
  }

  const channel = req.body.channelId ? await guild.channels.fetch(req.body.channelId).catch(() => null) : null;
  if (!channel || !channel.isTextBased()) {
    return res.status(400).render('error', { message: 'Pick a valid text channel to post the giveaway in.' });
  }

  const endsAt = new Date(Date.now() + ms);
  const hostedBy = req.session.discordUser.username;
  const draft = {
    id: 0, prize, winner_count: winnerCount, entries: [], ends_at: endsAt.toISOString(), required_role_id: requiredRoleId, hosted_by: hostedBy,
  };

  let message;
  try {
    message = await channel.send(buildGiveawayMessage(draft));
  } catch (err) {
    return res.status(500).render('error', { message: `Failed to post the giveaway: ${err.message}` });
  }

  await finalizeGiveaway(message, { prize, winnerCount, requiredRoleId, hostedBy, endsAt: endsAt.toISOString() });
  res.redirect(`/dashboard/${guild.id}/giveaways`);
});

router.post('/giveaways/:id/end', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const giveaway = Giveaways.get(req.params.id);
  // The scheduler picks this up (and posts winners) on its next sweep,
  // within 30s -- this route just pulls the end time to now.
  if (giveaway && giveaway.guild_id === guild.id) Giveaways.endNow(req.params.id);
  res.redirect(`/dashboard/${guild.id}/giveaways`);
});

router.post('/giveaways/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const giveaway = Giveaways.get(req.params.id);
  if (giveaway && giveaway.guild_id === guild.id) Giveaways.delete(req.params.id);
  res.redirect(`/dashboard/${guild.id}/giveaways`);
});

module.exports = router;
