const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { testSwearFilter } = require('./cache');
const { GuildSettings } = require('../db/repo');
const { recordModAction } = require('./modLog');

async function logDeletion(guild, message, matchedWord) {
  recordModAction(guild.id, {
    action: '🧼 Swear filter triggered',
    target: message.author,
    moderator: guild.client.user,
    reason: `matched "${matchedWord}" in #${message.channel.name}`,
  });

  const settings = GuildSettings.get(guild.id);
  if (!settings.mod_log_channel_id) return;
  const logChannel = await guild.channels.fetch(settings.mod_log_channel_id).catch(() => null);
  if (!logChannel) return;
  const embed = new EmbedBuilder()
    .setTitle('🧼 Swear filter triggered')
    .setColor('#ed4245')
    .addFields(
      { name: 'User', value: `<@${message.author.id}>`, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Matched', value: `||${matchedWord}||`, inline: true },
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

    const matchedWord = testSwearFilter(message.guildId, message.content);
    if (!matchedWord) return;

    try {
      await message.delete();
    } catch {
      return; // no perms or already gone — don't bother notifying
    }

    message.channel.send(`${message.author}, that message was removed by the word filter.`)
      .then((notice) => setTimeout(() => notice.delete().catch(() => {}), 5000))
      .catch(() => {});

    await logDeletion(message.guild, message, matchedWord);
  });
}

module.exports = { register };
