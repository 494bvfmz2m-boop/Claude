const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { safeEqual } = require('../utils/csrf');
const { db, getGuildSettings } = require('../../src/database/db');
const { orderEmbed } = require('../../src/utils/embeds');
const { sendMessage } = require('../utils/discordApi');
const { logger } = require('../../src/utils/logger');

const router = express.Router();

const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

// External integrations (a storefront, Stripe, etc.) POST here to automatically
// post an order embed when an order is received. Protected by a shared secret
// header rather than a session, since the caller isn't a logged-in browser.
router.post('/order/:guildId', webhookLimiter, express.json({ limit: '20kb' }), async (req, res) => {
  if (!config.orderWebhookSecret) {
    return res.status(503).json({ error: 'Order webhooks are not configured on this server.' });
  }
  const provided = req.get('x-webhook-secret');
  if (!provided || !safeEqual(provided, config.orderWebhookSecret)) {
    logger.warn(`Rejected order webhook with invalid secret from ${req.ip}`);
    return res.status(401).json({ error: 'Invalid webhook secret.' });
  }

  const { guildId } = req.params;
  const { order_ref: orderRef, customer, product, amount, status } = req.body || {};
  if (!orderRef || !product) {
    return res.status(400).json({ error: 'order_ref and product are required.' });
  }

  const settings = getGuildSettings(guildId);
  if (!settings.order_channel_id) {
    return res.status(409).json({ error: 'No order channel configured for this server yet.' });
  }

  const safeStatus = ['received', 'paid', 'fulfilled', 'cancelled', 'refunded'].includes(status) ? status : 'received';

  try {
    db.prepare('INSERT INTO orders (guild_id, order_ref, customer, product, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(guildId, String(orderRef), customer ? String(customer) : null, String(product), amount ? String(amount) : null, safeStatus, Date.now());

    await sendMessage(settings.order_channel_id, {
      embeds: [orderEmbed({ orderRef, customer, product, amount, status: safeStatus }).toJSON()],
    });
    res.json({ success: true });
  } catch (err) {
    logger.error('Order webhook failed:', err.message);
    res.status(500).json({ error: 'Failed to post order embed.' });
  }
});

module.exports = router;
