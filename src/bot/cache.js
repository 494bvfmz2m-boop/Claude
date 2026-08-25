const { GuildSettings, StaffRanks } = require('../db/repo');

// In-memory per-guild caches so the swear filter and role-hierarchy lookups
// don't hit SQLite on every single message / role change. Invalidated by the
// dashboard whenever the underlying settings are saved.
const swearFilterCache = new Map();
const staffRanksCache = new Map();

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

function getStaffRanks(guildId) {
  if (!staffRanksCache.has(guildId)) {
    staffRanksCache.set(guildId, StaffRanks.listForGuild(guildId));
  }
  return staffRanksCache.get(guildId);
}

function invalidateStaffRanks(guildId) {
  staffRanksCache.delete(guildId);
}

// Highest rank among a member's roles. Rank 0 means "not staff" (holds none
// of the hierarchy roles).
function getRankForRoleIds(guildId, roleIds) {
  const ranks = getStaffRanks(guildId);
  const roleIdSet = new Set(roleIds);
  let best = { rank: 0, roleId: null };
  for (const r of ranks) {
    if (roleIdSet.has(r.role_id) && r.rank > best.rank) {
      best = { rank: r.rank, roleId: r.role_id };
    }
  }
  return best;
}

function getRoleIdForRank(guildId, rank) {
  const ranks = getStaffRanks(guildId);
  return ranks.find((r) => r.rank === rank)?.role_id || null;
}

function getMaxRank(guildId) {
  const ranks = getStaffRanks(guildId);
  return ranks.reduce((max, r) => Math.max(max, r.rank), 0);
}

module.exports = {
  getSwearFilter, testSwearFilter, invalidateSwearFilter,
  getStaffRanks, invalidateStaffRanks, getRankForRoleIds, getRoleIdForRank, getMaxRank,
};
