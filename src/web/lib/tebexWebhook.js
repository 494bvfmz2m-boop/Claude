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

// A "secret" shown in a provider's dashboard isn't always meant to be used
// as literal UTF-8 text for the HMAC key -- some encode it as base64 (or
// hex) and expect it decoded into raw bytes first. We don't know which
// convention Tebex uses, so this computes the digest under every plausible
// interpretation of the same configured secret and accepts a match against
// any of them, rather than assuming one and rejecting a genuinely correct
// secret just because it needed decoding first.
function candidateKeys(secret) {
  const keys = [{ label: 'utf8 (literal text)', buf: Buffer.from(secret, 'utf8') }];
  try {
    const b64 = Buffer.from(secret, 'base64');
    // Buffer.from(str, 'base64') silently ignores invalid characters rather
    // than throwing, so only trust it as a real interpretation if
    // re-encoding it lands back on the same string (i.e. it actually was
    // valid base64), and it's not identical to the literal-text bytes.
    if (b64.length > 0 && b64.toString('base64').replace(/=+$/, '') === secret.replace(/=+$/, '') && !b64.equals(keys[0].buf)) {
      keys.push({ label: 'base64-decoded', buf: b64 });
    }
  } catch { /* not valid base64 -- skip */ }
  if (/^[0-9a-f]+$/i.test(secret) && secret.length % 2 === 0) {
    const hexBuf = Buffer.from(secret, 'hex');
    if (hexBuf.length > 0 && !hexBuf.equals(keys[0].buf)) keys.push({ label: 'hex-decoded', buf: hexBuf });
  }
  return keys;
}

// Per Tebex's docs (Developers > Webhooks > Overview), the signature is NOT
// a plain HMAC over the raw body. It's built in two steps: first SHA256-hash
// the raw JSON body to a hex string, then HMAC-SHA256 *that hex string* (as
// the message/data) using the webhook secret as the key. Their PHP example:
//   $signature = hash_hmac('sha256', hash('sha256', $json), $secret);
// -- the inner hash('sha256', $json) is the body's hex digest, which becomes
// the data for the outer hmac. Signing the raw body directly (what earlier
// rounds of this code did) never matches.
function bodyHashHex(bodyStr) {
  return crypto.createHash('sha256').update(bodyStr).digest('hex');
}

// Tries every candidate key interpretation against the signature found in
// the request; returns the label of whichever matched, or null.
function matchAnyKeyEncoding(secret, bodyStr, signatureHex) {
  const hashedBody = bodyHashHex(bodyStr);
  for (const { label, buf } of candidateKeys(secret)) {
    const digest = crypto.createHmac('sha256', buf).update(hashedBody).digest('hex');
    if (timingSafeEqualHex(digest, signatureHex)) return label;
  }
  return null;
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

// The exact header name Tebex uses isn't fully pinned down (their docs
// were unreachable while building this -- see the commit that introduced
// this file), so this checks every plausible variant rather than assuming
// one. Whichever is present gets used; if none are, that's logged plainly
// rather than silently failing as if a signature had been checked at all.
const SIGNATURE_HEADER_CANDIDATES = ['x-tebex-signature', 'x-signature', 'x-webhook-signature', 'x-hub-signature-256'];

function findSignatureHeader(headers) {
  for (const name of SIGNATURE_HEADER_CANDIDATES) {
    const value = headers?.[name];
    if (value) return { name, value };
  }
  return null;
}

// A signature value is sometimes prefixed with the algorithm name (GitHub/
// Stripe-style "sha256=<hex>") -- strip that if present so a correct
// signature isn't rejected just for carrying a prefix we didn't expect.
function stripAlgoPrefix(value) {
  const match = /^sha256=(.+)$/i.exec(value.trim());
  return match ? match[1] : value.trim();
}

// Verifies the signature header (HMAC-SHA256 of the raw request body,
// keyed with the webhook secret configured in Settings > Webhooks on the
// Tebex creator panel) and, if valid, updates tebex_subscribers from the
// event. rawBody must be the *unparsed* request body (a Buffer or string)
// -- Tebex signs the exact bytes it sent, so anything that re-serializes
// the parsed JSON before this runs would break verification. headers is
// the request's header map (lowercase keys, as Node/Express give them).
async function verifyAndHandleTebexWebhook(rawBody, headers = {}) {
  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const secret = AppSettings.get().tebexWebhookSecret;

  if (!secret) {
    TebexEvents.log(null, bodyStr, 0, 'No webhook secret configured in the dashboard -- rejected');
    return { status: 503, message: 'Webhook not configured' };
  }

  const found = findSignatureHeader(headers);
  const matchedEncoding = found ? matchAnyKeyEncoding(secret, bodyStr, stripAlgoPrefix(found.value)) : null;
  if (!matchedEncoding) {
    const literalDigest = crypto.createHmac('sha256', secret).update(bodyHashHex(bodyStr)).digest('hex');
    const headerList = Object.keys(headers).join(', ') || '(none)';
    const receivedNote = found
      ? `header "${found.name}" = "${found.value}"`
      : `no signature header found (checked: ${SIGNATURE_HEADER_CANDIDATES.join(', ')})`;
    TebexEvents.log(null, bodyStr, 0, `Signature did not match under any key encoding (literal/base64/hex) -- rejected. Computed (literal utf8, hmac over sha256(body)) "${literalDigest}" over a ${bodyStr.length}-byte body, received ${receivedNote}. All headers present: ${headerList}.`);
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
    TebexEvents.log(type, bodyStr, 1, `Validation ping acknowledged (signature matched using the ${matchedEncoding} key)`);
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

module.exports = { verifyAndHandleTebexWebhook, extractDiscordId, extractPackageIds, isRevocation, findSignatureHeader, stripAlgoPrefix, candidateKeys, matchAnyKeyEncoding, bodyHashHex };
