const express = require('express');
const client = require('../../bot/client');
const { buildBotInviteUrl } = require('../lib/discordOAuth');

const router = express.Router();

router.get('/', (req, res) => {
  const allBotGuilds = [...client.guilds.cache.values()]
    .map((g) => ({ id: g.id, name: g.name, iconURL: g.iconURL({ size: 64 }) }));

  if (req.session.authType !== 'oauth') {
    const guilds = allBotGuilds.sort((a, b) => a.name.localeCompare(b.name));
    return res.render('dashboard', { guilds, inviteGuilds: [], botReady: client.isReady() });
  }

  const botGuildIds = new Set(allBotGuilds.map((g) => g.id));
  const manageable = req.session.manageableGuilds || [];

  const guilds = manageable
    .filter((g) => botGuildIds.has(g.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const inviteGuilds = manageable
    .filter((g) => !botGuildIds.has(g.id))
    .map((g) => ({ ...g, inviteUrl: buildBotInviteUrl(g.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.render('dashboard', { guilds, inviteGuilds, botReady: client.isReady() });
});

module.exports = router;
