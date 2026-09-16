const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuildSettings } = require('../../database/db');
const { sendPanel } = require('../../handlers/ticketManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Post the ticket-opening panel in a channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to post the panel in').addChannelTypes(ChannelType.GuildText).setRequired(true)),

  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id);
    if (!settings.ticket_category_id) {
      return interaction.reply({ content: 'Set up a ticket category first with `/config tickets`.', ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel', true);
    await sendPanel(channel);
    await interaction.reply({ content: `Ticket panel posted in ${channel}.`, ephemeral: true });
  },
};
