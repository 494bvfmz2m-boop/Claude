import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { trackLabel } from '../util/format.js';
import { getControllableQueue, replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder()
  .setName('move')
  .setDescription('Move a song to another position in the queue')
  .addIntegerOption((o) => o.setName('from').setDescription('Current position').setMinValue(1).setRequired(true))
  .addIntegerOption((o) => o.setName('to').setDescription('New position').setMinValue(1).setRequired(true));

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  const from = interaction.options.getInteger('from', true);
  const to = interaction.options.getInteger('to', true);
  const len = queue.tracks.length;
  if (from > len || to > len) return replyError(interaction, `The queue only has ${len} tracks.`);
  const [track] = queue.tracks.splice(from - 1, 1);
  queue.tracks.splice(to - 1, 0, track);
  return interaction.reply({ embeds: [infoEmbed(`↕️ Moved ${trackLabel(track)} to position **${to}**`)] });
}
