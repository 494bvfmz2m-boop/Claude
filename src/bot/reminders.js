const { Reminders } = require('../db/repo');
const { parseDuration } = require('./moderation');

async function handleRemind(interaction) {
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

module.exports = { remind: handleRemind };
