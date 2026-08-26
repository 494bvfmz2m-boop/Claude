const { AuditLogEvent } = require('discord.js');
const config = require('../config');
const { AppSettings, BetaAllowlist } = require('../db/repo');

function isAuthorized(discordUserId) {
  if (!discordUserId) return false;
  if (config.ownerDiscordId && discordUserId === config.ownerDiscordId) return true;
  return BetaAllowlist.has(discordUserId);
}

// Best-effort -- needs the bot to have View Audit Log (it does, by default,
// via the invite permissions), and Discord only keeps these entries for a
// limited window. If we can't determine who added it, that itself isn't
// good enough reason to stay: closed beta means unverified installs don't
// get to keep the bot.
async function getInviter(guild) {
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 10 });
    const entry = logs.entries.find((e) => e.target?.id === guild.client.user.id);
    return entry?.executor || null;
  } catch {
    return null;
  }
}

// The closed-beta lock (managed from /admin) previously only gated who
// could log into the dashboard -- it never actually stopped anyone from
// adding the bot to their own server via Discord's own public invite flow,
// which isn't aware of the allowlist at all. This makes the lock mean what
// it says: if it's on and whoever added the bot isn't the owner or on the
// allowlist, the bot leaves immediately (after explaining why, if we can
// tell who to explain it to).
function register(client) {
  client.on('guildCreate', async (guild) => {
    if (!AppSettings.get().betaLocked) return;

    const inviter = await getInviter(guild);
    if (inviter && isAuthorized(inviter.id)) return;

    const message = `Quellum is currently in closed beta and isn't accepting new servers right now. Message **${config.betaContactHandle}** on Discord if you'd like to be added to the beta list.`;
    if (inviter) {
      await inviter.send({ content: message }).catch(() => {});
    }
    await guild.leave().catch(() => {});
  });
}

module.exports = { register, isAuthorized };
