const express = require('express');
const { TicketTypes, Panels, Tickets, GuildSettings, Hierarchies } = require('../../db/repo');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');
const { limitReached, limitFor } = require('../lib/tierLimits');

const router = express.Router({ mergeParams: true });
router.use(requireArea('tickets'));

// Purely informational -- nothing here blocks anything, it just points a new
// server owner at what they haven't touched yet instead of leaving them to
// discover it by trial and error. Hidden entirely once everything's done.
function buildSetupChecklist(guild, { ticketTypes, panels }) {
  const settings = GuildSettings.get(guild.id);
  return [
    {
      done: ticketTypes.length > 0,
      label: 'Create a ticket type',
      desc: 'Defines what categories of tickets people can open.',
      href: `/dashboard/${guild.id}/ticket-types/new`,
    },
    {
      done: panels.some((p) => p.message_id),
      label: 'Post a ticket panel',
      desc: "The button or dropdown people click to open a ticket -- needs a ticket type first.",
      href: `/dashboard/${guild.id}/panels/new`,
    },
    {
      done: !!settings.mod_log_channel_id,
      label: 'Set a moderation log channel',
      desc: 'Bans, kicks, timeouts, warnings, and filter deletions get posted here.',
      href: `/dashboard/${guild.id}/settings/channels`,
    },
    {
      done: Hierarchies.listForGuild(guild.id).length > 0,
      label: 'Set up a staff hierarchy',
      desc: 'Powers /promote, /demote, and the auto-updating staff list.',
      href: `/dashboard/${guild.id}/moderation/hierarchy`,
    },
  ];
}

router.get('/tickets', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const ticketTypes = TicketTypes.listForGuild(guild.id);
  const panels = Panels.listForGuild(guild.id);
  const recentTickets = Tickets.listForGuild(guild.id, 25);
  const setupChecklist = buildSetupChecklist(guild, { ticketTypes, panels });
  res.render('tickets', { guild, ticketTypes, panels, recentTickets, setupChecklist });
});

router.post('/tickets/clear-history', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  Tickets.clearClosedForGuild(guild.id);
  res.redirect(`/dashboard/${guild.id}/tickets`);
});

router.get('/ticket-types/new', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('ticketTypeForm', { guild, ticketType: null, options: guildChannelOptions(guild) });
});

router.post('/ticket-types', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  if (limitReached('max_ticket_types', guild.id, TicketTypes.listForGuild(guild.id).length, req.session)) {
    return res.status(402).render('upgrade', { reason: 'limit_reached', featureKey: 'max_ticket_types', limit: limitFor('max_ticket_types', guild.id, req.session) });
  }
  const supportRoleIds = [].concat(req.body.supportRoleIds || []).filter(Boolean);
  TicketTypes.create(guild.id, {
    name: req.body.name?.trim() || 'Support',
    emoji: req.body.emoji?.trim(),
    categoryChannelId: req.body.categoryChannelId || null,
    supportRoleIds,
    namePattern: req.body.namePattern?.trim() || 'ticket-{username}',
    maxOpenPerUser: Math.max(1, parseInt(req.body.maxOpenPerUser, 10) || 1),
    welcomeTitle: req.body.welcomeTitle?.trim(),
    welcomeDescription: req.body.welcomeDescription?.trim(),
    welcomeColor: req.body.welcomeColor || '#a32ee2',
    generateTranscript: req.body.generateTranscript === 'on',
  });
  res.redirect(`/dashboard/${guild.id}/tickets`);
});

router.get('/ticket-types/:id/edit', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const ticketType = TicketTypes.get(req.params.id);
  if (!ticketType || ticketType.guild_id !== guild.id) return res.status(404).render('error', { message: 'Ticket type not found.' });
  res.render('ticketTypeForm', { guild, ticketType, options: guildChannelOptions(guild) });
});

router.post('/ticket-types/:id', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const ticketType = TicketTypes.get(req.params.id);
  if (!ticketType || ticketType.guild_id !== guild.id) return res.status(404).render('error', { message: 'Ticket type not found.' });

  const supportRoleIds = [].concat(req.body.supportRoleIds || []).filter(Boolean);
  TicketTypes.update(req.params.id, {
    name: req.body.name?.trim() || 'Support',
    emoji: req.body.emoji?.trim(),
    categoryChannelId: req.body.categoryChannelId || null,
    supportRoleIds,
    namePattern: req.body.namePattern?.trim() || 'ticket-{username}',
    maxOpenPerUser: Math.max(1, parseInt(req.body.maxOpenPerUser, 10) || 1),
    welcomeTitle: req.body.welcomeTitle?.trim(),
    welcomeDescription: req.body.welcomeDescription?.trim(),
    welcomeColor: req.body.welcomeColor || '#a32ee2',
    generateTranscript: req.body.generateTranscript === 'on',
  });
  res.redirect(`/dashboard/${guild.id}/tickets`);
});

router.post('/ticket-types/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const ticketType = TicketTypes.get(req.params.id);
  if (ticketType && ticketType.guild_id === guild.id) TicketTypes.delete(req.params.id);
  res.redirect(`/dashboard/${guild.id}/tickets`);
});

module.exports = router;
