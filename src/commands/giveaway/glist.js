const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../database/db');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('glist')
    .setDescription('List active giveaways in this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const rows = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0 ORDER BY end_time ASC').all(interaction.guild.id);
    if (rows.length === 0) return interaction.reply({ content: 'No active giveaways.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('Active Giveaways')
      .setDescription(rows.map((g) => `**${g.prize}** in <#${g.channel_id}> — ends <t:${Math.floor(g.end_time / 1000)}:R>\nMessage ID: \`${g.message_id}\``).join('\n\n'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
