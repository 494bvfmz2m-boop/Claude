import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { infoEmbed } from '../music/ui.js';
import { trackLabel, trackLength } from '../util/format.js';
import { replyError } from '../util/guards.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song or playlist (name or YouTube / SoundCloud / Spotify / Apple Music link)')
  .addStringOption((o) => o.setName('query').setDescription('Song name or link').setRequired(true).setAutocomplete(true))
  .addBooleanOption((o) => o.setName('next').setDescription('Put it at the front of the queue'));

export async function autocomplete(interaction) {
  const query = interaction.options.getFocused().trim();
  if (query.length < 2 || /^https?:\/\//i.test(query)) return interaction.respond([]);
  const node = interaction.client.music.node;
  if (!node) return interaction.respond([]);
  const result = await node.rest.resolve(`${config.defaultSearch}:${query}`).catch(() => null);
  const tracks = result?.loadType === 'search' ? result.data.slice(0, 10) : [];
  const choices = tracks
    .filter((t) => t.info.uri && t.info.uri.length <= 100)
    .map((t) => ({ name: `${t.info.title} — ${t.info.author}`.slice(0, 100), value: t.info.uri }));
  return interaction.respond(choices);
}

export async function execute(interaction) {
  const { music } = interaction.client;
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) return replyError(interaction, 'Join a voice channel first.');

  const existing = music.get(interaction.guildId);
  if (existing && existing.voiceChannelId !== voiceChannel.id) {
    return replyError(interaction, `I'm already playing in <#${existing.voiceChannelId}>.`);
  }
  const perms = voiceChannel.permissionsFor(interaction.guild.members.me);
  if (!perms?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    return replyError(interaction, `I need permission to connect and speak in <#${voiceChannel.id}>.`);
  }

  await interaction.deferReply();

  let found;
  try {
    found = await music.search(interaction.options.getString('query', true));
  } catch (error) {
    return replyError(interaction, error.message);
  }

  const queue = await music.connect({ guild: interaction.guild, voiceChannel, textChannel: interaction.channel });
  const wasPlaying = queue.isPlaying;
  const playNext = interaction.options.getBoolean('next') ?? false;

  if (playNext && wasPlaying) {
    queue.tracks.unshift(...found.tracks.map((t) => ({ ...t, requester: interaction.user.id })));
  } else {
    await music.enqueue(queue, found.tracks, interaction.user.id);
  }

  const first = found.tracks[0];
  let message;
  if (found.playlistName) {
    message = `📃 Added **${found.tracks.length}** tracks from **${found.playlistName}**`;
  } else if (wasPlaying) {
    const position = playNext ? 1 : queue.tracks.length;
    message = `➕ Queued ${trackLabel(first)} • \`${trackLength(first)}\` at position **${position}**`;
  } else {
    message = `🎶 Starting ${trackLabel(first)} • \`${trackLength(first)}\``;
  }
  return interaction.editReply({ embeds: [infoEmbed(message)] });
}
