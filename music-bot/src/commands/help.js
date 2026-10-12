import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder().setName('help').setDescription('List all commands');

export async function execute(interaction) {
  const lines = [...interaction.client.commands.values()]
    .map((c) => `\`/${c.data.name}\` — ${c.data.description}`)
    .sort();
  const embed = new EmbedBuilder().setColor(config.embedColor).setTitle('🎵 Commands').setDescription(lines.join('\n'));
  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
