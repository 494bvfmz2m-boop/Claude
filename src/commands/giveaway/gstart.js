const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { startGiveaway } = require('../../handlers/giveawayManager');
const { parseDuration } = require('../../utils/duration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gstart')
    .setDescription('Start a giveaway.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName('duration').setDescription('e.g. 30s, 10m, 2h, 1d, 1w').setRequired(true))
    .addStringOption((o) => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
    .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20))
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to post in (defaults to this channel)').addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    const durationInput = interaction.options.getString('duration', true);
    const prize = interaction.options.getString('prize', true);
    const winnerCount = interaction.options.getInteger('winners') || 1;
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const durationMs = parseDuration(durationInput);
    if (!durationMs || durationMs < 5000) {
      return interaction.reply({ content: 'Invalid duration. Use a format like `30s`, `10m`, `2h`, `1d`, or `1w` (minimum 5 seconds).', ephemeral: true });
    }

    await startGiveaway(interaction.client, {
      guildId: interaction.guild.id,
      channelId: channel.id,
      prize,
      winnerCount,
      durationMs,
      hostId: interaction.user.id,
    });

    await interaction.reply({ content: `🎉 Giveaway for **${prize}** started in ${channel}!`, ephemeral: true });
  },
};
