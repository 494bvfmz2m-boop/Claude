const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // needed for the staff list + promote/demote to see current roles reliably
  ],
  partials: [Partials.Channel, Partials.Message],
});

module.exports = client;
