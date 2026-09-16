const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { canUseAction } = require('./commandPermissions');
const { recordModAction } = require('./modLog');
const { GuildSettings } = require('../db/repo');
const { emojiUrl } = require('./emoji');
const colors = require('./colors');

const LOCK_COLOR = colors.BRAND;
const UNLOCK_COLOR = colors.SUCCESS;

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

  // Deferred before the permission-overwrite edit below -- that's a real
  // Discord API call, and a slow one would otherwise blow the 3-second
  // first-response window and show "This interaction failed" even though
  // the channel actually got locked.
  await interaction.deferReply();

  try {
    await channel.permissionOverwrites.edit(
      guild.roles.everyone,
      { SendMessages: false },
      { reason: reason ? `Locked by ${member.user.tag}: ${reason}` : `Locked by ${member.user.tag}` },
    );
  } catch (err) {
    return interaction.editReply({ content: `Couldn't lock this channel: ${err.message}` });
  }

  const embed = new EmbedBuilder()
    .setTitle('🔒 Channel locked down')
    .setColor(LOCK_COLOR)
    .setThumbnail(emojiUrl('xyphros-lock.gif'))
    .setDescription(`This channel is locked — no one but staff can send messages here.${reason ? `\n**Reason:** ${reason}` : ''}`)
    .setFooter({ text: `Locked by ${member.user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  recordModAction(guild.id, { action: '🔒 Channel locked', target: null, moderator: member.user, reason: reason ? `${reason} (#${channel.name})` : `#${channel.name}` });
  await logToModChannel(guild, embed);
}

async function handleUnlockdown(interaction) {
  if (!canUseAction(interaction.guild, interaction.member, 'unlockdown')) return denyReply(interaction, 'unlockdown');

  const { guild, channel, member } = interaction;
  const reason = interaction.options.getString('reason');

  await interaction.deferReply();

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
    return interaction.editReply({ content: `Couldn't unlock this channel: ${err.message}` });
  }

  const embed = new EmbedBuilder()
    .setTitle('🔓 Channel unlocked')
    .setColor(UNLOCK_COLOR)
    .setDescription(`This channel is unlocked — everyone can send messages again.${reason ? `\n**Reason:** ${reason}` : ''}`)
    .setFooter({ text: `Unlocked by ${member.user.tag}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  recordModAction(guild.id, { action: '🔓 Channel unlocked', target: null, moderator: member.user, reason: reason ? `${reason} (#${channel.name})` : `#${channel.name}` });
  await logToModChannel(guild, embed);
}

module.exports = { lockdown: handleLockdown, unlockdown: handleUnlockdown };
