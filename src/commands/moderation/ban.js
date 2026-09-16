const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db, getGuildSettings } = require('../../database/db');
const { modLogEmbed } = require('../../utils/embeds');
const { canModerate } = require('../../utils/permissions');
const { sendToLogChannel } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('The member to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the ban'))
    .addIntegerOption((o) => o.setName('delete_days').setDescription('Delete messages from the last N days (0-7)').setMinValue(0).setMaxValue(7)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (targetMember) {
      if (!targetMember.bannable || !canModerate(interaction.member, targetMember)) {
        return interaction.reply({ content: 'I cannot ban that member (role hierarchy or missing permissions).', ephemeral: true });
      }
    }

    await interaction.guild.members.ban(targetUser.id, { reason, deleteMessageSeconds: deleteDays * 86400 });
    db.prepare('INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(interaction.guild.id, targetUser.id, interaction.user.id, 'ban', reason, Date.now());

    const embed = new EmbedBuilder().setColor(config.colors.danger).setTitle('🔨 Member Banned')
      .addFields({ name: 'User', value: `${targetUser.tag} (${targetUser.id})` }, { name: 'Moderator', value: `${interaction.user}` }, { name: 'Reason', value: reason });
    await interaction.reply({ embeds: [embed] });

    const settings = getGuildSettings(interaction.guild.id);
    await sendToLogChannel(interaction.client, settings.mod_log_channel_id, modLogEmbed({ action: 'Ban', target: targetUser, moderator: interaction.user, reason }));
  },
};
