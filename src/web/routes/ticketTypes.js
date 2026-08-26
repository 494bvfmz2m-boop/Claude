const express = require('express');
const { TicketTypes, Panels, Tickets } = require('../../db/repo');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireArea('tickets'));

router.get('/tickets', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const ticketTypes = TicketTypes.listForGuild(guild.id);
  const panels = Panels.listForGuild(guild.id);
  const recentTickets = Tickets.listForGuild(guild.id, 25);
  res.render('tickets', { guild, ticketTypes, panels, recentTickets });
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
    welcomeColor: req.body.welcomeColor || '#5865F2',
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
    welcomeColor: req.body.welcomeColor || '#5865F2',
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
