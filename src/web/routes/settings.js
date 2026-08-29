const express = require('express');
const { PermissionFlagsBits, GuildSystemChannelFlags, SystemChannelFlagsBitField } = require('discord.js');
const { GuildSettings, RoleTriggers } = require('../../db/repo');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');
const { postOrUpdatePanel } = require('../../bot/verification');
const { updateGuildStats } = require('../../bot/statsChannels');

const router = express.Router({ mergeParams: true });
router.use(requireArea('settings'));

function notice(req) {
  return req.query.msg ? { ok: req.query.ok === '1', text: req.query.msg } : null;
}

// One category per settings "type" rather than per feature -- channels,
// roles, and message text were previously mixed together on one page
// (e.g. "Logging & tickets" held two channel pickers and a role picker),
// which made the page read like a pile of unrelated fields.
function buildCategories(settings) {
  return [
    {
      id: 'channels',
      label: 'Channels',
      desc: 'Where ticket logs, moderation logs, message edits/deletes, welcomes, and leaves get posted.',
      total: 5,
      set: [settings.transcript_channel_id, settings.mod_log_channel_id, settings.message_log_channel_id, settings.welcome_channel_id, settings.leave_channel_id]
        .filter(Boolean).length,
    },
    {
      id: 'roles',
      label: 'Roles',
      desc: 'The ticket-banned role, the role new members get automatically, and automatic role assignment rules.',
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
    {
      id: 'verification',
      label: 'Verification',
      desc: 'A button new members click to get access to the rest of the server.',
      total: 3,
      set: [settings.verification_channel_id, settings.verification_role_id, settings.verification_enabled].filter(Boolean).length,
    },
    {
      id: 'stats',
      label: 'Server stats channels',
      desc: 'Locked voice channels that show a live member/online/boost count.',
      total: 3,
      set: [settings.stats_members_channel_id, settings.stats_online_channel_id, settings.stats_boosts_channel_id].filter(Boolean).length,
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
  GuildSettings.setMessageLogChannel(guild.id, req.body.messageLogChannelId || null);
  GuildSettings.setWelcomeChannel(guild.id, req.body.welcomeChannelId || null);
  GuildSettings.setLeaveChannel(guild.id, req.body.leaveChannelId || null);
  res.redirect(`/dashboard/${guild.id}/settings/channels`);
});

// Attaches display info (name/color, or "deleted role" for a ref to a role
// that's since been removed from Discord) so the view never has to reach
// into guild.roles.cache itself.
function describeRoleTriggers(guild, rules) {
  const roleInfo = (id) => {
    const role = guild.roles.cache.get(id);
    return role ? { id, name: role.name, color: role.color !== 0 ? role.hexColor : '#99aab5' } : { id, name: 'deleted role', color: '#99aab5' };
  };
  return rules.map((r) => ({
    id: r.id,
    trigger: roleInfo(r.trigger_role_id),
    add: roleInfo(r.add_role_id),
    remove: r.remove_role_id ? roleInfo(r.remove_role_id) : null,
  }));
}

router.get('/settings/roles', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('settingsRoles', {
    guild,
    settings: GuildSettings.get(guild.id),
    options: guildChannelOptions(guild),
    roleTriggers: describeRoleTriggers(guild, RoleTriggers.listForGuild(guild.id)),
    notice: notice(req),
  });
});

router.post('/settings/roles', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.setTicketBannedRole(guild.id, req.body.ticketBannedRoleId || null);
  GuildSettings.setAutorole(guild.id, req.body.autoroleId || null);
  res.redirect(`/dashboard/${guild.id}/settings/roles`);
});

router.post('/settings/role-triggers', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const triggerRoleId = req.body.triggerRoleId || null;
  const addRoleId = req.body.addRoleId || null;
  const removeRoleId = req.body.removeRoleId || null;

  if (!triggerRoleId || !addRoleId) {
    return res.redirect(`/dashboard/${guild.id}/settings/roles?msg=${encodeURIComponent('Pick both a trigger role and a role to add.')}&ok=0`);
  }
  if (triggerRoleId === addRoleId) {
    return res.redirect(`/dashboard/${guild.id}/settings/roles?msg=${encodeURIComponent("The added role can't be the same as the trigger role.")}&ok=0`);
  }
  if (removeRoleId && removeRoleId === addRoleId) {
    return res.redirect(`/dashboard/${guild.id}/settings/roles?msg=${encodeURIComponent("The role to remove can't be the same as the role to add.")}&ok=0`);
  }

  RoleTriggers.create(guild.id, { triggerRoleId, addRoleId, removeRoleId });
  res.redirect(`/dashboard/${guild.id}/settings/roles?msg=${encodeURIComponent('Rule added.')}&ok=1`);
});

