const { EmbedBuilder, Events } = require('discord.js');
const { Reminders } = require('../db/repo');
const { ownsGuild } = require('./clientRegistry');

const CHECK_INTERVAL_MS = 20000;
const COLOR = '#a32ee2';

// DM first; if DMs are closed (or it's not deliverable there), fall back to
// pinging them in the channel the reminder was set from -- same fallback
// whether or not they asked for "here" delivery, so a reminder never just
// silently disappears.
async function deliverReminder(client, reminder) {
  const embed = new EmbedBuilder()
    .setTitle('⏰ Reminder')
    .setColor(COLOR)
    .setDescription(reminder.message || "You didn't say what for!")
    .setFooter({ text: `Set ${reminder.created_at}` });

  try {
    if (reminder.ping_in_channel) {
      const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
      if (channel) await channel.send({ content: `<@${reminder.user_id}>`, embeds: [embed] }).catch(() => {});
    } else {
      const user = await client.users.fetch(reminder.user_id).catch(() => null);
      const sent = user ? await user.send({ embeds: [embed] }).catch(() => null) : null;
      if (!sent) {
        const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
        if (channel) await channel.send({ content: `<@${reminder.user_id}>`, embeds: [embed] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error(`Failed to deliver reminder ${reminder.id}:`, err.message);
  }

  Reminders.remove(reminder.id);
}

async function checkDueReminders(client) {
  // See pollScheduler.js's identical filter -- otherwise a guild with its
  // own custom bot would have every reminder delivered (DM'd) twice, once
  // by each bot.
  const due = Reminders.listDue(new Date().toISOString()).filter((r) => ownsGuild(client, r.guild_id));
  for (const reminder of due) {
    await deliverReminder(client, reminder);
  }
}

function register(client) {
  client.once(Events.ClientReady, () => {
    checkDueReminders(client).catch((err) => console.error('Reminder scheduler check failed:', err.message));
    setInterval(() => {
      checkDueReminders(client).catch((err) => console.error('Reminder scheduler check failed:', err.message));
    }, CHECK_INTERVAL_MS);
  });
}

module.exports = { register };
