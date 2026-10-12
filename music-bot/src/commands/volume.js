import { SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue } from '../util/guards.js';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Show or change the volume')
  .addIntegerOption((o) =>
    o.setName('level').setDescription(`0-${config.maxVolume}`).setMinValue(0).setMaxValue(config.maxVolume),
  );

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  const level = interaction.options.getInteger('level');
  if (level === null) return interaction.reply({ embeds: [infoEmbed(`🔊 Volume is **${queue.volume}%**`)] });
  await interaction.client.music.setVolume(queue, level);
  await interaction.client.music.refreshNowPlaying(queue);
  const icon = level === 0 ? '🔇' : level < 50 ? '🔉' : '🔊';
  return interaction.reply({ embeds: [infoEmbed(`${icon} Volume set to **${level}%**`)] });
}
