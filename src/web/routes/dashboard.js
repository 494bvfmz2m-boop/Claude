const express = require('express');
const client = require('../../bot/client');

const router = express.Router();

router.get('/', (req, res) => {
  const guilds = [...client.guilds.cache.values()]
    .map((g) => ({ id: g.id, name: g.name, iconURL: g.iconURL({ size: 64 }) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.render('dashboard', { guilds, botReady: client.isReady() });
});

module.exports = router;
