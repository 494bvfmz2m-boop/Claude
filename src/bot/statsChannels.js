const { Events } = require('discord.js');
const { GuildSettings } = require('../db/repo');
const { ownsGuild } = require('./clientRegistry');

// Discord rate-limits channel renames to about 2 per 10 minutes per channel,
// so this runs on a slow interval rather than reacting to every join/leave --
// an event-driven updater would just get rate-limited and silently drop most
// of its own renames.
const UPDATE_INTERVAL_MS = 10 * 60 * 1000;

// Skips the rename when the name is already right -- an unchanged count still
// spends rename budget otherwise, and a rate-limited rename stalls the whole
// sweep (every other guild waits behind it).
async function renameIfChanged(channel, name) {
  if (channel && channel.name !== name) await channel.setName(name).catch(() => {});
}

async function updateGuildStats(guild) {
  const settings = GuildSettings.get(guild.id);
  if (!settings.stats_members_channel_id && !settings.stats_online_channel_id && !settings.stats_boosts_channel_id) return;

  if (settings.stats_members_channel_id) {
    const channel = await guild.channels.fetch(settings.stats_members_channel_id).catch(() => null);
    await renameIfChanged(channel, `Members: ${guild.memberCount}`);
  }

  if (settings.stats_online_channel_id) {
    const channel = await guild.channels.fetch(settings.stats_online_channel_id).catch(() => null);
    if (channel) {
      // Presence data only exists for members already in the cache with the
      // Presences intent -- a guild that's never warmed its member cache
      // shows 0 rather than fetching everyone just for this number.
      const online = guild.members.cache.filter((m) => m.presence && m.presence.status !== 'offline').size;
      await renameIfChanged(channel, `Online: ${online}`);
    }
  }

  if (settings.stats_boosts_channel_id) {
    const channel = await guild.channels.fetch(settings.stats_boosts_channel_id).catch(() => null);
    await renameIfChanged(channel, `Boosts: ${guild.premiumSubscriptionCount || 0}`);
  }
}

async function updateAllGuilds(client) {
  // Both the main bot and a guild's own custom bot are simultaneously
  // members and would otherwise both try to rename the same stats
  // channels -- besides being pointless duplicate work, that burns through
  // Discord's tight per-channel rename rate limit twice as fast.
  for (const guild of client.guilds.cache.values()) {
    if (!ownsGuild(client, guild.id)) continue;
    await updateGuildStats(guild).catch((err) => console.error(`Stats channel update failed for ${guild.id}:`, err.message));
  }
}

// Presence data only arrives for members the client is actively tracking --
// a guild that's never fetched its members won't have any, so the online
// count would silently read ~0 forever without this.
async function warmPresences(client) {
  for (const guild of client.guilds.cache.values()) {
    if (!ownsGuild(client, guild.id)) continue;
    const settings = GuildSettings.get(guild.id);
    if (!settings.stats_online_channel_id) continue;
    await guild.members.fetch({ withPresences: true }).catch(() => {});
  }
}

function register(client) {
  client.once(Events.ClientReady, async () => {
    await warmPresences(client);
    updateAllGuilds(client);
    setInterval(() => updateAllGuilds(client), UPDATE_INTERVAL_MS);
  });
}

module.exports = { register, updateGuildStats };
