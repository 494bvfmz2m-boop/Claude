const { TebexSubscribers } = require('../../db/repo');

// The tier a Discord user currently has active via Tebex, or null. See
// db/repo.js's TebexSubscribers.activeTierFor -- a cancelled/expired
// subscription stops resolving here even though its history row remains.
function getActiveTier(discordUserId) {
  if (!discordUserId) return null;
  return TebexSubscribers.activeTierFor(discordUserId);
}

function hasFeature(discordUserId, featureKey) {
  const tier = getActiveTier(discordUserId);
  return Boolean(tier && tier.features.includes(featureKey));
}

// Express middleware -- gates a route behind a premium feature key (one of
// the free-form strings an owner types into a tier's "Features" field on
// the Subscriptions admin page). Nothing in the app calls this yet -- wire
// it into a specific route's middleware chain when a feature is actually
// meant to require a subscription, e.g.:
//   router.get('/custom-branding', requirePremiumFeature('custom_branding'), ...)
function requirePremiumFeature(featureKey) {
  return (req, res, next) => {
    const discordId = req.session?.discordUser?.id;
    if (hasFeature(discordId, featureKey)) return next();
    return res.status(402).render('upgrade', { featureKey });
  };
}

module.exports = { getActiveTier, hasFeature, requirePremiumFeature };
