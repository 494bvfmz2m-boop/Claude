const { EmbedBuilder, Events } = require('discord.js');
const { Polls } = require('../db/repo');

const POLL_COLOR = '#a8e6ff';
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
const CHECK_INTERVAL_MS = 30000;

function buildResultsDescription(options, counts) {
  const total = counts.reduce((sum, c) => sum + c, 0);
  const highest = Math.max(...counts, 0);
  return options.map((o, i) => {
    const count = counts[i];
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const crown = total > 0 && count === highest ? ' 👑' : '';
    return `${NUMBER_EMOJIS[i]} ${o} -- **${count}** vote${count === 1 ? '' : 's'} (${pct}%)${crown}`;
  }).join('\n\n') + `\n\n${total} total vote${total === 1 ? '' : 's'}`;
}

// A poll that's overdue when we go to close it (bot was offline, channel/
// message got deleted meanwhile, etc.) still gets marked closed either way --
// there's no fixing a poll whose message is gone, and leaving it open would
// just have the scheduler retry it forever.
async function closePoll(client, poll) {
  try {
    const channel = await client.channels.fetch(poll.channel_id).catch(() => null);
    const message = channel ? await channel.messages.fetch(poll.message_id).catch(() => null) : null;

    if (message) {
      const counts = poll.options.map((_, i) => {
        const reaction = message.reactions.cache.get(NUMBER_EMOJIS[i]);
        // -1 for the bot's own reaction it added when the poll was created.
        return reaction ? Math.max(0, reaction.count - 1) : 0;
      });

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${poll.question}`)
        .setDescription(buildResultsDescription(poll.options, counts))
        .setColor(POLL_COLOR)
        .setFooter({ text: '🔒 Poll closed' })
        .setTimestamp();

      await message.edit({ embeds: [embed] }).catch(() => {});
      await message.reactions.removeAll().catch(() => {});
    }
  } catch (err) {
    console.error(`Failed to close poll ${poll.id}:`, err.message);
  }

  Polls.markClosed(poll.id);
}

async function checkDuePolls(client) {
  const due = Polls.listDue(new Date().toISOString());
  for (const poll of due) {
    await closePoll(client, poll);
  }
}

function register(client) {
  client.once(Events.ClientReady, () => {
    checkDuePolls(client).catch((err) => console.error('Poll scheduler check failed:', err.message));
    setInterval(() => {
      checkDuePolls(client).catch((err) => console.error('Poll scheduler check failed:', err.message));
    }, CHECK_INTERVAL_MS);
  });
}

module.exports = { register };
