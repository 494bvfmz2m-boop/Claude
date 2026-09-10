const { Events } = require('discord.js');
const { TebexSubscribers, ManualTierGrants } = require('../db/repo');
const { enforceGuildLimits } = require('./tierEnforcement');

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // expiry isn't time-critical to the minute

// Manual grants (Staff -> Subscriptions -> Global user lookup, or the
// account-level "Manually grant a tier" form) can optionally carry an
// expires_at -- a temporary comp, a trial, etc. Neither table's normal
// upsert path sets it on its own; only an explicit expiry choice does (see
// TebexSubscribers.setExpiry and ManualTierGrants.upsert's expiresAt arg).
// A real Tebex-driven subscription NEVER has one -- it only ever ends via
// a real cancellation/refund webhook.
async function sweepExpiredManualGrants() {
  const now = new Date().toISOString();
  for (const grant of ManualTierGrants.listExpired(now)) {
    ManualTierGrants.remove(grant.guild_id);
    await enforceGuildLimits(grant.guild_id).catch((err) => console.error(`Expiry enforcement failed for guild ${grant.guild_id}:`, err.message));
  }
}

async function sweepExpiredSubscriptions() {
  const now = new Date().toISOString();
  for (const sub of TebexSubscribers.listExpired(now)) {
    TebexSubscribers.upsert(sub.discord_user_id, null, 'cancelled', sub.tebex_reference);
    if (sub.guild_id) {
      await enforceGuildLimits(sub.guild_id).catch((err) => console.error(`Expiry enforcement failed for guild ${sub.guild_id}:`, err.message));
    }
  }
}

async function checkExpired() {
  await sweepExpiredManualGrants();
  await sweepExpiredSubscriptions();
}

// Only ever wired to the main bot (see index.js) -- expiry is global
// housekeeping against the database, not a per-guild event a custom bot
// needs its own copy of. Registering it twice would just mean both bots
// racing to expire the same rows (harmless -- removal/upsert here is
// idempotent -- but pointless).
function register(client) {
  client.once(Events.ClientReady, () => {
    checkExpired().catch((err) => console.error('Expiry check failed:', err.message));
    setInterval(() => {
      checkExpired().catch((err) => console.error('Expiry check failed:', err.message));
    }, CHECK_INTERVAL_MS);
  });
}

module.exports = { register, checkExpired };
