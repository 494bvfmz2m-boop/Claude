import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { trackLabel } from '../util/format.js';
import { getControllableQueue, replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Remove a song from the queue')
  .addIntegerOption((o) => o.setName('position').setDescription('Queue position').setMinValue(1).setRequired(true));

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  const position = interaction.options.getInteger('position', true);
  if (position > queue.tracks.length) return replyError(interaction, `The queue only has ${queue.tracks.length} tracks.`);
  const [removed] = queue.tracks.splice(position - 1, 1);
  return interaction.reply({ embeds: [infoEmbed(`🗑️ Removed ${trackLabel(removed)}`)] });
}
