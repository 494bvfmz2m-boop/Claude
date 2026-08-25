const config = require('./config');
require('./db/database'); // ensures schema exists before anything else runs

const { Events } = require('discord.js');
const client = require('./bot/client');
const { register: registerInteractions } = require('./bot/interactions');
const { registerAllGuildCommands, registerCommandsForGuild } = require('./bot/commands');
const createApp = require('./web/app');

if (!config.discordToken) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

registerInteractions(client);

client.once(Events.ClientReady, async () => {
  console.log(`Bot logged in as ${client.user.tag}, in ${client.guilds.cache.size} server(s).`);
  await registerAllGuildCommands(client);
});

client.on(Events.GuildCreate, (guild) => registerCommandsForGuild(guild));

client.on('error', (err) => console.error('Discord client error:', err));

client.login(config.discordToken).catch((err) => {
  console.error('Failed to log in to Discord. Check DISCORD_TOKEN and that Message Content Intent is enabled in the Developer Portal.', err.message);
  console.error('The dashboard will keep running so you can still access it; the bot itself will stay offline until this is fixed and redeployed.');
});

const app = createApp();
app.listen(config.port, () => {
  console.log(`Dashboard listening on http://0.0.0.0:${config.port}`);
});
