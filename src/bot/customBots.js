const { Client, Events } = require('discord.js');
const { CLIENT_OPTIONS } = require('./clientOptions');
const { registerAllFeatures, registerCommandsForGuild, warmUpAndRefreshAll } = require('./registerAll');
const { CustomBots } = require('../db/repo');
const { isConfigured, decrypt } = require('../web/lib/tokenCrypto');
const registry = require('./clientRegistry');

const DISCORD_API = 'https://discord.com/api/v10';

// A client that's logging in or already live -- kept separate from
// clientRegistry's map (which only ever holds a READY client) so a
// dashboard request never gets handed a client mid-login or mid-shutdown.
const pendingOrLiveClients = new Map(); // guildId -> Client

// Validates a token against Discord's REST API before opening a gateway
// connection at all -- fails fast with a clear reason (bad token, wrong
// kind of token pasted) instead of a confusing gateway-level error later.
async function fetchApplicationInfo(token) {
  const res = await fetch(`${DISCORD_API}/oauth2/applications/@me`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("That token was rejected by Discord — double-check you copied the Bot Token (Developer Portal → Bot → Reset Token), not the Client Secret.");
    }
    const body = await res.text().catch(() => '');
    throw new Error(`Discord rejected this token (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Starts a custom bot for one guild: validates the token, logs it in,
// confirms it actually landed in the target guild, wires up the exact
// same feature set as the main bot (registerAllFeatures), and registers
// it in clientRegistry so the dashboard starts routing that guild's
// requests through it immediately.
async function startCustomBot(guildId, token) {
  const appInfo = await fetchApplicationInfo(token);

  const client = new Client(CLIENT_OPTIONS);
  pendingOrLiveClients.set(guildId, client);

  let readyTimer;
  const ready = new Promise((resolve, reject) => {
    client.once(Events.ClientReady, () => { clearTimeout(readyTimer); resolve(); });
    client.once('error', (err) => { clearTimeout(readyTimer); reject(err); });
    readyTimer = setTimeout(() => reject(new Error('Timed out connecting to Discord.')), 20_000);
  });

  registerAllFeatures(client, {
    onReady: async () => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return; // caught below, once `ready` resolves
      registerCommandsForGuild(guild);
      warmUpAndRefreshAll(client).catch(() => {});
    },
  });

  try {
    await client.login(token);
    await ready;
  } catch (err) {
    pendingOrLiveClients.delete(guildId);
    await client.destroy().catch(() => {});
    throw new Error(`Couldn't log in with that token: ${err.message}`);
  }

  if (!client.guilds.cache.has(guildId)) {
    pendingOrLiveClients.delete(guildId);
    await client.destroy().catch(() => {});
    throw new Error("That bot logged in, but it isn't a member of this server yet — invite it first (see the invite link below), then try again.");
  }

  registry.registerCustomClient(guildId, client);
  CustomBots.setConnected(guildId, {
    applicationId: appInfo.id,
    botUserId: client.user.id,
    botUsername: client.user.tag,
    botAvatar: client.user.avatarURL({ size: 64 }),
  });

  client.on('error', (err) => {
    console.error(`Custom bot for guild ${guildId} errored:`, err.message);
    CustomBots.setError(guildId, err.message);
  });

  return { applicationId: appInfo.id, botTag: client.user.tag };
}

// Disconnects and de-registers a guild's custom bot -- the guild falls
// back to being served by the main bot immediately (clientRegistry just
// stops finding an entry for it). Does not touch the database row; callers
// that mean to remove the subscription entirely also call CustomBots.remove.
async function stopCustomBot(guildId) {
  const client = pendingOrLiveClients.get(guildId);
  registry.unregisterCustomClient(guildId);
  pendingOrLiveClients.delete(guildId);
  if (client) await client.destroy().catch(() => {});
}

// Called once at boot -- reconnects every custom bot that was connected
// (or last seen erroring, worth retrying once) before the process
// restarted. A bot that fails to reconnect (revoked token, Discord outage)
// is marked with an error rather than left silently disconnected -- its
// guild just falls back to the main bot until the owner fixes it.
async function startAllSavedCustomBots() {
  if (!isConfigured()) return;
  const rows = CustomBots.list().filter((r) => r.status === 'connected' || r.status === 'error');
  for (const row of rows) {
    const token = decrypt(row.encrypted_token);
    if (!token) {
      CustomBots.setError(row.guild_id, 'Stored token could not be decrypted (TOKEN_ENCRYPTION_KEY may have changed) -- re-upload it.');
      continue;
    }
    try {
      await startCustomBot(row.guild_id, token);
      console.log(`Custom bot reconnected for guild ${row.guild_id}.`);
    } catch (err) {
      console.error(`Custom bot for guild ${row.guild_id} failed to reconnect:`, err.message);
      CustomBots.setError(row.guild_id, err.message);
    }
  }
}

module.exports = { startCustomBot, stopCustomBot, startAllSavedCustomBots, fetchApplicationInfo };
