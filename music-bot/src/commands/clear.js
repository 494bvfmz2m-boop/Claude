import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue } from '../util/guards.js';

export const data = new SlashCommandBuilder().setName('clear').setDescription('Clear the queue (keeps the current song playing)');

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  const count = queue.tracks.length;
  queue.tracks = [];
  return interaction.reply({ embeds: [infoEmbed(`🧹 Cleared **${count}** tracks from the queue`)] });
}
