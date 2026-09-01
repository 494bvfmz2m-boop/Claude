const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { TicketTypes, Tickets, GuildSettings, GlobalBlocklist } = require('../db/repo');
const { buildTranscript } = require('./transcript');
const { emojiUrl } = require('./emoji');

function sanitizeForChannelName(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80);
}

function ticketControlsRow(ticketDbId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_claim:${ticketDbId}`).setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('🙋'),
    new ButtonBuilder().setCustomId(`ticket_close:${ticketDbId}`).setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
  );
}

async function getLogChannel(guild) {
  const settings = GuildSettings.get(guild.id);
  if (!settings.transcript_channel_id) return null;
  return guild.channels.fetch(settings.transcript_channel_id).catch(() => null);
}

async function openTicket(interaction, ticketTypeId) {
  const ticketType = TicketTypes.get(ticketTypeId);
  if (!ticketType) {
    return interaction.reply({ content: 'This ticket type no longer exists. Ask an admin to check the dashboard.', ephemeral: true });
  }

  if (GlobalBlocklist.has(interaction.user.id)) {
    return interaction.reply({ content: "You're not able to use XyphrosMod.", ephemeral: true });
  }

  const settings = GuildSettings.get(interaction.guildId);
  if (settings.ticket_banned_role_id && interaction.member?.roles?.cache?.has(settings.ticket_banned_role_id)) {
    return interaction.reply({ content: "You've been banned from opening tickets in this server.", ephemeral: true });
  }

  const openCount = Tickets.countOpenForUser(interaction.guildId, ticketTypeId, interaction.user.id);
  if (openCount >= ticketType.max_open_per_user) {
    return interaction.reply({ content: `You already have ${openCount} open ticket(s) of this type. Close it before opening another.`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const everyoneId = guild.roles.everyone.id;

  const overwrites = [
    { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
    },
    {
      id: guild.members.me.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
    },
    ...ticketType.support_role_ids.map((roleId) => ({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
    })),
  ];

  const name = sanitizeForChannelName(
    (ticketType.name_pattern || 'ticket-{username}')
      .replace('{username}', interaction.user.username)
      .replace('{id}', interaction.user.id),
  );

  let channel;
  try {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: ticketType.category_channel_id || undefined,
      permissionOverwrites: overwrites,
      topic: `Ticket opened by ${interaction.user.tag} (${interaction.user.id}) — type: ${ticketType.name}`,
    });
  } catch (err) {
    return interaction.editReply({ content: `Couldn't create the ticket channel. The bot may be missing permissions (Manage Channels) or the configured category is invalid.\n\`${err.message}\`` });
  }

  const ticketDbId = Tickets.create(interaction.guildId, {
    channelId: channel.id,
    ticketTypeId: ticketType.id,
    openerId: interaction.user.id,
  });

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(ticketType.welcome_title || `${ticketType.name} ticket`)
    .setDescription(ticketType.welcome_description || `Thanks for reaching out, <@${interaction.user.id}>. Support will be with you shortly.`)
    .setColor(ticketType.welcome_color || '#a32ee2')
    .setThumbnail(emojiUrl('xyphros-ticket.png'))
    .setTimestamp();

  const mentionRoles = ticketType.support_role_ids.map((r) => `<@&${r}>`).join(' ');

  await channel.send({
    content: `<@${interaction.user.id}>${mentionRoles ? ' ' + mentionRoles : ''}`,
    embeds: [welcomeEmbed],
    components: [ticketControlsRow(ticketDbId)],
  });

  await interaction.editReply({ content: `Your ticket has been created: <#${channel.id}>` });

  if (interaction.isStringSelectMenu()) {
    // Discord's select menus keep showing your last pick as "selected" for you
    // until the message re-renders — re-editing with the same components resets
    // that, so you can immediately pick the same option again.
    await interaction.message.edit({ components: interaction.message.components }).catch(() => {});
  }

  const logChannel = await getLogChannel(guild);
  if (logChannel) {
    const logEmbed = new EmbedBuilder()
      .setTitle('🎫 Ticket opened')
      .addFields(
        { name: 'Ticket', value: `<#${channel.id}> (${channel.name})`, inline: true },
        { name: 'Type', value: ticketType.name, inline: true },
        { name: 'Opened by', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setColor('#23a55a')
      .setTimestamp();
    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
  }
}

async function claimTicket(interaction, ticketDbId) {
  const ticket = Tickets.get(ticketDbId);
  if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true });
  if (ticket.status === 'closed') return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });

  Tickets.claim(ticketDbId, interaction.user.id);
  await interaction.reply({ content: `🙋 Claimed by <@${interaction.user.id}>` });
}

