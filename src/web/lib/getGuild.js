const client = require('../../bot/client');
const { ChannelType } = require('discord.js');

async function getGuildOr404(req, res) {
  const guild = client.guilds.cache.get(req.params.guildId);
  if (!guild) {
    res.status(404).render('error', { message: 'The bot is not in that server (or it has not finished starting up yet).' });
    return null;
  }
  return guild;
}

const TEXTLIKE_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

function guildChannelOptions(guild) {
  const textChannels = [...guild.channels.cache.values()]
    .filter((c) => TEXTLIKE_TYPES.has(c.type))
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.type === ChannelType.GuildAnnouncement ? '📢' : '#',
    }));

  const voiceChannels = [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildVoice)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name, icon: '🔊' }));

  const categories = [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name }));

  const roles = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color !== 0 ? r.hexColor : '#99aab5',
      iconURL: r.iconURL({ size: 32 }) || null,
      unicodeEmoji: r.unicodeEmoji || null,
    }));

  return { textChannels, voiceChannels, categories, roles };
}

module.exports = { getGuildOr404, guildChannelOptions };
