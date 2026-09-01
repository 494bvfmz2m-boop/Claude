// The single place anything (dashboard routes, middleware) asks "which
// discord.js Client actually serves guild X" -- the shared bot for every
// guild by default, or a Custom-tier subscriber's own bot once
// bot/customBots.js has it connected and registered here. Nothing outside
// this file and bot/customBots.js should track custom clients directly.
const mainClient = require('./client');

const customClientsByGuild = new Map(); // guildId -> live, ready discord.js Client

function registerCustomClient(guildId, client) {
  customClientsByGuild.set(guildId, client);
}

function unregisterCustomClient(guildId) {
  customClientsByGuild.delete(guildId);
}

// The Client to use for guild-scoped work (fetching channels/roles,
// posting messages, moderation actions) -- a connected custom bot if this
// guild has one, otherwise the shared main bot.
function clientForGuild(guildId) {
  return customClientsByGuild.get(guildId) || mainClient;
}

// guild.cache.get(guildId) using whichever client actually has it --
// getGuild.js's getGuildOr404 is the main caller.
function resolveGuild(guildId) {
  return clientForGuild(guildId).guilds.cache.get(guildId) || null;
}

// Every guild reachable through ANY connected bot (main + all live custom
// bots) -- dashboard.js's "your servers" list needs this instead of just
// the main client's cache, since a Custom-tier guild's main bot may no
// longer even be a member there.
function allKnownGuilds() {
  const seen = new Map();
  for (const g of mainClient.guilds.cache.values()) seen.set(g.id, g);
  for (const client of customClientsByGuild.values()) {
    for (const g of client.guilds.cache.values()) seen.set(g.id, g);
  }
  return [...seen.values()];
}

module.exports = { mainClient, registerCustomClient, unregisterCustomClient, clientForGuild, resolveGuild, allKnownGuilds };
