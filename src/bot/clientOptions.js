const { GatewayIntentBits, Partials } = require('discord.js');

// Shared by the main bot (bot/client.js) and every custom bot
// (bot/customBots.js) -- a custom bot needs the exact same intents/partials
// since it runs the exact same feature set (registerAllFeatures).
const CLIENT_OPTIONS = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // needed for the staff list + promote/demote to see current roles reliably
    GatewayIntentBits.GuildMessageReactions, // needed for reaction roles
    GatewayIntentBits.DirectMessages, // needed for the DM greeting -- not privileged, no portal toggle required
    GatewayIntentBits.GuildPresences, // needed for the online-count stats channel
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
};

module.exports = { CLIENT_OPTIONS };
