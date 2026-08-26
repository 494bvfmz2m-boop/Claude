const express = require('express');
const client = require('../../bot/client');
const { buildGenericInviteUrl } = require('../lib/discordOAuth');
const { getMemberAccess } = require('../lib/dashboardAccess');

const router = express.Router();

router.get('/', async (req, res) => {
  const botGuilds = [...client.guilds.cache.values()];
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

  const guilds = [...owned, ...granted].sort((a, b) => a.name.localeCompare(b.name));

  res.render('dashboard', { guilds, inviteUrl: buildGenericInviteUrl(), botReady: client.isReady() });
});

module.exports = router;
