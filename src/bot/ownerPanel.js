const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { Tickets } = require('../db/repo');

const OWNER_COLOR = '#a8e6ff';
const MAX_FIELDS = 24; // leave room for a "+N more" field under Discord's 25-field cap

function totalMembers(client) {
  return [...client.guilds.cache.values()].reduce((sum, g) => sum + (g.memberCount || 0), 0);
}

function totalOpenTickets(client) {
  return [...client.guilds.cache.values()].reduce((sum, g) => sum + Tickets.countOpenForGuild(g.id), 0);
}

// The extra panel only the owner gets when they DM the bot -- a snapshot of
// how the whole install is doing, plus a button to drill into the server
// list, instead of the generic "invite me" pitch everyone else sees.
function buildOwnerPanelEmbed(client) {
  const guilds = [...client.guilds.cache.values()];
  return new EmbedBuilder()
    .setTitle('🛠️ ModSentry — owner panel')
    .setColor(OWNER_COLOR)
    .addFields(
      { name: 'Servers', value: String(guilds.length), inline: true },
      { name: 'Members reached', value: totalMembers(client).toLocaleString(), inline: true },
      { name: 'Open tickets', value: String(totalOpenTickets(client)), inline: true },
      { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
    )
    .setFooter({ text: 'DM me "help" to see every keyword — a direct answer instead of this panel.' });
}

function buildOwnerPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('owner_server_list').setLabel('📋 Server list').setStyle(ButtonStyle.Secondary),
  );
}

// Best-effort -- needs Create Instant Invite in at least one viewable channel,
// which older servers won't have until ModSentry is re-authorized with the
// current invite link (same caveat as View Audit Log). Falls back to no link
// per-server rather than failing the whole list.
async function getInviteLink(guild) {
  const me = guild.members.me;
  if (!me) return null;
  const channel = guild.channels.cache.find(
    (c) => c.isTextBased() && !c.isThread() && c.viewable
      && c.permissionsFor(me)?.has(PermissionFlagsBits.CreateInstantInvite),
  );
  if (!channel) return null;
  try {
    const invite = await channel.createInvite({ maxAge: 86400, unique: false, reason: 'Owner panel server list' });
    return invite.url;
  } catch {
    return null;
  }
}

// One embed listing every server ModSentry is in, each with member count, open
// tickets, and (when possible) a working invite link -- capped at
// MAX_FIELDS so a large install still fits in one embed instead of erroring.
async function buildServerListEmbed(client) {
  const guilds = [...client.guilds.cache.values()].sort((a, b) => b.memberCount - a.memberCount);
  const shown = guilds.slice(0, MAX_FIELDS);
  const invites = await Promise.all(shown.map((g) => getInviteLink(g)));

  const embed = new EmbedBuilder()
    .setTitle(`📋 Servers (${guilds.length})`)
    .setColor(OWNER_COLOR);

  shown.forEach((g, i) => {
    const openTickets = Tickets.countOpenForGuild(g.id);
    const lines = [
      `${g.memberCount.toLocaleString()} members${openTickets > 0 ? ` · ${openTickets} open ticket${openTickets === 1 ? '' : 's'}` : ''}`,
      `\`${g.id}\``,
      invites[i] ? `[Invite link](${invites[i]})` : "No invite permission (needs re-authorizing with the current invite link)",
    ];
    embed.addFields({ name: g.name, value: lines.join('\n') });
  });

  if (guilds.length > shown.length) {
    embed.setFooter({ text: `+${guilds.length - shown.length} more not shown` });
  }

  return embed;
}

module.exports = { buildOwnerPanelEmbed, buildOwnerPanelRow, buildServerListEmbed };
