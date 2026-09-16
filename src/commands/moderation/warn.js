const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db, getGuildSettings } = require('../../database/db');
const { modLogEmbed } = require('../../utils/embeds');
const { sendToLogChannel } = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('The member to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the warning').setRequired(true)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    db.prepare('INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(interaction.guild.id, targetUser.id, interaction.user.id, reason, Date.now());
    const count = db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ? AND user_id = ?').get(interaction.guild.id, targetUser.id).c;

    const embed = new EmbedBuilder().setColor(config.colors.warning).setTitle('⚠️ Member Warned')
      .addFields(
        { name: 'User', value: `${targetUser.tag} (${targetUser.id})` },
        { name: 'Moderator', value: `${interaction.user}` },
        { name: 'Reason', value: reason },
        { name: 'Total Warnings', value: String(count) },
      );
    await interaction.reply({ embeds: [embed] });

    await targetUser.send({ content: `You were warned in **${interaction.guild.name}**: ${reason}` }).catch(() => {});

    const settings = getGuildSettings(interaction.guild.id);
    await sendToLogChannel(interaction.client, settings.mod_log_channel_id, modLogEmbed({ action: 'Warn', target: targetUser, moderator: interaction.user, reason }));
  },
};
