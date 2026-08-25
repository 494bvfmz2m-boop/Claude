const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { TicketTypes, Tickets, GuildSettings } = require('../db/repo');
const { buildTranscript } = require('./transcript');

function sanitizeForChannelName(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80);
}

function ticketControlsRow(ticketDbId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_claim:${ticketDbId}`).setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('🙋'),
    new ButtonBuilder().setCustomId(`ticket_close:${ticketDbId}`).setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
  );
}

async function openTicket(interaction, ticketTypeId) {
  const ticketType = TicketTypes.get(ticketTypeId);
  if (!ticketType) {
    return interaction.reply({ content: 'This ticket type no longer exists. Ask an admin to check the dashboard.', ephemeral: true });
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
    .setColor(ticketType.welcome_color || '#5865F2')
    .setTimestamp();

  const mentionRoles = ticketType.support_role_ids.map((r) => `<@&${r}>`).join(' ');

  await channel.send({
    content: `<@${interaction.user.id}>${mentionRoles ? ' ' + mentionRoles : ''}`,
    embeds: [welcomeEmbed],
    components: [ticketControlsRow(ticketDbId)],
  });

  await interaction.editReply({ content: `Your ticket has been created: <#${channel.id}>` });
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
  const settings = GuildSettings.get(interaction.guildId);

  let transcriptFile = null;
  try {
    transcriptFile = await buildTranscript(channel);
  } catch (err) {
    // still close the ticket even if the transcript fails to build
  }

  if (settings.transcript_channel_id) {
    try {
      const transcriptChannel = await interaction.guild.channels.fetch(settings.transcript_channel_id);
      if (transcriptChannel) {
        const embed = new EmbedBuilder()
          .setTitle(`Ticket closed: ${channel.name}`)
          .addFields(
            { name: 'Opened by', value: `<@${ticket.opener_id}>`, inline: true },
            { name: 'Closed by', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false },
          )
          .setColor('#ed4245')
          .setTimestamp();
        await transcriptChannel.send({ embeds: [embed], files: transcriptFile ? [transcriptFile] : [] });
      }
    } catch (err) {
      // transcript channel might be misconfigured; don't block closing the ticket
    }
  }

  Tickets.close(ticketDbId, { closedBy: interaction.user.id, reason });

  await interaction.editReply({ content: `🔒 Ticket closed by <@${interaction.user.id}>. This channel will be deleted in 5 seconds.` });

  setTimeout(() => {
    channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(() => {});
  }, 5000);
}

module.exports = { openTicket, claimTicket, closeTicket, ticketControlsRow };
