import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { formatDuration, progressBar, trackLabel, trackLength } from '../util/format.js';

const loopLabels = { off: 'Off', track: 'Track', queue: 'Queue' };

export function infoEmbed(description) {
  return new EmbedBuilder().setColor(config.embedColor).setDescription(description);
}

export function errorEmbed(description) {
  return new EmbedBuilder().setColor(0xef4444).setDescription(`❌ ${description}`);
}

export function nowPlayingEmbed(queue, { withProgress = false } = {}) {
  const track = queue.current;
  const embed = new EmbedBuilder()
    .setColor(config.embedColor)
    .setAuthor({ name: queue.player.paused ? 'Paused' : 'Now playing' })
    .setTitle(track.info.title.slice(0, 256))
    .setURL(track.info.uri ?? null)
    .setThumbnail(track.info.artworkUrl ?? null)
    .addFields(
      { name: 'Artist', value: track.info.author || 'Unknown', inline: true },
      { name: 'Duration', value: trackLength(track), inline: true },
      { name: 'Requested by', value: track.requester ? `<@${track.requester}>` : 'Autoplay', inline: true },
    )
    .setFooter({
      text: `Loop: ${loopLabels[queue.loop]} • Autoplay: ${queue.autoplay ? 'On' : 'Off'} • Volume: ${queue.volume}% • Filter: ${queue.filter} • ${queue.tracks.length} in queue`,
    });

  if (withProgress && !track.info.isStream) {
    const pos = queue.player.position;
    embed.setDescription(`${progressBar(pos, track.info.length)}\n\`${formatDuration(pos)} / ${formatDuration(track.info.length)}\``);
  }
  return embed;
}

export function controlRow(queue, disabled = false) {
  const paused = queue?.player.paused ?? false;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:previous').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('music:pause')
      .setEmoji(paused ? '▶️' : '⏸️')
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder().setCustomId('music:skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('music:loop')
      .setEmoji(queue?.loop === 'track' ? '🔂' : '🔁')
      .setStyle(queue && queue.loop !== 'off' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder().setCustomId('music:stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

export function queuePageEmbed(queue, page, perPage = 10) {
  const totalPages = Math.max(1, Math.ceil(queue.tracks.length / perPage));
  const p = Math.min(Math.max(page, 1), totalPages);
  const start = (p - 1) * perPage;
  const lines = queue.tracks
    .slice(start, start + perPage)
    .map((t, i) => `\`${start + i + 1}.\` ${trackLabel(t, 50)} • \`${trackLength(t)}\``);

  const totalMs = queue.tracks.reduce((sum, t) => sum + (t.info.isStream ? 0 : t.info.length), 0);
  const current = queue.current ? `**Now playing:** ${trackLabel(queue.current)} • \`${trackLength(queue.current)}\`\n\n` : '';

  return new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle('Queue')
    .setDescription(current + (lines.length ? lines.join('\n') : '*The queue is empty.*'))
    .setFooter({ text: `Page ${p}/${totalPages} • ${queue.tracks.length} tracks • ${formatDuration(totalMs)} total • Loop: ${loopLabels[queue.loop]}` });
}
