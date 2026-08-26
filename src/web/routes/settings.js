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
  GuildSettings.setTranscriptChannel(guild.id, req.body.transcriptChannelId || null);
  GuildSettings.setModLogChannel(guild.id, req.body.modLogChannelId || null);
  GuildSettings.setTicketBannedRole(guild.id, req.body.ticketBannedRoleId || null);
  res.redirect(`/dashboard/${guild.id}/settings`);
});

module.exports = router;
