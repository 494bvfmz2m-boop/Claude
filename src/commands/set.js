const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set')
    .setDescription('Configure the reminder bot for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Set the channel reminders for this server are posted in')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Text channel for reminders')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((sub) => sub.setName('view').setDescription('View the current reminder channel configuration')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel');
      const me = interaction.guild.members.me;
      const perms = channel.permissionsFor(me);
      if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
        await interaction.reply({
          content: `I need View Channel and Send Messages permissions in ${channel} to post reminders there.`,
          ephemeral: true,
        });
        return;
      }
      db.setGuildChannel(interaction.guildId, channel.id);
      await interaction.reply({
        content: `Reminders for this server will now be posted in ${channel}.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'view') {
      const config = db.getGuildConfig(interaction.guildId);
      await interaction.reply({
        content: config?.channelId
          ? `Reminders are currently posted in <#${config.channelId}>.`
          : 'No reminder channel has been configured yet. Use `/set channel` to configure one.',
        ephemeral: true,
      });
    }
  },
};
