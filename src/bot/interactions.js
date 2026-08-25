const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { openTicket, claimTicket, closeTicket } = require('./tickets');

function register(client) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton()) {
        const [action, ...rest] = interaction.customId.split(':');

        if (action === 'panel_open') {
          const [ticketTypeId] = rest;
          return openTicket(interaction, Number(ticketTypeId));
        }

        if (action === 'ticket_claim') {
          const [ticketDbId] = rest;
          return claimTicket(interaction, Number(ticketDbId));
        }

        if (action === 'ticket_close') {
          const [ticketDbId] = rest;
          const modal = new ModalBuilder()
            .setCustomId(`ticket_close_modal:${ticketDbId}`)
            .setTitle('Close ticket');
          const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason (optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500);
          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          return interaction.showModal(modal);
        }
      }

      if (interaction.isStringSelectMenu()) {
        const [action, panelId] = interaction.customId.split(':');
        if (action === 'panel_select') {
          const ticketTypeId = interaction.values[0];
          return openTicket(interaction, Number(ticketTypeId));
        }
      }

      if (interaction.isModalSubmit()) {
        const [action, ticketDbId] = interaction.customId.split(':');
        if (action === 'ticket_close_modal') {
          const reason = interaction.fields.getTextInputValue('reason');
          return closeTicket(interaction, Number(ticketDbId), reason);
        }
      }
    } catch (err) {
      console.error('Interaction error:', err);
      const payload = { content: 'Something went wrong handling that action. Check the bot logs.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        interaction.followUp(payload).catch(() => {});
      } else {
        interaction.reply(payload).catch(() => {});
      }
    }
  });
}

module.exports = { register };
