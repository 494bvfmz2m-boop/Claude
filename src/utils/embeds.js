const { EmbedBuilder } = require('discord.js');
const { FREQUENCIES, computeOccurrence, toUnixSeconds } = require('./time');

const COLOR = 0x5865f2;

function triggerEmbed(reminder) {
  return new EmbedBuilder()
    .setTitle('⏰ Reminder')
    .setDescription(reminder.description)
    .addFields(
      { name: 'Frequency', value: FREQUENCIES[reminder.frequency].label, inline: true },
      { name: 'Reminder ID', value: `#${reminder.id}`, inline: true },
    )
    .setColor(COLOR)
    .setTimestamp();
}

function detailLine(reminder) {
  const occurrence = computeOccurrence(
    reminder.anchorISO,
    reminder.timezone,
    reminder.frequency,
    reminder.occurrenceIndex,
  );
  const unix = toUnixSeconds(occurrence);
  const freq = FREQUENCIES[reminder.frequency].label;
  return (
    `**#${reminder.id}** — ${reminder.description}\n` +
    `${freq} • Next: <t:${unix}:F> (<t:${unix}:R>) • Timezone: \`${reminder.timezone}\``
  );
}

function listEmbed(reminders, { title = 'Active Reminders' } = {}) {
  const embed = new EmbedBuilder().setTitle(title).setColor(COLOR);
  if (reminders.length === 0) {
    embed.setDescription('No active reminders. Use `/reminder set` to create one.');
    return embed;
  }
  const sorted = [...reminders].sort((a, b) => {
    const ta = computeOccurrence(a.anchorISO, a.timezone, a.frequency, a.occurrenceIndex);
    const tb = computeOccurrence(b.anchorISO, b.timezone, b.frequency, b.occurrenceIndex);
    return ta.toMillis() - tb.toMillis();
  });
  embed.setDescription(sorted.map(detailLine).join('\n\n'));
  return embed;
}

module.exports = { triggerEmbed, listEmbed, detailLine };
