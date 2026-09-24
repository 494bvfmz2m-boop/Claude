const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder,
} = require('discord.js');
const { getGuildSettings, updateGuildSettings, nextTicketNumber, db } = require('../database/db');
const { ticketPanelEmbed, ticketOpenEmbed, parseHexColor } = require('../utils/embeds');
const { isStaff } = require('../utils/permissions');
const { logger, sendToLogChannel } = require('../utils/logger');
const config = require('../config');

function panelRow(settings, withEmoji = true) {
  const button = new ButtonBuilder()
    .setCustomId('ticket_open')
    .setLabel(settings?.ticket_panel_button_label || 'Open Ticket')
    .setStyle(ButtonStyle.Primary);
  const emoji = settings?.ticket_panel_button_emoji;
  if (withEmoji) {
    try {
      button.setEmoji(emoji || '🎫');
    } catch {
      // Invalid/unsupported emoji text — fall through with no emoji rather than fail the whole panel.
    }
  }
  return new ActionRowBuilder().addComponents(button);
}

function ticketRow(claimed) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_claim').setLabel(claimed ? 'Claimed' : 'Claim').setEmoji('🙋').setStyle(ButtonStyle.Secondary).setDisabled(claimed),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  );
}

async function sendPanel(channel, settings) {
  const s = settings || getGuildSettings(channel.guild.id);
  const guildMeta = { name: channel.guild.name, iconURL: channel.guild.iconURL() ?? undefined };
  const embed = ticketPanelEmbed(s, guildMeta);
  try {
    await channel.send({ embeds: [embed], components: [panelRow(s, true)] });
  } catch (err) {
    // Most likely cause: an invalid/unsupported button emoji rejected by the API.
    // Retry once without it rather than leaving the panel unposted.
    logger.warn('Ticket panel send failed, retrying without the button emoji:', err.message);
    await channel.send({ embeds: [embed], components: [panelRow(s, false)] });
  }
}

async function handlePanelEditModalSubmit(interaction) {
  const title = interaction.fields.getTextInputValue('title').trim();
  const description = interaction.fields.getTextInputValue('description').trim();
  const buttonLabel = interaction.fields.getTextInputValue('button_label').trim();
  const buttonEmoji = interaction.fields.getTextInputValue('button_emoji').trim();
  const colorRaw = interaction.fields.getTextInputValue('color').trim();

  let colorHex = '#5865F2';
  if (colorRaw) {
    const parsed = parseHexColor(colorRaw);
    if (!parsed) {
      return interaction.reply({
        content: `"${colorRaw}" isn't a valid hex color — use a format like \`#5865F2\`. Run \`/ticketpanel edit\` again to retry (your other changes weren't saved).`,
        ephemeral: true,
      });
    }
    colorHex = parsed.hex;
  }

  const settings = updateGuildSettings(interaction.guild.id, {
    ticket_panel_title: title,
    ticket_panel_description: description,
    ticket_panel_button_label: buttonLabel,
    ticket_panel_button_emoji: buttonEmoji || null,
    ticket_panel_color: colorHex,
  });

  const guildMeta = { name: interaction.guild.name, iconURL: interaction.guild.iconURL() ?? undefined };
  await interaction.reply({
    content: 'Ticket panel updated — here\'s a preview. Run `/ticketpanel post` to (re)post it in a channel.',
    embeds: [ticketPanelEmbed(settings, guildMeta)],
    components: [panelRow(settings, true)],
    ephemeral: true,
  });
}

