const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../database/db');
const { antiRaidAlertEmbed } = require('../utils/embeds');
const { logger, sendToLogChannel } = require('../utils/logger');
const config = require('../config');

const RAID_MODE_DURATION_MS = 10 * 60 * 1000;

const recentJoins = new Map();
const raidModeExpiry = new Map();

async function handleJoin(member) {
  const settings = getGuildSettings(member.guild.id);
  if (!settings.antiraid_enabled) return false;

  const now = Date.now();
  const guildId = member.guild.id;

  const joins = (recentJoins.get(guildId) || []).filter((t) => now - t < settings.antiraid_join_window_ms);
  joins.push(now);
  recentJoins.set(guildId, joins);

  const wasAlreadyInRaidMode = (raidModeExpiry.get(guildId) || 0) > now;
  if (!wasAlreadyInRaidMode && joins.length >= settings.antiraid_join_threshold) {
    raidModeExpiry.set(guildId, now + RAID_MODE_DURATION_MS);
    await sendToLogChannel(member.client, settings.log_channel_id, antiRaidAlertEmbed({
      reason: `Join burst detected: ${joins.length} members joined within ${Math.round(settings.antiraid_join_window_ms / 1000)}s.`,
      action: `Raid protection enabled for 10 minutes. New joins will be ${settings.antiraid_action}ed automatically.`,
      memberCount: joins.length,
    }));
    logger.warn(`Anti-raid triggered in guild ${guildId}: ${joins.length} joins in window.`);
  }

  const inRaidMode = (raidModeExpiry.get(guildId) || 0) > now;
  const accountAgeDays = (now - member.user.createdTimestamp) / 86400000;
  const accountTooNew = accountAgeDays < settings.antiraid_min_account_age_days;

  if (!inRaidMode && !accountTooNew) return false;

  const reason = accountTooNew
    ? `Anti-raid: account created ${accountAgeDays.toFixed(1)} days ago (minimum ${settings.antiraid_min_account_age_days})`
    : 'Anti-raid: raid protection currently active';

  try {
    if (settings.antiraid_action === 'ban') {
      await member.ban({ reason });
    } else {
      await member.kick(reason);
    }
    await sendToLogChannel(member.client, settings.log_channel_id, new EmbedBuilder()
      .setColor(config.colors.danger)
      .setTitle('Anti-Raid Action')
      .setDescription(`${settings.antiraid_action === 'ban' ? 'Banned' : 'Kicked'} ${member.user.tag} (${member.id})\n**Reason:** ${reason}`)
      .setTimestamp());
    return true;
  } catch (err) {
    logger.error(`Anti-raid action failed for ${member.id}:`, err.message);
    return false;
  }
}

module.exports = { handleJoin };
