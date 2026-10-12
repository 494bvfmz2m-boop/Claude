// Offline sanity check: loads every command and validates its definition against Discord's limits.
import { loadCommands } from './commands.js';

const commands = await loadCommands();
for (const { data } of commands.values()) data.toJSON();
console.log(`OK: ${commands.size} commands — ${[...commands.keys()].sort().join(', ')}`);
