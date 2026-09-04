const express = require('express');
const { Tags } = require('../../db/repo');
const { getGuildOr404 } = require('../lib/getGuild');
const { requireArea } = require('../middleware/auth');
const { limitReached, limitFor } = require('../lib/tierLimits');

const router = express.Router({ mergeParams: true });
router.use(requireArea('tags'));

router.get('/tags', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const disabledTags = Tags.listAllForGuild(guild.id).filter((t) => t.tier_disabled);
  res.render('tags', { guild, tags: Tags.listForGuild(guild.id), disabledTags });
});

router.post('/tags', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const name = req.body.name?.trim().toLowerCase();
  const content = req.body.content?.trim();
  // getAny -- a name collision with a currently-disabled tag still blocks
  // creating a duplicate (no db-level uniqueness constraint to fall back on).
  if (name && content && !Tags.getAny(guild.id, name)) {
    if (limitReached('max_tags', guild.id, Tags.listForGuild(guild.id).length, req.session)) {
      return res.status(402).render('upgrade', { reason: 'limit_reached', featureKey: 'max_tags', limit: limitFor('max_tags', guild.id, req.session) });
    }
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
