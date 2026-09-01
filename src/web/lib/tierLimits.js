const { TebexSubscribers, TebexTiers } = require('../../db/repo');

// What a server gets with no subscription applied to it at all -- either
// nobody's ever bought a tier for it, or a subscription exists but hasn't
// been applied here (see routes/subscription.js's "choose a server" flow).
const FREE_LIMITS = {
  max_ticket_types: 1,
  max_reaction_role_panels: 1,
  max_tags: 3,
  max_scheduled_announcements: 1,
};

// A tier's numeric limits live in the SAME free-text "Features" field as
// its boolean feature flags (see staff.js's splitList) -- a limit is any
// entry shaped "key:number" (e.g. "max_ticket_types:10", or
// "max_ticket_types:-1" for unlimited); everything else is treated as a
// plain feature flag as before (custom_bot, priority_support, ...). This
// avoids a second admin UI just for numbers -- the owner edits one list.
function parseLimits(features) {
  const limits = {};
  for (const entry of features || []) {
    const match = /^([a-z0-9_]+):(-?\d+)$/i.exec(String(entry).trim());
    if (match) limits[match[1].toLowerCase()] = Number(match[2]);
  }
  return limits;
}

// The numeric limit for one key, on one specific guild -- resolved from
// whichever tier (if any) is actually applied THERE (TebexSubscribers.
// forGuild), not from whoever happens to be viewing the dashboard right
// now. A limit is a property of the server. Falls back to FREE_LIMITS when
// no subscription is applied to this guild. The owner's "preview as"
// override is the one exception -- it previews a tier's limits directly,
// independent of any real server, so the owner can see what a tier allows
// without needing a real subscription applied anywhere.
function limitFor(limitKey, guildId, session) {
  let tier = null;
  if (session?.isOwner && session?.previewTierId) {
    tier = TebexTiers.get(session.previewTierId);
  } else if (guildId) {
    const subscriber = TebexSubscribers.forGuild(guildId);
    tier = subscriber ? TebexTiers.get(subscriber.tier_id) : null;
  }
  const limits = parseLimits(tier?.features);
  if (limitKey in limits) {
    const n = limits[limitKey];
    return n < 0 ? Infinity : n;
  }
  return FREE_LIMITS[limitKey] ?? Infinity;
}

// True if creating one more of something would exceed the limit for this
// guild -- call with the count BEFORE the new one is added.
function limitReached(limitKey, guildId, currentCount, session) {
  return currentCount >= limitFor(limitKey, guildId, session);
}

module.exports = { FREE_LIMITS, parseLimits, limitFor, limitReached };
