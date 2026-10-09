const { REST, Routes } = require('discord.js');
const config = require('./config');
const { getAllCommandData } = require('./handlers/commandHandler');
const { logger } = require('./utils/logger');

async function deployCommands() {
  if (!config.token || !config.clientId) {
    throw new Error('DISCORD_TOKEN and CLIENT_ID must be set before deploying commands.');
  }

  const commands = getAllCommandData();
  const rest = new REST().setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  logger.info(`Deploying ${commands.length} commands ${config.guildId ? `to guild ${config.guildId}` : 'globally'}...`);
  const data = await rest.put(route, { body: commands });
  logger.info(`Successfully deployed ${data.length} commands.`);
  return data;
}

if (require.main === module) {
  deployCommands().catch((err) => {
    logger.error('Failed to deploy commands:', err);
    process.exit(1);
  });
}

module.exports = { deployCommands };
