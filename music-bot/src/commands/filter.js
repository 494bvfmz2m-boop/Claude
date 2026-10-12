import { SlashCommandBuilder } from 'discord.js';
import { filterPresets } from '../music/filters.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue } from '../util/guards.js';

export const data = new SlashCommandBuilder()
  .setName('filter')
  .setDescription('Apply an audio filter')
  .addStringOption((o) =>
    o
      .setName('preset')
      .setDescription('Filter to apply')
      .setRequired(true)
      .addChoices(...Object.entries(filterPresets).map(([value, { label }]) => ({ name: label, value }))),
  );

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  const name = interaction.options.getString('preset', true);
  await interaction.deferReply();
  await interaction.client.music.setFilter(queue, name);
  await interaction.client.music.refreshNowPlaying(queue);
  const text = name === 'off' ? '🎛️ Filters cleared' : `🎛️ Filter set to **${filterPresets[name].label}** (takes a few seconds)`;
  return interaction.editReply({ embeds: [infoEmbed(text)] });
}
