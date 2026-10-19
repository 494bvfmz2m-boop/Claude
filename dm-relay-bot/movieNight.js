const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const storage = require('./storage');
const { sendTemporary, isModerator, row } = require('./util');

const EMPTY_DELETE_MS = 5 * 60_000; // delete this long after the last person leaves
const UNUSED_DELETE_MS = 15 * 60_000; // delete if nobody joins at all
// Taken away from everyone in the channel. Administrators ignore channel permissions, so only they keep these.
const MUTED = [
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.Stream,
  PermissionFlagsBits.UseSoundboard,
  PermissionFlagsBits.UseExternalSounds,
  PermissionFlagsBits.UseEmbeddedActivities,
];

let client;
const timers = new Map(); // voice channel ID -> pending delete timeout

const nights = () => storage.data.movieNights;

function scheduleDelete(channelId, ms) {
  clearTimeout(timers.get(channelId));
  timers.set(channelId, setTimeout(() => end(channelId).catch(() => {}), ms));
}

async function init(discordClient) {
  client = discordClient;
  // Pick up movie nights that were running before a restart.
  for (const channelId of Object.keys(nights())) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) await end(channelId);
    else if (channel.members.size === 0) scheduleDelete(channelId, EMPTY_DELETE_MS);
  }
}

// "@Bot movie night [name]"
async function start(message, name) {
  await message.delete().catch(() => {});
  const { member, guild } = message;
  if (!isModerator(member)) return;

  // Put it next to the channel the command was used in. Threads/posts use their parent's category.
  const base = message.channel.isThread() ? message.channel.parent : message.channel;
  const category = base?.parent ?? null;
  // Copy the category's permissions so private categories stay private, but take talking and streaming away.
  const overwrites = (category?.permissionOverwrites.cache ?? new Map()).map((o) => ({
    id: o.id,
    type: o.type,
    allow: o.allow.remove(MUTED),
    deny: o.deny,
  }));
  const everyone = overwrites.find((o) => o.id === guild.id);
  if (everyone) everyone.deny = everyone.deny.add(MUTED);
  else overwrites.push({ id: guild.id, deny: MUTED });

  let voice;
  try {
    voice = await guild.channels.create({
      name: `🍿 ${name || 'Movie Night'}`.slice(0, 100),
      type: ChannelType.GuildVoice,
      parent: category?.id,
      permissionOverwrites: overwrites,
      reason: `Movie night started by ${message.author.tag}`,
    });
  } catch (err) {
    console.error('Could not create movie night channel:', err.message);
    return sendTemporary(
      message.channel,
      { content: `${message.author} ⚠️ I couldn't create the channel. I need **Manage Channels** and **Manage Roles**.`, allowedMentions: { parse: [] } },
      15_000
    );
  }

  const announcement = await message.channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xeb459e)
        .setTitle(`🍿 ${name || 'Movie night'} is starting!`)
        .setDescription(
          `Join ${voice} to watch.\n\n🔇 Everyone is muted and can't share their screen. Only admins can talk and stream.`
        )
        .setFooter({ text: 'The channel deletes itself 5 minutes after everyone leaves.' }),
    ],
    components: [
      row(new ButtonBuilder().setCustomId(`movie:end:${voice.id}`).setLabel('End movie night').setEmoji('🛑').setStyle(ButtonStyle.Danger)),
    ],
  });
  nights()[voice.id] = { announcementChannelId: announcement.channelId, announcementId: announcement.id };
  storage.save();
  scheduleDelete(voice.id, UNUSED_DELETE_MS);
}

async function end(channelId) {
  clearTimeout(timers.get(channelId));
  timers.delete(channelId);
  const night = nights()[channelId];
  delete nights()[channelId];
  storage.save();

  const channel = await client.channels.fetch(channelId).catch(() => null);
  await channel?.delete('Movie night ended').catch(() => {});
  if (!night) return;
  const announcementChannel = await client.channels.fetch(night.announcementChannelId).catch(() => null);
  const announcement = await announcementChannel?.messages.fetch(night.announcementId).catch(() => null);
  await announcement
    ?.edit({
      embeds: [new EmbedBuilder().setColor(0x99aab5).setTitle('🍿 Movie night has ended').setDescription('Thanks for watching!')],
      components: [],
    })
    .catch(() => {});
}

async function handleInteraction(interaction) {
  if (!interaction.customId?.startsWith('movie:')) return;
  if (!isModerator(interaction.member)) {
    return interaction.reply({ content: 'Only staff can end movie night.', flags: MessageFlags.Ephemeral });
  }
  await interaction.deferUpdate();
  return end(interaction.customId.split(':')[2]);
}

function handleVoiceState(oldState, newState) {
  if (newState.channelId && nights()[newState.channelId]) {
    clearTimeout(timers.get(newState.channelId));
    timers.delete(newState.channelId);
  }
  if (oldState.channelId && oldState.channelId !== newState.channelId && nights()[oldState.channelId]) {
    if (oldState.channel?.members.size === 0) scheduleDelete(oldState.channelId, EMPTY_DELETE_MS);
  }
}

module.exports = { init, start, handleInteraction, handleVoiceState };
