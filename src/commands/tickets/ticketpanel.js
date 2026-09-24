const {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
  ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getGuildSettings } = require('../../database/db');
const { sendPanel } = require('../../handlers/ticketManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Manage the ticket-opening panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sc) => sc.setName('edit')
      .setDescription('Open the in-Discord editor to customize the panel\'s title, description, button, and color'))
    .addSubcommand((sc) => sc.setName('post')
      .setDescription('Post the (customized) panel in a channel')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel to post the panel in').addChannelTypes(ChannelType.GuildText).setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const settings = getGuildSettings(interaction.guild.id);

    if (sub === 'edit') {
      const modal = new ModalBuilder().setCustomId('ticketpanel_edit_modal').setTitle('Ticket Panel Editor');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Panel Title')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(256)
            .setRequired(true)
            .setValue(settings.ticket_panel_title),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Panel Description')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(true)
            .setValue(settings.ticket_panel_description),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('button_label')
            .setLabel('Button Label')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(80)
            .setRequired(true)
            .setValue(settings.ticket_panel_button_label),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('button_emoji')
            .setLabel('Button Emoji (optional, unicode only)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(8)
            .setRequired(false)
            .setValue(settings.ticket_panel_button_emoji || ''),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Embed Color (hex, e.g. #5865F2)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(7)
            .setRequired(false)
            .setValue(settings.ticket_panel_color),
        ),
      );
      return interaction.showModal(modal);
    }

    if (sub === 'post') {
      if (!settings.ticket_category_id) {
        return interaction.reply({ content: 'Set up a ticket category first with `/config tickets`.', ephemeral: true });
      }
      const channel = interaction.options.getChannel('channel', true);
      await sendPanel(channel, settings);
      return interaction.reply({ content: `Ticket panel posted in ${channel}.`, ephemeral: true });
    }
  },
};
