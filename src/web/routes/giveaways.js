const express = require('express');
const { Giveaways } = require('../../db/repo');
const { getGuildOr404 } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireArea('giveaways'));

router.get('/giveaways', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('giveaways', { guild, giveaways: Giveaways.listForGuild(guild.id) });
});

router.post('/giveaways/:id/end', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const giveaway = Giveaways.get(req.params.id);
  // The scheduler picks this up (and posts winners) on its next sweep,
  // within 30s -- this route just pulls the end time to now.
  if (giveaway && giveaway.guild_id === guild.id) Giveaways.endNow(req.params.id);
  res.redirect(`/dashboard/${guild.id}/giveaways`);
});

router.post('/giveaways/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const giveaway = Giveaways.get(req.params.id);
  if (giveaway && giveaway.guild_id === guild.id) Giveaways.delete(req.params.id);
  res.redirect(`/dashboard/${guild.id}/giveaways`);
});

module.exports = router;
