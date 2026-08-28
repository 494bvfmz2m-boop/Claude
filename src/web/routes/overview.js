const express = require('express');
const { getGuildOr404 } = require('../lib/getGuild');
const { Tickets, Warnings, ModActions, Giveaways, TicketTypes } = require('../../db/repo');

const router = express.Router({ mergeParams: true });

router.get('/overview', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const access = req.dashboardAccess;
  const canSee = (area) => access.level === 'full' || (access.areas && access.areas.has(area));
  const seesTickets = canSee('tickets');
  const seesModeration = canSee('moderation');
  const seesGiveaways = canSee('giveaways');

  const stats = [
    { key: 'members', label: 'Members', value: guild.memberCount },
    seesTickets ? { key: 'tickets', label: 'Open tickets', value: Tickets.countOpenForGuild(guild.id) } : null,
    seesModeration ? { key: 'warnings', label: 'Warnings today', value: Warnings.countTodayForGuild(guild.id) } : null,
    seesModeration ? { key: 'actions', label: 'Mod actions this week', value: ModActions.countThisWeekForGuild(guild.id) } : null,
    seesGiveaways ? { key: 'giveaways', label: 'Active giveaways', value: Giveaways.countActiveForGuild(guild.id) } : null,
  ].filter(Boolean);

  const recentActions = seesModeration ? ModActions.listForGuild(guild.id, 8) : [];

  const recentTickets = seesTickets
    ? Tickets.listForGuild(guild.id, 6).map((t) => {
      const type = TicketTypes.get(t.ticket_type_id);
      return { ...t, typeName: type ? type.name : 'Unknown type' };
    })
    : [];

  res.render('overview', { guild, stats, recentActions, recentTickets, seesTickets, seesModeration });
});

module.exports = router;
