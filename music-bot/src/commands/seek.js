import { SlashCommandBuilder } from 'discord.js';
import { infoEmbed } from '../music/ui.js';
import { formatDuration, parseTimestamp } from '../util/format.js';
import { getControllableQueue, replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder()
  .setName('seek')
  .setDescription('Jump to a time in the current song')
  .addStringOption((o) => o.setName('time').setDescription('e.g. 1:30 or 90').setRequired(true));

export async function execute(interaction) {
  const queue = await getControllableQueue(interaction, { playing: true });
  if (!queue) return;
  if (!queue.current.info.isSeekable) return replyError(interaction, "This track can't be seeked.");
  const ms = parseTimestamp(interaction.options.getString('time', true));
  if (ms === null) return replyError(interaction, 'Use a time like `1:30` or `90`.');
  if (ms >= queue.current.info.length) return replyError(interaction, 'That is past the end of the song.');
  await queue.player.seekTo(ms);
  return interaction.reply({ embeds: [infoEmbed(`⏩ Seeked to \`${formatDuration(ms)}\``)] });
}
