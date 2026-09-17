const { ActivityType, Events } = require('discord.js');
const { logger } = require('../utils/logger');
const { startGiveawayChecker } = require('../handlers/giveawayManager');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`Logged in as ${client.user.tag} (${client.guilds.cache.size} guilds).`);
    // Discord doesn't expose a "Browsing" activity type to bots (only Playing/
    // Streaming/Listening/Watching/Competing/Custom) — Custom is the one that
    // shows plain text with no verb prefix, so it renders exactly as typed.
    client.user.setPresence({
      activities: [{ name: 'Custom Status', type: ActivityType.Custom, state: 'browsing 3d prints' }],
      status: 'online',
    });
    startGiveawayChecker(client);
  },
};
