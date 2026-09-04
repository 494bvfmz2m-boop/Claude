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

// Best-effort guild ID out of a raw gateway event's first argument --
// covers every shape our feature listeners actually receive (a Message,
// Interaction, GuildMember, Channel, Role, VoiceState, a [oldX, newX] pair
// for *Update events, ...). Returns null for anything guild-less (a DM, a
// client-level Ready event) -- those never need guarding since there's no
// guild for two clients to disagree about owning.
function guildIdOf(arg) {
  if (!arg) return null;
  if (typeof arg.guildId === 'string') return arg.guildId;
  if (arg.guild && typeof arg.guild.id === 'string') return arg.guild.id;
  return null;
}

// The main bot is deliberately never kicked from a guild once a Custom-tier
// subscriber's own bot takes over for it (so it's ready to resume instantly
// if their subscription lapses -- see bot/tierEnforcement.js) -- but that
// means BOTH clients are simultaneously members of that guild, and each one
// independently runs the exact same registerAllFeatures() listeners. Without
// this, every guild-scoped feature (welcome messages, the swear filter,
// message logging, ...) would double-fire, once from each bot, the whole
// time a custom bot is connected.
//
// Wraps client.on/once so any listener whose event resolves to a guild ID
// only actually runs if THIS client is the one clientForGuild says owns
// that guild right now -- the other client's identical listener silently
// no-ops instead. A guild-less event (DMs, Ready, ...) is never filtered.
// Call once per client, before registering any feature listeners on it.
function guardClientEvents(client) {
  const originalOn = client.on.bind(client);
  const originalOnce = client.once.bind(client);
  const guard = (listener) => (...args) => {
    const guildId = guildIdOf(args[0]) ?? guildIdOf(args[1]);
    if (guildId && clientForGuild(guildId) !== client) return;
    return listener(...args);
  };
  client.on = (event, listener) => originalOn(event, guard(listener));
  client.once = (event, listener) => originalOnce(event, guard(listener));
}

// True if `client` is the one clientForGuild says should currently be
// handling this guild. For the timer-driven schedulers (polls, giveaways,
// reminders, scheduled announcements, stats channels) -- these don't go
// through client.on/once at all (they run on a plain setInterval sweeping
// every due row or every cached guild globally), so guardClientEvents
// above can't cover them; each one filters its own work with this instead.
function ownsGuild(client, guildId) {
  return Boolean(guildId) && clientForGuild(guildId) === client;
}

module.exports = { mainClient, registerCustomClient, unregisterCustomClient, clientForGuild, resolveGuild, allKnownGuilds, guardClientEvents, ownsGuild };
