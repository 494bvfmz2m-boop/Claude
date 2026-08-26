const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { testLinkFilter } = require('./cache');
const { GuildSettings } = require('../db/repo');
const { recordModAction } = require('./modLog');

async function logDeletion(guild, message, matchedLink) {
  recordModAction(guild.id, {
    action: '🔗 Link filter triggered',
    target: message.author,
    moderator: guild.client.user,
    reason: `blocked a link in #${message.channel.name}`,
  });

  const settings = GuildSettings.get(guild.id);
  if (!settings.mod_log_channel_id) return;
  const logChannel = await guild.channels.fetch(settings.mod_log_channel_id).catch(() => null);
  if (!logChannel) return;
  const embed = new EmbedBuilder()
    .setTitle('🔗 Link filter triggered')
    .setColor('#ed4245')
    .addFields(
      { name: 'User', value: `<@${message.author.id}>`, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Blocked', value: `||${matchedLink}||` },
      { name: 'Message', value: message.content.slice(0, 1000) || '(empty)' },
    )
    .setTimestamp();
  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

function register(client) {
  client.on('messageCreate', async (message) => {
    // Cheap checks first — most messages bail out here without touching the cache/DB at all.
    if (message.author.bot || !message.guildId || !message.content) return;
    if (message.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return;

    const matched = testLinkFilter(message.guildId, message.content);
    if (!matched) return;

    try {
      await message.delete();
    } catch {
      return; // no perms or already gone — don't bother notifying
    }

    message.channel.send(`${message.author}, links aren't allowed here.`)
      .then((notice) => setTimeout(() => notice.delete().catch(() => {}), 5000))
      .catch(() => {});

    await logDeletion(message.guild, message, matched);
  });
}

module.exports = { register };
