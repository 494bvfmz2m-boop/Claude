import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue } from '../util/guards.js';

export const data = new SlashCommandBuilder()
  .setName('autoplay')
  .setDescription('Toggle autoplay: keep playing similar songs when the queue runs out');

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  queue.autoplay = !queue.autoplay;
  await interaction.client.music.refreshNowPlaying(queue);
  return interaction.reply({ embeds: [infoEmbed(`📻 Autoplay is now **${queue.autoplay ? 'on' : 'off'}**`)] });
}
