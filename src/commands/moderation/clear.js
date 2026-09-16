const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Bulk delete recent messages in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user')),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    let toDelete = [...messages.values()];
    if (user) toDelete = toDelete.filter((m) => m.author.id === user.id);
    toDelete = toDelete.slice(0, amount);

    if (toDelete.length === 0) {
      return interaction.editReply({ content: 'No matching messages found to delete.' });
    }

    const deleted = await interaction.channel.bulkDelete(toDelete, true).catch(() => null);
    if (!deleted) {
      return interaction.editReply({ content: 'Failed to delete messages (they may be older than 14 days).' });
    }
    await interaction.editReply({ content: `Deleted ${deleted.size} message(s).` });
  },
};
