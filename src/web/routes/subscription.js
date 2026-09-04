const express = require('express');
const { TebexTiers, TebexSubscribers } = require('../../db/repo');
const { getActiveTier, tierHasFeature } = require('../lib/subscriptionGate');
const { allKnownGuilds } = require('../../bot/clientRegistry');
const { enforceGuildLimits } = require('../../bot/tierEnforcement');

const router = express.Router();

// Servers the logged-in person can actually apply a subscription to: ones
// they manage (Manage Server/Admin, per the OAuth scopes we asked for at
// login) AND that some connected bot (main or a Custom-tier subscriber's
// own) is already in -- picking a server the bot isn't even in yet would
// just leave every gated feature looking broken.
function guildOptionsFor(session) {
  const manageable = session.manageableGuilds || [];
  const botGuildIds = new Set(allKnownGuilds().map((g) => g.id));
  return manageable
    .filter((g) => botGuildIds.has(g.id))
    .map((g) => ({ id: g.id, name: g.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Not guild-scoped -- a Tebex subscription belongs to the Discord person
// logged in, not to any one server they manage (see db/database.js's
// comment on tebex_tiers). Anyone authenticated can see their own status
// here; there's no separate permission to gate since it's just "what do I
// have."
router.get('/subscription', (req, res) => {
  const discordId = req.session.discordUser?.id;
  const activeTier = getActiveTier(discordId, req.session);
  const tiers = TebexTiers.list();
  const subscriber = discordId ? TebexSubscribers.get(discordId) : null;

  // A brand new (or just-renewed-onto-a-different-tier) subscription has
  // no server picked yet -- until one is, none of the tier's guild-scoped
  // features (e.g. the custom bot) unlock anywhere. This is independent of
  // "preview as": that's a debug overlay, it never touches the real
  // subscriber row, so previewing never triggers this prompt.
  const needsGuildChoice = Boolean(subscriber?.status === 'active' && subscriber.tier_id && !subscriber.guild_id);
  const appliedGuild = subscriber?.guild_id
    ? guildOptionsFor(req.session).find((g) => g.id === subscriber.guild_id) || { id: subscriber.guild_id, name: subscriber.guild_id }
    : null;

  res.render('subscription', {
    activeTier,
    tiers,
    subscriber,
    needsGuildChoice,
    appliedGuild,
    guildOptions: subscriber?.status === 'active' ? guildOptionsFor(req.session) : [],
    hasCustomBotFeature: tierHasFeature(activeTier, 'custom_bot'),
  });
});

router.post('/subscription/apply-guild', async (req, res) => {
  const discordId = req.session.discordUser?.id;
  const guildId = (req.body.guildId || '').trim();
  const valid = guildOptionsFor(req.session).some((g) => g.id === guildId);
  if (discordId && valid) {
    // Moving to a different server leaves the OLD one with nothing applied
    // -- it falls back to free-tier limits, so whatever it had beyond that
    // (extra ticket types, a custom bot, ...) needs trimming for real, not
    // just re-locked on the dashboard while still fully live in Discord.
    const priorGuildId = TebexSubscribers.get(discordId)?.guild_id || null;
    TebexSubscribers.setGuild(discordId, guildId);
    if (priorGuildId && priorGuildId !== guildId) await enforceGuildLimits(priorGuildId);
  }
  res.redirect('/subscription');
});

module.exports = router;
