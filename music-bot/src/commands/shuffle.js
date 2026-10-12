import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue, replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue');

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  if (queue.tracks.length < 2) return replyError(interaction, 'Need at least 2 tracks in the queue to shuffle.');
  queue.shuffle();
  return interaction.reply({ embeds: [infoEmbed(`🔀 Shuffled **${queue.tracks.length}** tracks`)] });
}
