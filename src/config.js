require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordGuildId: required('DISCORD_GUILD_ID', ''),

  port: Number(required('PORT', 3000)),
  sessionSecret: required('SESSION_SECRET', 'insecure-dev-secret-change-me'),
  dashboardUsername: required('DASHBOARD_USERNAME', 'admin'),
  dashboardPasswordHash: required('DASHBOARD_PASSWORD_HASH', ''),

  matchMinOverlap: Number(required('MATCH_MIN_OVERLAP', 1)),
  matchMinRatio: Number(required('MATCH_MIN_RATIO', 0.3)),

  databaseFile: required('DATABASE_FILE', './data/bot.sqlite3'),
};
