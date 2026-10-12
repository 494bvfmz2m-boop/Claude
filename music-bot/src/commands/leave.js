import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue } from '../util/guards.js';

export const data = new SlashCommandBuilder().setName('leave').setDescription('Disconnect from the voice channel');

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  await interaction.client.music.destroy(interaction.guildId);
  return interaction.reply({ embeds: [infoEmbed('👋 Bye!')] });
}
