const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

function loadEvents(client) {
  const eventsDir = path.join(__dirname, '..', 'events');
  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const event = require(path.join(eventsDir, file));
    if (!event?.name || !event?.execute) {
      logger.warn(`Skipping invalid event file: ${file}`);
      continue;
    }
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
  logger.info(`Loaded ${files.length} event listeners.`);
}

module.exports = { loadEvents };
