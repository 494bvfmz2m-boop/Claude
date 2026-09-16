const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../database/db');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View or clear warnings for a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sc) => sc.setName('list').setDescription('List warnings for a member')
      .addUserOption((o) => o.setName('user').setDescription('The member to check').setRequired(true)))
    .addSubcommand((sc) => sc.setName('clear').setDescription('Clear all warnings for a member')
      .addUserOption((o) => o.setName('user').setDescription('The member to clear').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user', true);

    if (sub === 'clear') {
      const result = db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(interaction.guild.id, targetUser.id);
      return interaction.reply({ content: `Cleared ${result.changes} warning(s) for ${targetUser.tag}.`, ephemeral: true });
    }

    const rows = db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 25')
      .all(interaction.guild.id, targetUser.id);

    if (rows.length === 0) {
      return interaction.reply({ content: `${targetUser.tag} has no warnings.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle(`Warnings for ${targetUser.tag}`)
      .setDescription(rows.map((r, i) => `**${i + 1}.** ${r.reason} — by <@${r.moderator_id}> (<t:${Math.floor(r.created_at / 1000)}:R>)`).join('\n'))
      .setFooter({ text: `Total: ${rows.length}` });
    await interaction.reply({ embeds: [embed] });
  },
};
