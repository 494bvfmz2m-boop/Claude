import { MessageFlags } from 'discord.js';
import { errorEmbed } from '../music/ui.js';

export function replyError(interaction, message) {
  const payload = { embeds: [errorEmbed(message)], flags: MessageFlags.Ephemeral };
  return interaction.deferred || interaction.replied ? interaction.followUp(payload) : interaction.reply(payload);
}

/**
 * Checks that the member can control playback and returns the guild's queue, or null after
 * replying with an error. Options: `playing` requires a current track.
 */
export async function getControllableQueue(interaction, { playing = false } = {}) {
  const queue = interaction.client.music.get(interaction.guildId);
  if (!queue) {
    await replyError(interaction, "I'm not playing anything in this server.");
    return null;
  }
  const memberChannelId = interaction.member?.voice?.channelId;
  const botChannelId = interaction.guild.members.me?.voice?.channelId ?? queue.voiceChannelId;
  if (memberChannelId !== botChannelId) {
    await replyError(interaction, `You need to be in <#${botChannelId}> to do that.`);
    return null;
  }
  if (playing && !queue.isPlaying) {
    await replyError(interaction, 'Nothing is playing right now.');
    return null;
  }
  return queue;
}
