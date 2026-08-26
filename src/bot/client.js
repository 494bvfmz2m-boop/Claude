const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // needed for the staff list + promote/demote to see current roles reliably
    GatewayIntentBits.GuildMessageReactions, // needed for reaction roles
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
});

module.exports = client;
