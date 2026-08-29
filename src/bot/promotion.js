const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getRankForRoleIds, getRoleIdForRank, getMaxRank } = require('./cache');
const { GuildSettings, Hierarchies } = require('../db/repo');
const { recordModAction } = require('./modLog');
const { emojiUrl } = require('./emoji');

const PROMO_COLOR = '#a8e6ff';

function isOverride(guild, member) {
  return guild.ownerId === member.id || member.permissions.has(PermissionFlagsBits.Administrator);
}

async function logAction(guild, title, target, moderator, detail, thumbnail) {
  recordModAction(guild.id, { action: title, target, moderator, reason: detail });

  const settings = GuildSettings.get(guild.id);
  if (!settings.mod_log_channel_id) return;
  const logChannel = await guild.channels.fetch(settings.mod_log_channel_id).catch(() => null);
  if (!logChannel) return;
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(PROMO_COLOR)
    .addFields(
      { name: 'User', value: `<@${target.id}>`, inline: true },
      { name: 'By', value: `<@${moderator.id}>`, inline: true },
      { name: 'Rank change', value: detail, inline: false },
    )
    .setTimestamp();
  if (thumbnail) embed.setThumbnail(thumbnail);
  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

async function applyRankChange(guild, targetMember, currentRoleId, newRoleId) {
  if (currentRoleId) await targetMember.roles.remove(currentRoleId).catch(() => {});
  if (newRoleId) await targetMember.roles.add(newRoleId).catch(() => {});
}

async function changeRank(interaction, direction) {
  const user = interaction.options.getUser('user');
  const steps = interaction.options.getInteger('levels') || 1;
  const guild = interaction.guild;

  if (user.id === interaction.user.id) {
    return interaction.reply({ content: "You can't promote or demote yourself.", ephemeral: true });
  }

  const targetMember = await guild.members.fetch(user.id).catch(() => null);
  if (!targetMember) {
    return interaction.reply({ content: "They're not in this server.", ephemeral: true });
  }

  const hierarchy = Hierarchies.getPrimary(guild.id);
  if (!hierarchy) {
    return interaction.reply({ content: 'No staff hierarchy is set up yet — configure it on the dashboard first.', ephemeral: true });
  }

  const maxRank = getMaxRank(hierarchy.id);
  if (maxRank === 0) {
    return interaction.reply({ content: 'No staff hierarchy is set up yet — configure it on the dashboard first.', ephemeral: true });
  }

  const override = isOverride(guild, interaction.member);
  const invokerRank = getRankForRoleIds(hierarchy.id, [...interaction.member.roles.cache.keys()]);
  const targetRank = getRankForRoleIds(hierarchy.id, [...targetMember.roles.cache.keys()]);

  if (!override && invokerRank.rank === 0) {
    return interaction.reply({ content: "You're not part of the staff hierarchy, so you can't promote or demote anyone.", ephemeral: true });
  }

  if (!override && invokerRank.rank <= targetRank.rank) {
    return interaction.reply({ content: "You can only act on someone with a strictly lower rank than you.", ephemeral: true });
  }

  // Promoting is capped at maxRank, and (unless override) at one below the
  // invoker's own rank -- demoting is capped at 0. Clamped rather than
  // refused outright, so "/promote 5" on someone 2 ranks from the top still
  // promotes them as far as it can, instead of doing nothing.
  const ceiling = direction > 0 && !override ? Math.min(maxRank, invokerRank.rank - 1) : maxRank;
  const requestedRank = targetRank.rank + direction * steps;
  const newRank = Math.min(ceiling, Math.max(0, requestedRank));
  const actualSteps = Math.abs(newRank - targetRank.rank);

  if (actualSteps === 0) {
    const msg = direction > 0
      ? `**${user.tag}** is already at the highest rank you can promote them to.`
      : `**${user.tag}** isn't part of the staff hierarchy — nothing to demote.`;
    return interaction.reply({ content: msg, ephemeral: true });
  }

  const newRoleId = newRank > 0 ? getRoleIdForRank(hierarchy.id, newRank) : null;

  try {
    await applyRankChange(guild, targetMember, targetRank.roleId, newRoleId);
  } catch (err) {
    return interaction.reply({ content: `Couldn't update their roles: ${err.message}`, ephemeral: true });
  }

  const verb = direction > 0 ? 'Promoted' : 'Demoted';
  const emoji = direction > 0 ? '⬆️' : '⬇️';
  const newRankLabel = newRoleId ? `<@&${newRoleId}>` : 'no staff role (fully demoted)';
  const stepsLabel = actualSteps > 1 ? ` ${actualSteps} ranks` : '';
  const clampNote = actualSteps < steps ? ` (asked for ${steps}, but that's as far as they could go)` : '';

  await interaction.reply({ content: `${emoji} ${verb} **${user.tag}**${stepsLabel} to ${newRankLabel}.${clampNote}` });
  await logAction(guild, `${emoji} ${verb}`, user, interaction.user, `rank ${targetRank.rank} → ${newRank}`, direction > 0 ? emojiUrl('modsentry-levelup.gif') : null);
}

module.exports = {
  promote: (interaction) => changeRank(interaction, 1),
  demote: (interaction) => changeRank(interaction, -1),
};
