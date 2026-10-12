import { SlashCommandBuilder } from 'discord.js';
import { nowPlayingEmbed } from '../music/ui.js';
import { replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder().setName('nowplaying').setDescription('Show the current song');

export async function execute(interaction) {
  const queue = interaction.client.music.get(interaction.guildId);
  if (!queue?.isPlaying) return replyError(interaction, 'Nothing is playing right now.');
  return interaction.reply({ embeds: [nowPlayingEmbed(queue, { withProgress: true })] });
}
