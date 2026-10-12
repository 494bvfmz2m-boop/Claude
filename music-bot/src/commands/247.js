import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { getControllableQueue } from '../util/guards.js';

export const data = new SlashCommandBuilder()
  .setName('247')
  .setDescription('Toggle 24/7 mode: stay in the voice channel even when idle or alone')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction);
  if (!queue) return;
  queue.stay = !queue.stay;
  if (queue.stay) queue.clearIdleTimer();
  return interaction.reply({ embeds: [infoEmbed(`🌙 24/7 mode is now **${queue.stay ? 'on' : 'off'}**`)] });
}
