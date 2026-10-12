import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { trackLabel } from '../util/format.js';
import { getControllableQueue } from '../util/guards.js';

export const data = new SlashCommandBuilder().setName('skip').setDescription('Skip the current song');

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction, { playing: true });
  if (!queue) return;
  const skipped = queue.current;
  await interaction.client.music.skip(queue);
  return interaction.reply({ embeds: [infoEmbed(`⏭️ Skipped ${trackLabel(skipped)}`)] });
}
