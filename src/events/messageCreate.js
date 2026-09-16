const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db, getGuildSettings } = require('../database/db');
const { sendToLogChannel, logger } = require('../utils/logger');
const config = require('../config');

// Anti-raid honeypot: a decoy channel set up with /config honeypot. Real members
// are never told about it and have no reason to post there; anything that does
// (a raid/spam bot blasting every visible channel, or a compromised account) gets
// removed automatically. Staff are exempted so a moderator confirming the trap is
// wired up correctly, or accidentally clicking into it, doesn't get soft-banned.
module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const settings = getGuildSettings(message.guild.id);
    if (!settings.honeypot_enabled || message.channelId !== settings.honeypot_channel_id) return;

    await message.delete().catch(() => {});

    const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
    const isStaff = member?.permissions.has(PermissionFlagsBits.BanMembers) || member?.permissions.has(PermissionFlagsBits.ModerateMembers);

    if (isStaff) {
      await sendToLogChannel(message.client, settings.log_channel_id, new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle('⚠️ Honeypot triggered by staff')
        .setDescription(`${message.author} posted in the honeypot channel but was **not** soft-banned because they hold moderation permissions. Reminder: nobody should post in that channel.`)
        .setTimestamp());
      return;
    }

    try {
      await message.guild.members.ban(message.author.id, {
        deleteMessageSeconds: 604800,
        reason: 'Anti-raid honeypot triggered (automatic soft-ban)',
      });
      await message.guild.members.unban(message.author.id, 'Honeypot soft-ban: releasing the ban after purge').catch(() => {});

      db.prepare('INSERT INTO mod_actions (guild_id, user_id, moderator_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(message.guild.id, message.author.id, message.client.user.id, 'honeypot_softban', 'Posted in the anti-raid honeypot channel', Date.now());

      logger.warn(`Honeypot triggered: soft-banned ${message.author.tag} (${message.author.id}) in guild ${message.guild.id}`);
      await sendToLogChannel(message.client, settings.log_channel_id, new EmbedBuilder()
        .setColor(config.colors.danger)
        .setTitle('🍯 Honeypot Triggered — Soft-Banned')
        .setDescription(`**${message.author.tag}** (${message.author.id}) posted in the trap channel and was soft-banned: kicked and recent messages purged. They are free to rejoin — this is not a permanent ban.`)
        .setTimestamp());
    } catch (err) {
      logger.error(`Failed to soft-ban honeypot trigger ${message.author.id}:`, err.message);
    }
  },
};
