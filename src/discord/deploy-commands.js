const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../config');

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

async function main() {
  if (!config.discordToken || !config.discordClientId) {
    console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env before registering commands.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);

  console.log(
    config.discordGuildId
      ? `Registering commands to guild ${config.discordGuildId} (instant)...`
      : 'Registering global commands (can take up to ~1 hour to propagate)...'
  );

  await rest.put(route, { body: commands });
  console.log('Done.');
}

main().catch((err) => {
  console.error('Failed to register commands:', err);
  process.exit(1);
});
