require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Events, REST, Routes } = require('discord.js');
const db = require('./db');
const { startScheduler } = require('./scheduler');

const requiredEnv = ['DISCORD_TOKEN', 'CLIENT_ID'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  client.commands.set(command.data.name, command);
}

async function registerCommands() {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const body = [...client.commands.values()].map((c) => c.data.toJSON());
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);

  const data = await rest.put(route, { body });
  console.log(
    `Registered ${data.length} application (/) command(s)${
      process.env.GUILD_ID ? ` for guild ${process.env.GUILD_ID}` : ' globally'
    }.`,
  );
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  db.load();

  try {
    await registerCommands();
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }

  startScheduler(readyClient);
  console.log('Reminder scheduler started.');
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error executing command ${interaction.commandName}:`, err);
      const payload = { content: 'Something went wrong while running that command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error(`Error in autocomplete for ${interaction.commandName}:`, err);
    }
  }
});

client.on(Events.Error, (err) => console.error('Client error:', err));

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down.');
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
