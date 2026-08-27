const { EmbedBuilder, Events } = require('discord.js');
const { Giveaways } = require('../db/repo');

const GIVEAWAY_COLOR = '#a8e6ff';
const CHECK_INTERVAL_MS = 30000;

function pickWinners(entries, count) {
  const pool = [...entries];
  const winners = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

async function endGiveaway(client, giveaway) {
  try {
    const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
    const message = channel ? await channel.messages.fetch(giveaway.message_id).catch(() => null) : null;
    const winners = pickWinners(giveaway.entries, giveaway.winner_count);

    if (message) {
      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.prize}`)
        .setColor(GIVEAWAY_COLOR)
        .setDescription(winners.length > 0
          ? `Winner${winners.length === 1 ? '' : 's'}: ${winners.map((w) => `<@${w}>`).join(', ')}`
          : 'Nobody entered.')
        .addFields({ name: 'Total entries', value: String(giveaway.entries.length), inline: true })
        .setFooter({ text: '🔒 Giveaway ended' })
        .setTimestamp();
      await message.edit({ embeds: [embed], components: [] }).catch(() => {});

      if (winners.length > 0) {
        await channel.send({ content: `🎉 Congrats ${winners.map((w) => `<@${w}>`).join(', ')} -- you won **${giveaway.prize}**!` }).catch(() => {});
      }
    }
  } catch (err) {
    console.error(`Failed to end giveaway ${giveaway.id}:`, err.message);
  }

  Giveaways.markEnded(giveaway.id);
}

async function checkDueGiveaways(client) {
  const due = Giveaways.listDue(new Date().toISOString());
  for (const giveaway of due) {
    await endGiveaway(client, giveaway);
  }
}

function register(client) {
  client.once(Events.ClientReady, () => {
    checkDueGiveaways(client).catch((err) => console.error('Giveaway scheduler check failed:', err.message));
    setInterval(() => {
      checkDueGiveaways(client).catch((err) => console.error('Giveaway scheduler check failed:', err.message));
    }, CHECK_INTERVAL_MS);
  });
}

module.exports = { register };