router.post('/settings/role-triggers/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const rule = RoleTriggers.listForGuild(guild.id).find((r) => String(r.id) === req.params.id);
  if (rule) RoleTriggers.delete(rule.id);
  res.redirect(`/dashboard/${guild.id}/settings/roles`);
});

router.get('/settings/messages', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('settingsMessages', {
    guild,
    settings: GuildSettings.get(guild.id),
    canManageSystemMessages: !!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild),
    discordJoinMessageSuppressed: guild.systemChannelFlags?.has(GuildSystemChannelFlags.SuppressJoinNotifications) ?? false,
    notice: notice(req),
  });
});

router.post('/settings/messages', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.setWelcomeMessage(guild.id, req.body.welcomeMessage || null);
  GuildSettings.setLeaveMessage(guild.id, req.body.leaveMessage || null);

  // Discord's own built-in "X joined the server" system message -- lives on
  // the guild itself (system_channel_flags), not in our DB, so it's read
  // fresh from the live guild object rather than cached anywhere. Requires
  // Manage Server; servers that added the bot before that permission was
  // requested need to re-invite it before this checkbox can take effect.
  if (guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    const wantSuppressed = req.body.suppressDiscordJoinMessage === 'on';
    const current = guild.systemChannelFlags ?? new SystemChannelFlagsBitField();
    const isSuppressed = current.has(GuildSystemChannelFlags.SuppressJoinNotifications);
    if (wantSuppressed !== isSuppressed) {
      const next = wantSuppressed
        ? current.add(GuildSystemChannelFlags.SuppressJoinNotifications)
        : current.remove(GuildSystemChannelFlags.SuppressJoinNotifications);
      try {
        await guild.setSystemChannelFlags(next);
      } catch (err) {
        const qs = new URLSearchParams({ ok: '0', msg: `Saved the message text, but couldn't change Discord's join message: ${err.message}` });
        return res.redirect(`/dashboard/${guild.id}/settings/messages?${qs.toString()}`);
      }
    }
  }

  res.redirect(`/dashboard/${guild.id}/settings/messages`);
});

router.get('/settings/verification', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('settingsVerification', { guild, settings: GuildSettings.get(guild.id), options: guildChannelOptions(guild) });
});

router.post('/settings/verification', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.setVerification(guild.id, {
    enabled: req.body.enabled === 'on',
    channelId: req.body.channelId || null,
    roleId: req.body.roleId || null,
    message: req.body.message?.trim() || null,
  });
  res.redirect(`/dashboard/${guild.id}/settings/verification`);
});

router.post('/settings/verification/deploy', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const settings = GuildSettings.get(guild.id);
  if (!settings.verification_channel_id) {
    return res.status(400).render('error', { message: 'Pick and save a verification channel first.' });
  }
  const channel = await guild.channels.fetch(settings.verification_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return res.status(400).render('error', { message: "That channel doesn't exist anymore -- pick a different one." });
  }
  try {
    await postOrUpdatePanel(guild, channel, settings);
  } catch (err) {
    return res.status(500).render('error', { message: `Failed to post: ${err.message}` });
  }
  res.redirect(`/dashboard/${guild.id}/settings/verification`);
});

router.get('/settings/stats', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('settingsStats', { guild, settings: GuildSettings.get(guild.id), options: guildChannelOptions(guild) });
});

router.post('/settings/stats', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.setStatsChannels(guild.id, {
    membersChannelId: req.body.membersChannelId || null,
    onlineChannelId: req.body.onlineChannelId || null,
    boostsChannelId: req.body.boostsChannelId || null,
  });
  updateGuildStats(guild).catch(() => {});
  res.redirect(`/dashboard/${guild.id}/settings/stats`);
});

module.exports = router;
