const express = require('express');
const { Events: EventsRepo } = require('../../db/repo');
const { getGuildOr404 } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireArea('events'));

router.get('/events', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('events', { guild, events: EventsRepo.listForGuild(guild.id) });
});

router.post('/events/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const event = EventsRepo.listForGuild(guild.id).find((e) => String(e.id) === req.params.id);
  if (event) EventsRepo.delete(req.params.id);
  res.redirect(`/dashboard/${guild.id}/events`);
});

module.exports = router;
