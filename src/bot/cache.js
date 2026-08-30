const { GuildSettings, StaffRanks } = require('../db/repo');

// In-memory per-guild caches so the swear filter and role-hierarchy lookups
// don't hit SQLite on every single message / role change. Invalidated by the
// dashboard whenever the underlying settings are saved.
const swearFilterCache = new Map();
const linkFilterCache = new Map();
const staffRanksCache = new Map();

// Matches discord.gg/xxx and discord.com(app.com)/invite/xxx specifically,
// vs. INVITE_URL_REGEX -- kept as two patterns so "invites only" mode
// doesn't also catch a plain link to, say, a screenshot on Discord's CDN.
const INVITE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;
const ANY_URL_REGEX = /https?:\/\/\S+/i;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSwearFilter(guildId) {
  const settings = GuildSettings.get(guildId);
  const words = settings.swear_words.filter((w) => w && w.trim());
  const regex = settings.swear_filter_enabled && words.length > 0
    ? new RegExp(`\\b(${words.map(escapeRegExp).join('|')})\\b`, 'i')
    : null;
  return { enabled: settings.swear_filter_enabled, regex };
}

function getSwearFilter(guildId) {
  if (!swearFilterCache.has(guildId)) {
    swearFilterCache.set(guildId, buildSwearFilter(guildId));
  }
  return swearFilterCache.get(guildId);
}

function testSwearFilter(guildId, content) {
  const filter = getSwearFilter(guildId);
  if (!filter.enabled || !filter.regex || !content) return null;
  const match = filter.regex.exec(content);
  return match ? match[1] : null;
}

function invalidateSwearFilter(guildId) {
  swearFilterCache.delete(guildId);
}

function buildLinkFilter(guildId) {
  return { mode: GuildSettings.get(guildId).link_filter_mode };
}

function getLinkFilter(guildId) {
  if (!linkFilterCache.has(guildId)) {
    linkFilterCache.set(guildId, buildLinkFilter(guildId));
  }
  return linkFilterCache.get(guildId);
}

// Returns the matched link text, or null if nothing should be filtered.
function testLinkFilter(guildId, content) {
  const { mode } = getLinkFilter(guildId);
  if (mode === 'off' || !content) return null;
  const regex = mode === 'invites' ? INVITE_URL_REGEX : ANY_URL_REGEX;
  const match = regex.exec(content);
  return match ? match[0] : null;
}

function invalidateLinkFilter(guildId) {
  linkFilterCache.delete(guildId);
}

// Keyed by hierarchy ID, not guild ID -- a guild can run more than one
// named hierarchy now (see db/repo.js's Hierarchies), each with its own
// independent rank ladder.
function getStaffRanks(hierarchyId) {
  if (!staffRanksCache.has(hierarchyId)) {
    staffRanksCache.set(hierarchyId, StaffRanks.listForHierarchy(hierarchyId));
  }
  return staffRanksCache.get(hierarchyId);
}

function invalidateStaffRanks(hierarchyId) {
  staffRanksCache.delete(hierarchyId);
}

// Highest rank among a member's roles, within one hierarchy. Rank 0 means
// "not in this hierarchy" (holds none of its ranked roles). Placeholder
// (skip_promote) ranks are ignored here -- a member who holds a placeholder
// role alongside a real rank role should still be treated as that real rank,
// not the placeholder.
function getRankForRoleIds(hierarchyId, roleIds) {
  const ranks = getStaffRanks(hierarchyId);
  const roleIdSet = new Set(roleIds);
  let best = { rank: 0, roleId: null };
  for (const r of ranks) {
    if (r.skip_promote) continue;
    if (roleIdSet.has(r.role_id) && r.rank > best.rank) {
      best = { rank: r.rank, roleId: r.role_id };
    }
  }
  return best;
}

function getRoleIdForRank(hierarchyId, rank) {
  const ranks = getStaffRanks(hierarchyId);
  return ranks.find((r) => r.rank === rank)?.role_id || null;
}

function getMaxRank(hierarchyId) {
  const ranks = getStaffRanks(hierarchyId);
  return ranks.reduce((max, r) => Math.max(max, r.rank), 0);
}

// The ladder /promote and /demote actually step through -- excludes any
// rank marked skip_promote (a placeholder/divider role kept in the
// hierarchy for display, e.g. "-- Staff --" in the posted staff list, but
// never meant to be a real destination for promoting/demoting someone).
// Still ordered lowest to highest, same as getStaffRanks.
function getPromotableLadder(hierarchyId) {
  return getStaffRanks(hierarchyId).filter((r) => !r.skip_promote);
}

module.exports = {
  getSwearFilter, testSwearFilter, invalidateSwearFilter,
  getLinkFilter, testLinkFilter, invalidateLinkFilter,
  getStaffRanks, invalidateStaffRanks, getRankForRoleIds, getRoleIdForRank, getMaxRank, getPromotableLadder,
};
