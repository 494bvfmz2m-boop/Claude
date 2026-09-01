const config = require('./config');
require('./db/database'); // ensures schema exists before anything else runs

const { Events } = require('discord.js');
const client = require('./bot/client');
const { registerAllFeatures, registerAllGuildCommands, warmUpAndRefreshAll, registerCommandsForGuild } = require('./bot/registerAll');
const { startAllSavedCustomBots } = require('./bot/customBots');
const createApp = require('./web/app');

if (!config.discordToken || !config.discordClientId) {
  console.error('DISCORD_TOKEN / DISCORD_CLIENT_ID is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

if (!config.discordClientSecret || !config.dashboardUrl) {
  console.error('DISCORD_CLIENT_SECRET and DASHBOARD_URL are required — Discord login is the only way into the dashboard. Copy .env.example to .env and fill them in.');
  process.exit(1);
}

registerAllFeatures(client, {
  onReady: async () => {
    console.log(`Bot logged in as ${client.user.tag}, in ${client.guilds.cache.size} server(s).`);
    await registerAllGuildCommands(client);
    warmUpAndRefreshAll(client).catch((err) => console.error('Staff list warm-up failed:', err.message));
    // Custom bots (Custom Tebex tier -- see bot/customBots.js) start after
    // the main bot is ready, not before, so a guild with one already
    // connected never briefly double-handles anything from the main bot's
    // own connection during startup.
    startAllSavedCustomBots().catch((err) => console.error('Failed to start saved custom bots:', err.message));
  },
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
