const express = require('express');
const { Tags } = require('../../db/repo');
const { getGuildOr404 } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireArea('tags'));

router.get('/tags', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('tags', { guild, tags: Tags.listForGuild(guild.id) });
});

router.post('/tags', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const name = req.body.name?.trim().toLowerCase();
  const content = req.body.content?.trim();
  if (name && content && !Tags.get(guild.id, name)) {
    Tags.create(guild.id, name, content, req.session.discordUser?.id);
  }
  res.redirect(`/dashboard/${guild.id}/tags`);
});

router.post('/tags/:id', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const content = req.body.content?.trim();
  if (content) Tags.update(req.params.id, content);
  res.redirect(`/dashboard/${guild.id}/tags`);
});

router.post('/tags/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  Tags.delete(req.params.id);
  res.redirect(`/dashboard/${guild.id}/tags`);
});

module.exports = router;
