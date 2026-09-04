const { TebexSubscribers, TebexTiers } = require('../../db/repo');

// The tier a Discord user currently has active, or null. See
// db/repo.js's TebexSubscribers.activeTierFor -- a cancelled/expired
// subscription stops resolving here even though its history row remains.
//
// session is optional; when passed and it belongs to the owner with an
// active "preview as" tier set (see staff.js's /tebex/preview routes),
// that tier overrides whatever the owner's own real subscription is --
// lets the owner see exactly what a given tier unlocks without needing to
// actually hold it. Never applies to anyone but the owner: a regular
// user's session never carries previewTierId in the first place, since
// only the owner-gated route can set it.
function getActiveTier(discordUserId, session) {
  if (session?.isOwner && session?.previewTierId) {
    const previewed = TebexTiers.get(session.previewTierId);
    if (previewed) return previewed;
  }
  if (!discordUserId) return null;
  return TebexSubscribers.activeTierFor(discordUserId);
}

function hasFeature(discordUserId, featureKey, session) {
  const tier = getActiveTier(discordUserId, session);
  return Boolean(tier && tier.features.includes(featureKey));
}

// Express middleware -- gates a route behind a premium feature key (one of
// the free-form strings an owner types into a tier's "Features" field on
// the Subscriptions admin page), e.g.:
//   router.get('/custom-branding', requirePremiumFeature('custom_branding'), ...)
//
// Account-level: doesn't care which server the route is for. Fine for a
// feature that isn't tied to one particular guild. A subscription applies
// to exactly one server (see requirePremiumFeatureForGuild below) -- use
// this only for something genuinely account-wide.
function requirePremiumFeature(featureKey) {
  return (req, res, next) => {
    const discordId = req.session?.discordUser?.id;
    if (hasFeature(discordId, featureKey, req.session)) return next();
    return res.status(402).render('upgrade', { featureKey });
  };
}

// A tier's guild-scoped features (e.g. the custom bot) belong to the
// SERVER they're applied to, not to whoever happens to be logged into the
// dashboard right now -- multiple staff can manage the same guild, and the
// person clicking around isn't necessarily the Tebex buyer. So the real
// check is "does whatever's applied to THIS guild include the feature"
// (TebexSubscribers.forGuild, same lookup lib/tierLimits.js uses), not
// "does the current user personally hold it". Falls back to the current
// user's own subscription only to explain *why* it's locked for them
// specifically (not subscribed, subscribed but unapplied, or applied to a
// different server) when the server-level check comes up empty. The
// owner's "preview as" override is exempt from all of this -- it's a
// debug tool, not a real subscription tied to any server.
function checkFeatureForGuild(discordUserId, featureKey, guildId, session) {
  if (session?.isOwner && session?.previewTierId) {
    return { ok: hasFeature(discordUserId, featureKey, session) };
  }

  if (guildId) {
    const guildSubscriber = TebexSubscribers.forGuild(guildId);
    const guildTier = guildSubscriber ? TebexTiers.get(guildSubscriber.tier_id) : null;
    if (guildTier?.features.includes(featureKey)) return { ok: true };
  }

  if (!discordUserId) return { ok: false };
  const mySub = TebexSubscribers.get(discordUserId);
  const myTier = mySub?.status === 'active' ? TebexTiers.get(mySub.tier_id) : null;
  if (!myTier || !myTier.features.includes(featureKey)) return { ok: false };
  if (!mySub.guild_id) return { ok: false, reason: 'not_applied' };
  return { ok: false, reason: 'wrong_guild', appliedGuildId: mySub.guild_id };
}

function hasFeatureForGuild(discordUserId, featureKey, guildId, session) {
  return checkFeatureForGuild(discordUserId, featureKey, guildId, session).ok;
}

// Express middleware version of checkFeatureForGuild, for a route mounted
// under /dashboard/:guildId, e.g.:
//   router.use(requirePremiumFeatureForGuild('custom_bot'))
function requirePremiumFeatureForGuild(featureKey) {
  return (req, res, next) => {
    const discordId = req.session?.discordUser?.id;
    const result = checkFeatureForGuild(discordId, featureKey, req.params.guildId, req.session);
    if (result.ok) return next();
    return res.status(402).render('upgrade', { featureKey, reason: result.reason, appliedGuildId: result.appliedGuildId });
  };
}

module.exports = { getActiveTier, hasFeature, hasFeatureForGuild, requirePremiumFeature, requirePremiumFeatureForGuild };
