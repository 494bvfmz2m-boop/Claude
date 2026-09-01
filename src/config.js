require('dotenv').config();
const path = require('path');

function required(name, fallback) {
  const val = process.env[name];
  return val === undefined || val === '' ? fallback : val;
}

const parsedPort = parseInt(required('PORT', '3000'), 10);

// Discord OAuth is the only way to log into the dashboard, so both of these
// are required. DASHBOARD_URL is this app's own public base URL, e.g.
// https://tickets.example.com (no trailing slash), used to build the exact
// redirect_uri Discord expects.
const dashboardUrl = required('DASHBOARD_URL', null);
const discordClientSecret = required('DISCORD_CLIENT_SECRET', null);

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordClientSecret,
  dashboardUrl,
  oauthRedirectUri: dashboardUrl ? `${dashboardUrl.replace(/\/+$/, '')}/auth/discord/callback` : null,
  // The one Discord user ID that can reach /staff to toggle closed-beta mode
  // and manage who's allowed to log in. Leave unset to disable that entirely.
  ownerDiscordId: required('OWNER_DISCORD_ID', null),
  betaContactHandle: required('BETA_CONTACT_HANDLE', 'spontanedonder'),
  // Total closed-beta slots, shown on the marketing site via /api/beta-status.
  // Not enforced anywhere -- just the denominator for "X of Y spots taken".
  betaTotalSlots: parseInt(required('BETA_TOTAL_SLOTS', '15'), 10) || 15,
  sessionSecret: required('SESSION_SECRET', 'insecure-dev-secret'),
  port: Number.isNaN(parsedPort) ? 3000 : parsedPort,
  cookieSecure: required('COOKIE_SECURE', 'false') === 'true',
  dbPath: required('DB_PATH', path.join(__dirname, '..', 'data', 'bot.sqlite')),
  // Encrypts custom-bot tokens at rest (see bot/customBots.js). Feature is
  // simply unavailable if this is unset -- never a reason to crash the app.
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY', null),
};
