const express = require('express');
const { GuildSettings } = require('../../db/repo');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');

const router = express.Router({ mergeParams: true });

router.get('/settings', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const settings = GuildSettings.get(guild.id);
  res.render('settings', { guild, settings, options: guildChannelOptions(guild) });
});

router.post('/settings', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.upsert(guild.id, {
    transcriptChannelId: req.body.transcriptChannelId || null,
  });
  res.redirect(`/dashboard/${guild.id}/settings`);
});

module.exports = router;
