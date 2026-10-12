import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = new URL('./commands/', import.meta.url);

/** Loads every module in src/commands into a Map keyed by command name. */
export async function loadCommands() {
  const commands = new Map();
  const files = (await readdir(fileURLToPath(dir))).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const mod = await import(new URL(file, dir));
    if (!mod.data || !mod.execute) throw new Error(`commands/${file} must export "data" and "execute"`);
    commands.set(mod.data.name, mod);
  }
  return commands;
}
