const { Events, MessageFlags } = require('discord.js');
const { logger } = require('../utils/logger');
const ticketManager = require('../handlers/ticketManager');
const { enterGiveaway } = require('../handlers/giveawayManager');
const { updateGuildSettings } = require('../database/db');

async function handleWelcomeOrLeaveModal(interaction, kind) {
  const channelId = interaction.customId.split(':')[1];
  const message = interaction.fields.getTextInputValue('message').trim();
  updateGuildSettings(interaction.guild.id, {
    [`${kind}_channel_id`]: channelId,
    [`${kind}_message`]: message,
  });
  const label = kind === 'welcome' ? 'Welcome' : 'Leave';
  return interaction.reply({ content: `${label} messages will be sent in <#${channelId}> with your updated template.`, ephemeral: true });
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      if (interaction.isButton()) {
        switch (interaction.customId) {
          case 'ticket_open':
            return ticketManager.openTicket(interaction);
          case 'ticket_claim':
            return ticketManager.claimTicket(interaction);
          case 'ticket_close':
            return ticketManager.requestClose(interaction);
          case 'ticket_close_confirm':
            return ticketManager.confirmClose(interaction);
          case 'ticket_close_cancel':
            return ticketManager.cancelClose(interaction);
          case 'giveaway_enter':
            return enterGiveaway(interaction);
          default:
            return;
        }
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'ticketpanel_edit_modal') {
          return ticketManager.handlePanelEditModalSubmit(interaction);
        }
        if (interaction.customId.startsWith('config_welcome_modal:')) {
          return handleWelcomeOrLeaveModal(interaction, 'welcome');
        }
        if (interaction.customId.startsWith('config_leave_modal:')) {
          return handleWelcomeOrLeaveModal(interaction, 'leave');
        }
        return;
      }
    } catch (err) {
      logger.error('Interaction handling error:', err);
      const payload = { content: 'Something went wrong while handling that. Please try again.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};
