const express = require('express');
const { GuildSettings } = require('../../db/repo');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireArea('settings'));

// One category per settings "type" rather than per feature -- channels,
// roles, and message text were previously mixed together on one page
// (e.g. "Logging & tickets" held two channel pickers and a role picker),
// which made the page read like a pile of unrelated fields.
function buildCategories(settings) {
  return [
    {
      id: 'channels',
      label: 'Channels',
      desc: 'Where ticket logs, moderation logs, welcomes, and leaves get posted.',
      total: 4,
      set: [settings.transcript_channel_id, settings.mod_log_channel_id, settings.welcome_channel_id, settings.leave_channel_id]
        .filter(Boolean).length,
    },
    {
      id: 'roles',
      label: 'Roles',
      desc: 'The ticket-banned role and the role new members get automatically.',
      total: 2,
      set: [settings.ticket_banned_role_id, settings.autorole_id].filter(Boolean).length,
    },
    {
      id: 'messages',
      label: 'Messages',
      desc: 'What gets said when someone joins or leaves.',
      total: 2,
      set: [settings.welcome_message, settings.leave_message].filter(Boolean).length,
    },
  ];
}

router.get('/settings', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const settings = GuildSettings.get(guild.id);
  res.render('settingsOverview', { guild, categories: buildCategories(settings) });
});

router.get('/settings/channels', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('settingsChannels', { guild, settings: GuildSettings.get(guild.id), options: guildChannelOptions(guild) });
});

router.post('/settings/channels', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.setTranscriptChannel(guild.id, req.body.transcriptChannelId || null);
  GuildSettings.setModLogChannel(guild.id, req.body.modLogChannelId || null);
  GuildSettings.setWelcomeChannel(guild.id, req.body.welcomeChannelId || null);
  GuildSettings.setLeaveChannel(guild.id, req.body.leaveChannelId || null);
  res.redirect(`/dashboard/${guild.id}/settings/channels`);
});

router.get('/settings/roles', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('settingsRoles', { guild, settings: GuildSettings.get(guild.id), options: guildChannelOptions(guild) });
});

router.post('/settings/roles', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.setTicketBannedRole(guild.id, req.body.ticketBannedRoleId || null);
  GuildSettings.setAutorole(guild.id, req.body.autoroleId || null);
  res.redirect(`/dashboard/${guild.id}/settings/roles`);
});

router.get('/settings/messages', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('settingsMessages', { guild, settings: GuildSettings.get(guild.id) });
});

router.post('/settings/messages', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.setWelcomeMessage(guild.id, req.body.welcomeMessage || null);
  GuildSettings.setLeaveMessage(guild.id, req.body.leaveMessage || null);
  res.redirect(`/dashboard/${guild.id}/settings/messages`);
});

module.exports = router;
