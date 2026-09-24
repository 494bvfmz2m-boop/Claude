const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { asyncHandler } = require('../utils/asyncHandler');
const { db, getGuildSettings } = require('../../src/database/db');
const { orderEmbed } = require('../../src/utils/embeds');
const { sendMessage } = require('../utils/discordApi');
const { logger } = require('../../src/utils/logger');

const router = express.Router();
const stripeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

let stripeClient = null;
function getStripeClient() {
  if (!stripeClient) {
    const Stripe = require('stripe');
    // The secret API key is only needed if you later want to enrich orders
    // (e.g. fetch line items); it's not required for signature verification.
    stripeClient = new Stripe(config.stripeSecretKey || 'sk_not_configured');
  }
  return stripeClient;
}

function extractOrder(event) {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    return {
      orderRef: session.id,
      customer: session.customer_details?.email || session.customer_details?.name || 'Unknown',
      amount: session.amount_total != null ? `${(session.amount_total / 100).toFixed(2)} ${(session.currency || '').toUpperCase()}` : 'N/A',
      product: session.metadata?.product || session.metadata?.product_name || 'N/A',
      status: session.payment_status === 'paid' ? 'paid' : 'received',
    };
  }
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    return {
      orderRef: intent.id,
      customer: intent.receipt_email || 'Unknown',
      amount: `${(intent.amount / 100).toFixed(2)} ${(intent.currency || '').toUpperCase()}`,
      product: intent.description || intent.metadata?.product || 'N/A',
      status: 'paid',
    };
  }
  return null;
}

// Configure this URL as a Stripe webhook endpoint (per-guild) listening for at
// least `checkout.session.completed` and/or `payment_intent.succeeded`.
// Needs the raw request body for signature verification — server.js captures
// it into req.rawBody alongside the normal JSON parse, so this route doesn't
// need its own body-parser.
router.post('/stripe/:guildId', stripeLimiter, asyncHandler(async (req, res) => {
  if (!config.stripeWebhookSecret) {
    return res.status(503).json({ error: 'Stripe webhooks are not configured on this server.' });
  }
  const signature = req.get('stripe-signature');
  if (!signature || !req.rawBody) {
    return res.status(400).json({ error: 'Missing Stripe signature or request body.' });
  }

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(req.rawBody, signature, config.stripeWebhookSecret);
  } catch (err) {
    logger.warn(`Rejected Stripe webhook with invalid signature from ${req.ip}: ${err.message}`);
    return res.status(400).json({ error: 'Invalid signature.' });
  }

  const { guildId } = req.params;
  const order = extractOrder(event);
  if (!order) {
    return res.json({ received: true, skipped: `unhandled event type ${event.type}` });
  }

  const settings = getGuildSettings(guildId);
  if (!settings.order_channel_id) {
    return res.json({ received: true, skipped: 'no order channel configured for this server' });
  }

  const alreadyProcessed = db.prepare('SELECT id FROM orders WHERE guild_id = ? AND order_ref = ?').get(guildId, order.orderRef);
  if (alreadyProcessed) {
    return res.json({ received: true, skipped: 'duplicate event, already processed' });
  }

  try {
    db.prepare('INSERT INTO orders (guild_id, order_ref, customer, product, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(guildId, order.orderRef, order.customer, order.product, order.amount, order.status, Date.now());
    await sendMessage(settings.order_channel_id, { embeds: [orderEmbed(order).toJSON()] });
    res.json({ received: true });
  } catch (err) {
    logger.error('Failed to post Stripe order embed:', err.message);
    res.status(500).json({ error: 'Failed to post order embed.' });
  }
}));

module.exports = router;
