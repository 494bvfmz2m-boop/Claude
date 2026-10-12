import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue } from '../util/guards.js';

const icons = { off: '➡️', track: '🔂', queue: '🔁' };

export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Set the loop mode')
  .addStringOption((o) =>
    o
      .setName('mode')
      .setDescription('What to repeat')
      .setRequired(true)
      .addChoices({ name: 'Off', value: 'off' }, { name: 'Track', value: 'track' }, { name: 'Queue', value: 'queue' }),
  );

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  queue.loop = interaction.options.getString('mode', true);
  await interaction.client.music.refreshNowPlaying(queue);
  return interaction.reply({ embeds: [infoEmbed(`${icons[queue.loop]} Loop mode: **${queue.loop}**`)] });
}
