const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
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

client.login(config.token);
