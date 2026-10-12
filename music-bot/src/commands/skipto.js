import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue, replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder()
  .setName('skipto')
  .setDescription('Jump to a position in the queue')
  .addIntegerOption((o) => o.setName('position').setDescription('Queue position').setMinValue(1).setRequired(true));

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction, { playing: true });
  if (!queue) return;
  const position = interaction.options.getInteger('position', true);
  if (position > queue.tracks.length) return replyError(interaction, `The queue only has ${queue.tracks.length} tracks.`);
  await interaction.client.music.skipTo(queue, position - 1);
  return interaction.reply({ embeds: [infoEmbed(`⏩ Jumped to position **${position}**`)] });
}
