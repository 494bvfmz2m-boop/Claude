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

function guildChannelOptions(guild) {
  const textChannels = [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildText)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name }));

  const categories = [...guild.channels.cache.values()]
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name }));

  const roles = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name }));

  return { textChannels, categories, roles };
}

module.exports = { getGuildOr404, guildChannelOptions };
