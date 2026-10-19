const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');
const storage = require('./storage');
const { sendTemporary, formatDuration, isModerator, row } = require('./util');

const WINDOW_DAYS = 30; // stats cover this many days
const KEEP_DAYS = 180; // closed conversations older than this are dropped
const STATS_MS = 120_000;

let client;

function init(discordClient) {
  client = discordClient;
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  const stats = storage.data.stats;
  const before = stats.conversations.length;
  stats.conversations = stats.conversations.filter((c) => !c.closedAt || c.closedAt > cutoff);
  if (stats.conversations.length !== before) storage.save();
}

const conversations = () => storage.data.stats.conversations;

function hourNow() {
  try {
    const hour = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: config.timezone });
    return Number(hour.format(new Date())) % 24;
  } catch {
    return new Date().getUTCHours();
  }
}

// The open conversation in a post, if any. A post holds one conversation per open/close cycle.
function current(postId) {
  const list = conversations();
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].postId === postId) return list[i].closedAt ? null : list[i];
  }
  return null;
}

function openConversation(postId, userId) {
  const existing = current(postId);
  if (existing) return existing;
  const conversation = {
    id: `${postId}-${Date.now()}`,
    postId,
    userId,
    openedAt: Date.now(),
    firstResponseAt: null,
    firstResponderId: null,
    handlers: {}, // staff ID -> replies sent
    closedAt: null,
    rating: null,
    ratedStaffId: null,
  };
  conversations().push(conversation);
  storage.save();
  return conversation;
}

function recordIncoming() {
  storage.data.stats.hours[hourNow()]++;
  storage.save();
}

function recordReply(postId, userId, staffId) {
  const conversation = current(postId) ?? openConversation(postId, userId);
  if (!conversation.firstResponseAt) {
    conversation.firstResponseAt = Date.now();
    conversation.firstResponderId = staffId;
  }
  conversation.handlers[staffId] = (conversation.handlers[staffId] ?? 0) + 1;
  storage.save();
}

function closeConversation(postId) {
  const conversation = current(postId);
  if (!conversation) return null;
  conversation.closedAt = Date.now();
  storage.save();
  return conversation;
}

// Asks the person to rate the conversation. The rating counts for the claimer, or whoever replied most.
async function requestRating(conversation, claimerId) {
  if (!conversation) return;
  const topHandler = Object.entries(conversation.handlers).sort((a, b) => b[1] - a[1])[0]?.[0];
  const staffId = claimerId ?? topHandler;
  if (!staffId) return; // nobody replied, nothing to rate
  conversation.ratedStaffId = staffId;
  storage.save();

  const user = await client.users.fetch(conversation.userId).catch(() => null);
  await user
    ?.send({
      content: '**How did we do?** Rate this conversation:',
      components: [
        row(
          ...[1, 2, 3, 4, 5].map((n) =>
            new ButtonBuilder()
              .setCustomId(`rate:${conversation.id}:${n}`)
              .setLabel(String(n))
              .setEmoji('⭐')
              .setStyle(ButtonStyle.Secondary)
          )
        ),
      ],
    })
    .catch(() => {});
}

async function handleInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('rate:')) return;
  const [, id, value] = interaction.customId.split(':');
  const conversation = conversations().find((c) => c.id === id);
  if (!conversation || conversation.userId !== interaction.user.id) {
    return interaction.update({ content: 'This rating has expired.', components: [] });
  }
  if (!conversation.rating) {
    conversation.rating = Number(value);
    storage.save();
  }
  return interaction.update({
    content: `Thanks for your feedback! ${'⭐'.repeat(conversation.rating)}`,
    components: [],
  });
}

const average = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

async function show(message) {
  await message.delete().catch(() => {});
  if (!isModerator(message.member)) return;

  const since = Date.now() - WINDOW_DAYS * 86_400_000;
  const recent = conversations().filter((c) => c.openedAt >= since);
  const firstResponse = average(recent.filter((c) => c.firstResponseAt).map((c) => c.firstResponseAt - c.openedAt));
  const ratings = recent.filter((c) => c.rating).map((c) => c.rating);

  const staff = new Map(); // staff ID -> { conversations, ratings, firstReplies }
  const entry = (id) => {
    if (!staff.has(id)) staff.set(id, { conversations: 0, ratings: [], firstReplies: [] });
    return staff.get(id);
  };
  for (const c of recent) {
    for (const id of Object.keys(c.handlers)) entry(id).conversations++;
    if (c.rating && c.ratedStaffId) entry(c.ratedStaffId).ratings.push(c.rating);
    if (c.firstResponderId) entry(c.firstResponderId).firstReplies.push(c.firstResponseAt - c.openedAt);
  }
  const staffLines = [...staff.entries()]
    .sort((a, b) => b[1].conversations - a[1].conversations)
    .slice(0, 15)
    .map(([id, s]) => {
      const rating = average(s.ratings);
      const reply = average(s.firstReplies);
      return [
        `<@${id}>: **${s.conversations}** conversations`,
        rating ? `⭐ ${rating.toFixed(1)} (${s.ratings.length})` : null,
        reply ? `first reply ~${formatDuration(reply)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    });

  const hours = storage.data.stats.hours;
  const pad = (h) => String(h).padStart(2, '0');
  const busiest = hours
    .map((count, hour) => ({ count, hour }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(({ hour, count }) => `${pad(hour)}:00–${pad((hour + 1) % 24)}:00 (${count} DMs)`);

  const rating = average(ratings);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📊 Staff stats: last ${WINDOW_DAYS} days`)
    .addFields(
      { name: 'Conversations', value: String(recent.length), inline: true },
      { name: 'Open now', value: String(recent.filter((c) => !c.closedAt).length), inline: true },
      { name: 'Avg first reply', value: firstResponse ? formatDuration(firstResponse) : 'n/a', inline: true },
      { name: 'Avg rating', value: rating ? `⭐ ${rating.toFixed(1)} (${ratings.length} ratings)` : 'No ratings yet', inline: true },
      { name: 'Staff', value: staffLines.join('\n') || 'No replies yet.' },
      { name: `Busiest hours (all time, ${config.timezone})`, value: busiest.join('\n') || 'No DMs yet.' }
    );
  return sendTemporary(message.channel, { embeds: [embed], allowedMentions: { parse: [] } }, STATS_MS);
}

module.exports = {
  init,
  openConversation,
  recordIncoming,
  recordReply,
  closeConversation,
  requestRating,
  handleInteraction,
  show,
};
