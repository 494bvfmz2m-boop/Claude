const config = require('./config');
require('./db/database'); // ensures schema exists before anything else runs

const { Events } = require('discord.js');
const client = require('./bot/client');
const { register: registerInteractions } = require('./bot/interactions');
const createApp = require('./web/app');

if (!config.discordToken) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

registerInteractions(client);

client.once(Events.ClientReady, () => {
  console.log(`Bot logged in as ${client.user.tag}, in ${client.guilds.cache.size} server(s).`);
});

client.on('error', (err) => console.error('Discord client error:', err));

client.login(config.discordToken).catch((err) => {
  console.error('Failed to log in to Discord. Check DISCORD_TOKEN.', err);
  process.exit(1);
});

const app = createApp();
app.listen(config.port, () => {
  console.log(`Dashboard listening on http://0.0.0.0:${config.port}`);
});
