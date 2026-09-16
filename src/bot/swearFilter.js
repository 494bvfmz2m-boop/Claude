const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { testSwearFilter } = require('./cache');
const { GuildSettings, Warnings } = require('../db/repo');
const { recordModAction } = require('./modLog');
const { emojiUrl } = require('./emoji');
const { applyWarningThreshold, buildPunishmentEmbed, sendPunishmentDM } = require('./moderation');
const colors = require('./colors');

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
    .setColor(colors.DANGER)
    .setThumbnail(emojiUrl('xyphros-filter.png'))
    .addFields(
      { name: 'User', value: `<@${message.author.id}>`, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Matched', value: `||${matchedWord}||`, inline: true },
      { name: 'Message', value: message.content.slice(0, 1000) || '(empty)' },
    )
    .setTimestamp();
  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

// A filtered message is a real infraction, not just cleanup -- it now feeds
// the same warning/auto-punishment pipeline as a staff-given /warn, so
// "N warnings -> mute/kick/ban" thresholds (Moderation -> Auto-punishments)
// actually fire from repeat swear-filter hits instead of only ever counting
// manual warnings. Returns a short note for the in-channel notice if an
// auto-punishment fired, or null.
async function warnForFilterHit(guild, message, matchedWord) {
  const reason = `Swear filter: matched "${matchedWord}" in #${message.channel.name}`;
  Warnings.add(guild.id, message.author.id, guild.client.user.id, reason);
  const count = Warnings.listForUser(guild.id, message.author.id).length;

  await sendPunishmentDM(message.author, buildPunishmentEmbed({
    action: 'warned', emoji: '⚠️', guildName: guild.name, reason,
  }));

  return applyWarningThreshold(guild, message.member, guild.client.user, count);
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

    await logDeletion(message.guild, message, matchedWord);
    const autoNote = await warnForFilterHit(message.guild, message, matchedWord);

    const notice = autoNote
      ? `${message.author}, that message was removed by the word filter ${autoNote}.`
      : `${message.author}, that message was removed by the word filter.`;
    message.channel.send(notice)
      .then((sent) => setTimeout(() => sent.delete().catch(() => {}), 5000))
      .catch(() => {});
  });
}

module.exports = { register };
