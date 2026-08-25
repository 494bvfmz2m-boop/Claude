const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('change')
    .setDescription("Move this ticket to a different category (keeps all messages)")
    .toJSON(),
];

async function registerCommandsForGuild(guild) {
  try {
    await guild.commands.set(commands);
  } catch (err) {
    console.error(`Failed to register commands for guild ${guild.id}:`, err.message);
  }
}

async function registerAllGuildCommands(client) {
  await Promise.all([...client.guilds.cache.values()].map(registerCommandsForGuild));
}

module.exports = { registerAllGuildCommands, registerCommandsForGuild };
