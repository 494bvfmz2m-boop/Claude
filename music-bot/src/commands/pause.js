import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue, replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder().setName('pause').setDescription('Pause the music');

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction, { playing: true });
  if (!queue) return;
  if (queue.player.paused) return replyError(interaction, 'Already paused. Use `/resume`.');
  await queue.player.setPaused(true);
  await interaction.client.music.refreshNowPlaying(queue);
  return interaction.reply({ embeds: [infoEmbed('⏸️ Paused')] });
}
