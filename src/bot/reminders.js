const { EmbedBuilder } = require('discord.js');
const { Reminders } = require('../db/repo');
const { parseDuration } = require('./moderation');

const COLOR = '#a32ee2';

async function handleSet(interaction) {
  const durationInput = interaction.options.getString('time');
  const message = interaction.options.getString('message');
  const here = interaction.options.getBoolean('here') || false;

  const ms = parseDuration(durationInput);
  if (!ms) {
    return interaction.reply({ content: 'Give a time like `10m`, `2h`, or `3d` (up to 28 days).', ephemeral: true });
  }

  const remindAt = new Date(Date.now() + ms);
  Reminders.create({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    message,
    remindAt: remindAt.toISOString(),
    pingInChannel: here,
  });

  await interaction.reply({
    content: `⏰ Got it — I'll remind you <t:${Math.floor(remindAt.getTime() / 1000)}:R>${here ? ' here' : ' by DM'}${message ? `: ${message}` : ''}.`,
    ephemeral: !here,
  });
}

async function handleList(interaction) {
  const pending = Reminders.listForUser(interaction.user.id);
  if (pending.length === 0) {
    return interaction.reply({ content: "You don't have any pending reminders.", ephemeral: true });
  }

  const lines = pending.map((r) => `**#${r.id}** <t:${Math.floor(new Date(r.remind_at).getTime() / 1000)}:R> — ${r.message || '*(no message)*'}`);
  const embed = new EmbedBuilder()
    .setTitle('⏰ Your pending reminders')
    .setColor(COLOR)
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Cancel one with /remind cancel <id>' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCancel(interaction) {
  const id = interaction.options.getInteger('id');
  const reminder = Reminders.getForUser(id, interaction.user.id);
  if (!reminder) {
    return interaction.reply({ content: `Couldn't find a pending reminder #${id} of yours.`, ephemeral: true });
  }

  Reminders.remove(id);
  await interaction.reply({ content: `🗑️ Cancelled reminder #${id}.`, ephemeral: true });
}

async function handleRemind(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'list') return handleList(interaction);
  if (sub === 'cancel') return handleCancel(interaction);
  return handleSet(interaction);
}

module.exports = { remind: handleRemind };
