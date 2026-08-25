const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { Warnings, GuildSettings } = require('../db/repo');

const MOD_COLOR = '#ed4245';
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord's own cap

async function getLogChannel(guild) {
  const settings = GuildSettings.get(guild.id);
  if (!settings.mod_log_channel_id) return null;
  return guild.channels.fetch(settings.mod_log_channel_id).catch(() => null);
}

async function logAction(guild, { action, target, moderator, reason, extra }) {
  const logChannel = await getLogChannel(guild);
  if (!logChannel) return;
  const embed = new EmbedBuilder()
    .setTitle(action)
    .setColor(MOD_COLOR)
    .addFields(
      { name: 'User', value: target ? `<@${target.id ?? target}> (${target.id ?? target})` : 'Unknown', inline: true },
      { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: false },
    )
    .setTimestamp();
  if (extra) embed.addFields(extra);
  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

// Baseline "can this staff member act on this target at all" check, on top
// of whatever Discord permission the slash command itself already requires.
// Mirrors how basically every moderation bot behaves: you can't touch someone
// with an equal or higher role than you, unless you're an admin/the owner.
function canActOn(guild, invokerMember, targetMember) {
  if (guild.ownerId === invokerMember.id) return true;
  if (invokerMember.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (!targetMember) return true;
  return invokerMember.roles.highest.position > targetMember.roles.highest.position;
}

function parseDuration(input) {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec((input || '').trim());
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2].toLowerCase()];
  const ms = amount * unitMs;
  if (ms <= 0 || ms > MAX_TIMEOUT_MS) return null;
  return ms;
}

async function handleBan(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  const deleteDays = interaction.options.getInteger('delete_days') || 0;

  const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!canActOn(interaction.guild, interaction.member, targetMember)) {
    return interaction.reply({ content: "You can't ban someone with an equal or higher role than you.", ephemeral: true });
  }

  try {
    await interaction.guild.members.ban(user.id, { reason: reason || undefined, deleteMessageSeconds: deleteDays * 86400 });
  } catch (err) {
    return interaction.reply({ content: `Couldn't ban them: ${err.message}`, ephemeral: true });
  }

  await interaction.reply({ content: `🔨 Banned **${user.tag}**.${reason ? ` Reason: ${reason}` : ''}` });
  await logAction(interaction.guild, { action: '🔨 Member banned', target: user, moderator: interaction.user, reason });
}

async function handleUnban(interaction) {
  const userId = interaction.options.getString('user_id').trim();
  const reason = interaction.options.getString('reason');

  try {
    await interaction.guild.members.unban(userId, reason || undefined);
  } catch (err) {
    return interaction.reply({ content: `Couldn't unban that ID: ${err.message}`, ephemeral: true });
  }

  await interaction.reply({ content: `✅ Unbanned \`${userId}\`.` });
  await logAction(interaction.guild, { action: '✅ Member unbanned', target: userId, moderator: interaction.user, reason });
}

async function handleKick(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');

  const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!targetMember) {
    return interaction.reply({ content: "They're not in this server.", ephemeral: true });
  }
  if (!canActOn(interaction.guild, interaction.member, targetMember)) {
    return interaction.reply({ content: "You can't kick someone with an equal or higher role than you.", ephemeral: true });
  }

  try {
    await targetMember.kick(reason || undefined);
  } catch (err) {
    return interaction.reply({ content: `Couldn't kick them: ${err.message}`, ephemeral: true });
  }

  await interaction.reply({ content: `👢 Kicked **${user.tag}**.${reason ? ` Reason: ${reason}` : ''}` });
  await logAction(interaction.guild, { action: '👢 Member kicked', target: user, moderator: interaction.user, reason });
}

