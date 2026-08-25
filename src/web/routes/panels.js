const express = require('express');
const { Panels, TicketTypes } = require('../../db/repo');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { buildPanelMessage } = require('../../bot/panelMessage');

const router = express.Router({ mergeParams: true });

router.get('/panels/new', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('panelForm', { guild, panel: null, ticketTypes: TicketTypes.listForGuild(guild.id), options: guildChannelOptions(guild) });
});

router.post('/panels', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const ticketTypeIds = [].concat(req.body.ticketTypeIds || []).filter(Boolean).map(Number);
  Panels.create(guild.id, {
    title: req.body.title?.trim() || 'Support',
    description: req.body.description?.trim() || 'Click below to open a ticket.',
    color: req.body.color || '#5865F2',
    ticketTypeIds,
  });
  res.redirect(`/dashboard/${guild.id}/tickets`);
});

router.get('/panels/:id/edit', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const panel = Panels.get(req.params.id);
  if (!panel || panel.guild_id !== guild.id) return res.status(404).render('error', { message: 'Panel not found.' });
  res.render('panelForm', { guild, panel, ticketTypes: TicketTypes.listForGuild(guild.id), options: guildChannelOptions(guild) });
});

router.post('/panels/:id', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const panel = Panels.get(req.params.id);
  if (!panel || panel.guild_id !== guild.id) return res.status(404).render('error', { message: 'Panel not found.' });

  const ticketTypeIds = [].concat(req.body.ticketTypeIds || []).filter(Boolean).map(Number);
  Panels.update(req.params.id, {
    title: req.body.title?.trim() || 'Support',
    description: req.body.description?.trim() || 'Click below to open a ticket.',
    color: req.body.color || '#5865F2',
    ticketTypeIds,
  });
  res.redirect(`/dashboard/${guild.id}/tickets`);
});

router.post('/panels/:id/deploy', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const panel = Panels.get(req.params.id);
  if (!panel || panel.guild_id !== guild.id) return res.status(404).render('error', { message: 'Panel not found.' });

  const channelId = req.body.channelId;
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
  if (!channel || !channel.isTextBased()) {
    return res.status(400).render('error', { message: 'Pick a valid text channel to post the panel in.' });
  }

  const payload = buildPanelMessage(Panels.get(req.params.id));

  try {
    if (panel.channel_id === channelId && panel.message_id) {
      const existing = await channel.messages.fetch(panel.message_id).catch(() => null);
      if (existing) {
        await existing.edit(payload);
        return res.redirect(`/dashboard/${guild.id}/tickets`);
      }
    }
    const sent = await channel.send(payload);
    Panels.setDeployed(req.params.id, channel.id, sent.id);
  } catch (err) {
    return res.status(500).render('error', { message: `Failed to post the panel: ${err.message}` });
  }

  res.redirect(`/dashboard/${guild.id}/tickets`);
});

router.post('/panels/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const panel = Panels.get(req.params.id);
  if (panel && panel.guild_id === guild.id) Panels.delete(req.params.id);
  res.redirect(`/dashboard/${guild.id}/tickets`);
});

module.exports = router;
