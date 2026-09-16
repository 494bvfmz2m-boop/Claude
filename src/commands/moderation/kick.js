const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db, getGuildSettings } = require('../../database/db');
const { modLogEmbed } = require('../../utils/embeds');
const { canModerate } = require('../../utils/permissions');
const { sendToLogChannel } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName('user').setDescription('The member to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the kick')),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    if (!targetMember.kickable || !canModerate(interaction.member, targetMember)) {
      return interaction.reply({ content: 'I cannot kick that member (role hierarchy or missing permissions).', ephemeral: true });
    }

    await targetMember.kick(reason);
    db.prepare('INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(interaction.guild.id, targetUser.id, interaction.user.id, 'kick', reason, Date.now());

    const embed = new EmbedBuilder().setColor(config.colors.warning).setTitle('👢 Member Kicked')
      .addFields({ name: 'User', value: `${targetUser.tag} (${targetUser.id})` }, { name: 'Moderator', value: `${interaction.user}` }, { name: 'Reason', value: reason });
    await interaction.reply({ embeds: [embed] });

    const settings = getGuildSettings(interaction.guild.id);
    await sendToLogChannel(interaction.client, settings.mod_log_channel_id, modLogEmbed({ action: 'Kick', target: targetUser, moderator: interaction.user, reason }));
  },
};
