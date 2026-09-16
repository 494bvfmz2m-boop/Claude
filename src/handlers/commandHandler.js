const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const { logger } = require('../utils/logger');

function loadCommands(client) {
  client.commands = new Collection();
  const commandsDir = path.join(__dirname, '..', 'commands');
  const categories = fs.readdirSync(commandsDir).filter((f) => fs.statSync(path.join(commandsDir, f)).isDirectory());

  for (const category of categories) {
    const categoryDir = path.join(commandsDir, category);
    const files = fs.readdirSync(categoryDir).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const command = require(path.join(categoryDir, file));
      if (!command?.data || !command?.execute) {
        logger.warn(`Skipping invalid command file: ${category}/${file}`);
        continue;
      }
      client.commands.set(command.data.name, command);
    }
  }
  logger.info(`Loaded ${client.commands.size} slash commands.`);
  return client.commands;
}

function getAllCommandData() {
  const client = { commands: new Collection() };
  loadCommands(client);
  return [...client.commands.values()].map((c) => c.data.toJSON());
}

module.exports = { loadCommands, getAllCommandData };
