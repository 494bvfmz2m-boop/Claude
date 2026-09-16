const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../database/db');
const { giveawayEmbed, giveawayEndedEmbed } = require('../utils/embeds');
const { logger } = require('../utils/logger');

const CHECK_INTERVAL_MS = 15000;

function enterRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter Giveaway').setEmoji('🎉').setStyle(ButtonStyle.Success).setDisabled(disabled),
  );
}

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

async function startGiveaway(client, { guildId, channelId, prize, winnerCount, durationMs, hostId }) {
  const endTime = Date.now() + durationMs;
  const info = db.prepare(
    'INSERT INTO giveaways (guild_id, channel_id, prize, winner_count, host_id, end_time, ended, entries) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
  ).run(guildId, channelId, prize, winnerCount, hostId, endTime, '[]');

  const channel = await client.channels.fetch(channelId);
  const message = await channel.send({
    embeds: [giveawayEmbed({ prize, winnerCount, endTime, hostId, entryCount: 0 })],
    components: [enterRow()],
  });
  db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(message.id, info.lastInsertRowid);
  return info.lastInsertRowid;
}

async function enterGiveaway(interaction) {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(interaction.message.id);
  if (!giveaway || giveaway.ended) {
    return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });
  }
  const entries = JSON.parse(giveaway.entries);
  if (entries.includes(interaction.user.id)) {
    return interaction.reply({ content: 'You have already entered this giveaway. Good luck! 🍀', ephemeral: true });
  }
  entries.push(interaction.user.id);
  db.prepare('UPDATE giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(entries), giveaway.id);
  return interaction.reply({ content: '🎉 You entered the giveaway! Good luck!', ephemeral: true });
}

async function endGiveaway(client, giveawayId) {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId);
  if (!giveaway || giveaway.ended) return null;

  const entries = JSON.parse(giveaway.entries);
  const winners = pickWinners(entries, giveaway.winner_count);
  db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(giveaway.id);

  try {
    const channel = await client.channels.fetch(giveaway.channel_id);
    const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    const endedEmbed = giveawayEndedEmbed({ prize: giveaway.prize, winnerCount: giveaway.winner_count, hostId: giveaway.host_id, winners });
    if (message) await message.edit({ embeds: [endedEmbed], components: [enterRow(true)] });

    if (winners.length) {
      await channel.send({ content: `🎉 Congratulations ${winners.map((w) => `<@${w}>`).join(', ')}! You won **${giveaway.prize}**!` });
    } else {
      await channel.send({ content: `No valid entries for **${giveaway.prize}** — no winner could be chosen.` });
    }
  } catch (err) {
    logger.error('Failed to finalize giveaway:', err.message);
  }
  return winners;
}

async function rerollGiveaway(client, giveawayId) {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId);
  if (!giveaway) return null;
  const entries = JSON.parse(giveaway.entries);
  const winners = pickWinners(entries, giveaway.winner_count);
  try {
    const channel = await client.channels.fetch(giveaway.channel_id);
    if (winners.length) {
      await channel.send({ content: `🎉 New winner(s) for **${giveaway.prize}**: ${winners.map((w) => `<@${w}>`).join(', ')}!` });
    } else {
      await channel.send({ content: `Cannot reroll **${giveaway.prize}** — no entries were recorded.` });
    }
  } catch (err) {
    logger.error('Failed to reroll giveaway:', err.message);
  }
  return winners;
}

function startGiveawayChecker(client) {
  const check = async () => {
    const due = db.prepare('SELECT id FROM giveaways WHERE ended = 0 AND end_time <= ?').all(Date.now());
    for (const row of due) {
      await endGiveaway(client, row.id).catch((err) => logger.error('Giveaway auto-end failed:', err.message));
    }
  };
  check();
  setInterval(check, CHECK_INTERVAL_MS);
}

module.exports = { startGiveaway, enterGiveaway, endGiveaway, rerollGiveaway, startGiveawayChecker, enterRow, pickWinners };
