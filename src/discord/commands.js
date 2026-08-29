const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the ticket bot a question from the FAQ database')
    .addStringOption((option) =>
      option.setName('question').setDescription('What do you need help with?').setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('escalate')
    .setDescription('Ping the support team for this ticket')
    .addStringOption((option) =>
      option.setName('reason').setDescription('Briefly, what do you need help with?').setRequired(false)
    ),
].map((command) => command.toJSON());

module.exports = { commands };
