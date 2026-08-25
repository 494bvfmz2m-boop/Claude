require('dotenv').config();
const path = require('path');

function required(name, fallback) {
  const val = process.env[name] ?? fallback;
  return val;
}

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  adminPassword: required('ADMIN_PASSWORD', 'change-me'),
  sessionSecret: required('SESSION_SECRET', 'insecure-dev-secret'),
  port: parseInt(required('PORT', '3000'), 10),
  cookieSecure: required('COOKIE_SECURE', 'false') === 'true',
  dbPath: required('DB_PATH', path.join(__dirname, '..', 'data', 'bot.sqlite')),
};
