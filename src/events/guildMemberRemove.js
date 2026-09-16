const { Events } = require('discord.js');
const { getGuildSettings } = require('../database/db');
const { leaveEmbed } = require('../utils/embeds');
const { logger } = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const settings = getGuildSettings(member.guild.id);
    if (!settings.leave_channel_id) return;
    try {
      const channel = await member.guild.channels.fetch(settings.leave_channel_id);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [leaveEmbed(member, settings.leave_message)] });
      }
    } catch (err) {
      logger.error('Failed to send leave message:', err.message);
    }
  },
};
