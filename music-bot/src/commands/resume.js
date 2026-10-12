import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue, replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder().setName('resume').setDescription('Resume the music');

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction, { playing: true });
  if (!queue) return;
  if (!queue.player.paused) return replyError(interaction, "The music isn't paused.");
  await queue.player.setPaused(false);
  await interaction.client.music.refreshNowPlaying(queue);
  return interaction.reply({ embeds: [infoEmbed('▶️ Resumed')] });
}
