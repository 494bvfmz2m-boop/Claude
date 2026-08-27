const { EmbedBuilder, Events } = require('discord.js');
const { getStaffRanks } = require('./cache');
const { Hierarchies } = require('../db/repo');

const DEBOUNCE_MS = 3000;
const timers = new Map(); // guildId -> Timeout

async function renderHierarchyList(guild, hierarchy) {
  if (!hierarchy.channel_id) return;

  const ranks = getStaffRanks(hierarchy.id);
  if (ranks.length === 0) return;

  const channel = await guild.channels.fetch(hierarchy.channel_id).catch(() => null);
  if (!channel) return;

  // Highest rank first for display.
  const sorted = [...ranks].sort((a, b) => b.rank - a.rank);
  // "Only show highest" -- a member holding more than one ranked role in
  // this hierarchy is listed once, under the first (highest) section that
  // covers them, and skipped from every lower section.
  const shown = new Set();
  const fields = sorted.map((r) => {
    const role = guild.roles.cache.get(r.role_id);
    let members = role ? [...role.members.values()] : [];
    if (hierarchy.only_show_highest) {
      members = members.filter((m) => !shown.has(m.id));
      members.forEach((m) => shown.add(m.id));
    }
    const list = members.length > 0 ? members.map((m) => `<@${m.id}>`).join('\n') : '*Nobody*';
    return { name: role ? role.name : `Unknown role (${r.role_id})`, value: list, inline: false };
  });

  const embed = new EmbedBuilder()
    .setTitle(`👮 ${hierarchy.name}`)
    .setColor(hierarchy.color || '#a8e6ff')
    .addFields(fields)
    .setTimestamp()
    .setFooter({ text: 'Auto-updates when tracked roles change' });

  if (hierarchy.message_id) {
    const existing = await channel.messages.fetch(hierarchy.message_id).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [embed] }).catch(() => {});
      return;
    }
  }

  const sent = await channel.send({ embeds: [embed] }).catch(() => null);
  if (sent) Hierarchies.setListMessage(hierarchy.id, sent.id);
}

async function renderStaffList(guild) {
  for (const hierarchy of Hierarchies.listForGuild(guild.id)) {
    await renderHierarchyList(guild, hierarchy);
  }
}

function scheduleRefresh(guild) {
  if (timers.has(guild.id)) clearTimeout(timers.get(guild.id));
  timers.set(guild.id, setTimeout(() => {
    timers.delete(guild.id);
    renderStaffList(guild).catch(() => {});
  }, DEBOUNCE_MS));
}

function trackedRoleChanged(guildId, oldRoleIds, newRoleIds) {
  const hierarchies = Hierarchies.listForGuild(guildId);
  if (hierarchies.length === 0) return false;
  const trackedIds = new Set();
  for (const h of hierarchies) {
    for (const r of getStaffRanks(h.id)) trackedIds.add(r.role_id);
  }
  if (trackedIds.size === 0) return false;
  for (const id of oldRoleIds) if (trackedIds.has(id) && !newRoleIds.has(id)) return true;
  for (const id of newRoleIds) if (trackedIds.has(id) && !oldRoleIds.has(id)) return true;
  return false;
}

function register(client) {
  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    const oldRoles = new Set(oldMember.roles.cache.keys());
    const newRoles = new Set(newMember.roles.cache.keys());
    if (trackedRoleChanged(newMember.guild.id, oldRoles, newRoles)) {
      scheduleRefresh(newMember.guild);
    }
  });

  client.on(Events.GuildMemberRemove, (member) => {
    const roleIds = new Set(member.roles?.cache?.keys() || []);
    if (trackedRoleChanged(member.guild.id, roleIds, new Set())) {
      scheduleRefresh(member.guild);
    }
  });
}

// Only warms the member cache (needed for role.members to be accurate) for
// guilds that actually use this feature — no point paying that cost otherwise.
async function warmUpAndRefreshAll(client) {
  for (const guild of client.guilds.cache.values()) {
    const hierarchies = Hierarchies.listForGuild(guild.id);
    if (!hierarchies.some((h) => h.channel_id)) continue;
    await guild.members.fetch().catch(() => {});
    scheduleRefresh(guild);
  }
}

module.exports = { register, warmUpAndRefreshAll, renderStaffList, renderHierarchyList };
