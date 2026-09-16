const { DateTime } = require('luxon');
const db = require('./db');
const { computeOccurrence } = require('./utils/time');
const { triggerEmbed } = require('./utils/embeds');

const CHECK_INTERVAL_MS = 60 * 1000;
const DEFAULT_OWNER_ID = '1227918600753512480';

function getOwnerId() {
  return process.env.OWNER_ID || DEFAULT_OWNER_ID;
}

async function deliverReminder(client, reminder) {
  const embed = triggerEmbed(reminder);

  try {
    const owner = await client.users.fetch(getOwnerId());
    await owner.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Failed to DM owner for reminder #${reminder.id}:`, err.message);
  }

  const guildConfig = db.getGuildConfig(reminder.guildId);
  if (guildConfig?.channelId) {
    try {
      const channel = await client.channels.fetch(guildConfig.channelId);
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error(`Failed to post reminder #${reminder.id} to configured channel:`, err.message);
    }
  }
}

async function checkReminders(client) {
  const now = DateTime.utc();
  const reminders = db.listAllActiveReminders();

  for (const reminder of reminders) {
    const occurrence = computeOccurrence(
      reminder.anchorISO,
      reminder.timezone,
      reminder.frequency,
      reminder.occurrenceIndex,
    );

    if (occurrence > now) continue;

    await deliverReminder(client, reminder);

    if (reminder.frequency === 'once') {
      db.updateReminder(reminder.id, { active: false });
    } else {
      db.updateReminder(reminder.id, { occurrenceIndex: reminder.occurrenceIndex + 1 });
    }
  }
}

function startScheduler(client) {
  checkReminders(client).catch((err) => console.error('Scheduler tick failed:', err));
  setInterval(() => {
    checkReminders(client).catch((err) => console.error('Scheduler tick failed:', err));
  }, CHECK_INTERVAL_MS);
}

module.exports = { startScheduler, getOwnerId, DEFAULT_OWNER_ID };
