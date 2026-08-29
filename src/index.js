const config = require('./config');
const { createBot } = require('./discord/bot');
const { createServer } = require('./web/server');

if (!config.discordToken) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = createBot();

client.login(config.discordToken).catch((err) => {
  console.error(
    'Failed to log in to Discord (dashboard will stay up so you can fix .env):',
    err.message
  );
});

const app = createServer(client);
app.listen(config.port, () => {
  console.log(`Dashboard listening on http://localhost:${config.port}`);
});
