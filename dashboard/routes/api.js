const express = require('express');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { verifyCsrf } = require('../utils/csrf');
const { getBotGuilds, getGuildChannels, getGuildRoles, sendMessage, editMessage } = require('../utils/discordApi');
const { db, getGuildSettings, updateGuildSettings } = require('../../src/database/db');
const { giveawayEmbed, giveawayEndedEmbed, orderEmbed } = require('../../src/utils/embeds');
const { pickWinners } = require('../../src/handlers/giveawayManager');
const { logger } = require('../../src/utils/logger');

const router = express.Router();

async function assertBotInGuild(guildId) {
  const guilds = await getBotGuilds();
  return guilds.some((g) => g.id === guildId);
}

router.get('/guilds', async (req, res) => {
  try {
    const guilds = await getBotGuilds();
    res.json(guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon })));
  } catch (err) {
    logger.error('Failed to fetch bot guilds:', err.message);
    res.status(502).json({ error: 'Failed to reach Discord API.' });
  }
});

router.get('/guilds/:id/channels', async (req, res) => {
  if (!(await assertBotInGuild(req.params.id))) return res.status(404).json({ error: 'Bot is not in that server.' });
  const channels = await getGuildChannels(req.params.id);
  res.json(channels.map((c) => ({ id: c.id, name: c.name, type: c.type, parent_id: c.parent_id })));
});

router.get('/guilds/:id/roles', async (req, res) => {
  if (!(await assertBotInGuild(req.params.id))) return res.status(404).json({ error: 'Bot is not in that server.' });
  const roles = await getGuildRoles(req.params.id);
  res.json(roles.filter((r) => r.name !== '@everyone').map((r) => ({ id: r.id, name: r.name, color: r.color })));
});

router.get('/guilds/:id/settings', async (req, res) => {
  if (!(await assertBotInGuild(req.params.id))) return res.status(404).json({ error: 'Bot is not in that server.' });
  res.json(getGuildSettings(req.params.id));
});

const SETTINGS_FIELDS = [
  'welcome_channel_id', 'welcome_message', 'leave_channel_id', 'leave_message',
  'log_channel_id', 'mod_log_channel_id', 'order_channel_id', 'ticket_category_id',
  'ticket_staff_role_id', 'ticket_log_channel_id', 'antiraid_enabled',
  'antiraid_join_threshold', 'antiraid_join_window_ms', 'antiraid_min_account_age_days', 'antiraid_action',
];

router.post('/guilds/:id/settings', verifyCsrf, async (req, res) => {
  if (!(await assertBotInGuild(req.params.id))) return res.status(404).json({ error: 'Bot is not in that server.' });
  const fields = {};
  for (const key of SETTINGS_FIELDS) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
      fields[key] = req.body[key];
    }
  }
  const updated = updateGuildSettings(req.params.id, fields);
  res.json(updated);
});

router.get('/guilds/:id/warnings', (req, res) => {
  const rows = db.prepare('SELECT * FROM warnings WHERE guild_id = ? ORDER BY created_at DESC LIMIT 200').all(req.params.id);
  res.json(rows);
});

router.get('/guilds/:id/tickets', (req, res) => {
  const rows = db.prepare('SELECT * FROM tickets WHERE guild_id = ? ORDER BY created_at DESC LIMIT 200').all(req.params.id);
  res.json(rows);
});

router.get('/guilds/:id/giveaways', (req, res) => {
  const rows = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY end_time DESC LIMIT 100').all(req.params.id);
  res.json(rows.map((r) => ({ ...r, entries: JSON.parse(r.entries).length })));
});

