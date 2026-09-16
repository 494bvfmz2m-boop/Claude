const { REST, Routes } = require('discord.js');
const config = require('../../src/config');

if (!config.token) {
  throw new Error('DISCORD_TOKEN is not set — the dashboard needs it to talk to the Discord API.');
}

const rest = new REST({ version: '10' }).setToken(config.token);

async function getBotGuilds() {
  return rest.get(Routes.userGuilds());
}

async function getGuild(guildId) {
  return rest.get(Routes.guild(guildId));
}

async function getGuildChannels(guildId) {
  return rest.get(Routes.guildChannels(guildId));
}

async function getGuildRoles(guildId) {
  return rest.get(Routes.guildRoles(guildId));
}

async function sendMessage(channelId, body) {
  return rest.post(Routes.channelMessages(channelId), { body });
}

async function editMessage(channelId, messageId, body) {
  return rest.patch(Routes.channelMessage(channelId, messageId), { body });
}

module.exports = { rest, getBotGuilds, getGuild, getGuildChannels, getGuildRoles, sendMessage, editMessage };
