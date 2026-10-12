import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue, replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder().setName('previous').setDescription('Play the previous song again');

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  if (!(await interaction.client.music.previous(queue))) return replyError(interaction, 'There is no previous song.');
  return interaction.reply({ embeds: [infoEmbed('⏮️ Playing the previous song')] });
}