async function handleTimeout(interaction) {
  const user = interaction.options.getUser('user');
  const durationInput = interaction.options.getString('duration');
  const reason = interaction.options.getString('reason');

  const ms = parseDuration(durationInput);
  if (!ms) {
    return interaction.reply({ content: `Couldn't parse "${durationInput}" — try something like \`10m\`, \`2h\`, or \`1d\` (max 28d).`, ephemeral: true });
  }

  const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!targetMember) {
    return interaction.reply({ content: "They're not in this server.", ephemeral: true });
  }
  if (!canActOn(interaction.guild, interaction.member, targetMember)) {
    return interaction.reply({ content: "You can't time out someone with an equal or higher role than you.", ephemeral: true });
  }

  try {
    await targetMember.timeout(ms, reason || undefined);
  } catch (err) {
    return interaction.reply({ content: `Couldn't time them out: ${err.message}`, ephemeral: true });
  }

  await interaction.reply({ content: `🔇 Timed out **${user.tag}** for ${durationInput}.${reason ? ` Reason: ${reason}` : ''}` });
  await logAction(interaction.guild, { action: '🔇 Member timed out', target: user, moderator: interaction.user, reason, extra: [{ name: 'Duration', value: durationInput, inline: true }] });
}

async function handleUntimeout(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');

  const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!targetMember) {
    return interaction.reply({ content: "They're not in this server.", ephemeral: true });
  }

  try {
    await targetMember.timeout(null, reason || undefined);
  } catch (err) {
    return interaction.reply({ content: `Couldn't remove their timeout: ${err.message}`, ephemeral: true });
  }

  await interaction.reply({ content: `🔊 Removed timeout for **${user.tag}**.` });
  await logAction(interaction.guild, { action: '🔊 Timeout removed', target: user, moderator: interaction.user, reason });
}

async function handleWarn(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');

  const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!canActOn(interaction.guild, interaction.member, targetMember)) {
    return interaction.reply({ content: "You can't warn someone with an equal or higher role than you.", ephemeral: true });
  }

  Warnings.add(interaction.guildId, user.id, interaction.user.id, reason);
  const count = Warnings.listForUser(interaction.guildId, user.id).length;

  await interaction.reply({ content: `⚠️ Warned **${user.tag}**. Reason: ${reason} (${count} total warning${count === 1 ? '' : 's'})` });
  await logAction(interaction.guild, { action: '⚠️ Member warned', target: user, moderator: interaction.user, reason });

  await user.send({ content: `You were warned in **${interaction.guild.name}**: ${reason}` }).catch(() => {});
}

async function handleWarnings(interaction) {
  const user = interaction.options.getUser('user');
  const warnings = Warnings.listForUser(interaction.guildId, user.id);

  if (warnings.length === 0) {
    return interaction.reply({ content: `**${user.tag}** has no warnings.`, ephemeral: true });
  }

  const lines = warnings.slice(0, 15).map((w) => `**#${w.id}** — ${w.reason || 'No reason'} *(by <@${w.moderator_id}>, ${w.created_at})*`);
  const embed = new EmbedBuilder()
    .setTitle(`⚠️ Warnings for ${user.tag}`)
    .setDescription(lines.join('\n'))
    .setColor(MOD_COLOR)
    .setFooter({ text: `${warnings.length} total` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleClearWarnings(interaction) {
  const user = interaction.options.getUser('user');
  const count = Warnings.clearForUser(interaction.guildId, user.id);

  await interaction.reply({ content: `🧹 Cleared **${count}** warning${count === 1 ? '' : 's'} for **${user.tag}**.` });
  await logAction(interaction.guild, { action: '🧹 Warnings cleared', target: user, moderator: interaction.user, reason: `${count} warning(s) cleared` });
}

async function handlePurge(interaction) {
  const amount = interaction.options.getInteger('amount');
  const user = interaction.options.getUser('user');

  await interaction.deferReply({ ephemeral: true });

  try {
    const messages = await interaction.channel.messages.fetch({ limit: amount });
    const toDelete = user ? messages.filter((m) => m.author.id === user.id) : messages;
    const deleted = await interaction.channel.bulkDelete(toDelete, true);
    await interaction.editReply({ content: `🧹 Deleted ${deleted.size} message${deleted.size === 1 ? '' : 's'}.` });
  } catch (err) {
    await interaction.editReply({ content: `Couldn't delete messages (Discord only allows bulk-deleting messages under 14 days old): ${err.message}` });
  }
}

module.exports = {
  ban: handleBan,
  unban: handleUnban,
  kick: handleKick,
  timeout: handleTimeout,
  untimeout: handleUntimeout,
  warn: handleWarn,
  warnings: handleWarnings,
  clearwarnings: handleClearWarnings,
  purge: handlePurge,
  canActOn,
};
