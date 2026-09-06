const { TebexSubscribers, TebexTiers, ManualTierGrants } = require('../../db/repo');

// The tier actually in effect for a guild right now. A manual grant
// (Staff -> Subscriptions -> Global user lookup -> pick a server they're
// in -> apply a tier) always wins if one is set, since it's a deliberate
// owner override -- and critically, it's stored completely independently
// of tebex_subscribers, so applying one to a server never touches (or
// even looks at) any buyer's real subscription, including the SAME
// person's if they're separately paying for a different server. Falls
// back to whichever real Tebex subscription (if any) is applied to this
// guild, then null (free tier) if neither.
function effectiveTierForGuild(guildId) {
  if (!guildId) return null;
  const manual = ManualTierGrants.get(guildId);
  if (manual) return TebexTiers.get(manual.tier_id);
  const subscriber = TebexSubscribers.forGuild(guildId);
  return subscriber ? TebexTiers.get(subscriber.tier_id) : null;
}

module.exports = { effectiveTierForGuild };
