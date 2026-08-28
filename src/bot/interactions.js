const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { openTicket, claimTicket, closeTicket, startChangeType, applyChangeType } = require('./tickets');
const moderation = require('./moderation');
const promotion = require('./promotion');
const info = require('./info');
const introduction = require('./introduction');
const poll = require('./poll');
const help = require('./help');
const lockdown = require('./lockdown');
const giveaway = require('./giveaway');
const event = require('./event');
const tags = require('./tags');
const afk = require('./afk');
const config = require('../config');
const { buildServerListEmbed } = require('./ownerPanel');
const dmForm = require('./dmForm');
const { handleVerifyClick } = require('./verification');
const { handleGiveawayEnter } = require('./giveaway');
const { handleEventResponse } = require('./event');
const { handleTagAutocomplete } = require('./tags');
const { handleBetaRequestButton } = require('./betaRequests');

const chatCommandHandlers = {
  change: startChangeType,
  ...moderation,
  ...promotion,
  ...info,
  ...introduction,
  ...poll,
  ...help,
  ...lockdown,
  ...giveaway,
  ...event,
  ...tags,
  ...afk,
};
// moderation.js exports these helpers too, not commands
delete chatCommandHandlers.canActOn;
delete chatCommandHandlers.logAction;
delete chatCommandHandlers.parseDuration;
delete chatCommandHandlers.applyWarningThreshold;
delete chatCommandHandlers.confirmPurgeAll;
delete chatCommandHandlers.cancelPurgeAll;
delete chatCommandHandlers.purgeMessages;
delete chatCommandHandlers.buildPunishmentEmbed;
delete chatCommandHandlers.sendPunishmentDM;
// afk.js exports its messageCreate registrar too, not a command
delete chatCommandHandlers.register;

function register(client) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const handler = chatCommandHandlers[interaction.commandName];
        if (handler) return handler(interaction);
      }

      if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'tag') return handleTagAutocomplete(interaction);
        return interaction.respond([]).catch(() => {});
      }

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

        if (action === 'purge_all_confirm') {
          const [invokerId, targetUserId] = rest;
          return moderation.confirmPurgeAll(interaction, invokerId, targetUserId === '0' ? null : targetUserId);
        }

        if (action === 'purge_all_cancel') {
          const [invokerId] = rest;
          return moderation.cancelPurgeAll(interaction, invokerId);
        }

        if (action === 'owner_server_list') {
          if (!config.ownerDiscordId || interaction.user.id !== config.ownerDiscordId) {
            return interaction.reply({ content: "This isn't for you.", ephemeral: true });
          }
          await interaction.deferReply({ ephemeral: true });
          const embed = await buildServerListEmbed(interaction.client);
          return interaction.editReply({ embeds: [embed] });
        }

        if (action === 'dmform_open') {
          const [sendId] = rest;
          return dmForm.handleOpenButton(interaction, Number(sendId));
        }

        if (action === 'verify_click') {
          return handleVerifyClick(interaction);
        }

        if (action === 'giveaway_enter') {
          const [giveawayId] = rest;
          return handleGiveawayEnter(interaction, Number(giveawayId));
        }

        if (action === 'event_rsvp') {
          const [eventId, response] = rest;
          return handleEventResponse(interaction, Number(eventId), response);
        }

        if (action === 'beta_approve' || action === 'beta_reject') {
          return handleBetaRequestButton(interaction);
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
        const [action, param] = interaction.customId.split(':');
        if (action === 'panel_select') {
          const ticketTypeId = interaction.values[0];
          return openTicket(interaction, Number(ticketTypeId));
        }
        if (action === 'ticket_change_type') {
          const ticketDbId = param;
          const newTypeId = interaction.values[0];
          return applyChangeType(interaction, Number(ticketDbId), Number(newTypeId));
        }
      }

      if (interaction.isModalSubmit()) {
        const [action, param] = interaction.customId.split(':');
        if (action === 'ticket_close_modal') {
          const reason = interaction.fields.getTextInputValue('reason');
          return closeTicket(interaction, Number(param), reason);
        }
        if (action === 'dmform_submit') {
          return dmForm.handleSubmitModal(interaction, Number(param));
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
