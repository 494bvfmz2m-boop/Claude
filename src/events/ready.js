const { ActivityType, Events } = require('discord.js');
const { logger } = require('../utils/logger');
const { startGiveawayChecker } = require('../handlers/giveawayManager');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`Logged in as ${client.user.tag} (${client.guilds.cache.size} guilds).`);
    client.user.setPresence({
      activities: [{ name: '/config | dashboard online', type: ActivityType.Watching }],
      status: 'online',
    });
    startGiveawayChecker(client);
  },
};