async function closeTicket(interaction, ticketDbId, reason) {
  const ticket = Tickets.get(ticketDbId);
  if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true });
  if (ticket.status === 'closed') return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });

  await interaction.deferReply();

  const channel = interaction.channel;
  const ticketType = ticket.ticket_type_id ? TicketTypes.get(ticket.ticket_type_id) : null;
  const wantsTranscript = !ticketType || ticketType.generate_transcript;

  let transcriptFile = null;
  if (wantsTranscript) {
    try {
      transcriptFile = await buildTranscript(channel);
    } catch (err) {
      // still close the ticket even if the transcript fails to build
    }
  }

  const logChannel = await getLogChannel(interaction.guild);
  if (logChannel) {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`🔒 Ticket closed: ${channel.name}`)
        .setThumbnail(emojiUrl('xyphros-gavel.png'))
        .addFields(
          { name: 'Opened by', value: `<@${ticket.opener_id}>`, inline: true },
          { name: 'Closed by', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Claimed by', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'Nobody', inline: true },
          { name: 'Opened at', value: `<t:${Math.floor(new Date(ticket.created_at + 'Z').getTime() / 1000)}:F>`, inline: true },
          { name: 'Closed at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: 'Reason', value: reason || 'No reason provided', inline: false },
        )
        .setColor('#ed4245')
        .setTimestamp();
      if (!wantsTranscript) embed.setFooter({ text: 'Transcripts are turned off for this ticket type' });
      await logChannel.send({ embeds: [embed], files: transcriptFile ? [transcriptFile] : [] });
    } catch (err) {
      // log channel might be misconfigured; don't block closing the ticket
    }
  }

  Tickets.close(ticketDbId, { closedBy: interaction.user.id, reason });

  await interaction.editReply({ content: `🔒 Ticket closed by <@${interaction.user.id}>. This channel will be deleted in 5 seconds.` });

  setTimeout(() => {
    channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(() => {});
  }, 5000);
}

async function startChangeType(interaction) {
  const ticket = Tickets.getByChannel(interaction.channelId);
  if (!ticket || ticket.status === 'closed') {
    return interaction.reply({ content: "This isn't an open ticket channel.", ephemeral: true });
  }

  const otherTypes = TicketTypes.listForGuild(interaction.guildId).filter((t) => t.id !== ticket.ticket_type_id);
  if (otherTypes.length === 0) {
    return interaction.reply({ content: 'There are no other ticket types to move this to. Create one on the dashboard first.', ephemeral: true });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`ticket_change_type:${ticket.id}`)
    .setPlaceholder('Choose a new category')
    .addOptions(otherTypes.slice(0, 25).map((t) => ({
      label: t.name,
      value: String(t.id),
      emoji: t.emoji || undefined,
    })));

  await interaction.reply({
    content: 'Pick the new category for this ticket. It stays the same channel — all messages so far are kept.',
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true,
  });
}

async function applyChangeType(interaction, ticketDbId, newTypeId) {
  const ticket = Tickets.get(ticketDbId);
  if (!ticket || ticket.status === 'closed') {
    return interaction.update({ content: 'This ticket is no longer open.', components: [] });
  }

  const newType = TicketTypes.get(newTypeId);
  if (!newType) {
    return interaction.update({ content: 'That ticket type no longer exists.', components: [] });
  }

  await interaction.update({ content: `Moving this ticket to **${newType.name}**...`, components: [] });

  const channel = interaction.channel;
  const guild = interaction.guild;
  const everyoneId = guild.roles.everyone.id;

  const opener = await guild.members.fetch(ticket.opener_id).catch(() => null);
  const newName = sanitizeForChannelName(
    (newType.name_pattern || 'ticket-{username}')
      .replace('{username}', opener?.user?.username || ticket.opener_id)
      .replace('{id}', ticket.opener_id),
  );

  const overwrites = [
    { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: ticket.opener_id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles],
    },
    {
      id: guild.members.me.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
    },
    ...newType.support_role_ids.map((roleId) => ({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
    })),
  ];

  try {
    await channel.edit({
      name: newName,
      parent: newType.category_channel_id || null,
      lockPermissions: false,
      permissionOverwrites: overwrites,
    });
  } catch (err) {
    return interaction.followUp({ content: `Couldn't update the channel: ${err.message}`, ephemeral: true });
  }

  Tickets.updateType(ticketDbId, newType.id);

  const mentionRoles = newType.support_role_ids.map((r) => `<@&${r}>`).join(' ');
  await channel.send({
    content: mentionRoles || undefined,
    embeds: [new EmbedBuilder()
      .setDescription(`🔄 This ticket was moved to **${newType.name}** by <@${interaction.user.id}>. Everything above stays right here.`)
      .setColor(newType.welcome_color || '#a32ee2')],
  });

  await interaction.followUp({ content: `Done — moved to **${newType.name}**.`, ephemeral: true });
}

// /ticket claim and /ticket close -- a slash-command alternative to the
// Claim/Close buttons on the panel, for staff who'd rather type than click.
// Same trust model as the buttons: no extra permission check here, because
// the channel itself is already restricted to support roles + the opener +
// the bot via Discord's own permission overwrites.
async function handleTicketCommand(interaction) {
  const ticket = Tickets.getByChannel(interaction.channelId);
  if (!ticket) {
    return interaction.reply({ content: "This isn't a ticket channel.", ephemeral: true });
  }

  const sub = interaction.options.getSubcommand();
  if (sub === 'claim') return claimTicket(interaction, ticket.id);
  if (sub === 'close') return closeTicket(interaction, ticket.id, interaction.options.getString('reason'));
}

module.exports = { openTicket, claimTicket, closeTicket, startChangeType, applyChangeType, ticketControlsRow, ticket: handleTicketCommand };
