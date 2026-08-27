const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { BetaRequests, BetaAllowlist, DashboardAdmins } = require('../db/repo');

const COLOR = '#a8e6ff';

function adminRecipientIds() {
  const ids = new Set(DashboardAdmins.list().map((a) => a.discord_user_id));
  if (config.ownerDiscordId) ids.add(config.ownerDiscordId);
  return [...ids];
}

function buildRequestEmbed(request) {
  return new EmbedBuilder()
    .setTitle('🔑 Beta access request')
    .setColor(COLOR)
    .addFields(
      { name: 'From', value: `<@${request.discordUserId}> (${request.discordTag || request.discordUserId})` },
      { name: 'Message', value: request.message || '*No message*' },
    )
    .setFooter({ text: `Request #${request.id}` })
    .setTimestamp();
}

// DMs every current admin (plus the owner) a copy of the request with its
// own Approve/Reject buttons -- each copy is a separate DM message, so
// deciding it from one admin's DM doesn't update what any other admin sees
// there; the request itself (in the DB) is still only ever decided once,
// whoever gets to it first.
async function notifyAdmins(client, request) {
  const embed = buildRequestEmbed(request);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`beta_approve:${request.id}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`beta_reject:${request.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
  );
  for (const adminId of adminRecipientIds()) {
    const user = await client.users.fetch(adminId).catch(() => null);
    if (!user) continue;
    await user.send({ embeds: [embed], components: [row] }).catch(() => {});
  }
}

async function handleBetaRequestButton(interaction) {
  const [prefix, idStr] = interaction.customId.split(':');
  const approve = prefix === 'beta_approve';
  const id = Number(idStr);
  const request = BetaRequests.get(id);

  if (!request) {
    return interaction.reply({ content: "This request no longer exists.", ephemeral: true });
  }
  if (request.status !== 'pending') {
    return interaction.reply({ content: `Already ${request.status} by <@${request.decided_by}>.`, ephemeral: true });
  }

  BetaRequests.decide(id, approve ? 'approved' : 'rejected', interaction.user.id);
  if (approve) BetaAllowlist.add(request.discord_user_id);

  const requester = await interaction.client.users.fetch(request.discord_user_id).catch(() => null);
  if (requester) {
    const resultEmbed = new EmbedBuilder()
      .setColor(approve ? '#23a55a' : '#ed4245')
      .setTitle(approve ? '✅ Beta access approved' : '❌ Beta access request declined')
      .setDescription(approve
        ? `You're in! Log in any time at [bot.modsentry.site](${config.dashboardUrl || 'https://bot.modsentry.site'}).`
        : "Your request wasn't approved this time.");
    await requester.send({ embeds: [resultEmbed] }).catch(() => {});
  }

  const decidedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(approve ? '#23a55a' : '#ed4245')
    .addFields({ name: approve ? '✅ Approved' : '❌ Rejected', value: `By ${interaction.user.tag}` });
  await interaction.update({ embeds: [decidedEmbed], components: [] });
}

module.exports = { notifyAdmins, handleBetaRequestButton };
