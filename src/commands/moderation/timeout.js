const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db, getGuildSettings } = require('../../database/db');
const { modLogEmbed } = require('../../utils/embeds');
const { canModerate } = require('../../utils/permissions');
const { sendToLogChannel } = require('../../utils/logger');
const config = require('../../config');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Time out a member, or clear an active timeout.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('The member to time out').setRequired(true))
    .addIntegerOption((o) => o.setName('minutes').setDescription('Duration in minutes (0 to clear timeout)').setRequired(true).setMinValue(0).setMaxValue(40320))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the timeout')),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    if (!targetMember.moderatable || !canModerate(interaction.member, targetMember)) {
      return interaction.reply({ content: 'I cannot time out that member (role hierarchy or missing permissions).', ephemeral: true });
    }

    const ms = Math.min(minutes * 60 * 1000, MAX_TIMEOUT_MS);
    await targetMember.timeout(ms === 0 ? null : ms, reason);

    const action = ms === 0 ? 'Timeout Cleared' : 'Member Timed Out';
    db.prepare('INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(interaction.guild.id, targetUser.id, interaction.user.id, action.toLowerCase(), reason, Date.now());

    const embed = new EmbedBuilder().setColor(config.colors.warning).setTitle(`⏱️ ${action}`)
      .addFields(
        { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
        { name: 'Moderator', value: `${interaction.user}` },
        ...(ms > 0 ? [{ name: 'Duration', value: `${minutes} minute(s)` }] : []),
        { name: 'Reason', value: reason },
      );
    await interaction.reply({ embeds: [embed] });

    const settings = getGuildSettings(interaction.guild.id);
    await sendToLogChannel(interaction.client, settings.mod_log_channel_id, modLogEmbed({ action, target: targetUser, moderator: interaction.user, reason }));
  },
};
