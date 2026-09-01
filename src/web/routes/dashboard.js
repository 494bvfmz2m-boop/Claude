const express = require('express');
const { mainClient, resolveGuild, allKnownGuilds } = require('../../bot/clientRegistry');
const { buildGenericInviteUrl } = require('../lib/discordOAuth');
const { getMemberAccess } = require('../lib/dashboardAccess');
const { Tickets, Warnings } = require('../../db/repo');

const router = express.Router();

router.get('/', async (req, res) => {
  // Every guild reachable through ANY connected bot, not just the main
  // one -- a Custom-tier subscriber's server may no longer have the main
  // bot as a member at all once their own bot has replaced it.
  const botGuilds = allKnownGuilds();
  const manageable = req.session.manageableGuilds || [];
  const manageableIds = new Set(manageable.map((g) => g.id));

  const owned = manageable.filter((g) => botGuilds.some((bg) => bg.id === g.id));

  // Also surface servers reachable only through a Permissions-page role
  // grant, not real Manage Server -- otherwise someone granted limited
  // access would have no way to even find their way to it.
  const grantedGuilds = botGuilds.filter((g) => !manageableIds.has(g.id));
  const grantedChecks = await Promise.all(
    grantedGuilds.map((g) => getMemberAccess(g, req.session.discordUser?.id)),
  );
  const granted = grantedGuilds
    .filter((g, i) => grantedChecks[i].level === 'limited')
    .map((g) => ({ id: g.id, name: g.name, iconURL: g.iconURL({ size: 64 }) }));

  const guilds = [...owned, ...granted]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => {
      const live = resolveGuild(g.id);
      return {
        ...g,
        memberCount: live ? live.memberCount : null,
        openTickets: Tickets.countOpenForGuild(g.id),
        warningsToday: Warnings.countTodayForGuild(g.id),
      };
    });

  res.render('dashboard', { guilds, inviteUrl: buildGenericInviteUrl(), botReady: mainClient.isReady() });
});

module.exports = router;