router.post('/guilds/:id/giveaways', verifyCsrf, async (req, res) => {
  const guildId = req.params.id;
  if (!(await assertBotInGuild(guildId))) return res.status(404).json({ error: 'Bot is not in that server.' });

  const { channel_id: channelId, prize, winner_count: winnerCountRaw, duration_minutes: durationMinutesRaw } = req.body || {};
  const winnerCount = Math.max(1, Math.min(20, parseInt(winnerCountRaw, 10) || 1));
  const durationMinutes = parseFloat(durationMinutesRaw);

  if (!channelId || !prize || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return res.status(400).json({ error: 'channel_id, prize, and a positive duration_minutes are required.' });
  }

  const durationMs = durationMinutes * 60 * 1000;
  const endTime = Date.now() + durationMs;
  const hostId = 'dashboard';

  try {
    const info = db.prepare(
      'INSERT INTO giveaways (guild_id, channel_id, prize, winner_count, host_id, end_time, ended, entries) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
    ).run(guildId, channelId, prize, winnerCount, hostId, endTime, '[]');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter Giveaway').setEmoji('🎉').setStyle(ButtonStyle.Success),
    );
    const message = await sendMessage(channelId, {
      embeds: [giveawayEmbed({ prize, winnerCount, endTime, hostId: 'the dashboard admin', entryCount: 0 }).toJSON()],
      components: [row.toJSON()],
    });
    db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(message.id, info.lastInsertRowid);
    res.json({ success: true, id: info.lastInsertRowid, messageId: message.id });
  } catch (err) {
    logger.error('Failed to start giveaway from dashboard:', err.message);
    res.status(502).json({ error: 'Failed to post giveaway to Discord.' });
  }
});

router.post('/guilds/:id/giveaways/:gid/end', verifyCsrf, async (req, res) => {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ? AND guild_id = ?').get(req.params.gid, req.params.id);
  if (!giveaway) return res.status(404).json({ error: 'Giveaway not found.' });
  if (giveaway.ended) return res.status(409).json({ error: 'Giveaway already ended.' });

  const entries = JSON.parse(giveaway.entries);
  const winners = pickWinners(entries, giveaway.winner_count);
  db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(giveaway.id);

  try {
    const endedEmbed = giveawayEndedEmbed({ prize: giveaway.prize, winnerCount: giveaway.winner_count, hostId: giveaway.host_id, winners }).toJSON();
    if (giveaway.message_id) {
      await editMessage(giveaway.channel_id, giveaway.message_id, { embeds: [endedEmbed], components: [] });
    }
    await sendMessage(giveaway.channel_id, {
      content: winners.length
        ? `🎉 Congratulations ${winners.map((w) => `<@${w}>`).join(', ')}! You won **${giveaway.prize}**!`
        : `No valid entries for **${giveaway.prize}** — no winner could be chosen.`,
    });
    res.json({ success: true, winners });
  } catch (err) {
    logger.error('Failed to end giveaway from dashboard:', err.message);
    res.status(502).json({ error: 'Giveaway marked ended, but posting the result to Discord failed.' });
  }
});

router.get('/guilds/:id/orders', (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE guild_id = ? ORDER BY created_at DESC LIMIT 200').all(req.params.id);
  res.json(rows);
});

router.post('/guilds/:id/orders', verifyCsrf, async (req, res) => {
  const guildId = req.params.id;
  const settings = getGuildSettings(guildId);
  if (!settings.order_channel_id) return res.status(409).json({ error: 'No order channel configured for this server yet.' });

  const { order_ref: orderRef, customer, product, amount, status } = req.body || {};
  if (!orderRef || !product) return res.status(400).json({ error: 'order_ref and product are required.' });
  const safeStatus = ['received', 'paid', 'fulfilled', 'cancelled', 'refunded'].includes(status) ? status : 'received';

  try {
    db.prepare('INSERT INTO orders (guild_id, order_ref, customer, product, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(guildId, orderRef, customer || null, product, amount || null, safeStatus, Date.now());
    await sendMessage(settings.order_channel_id, {
      embeds: [orderEmbed({ orderRef, customer, product, amount, status: safeStatus }).toJSON()],
    });
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to post order from dashboard:', err.message);
    res.status(502).json({ error: 'Failed to post order embed to Discord.' });
  }
});

module.exports = router;
