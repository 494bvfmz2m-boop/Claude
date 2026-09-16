const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GuildSettings } = require('../db/repo');
const colors = require('./colors');

const VERIFY_COLOR = colors.BRAND;
const DEFAULT_MESSAGE = 'Click the button below to verify and get access to the rest of the server.';

function buildVerificationMessage(settings) {
  const embed = new EmbedBuilder()
    .setTitle('✅ Verification')
    .setDescription(settings.verification_message || DEFAULT_MESSAGE)
    .setColor(VERIFY_COLOR);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify_click').setLabel('Verify').setStyle(ButtonStyle.Success).setEmoji('✅'),
  );
  return { embeds: [embed], components: [row] };
}

async function postOrUpdatePanel(guild, channel, settings) {
  if (settings.verification_message_id) {
    const existing = await channel.messages.fetch(settings.verification_message_id).catch(() => null);
    if (existing) {
      await existing.edit(buildVerificationMessage(settings));
      return existing;
    }
  }
  const sent = await channel.send(buildVerificationMessage(settings));
  GuildSettings.setVerificationMessage(guild.id, sent.id);
  return sent;
}

async function handleVerifyClick(interaction) {
  const settings = GuildSettings.get(interaction.guildId);
  if (!settings.verification_enabled || !settings.verification_role_id) {
    return interaction.reply({ content: "Verification isn't set up right now.", ephemeral: true });
  }

  const role = interaction.guild.roles.cache.get(settings.verification_role_id);
  if (!role) {
    return interaction.reply({ content: "The verification role no longer exists -- let a staff member know.", ephemeral: true });
  }

  if (interaction.member.roles.cache.has(role.id)) {
    return interaction.reply({ content: "You're already verified!", ephemeral: true });
  }

  // This button gets clicked by every new member, often right as they join
  // -- exactly when Discord's API is likeliest to be a little slow for
  // them. Deferring first means a sluggish role.add() never shows up as
  // "This interaction failed" on someone's very first action in the server.
  await interaction.deferReply({ ephemeral: true });

  try {
    await interaction.member.roles.add(role);
  } catch {
    return interaction.editReply({ content: "Couldn't give you the role -- XyphrosMod's role might need to be dragged above it in Server Settings → Roles." });
  }

  return interaction.editReply({ content: "You're verified! Welcome in." });
}

module.exports = { postOrUpdatePanel, buildVerificationMessage, handleVerifyClick };
