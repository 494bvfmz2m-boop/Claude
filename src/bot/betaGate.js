const { AuditLogEvent } = require('discord.js');
const config = require('../config');
const { AppSettings, BetaAllowlist } = require('../db/repo');

function isAuthorized(discordUserId) {
  if (!discordUserId) return false;
  if (config.ownerDiscordId && discordUserId === config.ownerDiscordId) return true;
  return BetaAllowlist.has(discordUserId);
}

// Best-effort -- needs the bot to have View Audit Log (granted by the invite
// link as of the permissions value above; a server invited before that
// change won't have it until re-authorized) and Discord only keeps these
// entries for a limited window. Returns { found, executor }: found is false
// whenever we genuinely can't tell who added it, which is a distinct case
// from "found nobody" (executor null with found true doesn't currently
// happen, but keeping the shape explicit avoids conflating "don't know"
// with "know it was nobody").
async function getInviter(guild) {
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 10 });
    const entry = logs.entries.find((e) => e.target?.id === guild.client.user.id);
    return { found: true, executor: entry?.executor || null };
  } catch {
    return { found: false, executor: null };
  }
}

// Lets the owner know a server joined that couldn't be verified, so they can
// check it manually -- silent failure here would mean unverified servers
// slip through with nobody ever finding out.
async function notifyOwnerUnverified(client, guild) {
  if (!config.ownerDiscordId) return;
  try {
    const owner = await client.users.fetch(config.ownerDiscordId);
    await owner.send({
      content: `⚠️ Quellum joined **${guild.name}** (${guild.id}) but couldn't identify who added it (missing View Audit Log, the entry hasn't shown up yet, or it aged out) -- closed beta is on, so I stayed rather than guess and kick someone legitimate. Worth a manual look.`,
    }).catch(() => {});
  } catch {
    // can't reach the owner -- nothing more to do
  }
}

// The closed-beta lock (managed from /admin) previously only gated who
// could log into the dashboard -- it never actually stopped anyone from
// adding the bot to their own server via Discord's own public invite flow,
// which isn't aware of the allowlist at all. This makes the lock mean what
// it says: if it's on and whoever added the bot isn't the owner or on the
// allowlist, the bot leaves immediately (after explaining why). If we
// genuinely can't tell who added it (missing permission, expired audit log),
// that's NOT treated as unauthorized -- kicking the owner out of their own
// server because of a permissions gap is worse than an unverified server
// slipping through, so it stays and flags the owner instead.
function register(client) {
  client.on('guildCreate', async (guild) => {
    if (!AppSettings.get().betaLocked) return;

    const { found, executor } = await getInviter(guild);

    // Only a positive identification of an unauthorized inviter kicks the
    // bot out. "found but no entry yet" (a real possibility -- the audit
    // log entry isn't guaranteed to exist the instant guildCreate fires)
    // gets the same benefit of the doubt as "couldn't check at all".
    if (!found || !executor) {
      await notifyOwnerUnverified(client, guild);
      return;
    }

    if (isAuthorized(executor.id)) return;

    const message = `Quellum is currently in closed beta and isn't accepting new servers right now. Message **${config.betaContactHandle}** on Discord if you'd like to be added to the beta list.`;
    await executor.send({ content: message }).catch(() => {});
    await guild.leave().catch(() => {});
  });
}

module.exports = { register, isAuthorized };
