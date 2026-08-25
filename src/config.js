require('dotenv').config();
const path = require('path');

function required(name, fallback) {
  const val = process.env[name];
  return val === undefined || val === '' ? fallback : val;
}

const parsedPort = parseInt(required('PORT', '3000'), 10);

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  adminPassword: required('ADMIN_PASSWORD', 'change-me'),
  sessionSecret: required('SESSION_SECRET', 'insecure-dev-secret'),
  port: Number.isNaN(parsedPort) ? 3000 : parsedPort,
  cookieSecure: required('COOKIE_SECURE', 'false') === 'true',
  dbPath: required('DB_PATH', path.join(__dirname, '..', 'data', 'bot.sqlite')),
};
