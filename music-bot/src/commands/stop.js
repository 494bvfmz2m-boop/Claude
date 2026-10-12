import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue } from '../util/guards.js';

export const data = new SlashCommandBuilder().setName('stop').setDescription('Stop the music and clear the queue');

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  await interaction.client.music.stop(queue);
  return interaction.reply({ embeds: [infoEmbed('⏹️ Stopped the music and cleared the queue.')] });
}
