// Every Discord-event-driven feature module, wired onto whichever client
// is passed in. Used for the main bot (index.js) and identically for each
// live custom bot (bot/customBots.js) -- a customer's own bot gets the
// exact same feature set, just running on its own login instead of the
// shared one. Anything added here automatically applies to both.
const { register: registerInteractions } = require('./interactions');
const { registerAllGuildCommands, registerCommandsForGuild } = require('./commands');
const { register: registerSwearFilter } = require('./swearFilter');
const { register: registerLinkFilter } = require('./linkFilter');
const { register: registerStaffList, warmUpAndRefreshAll } = require('./staffList');
const { register: registerReactionRoles } = require('./reactionRoles');
const { register: registerDmGreeting } = require('./dmGreeting');
const { register: registerBetaGate } = require('./betaGate');
const { register: registerWelcome } = require('./welcome');
const { register: registerPollScheduler } = require('./pollScheduler');
const { register: registerMessageLog } = require('./messageLog');
const { register: registerGiveawayScheduler } = require('./giveawayScheduler');
const { register: registerAnnouncementScheduler } = require('./announcementScheduler');
const { register: registerStatsChannels } = require('./statsChannels');
const { register: registerAfk } = require('./afk');
const { register: registerReminderScheduler } = require('./reminderScheduler');
const { register: registerRoleTriggers } = require('./roleTriggers');
const { guardClientEvents } = require('./clientRegistry');
const { Events } = require('discord.js');

// onReady runs after the client logs in and its guild cache is populated --
// the main bot registers commands for every guild it's in; a custom bot
// (see customBots.js) instead only ever targets its one guild and handles
// that itself, so it's an optional hook rather than baked in here.
function registerAllFeatures(client, { onReady } = {}) {
  // Must come first -- every register*(client) call below attaches its
  // listeners through client.on/once, so they only take effect once this
  // has patched them to skip guilds a DIFFERENT client currently owns (see
  // clientRegistry.js's guardClientEvents for why that matters: the main
  // bot deliberately stays in a guild even after a custom bot takes over).
  guardClientEvents(client);

  registerInteractions(client);
  registerSwearFilter(client);
  registerLinkFilter(client);
  registerStaffList(client);
  registerReactionRoles(client);
  registerDmGreeting(client);
  registerBetaGate(client);
  registerWelcome(client);
  registerPollScheduler(client);
  registerMessageLog(client);
  registerGiveawayScheduler(client);
  registerAnnouncementScheduler(client);
  registerStatsChannels(client);
  registerAfk(client);
  registerReminderScheduler(client);
  registerRoleTriggers(client);

  client.once(Events.ClientReady, async () => {
    if (onReady) await onReady(client);
  });
}

module.exports = { registerAllFeatures, registerAllGuildCommands, registerCommandsForGuild, warmUpAndRefreshAll };
