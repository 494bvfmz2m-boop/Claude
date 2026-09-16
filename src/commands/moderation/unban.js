const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db, getGuildSettings } = require('../../database/db');
const { modLogEmbed } = require('../../utils/embeds');
const { sendToLogChannel } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((o) => o.setName('user_id').setDescription('The user ID to unban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the unban')),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id', true).trim();
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ content: 'That does not look like a valid user ID.', ephemeral: true });
    }

    const banEntry = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!banEntry) return interaction.reply({ content: 'That user is not banned.', ephemeral: true });

    await interaction.guild.members.unban(userId, reason);
    db.prepare('INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(interaction.guild.id, userId, interaction.user.id, 'unban', reason, Date.now());

    const embed = new EmbedBuilder().setColor(config.colors.success).setTitle('✅ Member Unbanned')
      .addFields({ name: 'User', value: `${banEntry.user.tag} (${userId})` }, { name: 'Moderator', value: `${interaction.user}` }, { name: 'Reason', value: reason });
    await interaction.reply({ embeds: [embed] });

    const settings = getGuildSettings(interaction.guild.id);
    await sendToLogChannel(interaction.client, settings.mod_log_channel_id, modLogEmbed({ action: 'Unban', target: banEntry.user, moderator: interaction.user, reason }));
  },
};
