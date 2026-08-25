require('dotenv').config();
const path = require('path');

function required(name, fallback) {
  const val = process.env[name];
  return val === undefined || val === '' ? fallback : val;
}

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  dbPath: required('DB_PATH', path.join(__dirname, '..', 'data', 'bot.sqlite')),
};
