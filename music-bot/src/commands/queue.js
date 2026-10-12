import { SlashCommandBuilder } from 'discord.js';
import { queuePageEmbed } from '../music/ui.js';
import { replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the queue')
  .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1));

export async function execute(interaction) {
  const queue = interaction.client.music.get(interaction.guildId);
  if (!queue) return replyError(interaction, "I'm not playing anything in this server.");
  return interaction.reply({ embeds: [queuePageEmbed(queue, interaction.options.getInteger('page') ?? 1)] });
}
