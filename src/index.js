const config = require('./config');
require('./db/database'); // ensures schema exists before anything else runs

const { Events } = require('discord.js');
const client = require('./bot/client');
const { register: registerInteractions } = require('./bot/interactions');
const { registerAllGuildCommands, registerCommandsForGuild } = require('./bot/commands');
const { register: registerSwearFilter } = require('./bot/swearFilter');
const { register: registerLinkFilter } = require('./bot/linkFilter');
const { register: registerStaffList, warmUpAndRefreshAll } = require('./bot/staffList');
const { register: registerReactionRoles } = require('./bot/reactionRoles');
const { register: registerDmGreeting } = require('./bot/dmGreeting');
const { register: registerBetaGate } = require('./bot/betaGate');
const { register: registerWelcome } = require('./bot/welcome');
const { register: registerPollScheduler } = require('./bot/pollScheduler');
const { register: registerMessageLog } = require('./bot/messageLog');
const { register: registerGiveawayScheduler } = require('./bot/giveawayScheduler');
const { register: registerAnnouncementScheduler } = require('./bot/announcementScheduler');
const { register: registerStatsChannels } = require('./bot/statsChannels');
const { register: registerAfk } = require('./bot/afk');
const { register: registerReminderScheduler } = require('./bot/reminderScheduler');
const { register: registerRoleTriggers } = require('./bot/roleTriggers');
const createApp = require('./web/app');

if (!config.discordToken || !config.discordClientId) {
  console.error('DISCORD_TOKEN / DISCORD_CLIENT_ID is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

if (!config.discordClientSecret || !config.dashboardUrl) {
  console.error('DISCORD_CLIENT_SECRET and DASHBOARD_URL are required — Discord login is the only way into the dashboard. Copy .env.example to .env and fill them in.');
  process.exit(1);
}

registerInteractions(client);
registerSwearFilter(client);
registerLinkFilter(client);
registerStaffList(client);
registerReactionRoles(client);
registerDmGreeting(client);
registerBetaGate(client);
registerWelcome(client);
registerPollScheduler(client);
registerMessageLog(client);
registerGiveawayScheduler(client);
registerAnnouncementScheduler(client);
registerStatsChannels(client);
registerAfk(client);
registerReminderScheduler(client);
registerRoleTriggers(client);

client.once(Events.ClientReady, async () => {
  console.log(`Bot logged in as ${client.user.tag}, in ${client.guilds.cache.size} server(s).`);
  await registerAllGuildCommands(client);
  warmUpAndRefreshAll(client).catch((err) => console.error('Staff list warm-up failed:', err.message));
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
