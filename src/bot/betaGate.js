const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const config = require('../config');
const { AppSettings, BetaAllowlist } = require('../db/repo');
const { emojiUrl } = require('./emoji');

const JOIN_COLOR = '#5865F2';
const LEFT_COLOR = '#a32ee2';

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

// One DM to the owner for every single guildCreate, whatever the outcome --
// silent joins are how a compromised invite link or a slipped-through
// unverified server goes unnoticed for weeks.
async function notifyOwner(client, guild, { executor, status }) {
  if (!config.ownerDiscordId) return;

  const STATUS_COPY = {
    joined: { title: '➕ Joined a new server', color: JOIN_COLOR, note: null, footerIcon: emojiUrl('xyphros-radar.gif') },
    authorized: { title: '✅ Joined a new server (authorized)', color: JOIN_COLOR, note: null, footerIcon: emojiUrl('xyphros-radar.gif') },
    unverified: {
      title: '⚠️ Joined a new server (unverified)',
      color: '#d97706',
      note: "Couldn't identify who added me -- missing View Audit Log, the entry hasn't shown up yet, or it aged out. Closed beta is on, so I stayed rather than guess and kick someone legitimate. Worth a manual look.",
      footerIcon: emojiUrl('xyphros-warning.png'),
    },
    kicked: {
      title: '❌ Left a server (closed beta)',
      color: LEFT_COLOR,
      note: 'Whoever added me is not on the beta allowlist, so I left and told them how to request access.',
      footerIcon: emojiUrl('xyphros-cross.png'),
    },
  };
  const copy = STATUS_COPY[status];

  try {
    const owner = await client.users.fetch(config.ownerDiscordId);
    const embed = new EmbedBuilder()
      .setTitle(copy.title)
      .setColor(copy.color)
      .setThumbnail(guild.iconURL({ size: 128 }))
      .addFields(
        { name: 'Server', value: guild.name, inline: true },
        { name: 'Members', value: String(guild.memberCount || '?'), inline: true },
        { name: 'Server ID', value: guild.id, inline: false },
        { name: 'Added by', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unknown', inline: false },
      )
      .setTimestamp();
    if (copy.note) embed.setDescription(copy.note);
    if (copy.footerIcon) embed.setFooter({ text: status === 'unverified' ? 'Needs a manual look' : status === 'kicked' ? 'Access declined' : 'Watching this server', iconURL: copy.footerIcon });
    await owner.send({ embeds: [embed] }).catch(() => {});
  } catch {
    // can't reach the owner -- nothing more to do
  }
}

// The closed-beta lock (managed from /staff) previously only gated who
// could log into the dashboard -- it never actually stopped anyone from
// adding the bot to their own server via Discord's own public invite flow,
// which isn't aware of the allowlist at all. This makes the lock mean what
// it says: if it's on and whoever added the bot isn't the owner or on the
// allowlist, the bot leaves immediately (after explaining why). If we
// genuinely can't tell who added it (missing permission, expired audit log),
// that's NOT treated as unauthorized -- kicking the owner out of their own
// server because of a permissions gap is worse than an unverified server
// slipping through, so it stays and flags the owner instead.
//
// The owner gets exactly one DM per join either way (see notifyOwner above),
// regardless of whether closed beta is even on.
function register(client) {
  client.on('guildCreate', async (guild) => {
    const { found, executor } = await getInviter(guild);

    if (!AppSettings.get().betaLocked) {
      await notifyOwner(client, guild, { executor, status: 'joined' });
      return;
    }

    // Only a positive identification of an unauthorized inviter kicks the
    // bot out. "found but no entry yet" (a real possibility -- the audit
    // log entry isn't guaranteed to exist the instant guildCreate fires)
    // gets the same benefit of the doubt as "couldn't check at all".
    if (!found || !executor) {
      await notifyOwner(client, guild, { executor: null, status: 'unverified' });
      return;
    }

    if (isAuthorized(executor.id)) {
      await notifyOwner(client, guild, { executor, status: 'authorized' });
      return;
    }

    const message = `XyphrosMod is currently in closed beta and isn't accepting new servers right now. Message **${config.betaContactHandle}** on Discord if you'd like to be added to the beta list.`;
    await executor.send({ content: message }).catch(() => {});
    // Notify before leaving -- guild.memberCount/iconURL should stay readable
    // on the same object either way, but there's no reason to rely on that.
    await notifyOwner(client, guild, { executor, status: 'kicked' });
    await guild.leave().catch(() => {});
  });
}

module.exports = { register, isAuthorized };
