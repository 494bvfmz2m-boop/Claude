const crypto = require('crypto');
const { AppSettings, TebexTiers, TebexSubscribers, TebexEvents } = require('../../db/repo');

const DISCORD_SNOWFLAKE = /^\d{17,20}$/;

function timingSafeEqualHex(expectedHex, givenHex) {
  if (typeof givenHex !== 'string') return false;
  const a = Buffer.from(expectedHex, 'hex');
  const b = Buffer.from(givenHex, 'hex');
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Tebex's webhook payload carries the buyer's platform account ID under a
// shape that varies by store/platform type and event -- this tries every
// candidate path rather than assuming one. Every event is logged in full
// via TebexEvents regardless of whether this finds anything, so an
// unrecognized shape is visible/debuggable (Recent events, in the
// Subscriptions admin page) instead of silently dropped.
function extractDiscordId(payload) {
  const subject = payload?.subject || {};
  const candidates = [
    subject?.customer?.username?.id,
    subject?.player?.id,
    subject?.player?.uuid,
    subject?.fields?.discord_id, // a custom checkout field, if the store collects one instead
  ];
  for (const c of candidates) {
    const id = c != null ? String(c) : null;
    if (id && DISCORD_SNOWFLAKE.test(id)) return id;
  }
  return null;
}

// The Tebex package ID(s) a payment/recurring-payment event is for -- a
// one-off payment lists packages under subject.packages[], a recurring
// payment has one package directly under subject.package.
function extractPackageIds(payload) {
  const subject = payload?.subject || {};
  const ids = [];
  if (Array.isArray(subject.packages)) {
    for (const p of subject.packages) if (p?.id != null) ids.push(String(p.id));
  }
  if (subject.package?.id != null) ids.push(String(subject.package.id));
  return ids;
}

// A cancellation/refund clears the tier rather than trying to match a
// package -- there may be no package info on a refund event at all.
// payment.declined is deliberately NOT here: nothing was ever granted for
// a declined attempt, so there's nothing to revoke (and revoking would
// wrongly clobber an unrelated existing subscription for the same buyer).
function isRevocation(type, payload) {
  if (type === 'payment.refunded') return true;
  if (type === 'recurring-payment.status-changed') {
    const desc = payload?.subject?.status?.description || '';
    return /cancel|end|expire/i.test(desc);
  }
  return false;
}

// Verifies the X-Tebex-Signature header (HMAC-SHA256 of the raw request
// body, keyed with the webhook secret configured in Settings > Webhooks
// on the Tebex creator panel) and, if valid, updates tebex_subscribers
// from the event. rawBody must be the *unparsed* request body (a Buffer
// or string) -- Tebex signs the exact bytes it sent, so anything that
// re-serializes the parsed JSON before this runs would break verification.
async function verifyAndHandleTebexWebhook(rawBody, signatureHeader) {
  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const secret = AppSettings.get().tebexWebhookSecret;

  if (!secret) {
    TebexEvents.log(null, bodyStr, 0, 'No webhook secret configured in the dashboard -- rejected');
    return { status: 503, message: 'Webhook not configured' };
  }

  const expected = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
  if (!timingSafeEqualHex(expected, signatureHeader)) {
    TebexEvents.log(null, bodyStr, 0, 'Signature did not match -- rejected');
    return { status: 401, message: 'Invalid signature' };
  }

  let payload;
  try {
    payload = JSON.parse(bodyStr);
  } catch {
    TebexEvents.log(null, bodyStr, 0, 'Body was not valid JSON');
    return { status: 400, message: 'Invalid JSON' };
  }

  const type = payload?.type || null;

  // Tebex sends this to confirm the endpoint URL works when you save it in
  // the creator panel -- just acknowledge it, nothing to process.
  if (type === 'validation.webhook') {
    TebexEvents.log(type, bodyStr, 1, 'Validation ping acknowledged');
    return { status: 200, message: 'OK' };
  }

  const discordId = extractDiscordId(payload);
  if (!discordId) {
    TebexEvents.log(type, bodyStr, 0, 'Could not find a Discord user ID in this payload');
    return { status: 200, message: 'OK' }; // still 2XX -- an extraction gap on our end shouldn't make Tebex retry forever
  }

  if (isRevocation(type, payload)) {
    TebexSubscribers.upsert(discordId, null, 'cancelled', payload?.subject?.reference || null);
    TebexEvents.log(type, bodyStr, 1, `Cleared subscription for Discord user ${discordId}`);
    return { status: 200, message: 'OK' };
  }

  const packageIds = extractPackageIds(payload);
  const matchedTiers = packageIds.flatMap((id) => TebexTiers.forPackageId(id));
  if (matchedTiers.length === 0) {
    TebexEvents.log(type, bodyStr, 0, `No configured tier matches package ID(s): ${packageIds.join(', ') || '(none found in payload)'}`);
    return { status: 200, message: 'OK' };
  }

  // Highest level wins if more than one tier matches (a misconfigured
  // overlap, or a bundle spanning packages from two tiers).
  const tier = matchedTiers.reduce((best, t) => (t.level > best.level ? t : best));
  TebexSubscribers.upsert(discordId, tier.id, 'active', payload?.subject?.reference || null);
  TebexEvents.log(type, bodyStr, 1, `Granted tier "${tier.name}" to Discord user ${discordId}`);
  return { status: 200, message: 'OK' };
}

module.exports = { verifyAndHandleTebexWebhook, extractDiscordId, extractPackageIds, isRevocation };
