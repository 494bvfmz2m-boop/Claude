const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { canUseAction } = require('./commandPermissions');
const { recordModAction } = require('./modLog');
const { GuildSettings } = require('../db/repo');
const { emojiUrl } = require('./emoji');

const LOCK_COLOR = '#a8e6ff';
const UNLOCK_COLOR = '#23a55a';

function denyReply(interaction, command) {
  return interaction.reply({ content: `You don't have permission to use \`/${command}\`. Ask an admin to grant it from the dashboard's Permissions page.`, ephemeral: true });
}

async function logToModChannel(guild, embed) {
  const settings = GuildSettings.get(guild.id);
  if (!settings.mod_log_channel_id) return;
  const logChannel = await guild.channels.fetch(settings.mod_log_channel_id).catch(() => null);
  if (!logChannel) return;
  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

async function handleLockdown(interaction) {
  if (!canUseAction(interaction.guild, interaction.member, 'lockdown')) return denyReply(interaction, 'lockdown');

  const { guild, channel, member } = interaction;
  const reason = interaction.options.getString('reason');

  try {
    await channel.permissionOverwrites.edit(
      guild.roles.everyone,
      { SendMessages: false },
      { reason: reason ? `Locked by ${member.user.tag}: ${reason}` : `Locked by ${member.user.tag}` },
    );
  } catch (err) {
    return interaction.reply({ content: `Couldn't lock this channel: ${err.message}`, ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🔒 Channel locked down')
    .setColor(LOCK_COLOR)
    .setThumbnail(emojiUrl('modsentry-lock.gif'))
    .setDescription(`This channel is locked — no one but staff can send messages here.${reason ? `\n**Reason:** ${reason}` : ''}`)
    .setFooter({ text: `Locked by ${member.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  recordModAction(guild.id, { action: '🔒 Channel locked', target: null, moderator: member.user, reason: reason ? `${reason} (#${channel.name})` : `#${channel.name}` });
  await logToModChannel(guild, embed);
}

async function handleUnlockdown(interaction) {
  if (!canUseAction(interaction.guild, interaction.member, 'unlockdown')) return denyReply(interaction, 'unlockdown');

  const { guild, channel, member } = interaction;
  const reason = interaction.options.getString('reason');

  try {
    // Clears the overwrite entirely rather than setting it to explicitly
    // true -- that way the channel just goes back to whatever it inherited
    // from category/role permissions before the lock, instead of a lock
    // potentially punching a hole through an otherwise-restricted channel.
    await channel.permissionOverwrites.edit(
      guild.roles.everyone,
      { SendMessages: null },
      { reason: reason ? `Unlocked by ${member.user.tag}: ${reason}` : `Unlocked by ${member.user.tag}` },
    );
  } catch (err) {
    return interaction.reply({ content: `Couldn't unlock this channel: ${err.message}`, ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🔓 Channel unlocked')
    .setColor(UNLOCK_COLOR)
    .setDescription(`This channel is unlocked — everyone can send messages again.${reason ? `\n**Reason:** ${reason}` : ''}`)
    .setFooter({ text: `Unlocked by ${member.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  recordModAction(guild.id, { action: '🔓 Channel unlocked', target: null, moderator: member.user, reason: reason ? `${reason} (#${channel.name})` : `#${channel.name}` });
  await logToModChannel(guild, embed);
}

module.exports = { lockdown: handleLockdown, unlockdown: handleUnlockdown };
