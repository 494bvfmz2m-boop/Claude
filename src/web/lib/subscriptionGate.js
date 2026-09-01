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
function requirePremiumFeature(featureKey) {
  return (req, res, next) => {
    const discordId = req.session?.discordUser?.id;
    if (hasFeature(discordId, featureKey, req.session)) return next();
    return res.status(402).render('upgrade', { featureKey });
  };
}

module.exports = { getActiveTier, hasFeature, requirePremiumFeature };
