const { EmbedBuilder, Events } = require('discord.js');
const { getStaffRanks } = require('./cache');
const { GuildSettings } = require('../db/repo');

const DEBOUNCE_MS = 3000;
const timers = new Map(); // guildId -> Timeout

async function renderStaffList(guild) {
  const settings = GuildSettings.get(guild.id);
  if (!settings.staff_list_channel_id) return;

  const ranks = getStaffRanks(guild.id);
  if (ranks.length === 0) return;

  const channel = await guild.channels.fetch(settings.staff_list_channel_id).catch(() => null);
  if (!channel) return;

  // Highest rank first for display.
  const sorted = [...ranks].sort((a, b) => b.rank - a.rank);
  const fields = sorted.map((r) => {
    const role = guild.roles.cache.get(r.role_id);
    const members = role ? [...role.members.values()] : [];
    const list = members.length > 0 ? members.map((m) => `<@${m.id}>`).join('\n') : '*Nobody*';
    return { name: role ? role.name : `Unknown role (${r.role_id})`, value: list, inline: true };
  });

  const embed = new EmbedBuilder()
    .setTitle('👮 Staff List')
    .setColor('#5865F2')
    .addFields(fields)
    .setTimestamp()
    .setFooter({ text: 'Auto-updates when staff roles change' });

  if (settings.staff_list_message_id) {
    const existing = await channel.messages.fetch(settings.staff_list_message_id).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [embed] }).catch(() => {});
      return;
    }
  }

  const sent = await channel.send({ embeds: [embed] }).catch(() => null);
  if (sent) GuildSettings.setStaffListMessage(guild.id, sent.id);
}

function scheduleRefresh(guild) {
  if (timers.has(guild.id)) clearTimeout(timers.get(guild.id));
  timers.set(guild.id, setTimeout(() => {
    timers.delete(guild.id);
    renderStaffList(guild).catch(() => {});
  }, DEBOUNCE_MS));
}

function trackedRoleChanged(guildId, oldRoleIds, newRoleIds) {
  const ranks = getStaffRanks(guildId);
  if (ranks.length === 0) return false;
  const trackedIds = new Set(ranks.map((r) => r.role_id));
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
    const settings = GuildSettings.get(guild.id);
    if (!settings.staff_list_channel_id) continue;
    await guild.members.fetch().catch(() => {});
    scheduleRefresh(guild);
  }
}

module.exports = { register, warmUpAndRefreshAll, renderStaffList };
