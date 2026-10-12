import { REST, Routes } from 'discord.js';
import { loadCommands } from './commands.js';
import { config } from './config.js';

const commands = await loadCommands();
const body = [...commands.values()].map((c) => c.data.toJSON());
const rest = new REST().setToken(config.token);

const route = config.guildId
  ? Routes.applicationGuildCommands(config.clientId, config.guildId)
  : Routes.applicationCommands(config.clientId);

await rest.put(route, { body });
console.log(`Registered ${body.length} commands ${config.guildId ? `in guild ${config.guildId}` : 'globally (may take up to an hour to appear)'}.`);
