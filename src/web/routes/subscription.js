const express = require('express');
const { TebexTiers } = require('../../db/repo');
const { getActiveTier } = require('../lib/subscriptionGate');

const router = express.Router();

// Not guild-scoped -- a Tebex subscription belongs to the Discord person
// logged in, not to any one server they manage (see db/database.js's
// comment on tebex_tiers). Anyone authenticated can see their own status
// here; there's no separate permission to gate since it's just "what do I
// have."
router.get('/subscription', (req, res) => {
  const discordId = req.session.discordUser?.id;
  const activeTier = getActiveTier(discordId, req.session);
  const tiers = TebexTiers.list();
  res.render('subscription', { activeTier, tiers });
});

module.exports = router;
