const { REST, Routes } = require('discord.js');
const config = require('./config');
const { getAllCommandData } = require('./handlers/commandHandler');
const { logger } = require('./utils/logger');

async function main() {
  if (!config.token || !config.clientId) {
    logger.error('DISCORD_TOKEN and CLIENT_ID must be set in .env before deploying commands.');
    process.exit(1);
  }

  const commands = getAllCommandData();
  const rest = new REST().setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  logger.info(`Deploying ${commands.length} commands ${config.guildId ? `to guild ${config.guildId}` : 'globally'}...`);
  const data = await rest.put(route, { body: commands });
  logger.info(`Successfully deployed ${data.length} commands.`);
}

main().catch((err) => {
  logger.error('Failed to deploy commands:', err);
  process.exit(1);
});
