const express = require('express');
const { ReactionRolePanels } = require('../../db/repo');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { postPanel, buildReactionRoleMessage, parseEmojiInput } = require('../../bot/reactionRoles');
const { requireArea } = require('../middleware/auth');
const { limitReached, limitFor } = require('../lib/tierLimits');

const router = express.Router({ mergeParams: true });
router.use(requireArea('reaction_roles'));

function parseMappingsFromBody(body) {
  const emojis = [].concat(body.emoji || []);
  const roleIds = [].concat(body.roleId || []);
  const mappings = [];
  emojis.forEach((raw, i) => {
    const roleId = roleIds[i];
    if (!raw || !roleId) return;
    const parsed = parseEmojiInput(raw);
    mappings.push({ emoji: parsed.display, roleId, reactWith: parsed.reactWith, matchKey: parsed.matchKey });
  });
  return mappings;
}

router.get('/reaction-roles', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const panels = ReactionRolePanels.listForGuild(guild.id);
  const disabledPanels = ReactionRolePanels.listAllForGuild(guild.id).filter((p) => p.tier_disabled);
  res.render('reactionRoles', { guild, panels, disabledPanels, options: guildChannelOptions(guild) });
});

router.get('/reaction-roles/new', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('reactionRoleForm', { guild, panel: null, options: guildChannelOptions(guild) });
});

router.post('/reaction-roles', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  if (limitReached('max_reaction_role_panels', guild.id, ReactionRolePanels.listForGuild(guild.id).length, req.session)) {
    return res.status(402).render('upgrade', { reason: 'limit_reached', featureKey: 'max_reaction_role_panels', limit: limitFor('max_reaction_role_panels', guild.id, req.session) });
  }
  ReactionRolePanels.create(guild.id, {
    title: req.body.title?.trim() || 'Reaction Roles',
    description: req.body.description?.trim() || 'React to get a role!',
    color: req.body.color || '#a32ee2',
    mappings: parseMappingsFromBody(req.body),
    exclusive: req.body.exclusive === 'on',
  });
  res.redirect(`/dashboard/${guild.id}/reaction-roles`);
});

router.get('/reaction-roles/:id/edit', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const panel = ReactionRolePanels.get(req.params.id);
  if (!panel || panel.guild_id !== guild.id) return res.status(404).render('error', { message: 'Reaction role panel not found.' });
  res.render('reactionRoleForm', { guild, panel, options: guildChannelOptions(guild) });
});

router.post('/reaction-roles/:id', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const panel = ReactionRolePanels.get(req.params.id);
  if (!panel || panel.guild_id !== guild.id) return res.status(404).render('error', { message: 'Reaction role panel not found.' });

  ReactionRolePanels.update(req.params.id, {
    title: req.body.title?.trim() || 'Reaction Roles',
    description: req.body.description?.trim() || 'React to get a role!',
    color: req.body.color || '#a32ee2',
    mappings: parseMappingsFromBody(req.body),
    exclusive: req.body.exclusive === 'on',
  });
  res.redirect(`/dashboard/${guild.id}/reaction-roles`);
});

router.post('/reaction-roles/:id/deploy', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const panel = ReactionRolePanels.get(req.params.id);
  if (!panel || panel.guild_id !== guild.id) return res.status(404).render('error', { message: 'Reaction role panel not found.' });
  if (panel.mappings.length === 0) {
    return res.status(400).render('error', { message: 'Add at least one emoji → role mapping before posting.' });
  }

  const channelId = req.body.channelId;
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
  if (!channel || !channel.isTextBased()) {
    return res.status(400).render('error', { message: 'Pick a valid text channel to post in.' });
  }

  try {
    if (panel.channel_id === channelId && panel.message_id) {
      const existing = await channel.messages.fetch(panel.message_id).catch(() => null);
      if (existing) {
        await existing.edit(buildReactionRoleMessage(panel, guild));
        await existing.reactions.removeAll().catch(() => {});
        for (const m of panel.mappings) await existing.react(m.reactWith).catch(() => {});
        return res.redirect(`/dashboard/${guild.id}/reaction-roles`);
      }
    }
    const sent = await postPanel(guild, channel, panel);
    ReactionRolePanels.setDeployed(req.params.id, channel.id, sent.id);
  } catch (err) {
    return res.status(500).render('error', { message: `Failed to post: ${err.message}` });
  }

  res.redirect(`/dashboard/${guild.id}/reaction-roles`);
});

router.post('/reaction-roles/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const panel = ReactionRolePanels.get(req.params.id);
  if (panel && panel.guild_id === guild.id) ReactionRolePanels.delete(req.params.id);
  res.redirect(`/dashboard/${guild.id}/reaction-roles`);
});

module.exports = router;
