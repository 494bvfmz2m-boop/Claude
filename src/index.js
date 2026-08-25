const config = require('./config');
require('./db/database'); // ensures schema exists before anything else runs

const { Events } = require('discord.js');
const client = require('./bot/client');
const { register: registerInteractions } = require('./bot/interactions');
const { registerAllGuildCommands, registerCommandsForGuild } = require('./bot/commands');

if (!config.discordToken) {
  console.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

registerInteractions(client);

client.once(Events.ClientReady, async () => {
  console.log(`Bot logged in as ${client.user.tag}, in ${client.guilds.cache.size} server(s).`);
  await registerAllGuildCommands(client);
  console.log('Slash commands registered.');
});

client.on(Events.GuildCreate, (guild) => registerCommandsForGuild(guild));

client.on('error', (err) => console.error('Discord client error:', err));

client.login(config.discordToken).catch((err) => {
  console.error('Failed to log in to Discord. Check DISCORD_TOKEN.', err.message);
});
