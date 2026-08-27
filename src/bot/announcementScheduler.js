const { Events } = require('discord.js');
const { ScheduledAnnouncements } = require('../db/repo');

const CHECK_INTERVAL_MS = 30000;
const RECURRENCE_MS = { daily: 24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000 };

async function sendAnnouncement(client, announcement) {
  try {
    const channel = await client.channels.fetch(announcement.channel_id).catch(() => null);
    if (channel) await channel.send(announcement.message).catch(() => {});
  } catch (err) {
    console.error(`Failed to send scheduled announcement ${announcement.id}:`, err.message);
  }

  const bump = RECURRENCE_MS[announcement.recurrence];
  if (bump) {
    // Base the next run off the scheduled time, not "now" -- keeps a daily
    // 9am announcement landing at 9am even if this sweep runs a bit late,
    // instead of the schedule slowly drifting later each time.
    let next = new Date(announcement.next_run).getTime() + bump;
    const now = Date.now();
    while (next <= now) next += bump;
    ScheduledAnnouncements.reschedule(announcement.id, new Date(next).toISOString());
  } else {
    ScheduledAnnouncements.deactivate(announcement.id);
  }
}

async function checkDueAnnouncements(client) {
  const due = ScheduledAnnouncements.listDue(new Date().toISOString());
  for (const announcement of due) {
    await sendAnnouncement(client, announcement);
  }
}

function register(client) {
  client.once(Events.ClientReady, () => {
    checkDueAnnouncements(client).catch((err) => console.error('Announcement scheduler check failed:', err.message));
    setInterval(() => {
      checkDueAnnouncements(client).catch((err) => console.error('Announcement scheduler check failed:', err.message));
    }, CHECK_INTERVAL_MS);
  });
}

module.exports = { register };
