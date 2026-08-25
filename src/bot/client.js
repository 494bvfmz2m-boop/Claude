const { Client, GatewayIntentBits } = require('discord.js');

// Everything here runs off slash commands, so no privileged intents needed —
// nothing to toggle in the Discord Developer Portal.
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

module.exports = client;