async function openTicket(interaction) {
  const settings = getGuildSettings(interaction.guild.id);
  if (!settings.ticket_category_id) {
    return interaction.reply({ content: 'Tickets are not configured yet. Ask an admin to run `/config tickets`.', ephemeral: true });
  }

  const existing = db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'").get(interaction.guild.id, interaction.user.id);
  if (existing) {
    return interaction.reply({ content: `You already have an open ticket: <#${existing.channel_id}>`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const ticketNumber = nextTicketNumber(interaction.guild.id);
  const overwrites = [
    { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
  ];
  if (settings.ticket_staff_role_id) {
    overwrites.push({ id: settings.ticket_staff_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  const channel = await interaction.guild.channels.create({
    name: `ticket-${ticketNumber}`,
    type: ChannelType.GuildText,
    parent: settings.ticket_category_id,
    permissionOverwrites: overwrites,
    topic: `Ticket #${ticketNumber} | Opened by ${interaction.user.tag} (${interaction.user.id})`,
  });

  db.prepare('INSERT INTO tickets (guild_id, channel_id, user_id, ticket_number, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(interaction.guild.id, channel.id, interaction.user.id, ticketNumber, 'open', Date.now());

  const mention = settings.ticket_staff_role_id ? `<@&${settings.ticket_staff_role_id}>` : '';
  await channel.send({ content: `${interaction.user} ${mention}`.trim(), embeds: [ticketOpenEmbed(interaction.user, ticketNumber)], components: [ticketRow(false)] });

  await interaction.editReply({ content: `Your ticket has been created: ${channel}` });
  await sendToLogChannel(interaction.client, settings.ticket_log_channel_id, new EmbedBuilder()
    .setColor(config.colors.info).setTitle('Ticket Opened').setDescription(`#${ticketNumber} by ${interaction.user} in ${channel}`).setTimestamp());
}

async function claimTicket(interaction) {
  const settings = getGuildSettings(interaction.guild.id);
  if (!isStaff(interaction.member, settings.ticket_staff_role_id)) {
    return interaction.reply({ content: 'Only staff can claim tickets.', ephemeral: true });
  }
  const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
  if (!ticket || ticket.status !== 'open') {
    return interaction.reply({ content: 'This ticket cannot be claimed.', ephemeral: true });
  }
  db.prepare('UPDATE tickets SET claimed_by = ? WHERE id = ?').run(interaction.user.id, ticket.id);
  await interaction.update({ components: [ticketRow(true)] });
  await interaction.followUp({ content: `🙋 ${interaction.user} has claimed this ticket.` });
}

async function requestClose(interaction) {
  const settings = getGuildSettings(interaction.guild.id);
  const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
  if (!ticket || ticket.status !== 'open') {
    return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });
  }
  const canClose = isStaff(interaction.member, settings.ticket_staff_role_id) || interaction.user.id === ticket.user_id;
  if (!canClose) {
    return interaction.reply({ content: 'You cannot close this ticket.', ephemeral: true });
  }
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
  await interaction.reply({ content: 'Are you sure you want to close this ticket? The channel will be deleted in 5 seconds after confirmation.', components: [row] });
}

async function confirmClose(interaction) {
  const settings = getGuildSettings(interaction.guild.id);
  const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);
  if (!ticket || ticket.status !== 'open') {
    return interaction.update({ content: 'This ticket is already closed.', components: [] });
  }
  db.prepare("UPDATE tickets SET status = 'closed', closed_at = ? WHERE id = ?").run(Date.now(), ticket.id);
  await interaction.update({ content: `🔒 Ticket closed by ${interaction.user}. Deleting channel...`, components: [] });

  await sendToLogChannel(interaction.client, settings.ticket_log_channel_id, new EmbedBuilder()
    .setColor(config.colors.danger).setTitle('Ticket Closed').setDescription(`#${ticket.ticket_number} closed by ${interaction.user}`).setTimestamp());

  setTimeout(() => {
    interaction.channel.delete().catch((err) => logger.error('Failed to delete ticket channel:', err.message));
  }, 5000);
}

async function cancelClose(interaction) {
  await interaction.update({ content: 'Ticket close cancelled.', components: [] });
}

module.exports = {
  sendPanel, openTicket, claimTicket, requestClose, confirmClose, cancelClose,
  panelRow, ticketRow, handlePanelEditModalSubmit,
};
