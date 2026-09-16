const { Events } = require('discord.js');
const { getGuildSettings } = require('../database/db');
const { welcomeEmbed } = require('../utils/embeds');
const { handleJoin } = require('../handlers/antiRaidManager');
const { logger } = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const removed = await handleJoin(member).catch((err) => {
      logger.error('Anti-raid handling failed:', err.message);
      return false;
    });
    if (removed) return;

    const settings = getGuildSettings(member.guild.id);
    if (!settings.welcome_channel_id) return;
    try {
      const channel = await member.guild.channels.fetch(settings.welcome_channel_id);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [welcomeEmbed(member, settings.welcome_message)] });
      }
    } catch (err) {
      logger.error('Failed to send welcome message:', err.message);
    }
  },
};
