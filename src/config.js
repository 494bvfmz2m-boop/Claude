require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordClientSecret: required('DISCORD_CLIENT_SECRET', ''),
  discordRedirectUri: required('DISCORD_REDIRECT_URI', ''),
  discordGuildId: required('DISCORD_GUILD_ID', ''),

  port: Number(required('PORT', 3000)),
  sessionSecret: required('SESSION_SECRET', 'insecure-dev-secret-change-me'),

  // Discord user IDs that can manage every server the bot is in, regardless
  // of their permissions in each individual server. Optional.
  superAdminIds: required('SUPER_ADMIN_DISCORD_IDS', '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),

  matchMinOverlap: Number(required('MATCH_MIN_OVERLAP', 1)),
  matchMinRatio: Number(required('MATCH_MIN_RATIO', 0.3)),

  databaseFile: required('DATABASE_FILE', './data/bot.sqlite3'),
};
