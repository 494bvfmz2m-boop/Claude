const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../database/db');
const { endGiveaway } = require('../../handlers/giveawayManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gend')
    .setDescription('End a giveaway early.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName('message_id').setDescription('The giveaway message ID').setRequired(true)),

  async execute(interaction) {
    const messageId = interaction.options.getString('message_id', true).trim();
    const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(messageId, interaction.guild.id);
    if (!giveaway) return interaction.reply({ content: 'No giveaway found with that message ID in this server.', ephemeral: true });
    if (giveaway.ended) return interaction.reply({ content: 'That giveaway has already ended.', ephemeral: true });

    await interaction.reply({ content: 'Ending giveaway...', ephemeral: true });
    await endGiveaway(interaction.client, giveaway.id);
  },
};
