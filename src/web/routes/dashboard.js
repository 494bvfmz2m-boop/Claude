const express = require('express');
const client = require('../../bot/client');
const { buildGenericInviteUrl } = require('../lib/discordOAuth');

const router = express.Router();

router.get('/', (req, res) => {
  const botGuildIds = new Set([...client.guilds.cache.values()].map((g) => g.id));
  const manageable = req.session.manageableGuilds || [];

  const guilds = manageable
    .filter((g) => botGuildIds.has(g.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.render('dashboard', { guilds, inviteUrl: buildGenericInviteUrl(), botReady: client.isReady() });
});

module.exports = router;
