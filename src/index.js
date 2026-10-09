const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { deployCommands } = require('./deploy-commands');
const { logger } = require('./utils/logger');

if (!config.token) {
  logger.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

loadCommands(client);
loadEvents(client);

process.on('unhandledRejection', (err) => logger.error('Unhandled promise rejection:', err));
process.on('uncaughtException', (err) => logger.error('Uncaught exception:', err));

(async () => {
  // Registers slash commands with Discord on every boot, so this never depends
  // on someone manually running deploy-commands.js (e.g. no shell access into
  // a host's container). Failure here shouldn't block the bot from otherwise
  // coming online — it just means commands stay whatever they were last time.
  try {
    await deployCommands();
  } catch (err) {
    logger.error('Automatic slash command deployment failed (bot will still start):', err.message);
  }
  await client.login(config.token);
})();
