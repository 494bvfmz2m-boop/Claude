const { EmbedBuilder } = require('discord.js');
const config = require('../config');

function fillTemplate(template, member) {
  const guild = member.guild;
  return template
    .replaceAll('{user}', `${member}`)
    .replaceAll('{username}', member.user?.username ?? member.username ?? 'unknown')
    .replaceAll('{server}', guild.name)
    .replaceAll('{membercount}', String(guild.memberCount));
}

function welcomeEmbed(member, template) {
  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setAuthor({ name: `Welcome to ${member.guild.name}!`, iconURL: member.guild.iconURL() ?? undefined })
    .setDescription(fillTemplate(template, member))
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();
}

function leaveEmbed(member, template) {
  return new EmbedBuilder()
    .setColor(config.colors.danger)
    .setAuthor({ name: `Goodbye from ${member.guild.name}`, iconURL: member.guild.iconURL() ?? undefined })
    .setDescription(fillTemplate(template, member))
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();
}

function parseHexColor(input) {
  if (!input) return null;
  const match = /^#?([0-9a-fA-F]{6})$/.exec(String(input).trim());
  if (!match) return null;
  return { hex: `#${match[1].toUpperCase()}`, int: parseInt(match[1], 16) };
}

// settings: the guild_settings row (or a subset with the ticket_panel_* fields).
// guildMeta: optional { name, iconURL } for the footer — the bot passes the live
// Guild's values, the dashboard (which only has REST guild data) passes its own.
function ticketPanelEmbed(settings, guildMeta) {
  const parsedColor = parseHexColor(settings?.ticket_panel_color);
  const embed = new EmbedBuilder()
    .setColor(parsedColor ? parsedColor.int : config.colors.primary)
    .setTitle(settings?.ticket_panel_title || '🎫 Support Tickets')
    .setDescription(settings?.ticket_panel_description || 'Need help, have a question, or want to report an issue? Click the button below to open a private ticket with our staff team.');
  if (guildMeta?.name) embed.setFooter({ text: guildMeta.name, iconURL: guildMeta.iconURL || undefined });
  return embed;
}

function ticketOpenEmbed(user, ticketNumber) {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`Ticket #${ticketNumber}`)
    .setDescription(`Hi ${user}, thanks for reaching out! Support staff will be with you shortly.\n\nUse the buttons below to **claim** or **close** this ticket.`)
    .setTimestamp();
}

function modLogEmbed({ action, target, moderator, reason }) {
  return new EmbedBuilder()
    .setColor(config.colors.warning)
    .setTitle(`Moderation Action: ${action}`)
    .addFields(
      { name: 'Target', value: `${target} (${target.id ?? target.tag ?? 'unknown'})`, inline: true },
      { name: 'Moderator', value: `${moderator}`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided' },
    )
    .setTimestamp();
}

function giveawayEmbed({ prize, winnerCount, endTime, hostId, entryCount }) {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('🎉 Giveaway 🎉')
    .setDescription(
      `**Prize:** ${prize}\n` +
      `**Winners:** ${winnerCount}\n` +
      `**Hosted by:** <@${hostId}>\n` +
      `**Ends:** <t:${Math.floor(endTime / 1000)}:R> (<t:${Math.floor(endTime / 1000)}:f>)\n` +
      `**Entries:** ${entryCount}\n\n` +
      `Click 🎉 below to enter!`
    )
    .setTimestamp(endTime);
}

function giveawayEndedEmbed({ prize, winnerCount, hostId, winners }) {
  const description = winners.length
    ? `**Winner${winners.length > 1 ? 's' : ''}:** ${winners.map((w) => `<@${w}>`).join(', ')}\n**Hosted by:** <@${hostId}>`
    : `Nobody entered the giveaway, so no winner could be chosen.\n**Hosted by:** <@${hostId}>`;
  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setTitle('🎉 Giveaway Ended 🎉')
    .setDescription(`**Prize:** ${prize}\n**Winners requested:** ${winnerCount}\n\n${description}`)
    .setTimestamp();
}

function orderEmbed({ orderRef, customer, product, amount, status }) {
  const statusColors = { received: config.colors.info, paid: config.colors.success, fulfilled: config.colors.success, cancelled: config.colors.danger, refunded: config.colors.warning };
  return new EmbedBuilder()
    .setColor(statusColors[status] ?? config.colors.primary)
    .setTitle('🛒 New Order Received')
    .addFields(
      { name: 'Order Ref', value: `\`${orderRef}\``, inline: true },
      { name: 'Status', value: status, inline: true },
      { name: '​', value: '​', inline: true },
      { name: 'Customer', value: customer || 'N/A', inline: true },
      { name: 'Product', value: product || 'N/A', inline: true },
      { name: 'Amount', value: amount || 'N/A', inline: true },
    )
    .setTimestamp();
}

function antiRaidAlertEmbed({ reason, action, memberCount }) {
  return new EmbedBuilder()
    .setColor(config.colors.danger)
    .setTitle('🚨 Anti-Raid Triggered')
    .setDescription(`${reason}\n\n**Action taken:** ${action}\n**Members affected:** ${memberCount}`)
    .setTimestamp();
}

module.exports = {
  welcomeEmbed,
  leaveEmbed,
  ticketPanelEmbed,
  ticketOpenEmbed,
  modLogEmbed,
  giveawayEmbed,
  giveawayEndedEmbed,
  orderEmbed,
  antiRaidAlertEmbed,
  parseHexColor,
};
