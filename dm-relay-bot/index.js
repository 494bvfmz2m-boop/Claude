const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');

const { DISCORD_TOKEN, DM_CHANNEL_ID, STAFF_ROLE_ID } = process.env;

if (!DISCORD_TOKEN || !DM_CHANNEL_ID) {
  console.error('Missing DISCORD_TOKEN or DM_CHANNEL_ID environment variable.');
  process.exit(1);
}

// Each thread hangs off a bot message in the relay channel whose footer holds the user ID.
// A thread started from a message shares that message's ID, so no database is needed.
const FOOTER_PREFIX = 'User ID: ';
// Messages in a thread starting with this stay internal and are not sent to the user.
const NOTE_PREFIX = '//';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  // DM channels aren't cached, so this is needed to receive DMs at all.
  partials: [Partials.Channel],
});

let relayChannel;
const threadByUser = new Map(); // userId -> threadId
const userByThread = new Map(); // threadId -> userId
const pendingThreads = new Map(); // userId -> Promise<thread>, avoids duplicate threads

function userIdFromStarter(message) {
  if (message?.author.id !== client.user.id) return null;
  const footer = message.embeds[0]?.footer?.text;
  return footer?.startsWith(FOOTER_PREFIX) ? footer.slice(FOOTER_PREFIX.length) : null;
}

function remember(userId, threadId) {
  threadByUser.set(userId, threadId);
  userByThread.set(threadId, userId);
}

// Rebuild the user -> thread lookup from the relay channel's history after a restart.
async function loadExistingThreads() {
  let before;
  for (;;) {
    const batch = await relayChannel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    for (const message of batch.values()) {
      const userId = userIdFromStarter(message);
      // Newest first, so the first match per user is their latest thread.
      if (userId && message.hasThread && !threadByUser.has(userId)) remember(userId, message.id);
    }
    before = batch.last().id;
  }
}

client.once('ready', async () => {
  try {
    relayChannel = await client.channels.fetch(DM_CHANNEL_ID);
  } catch (err) {
    console.error(`Could not fetch channel ${DM_CHANNEL_ID}:`, err.message);
    process.exit(1);
  }
  if (relayChannel?.type !== ChannelType.GuildText) {
    console.error(`Channel ${DM_CHANNEL_ID} is not a regular text channel.`);
    process.exit(1);
  }
  await loadExistingThreads();
  console.log(
    `Logged in as ${client.user.tag}, relaying DMs to #${relayChannel.name} (${threadByUser.size} existing threads)`
  );
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    if (message.channel.type === ChannelType.DM) {
      await relayIncomingDm(message);
    } else if (message.channel.isThread() && message.channel.parentId === DM_CHANNEL_ID) {
      await sendReply(message);
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

async function getThreadFor(user) {
  const threadId = threadByUser.get(user.id);
  if (threadId) {
    const thread = await client.channels.fetch(threadId).catch(() => null);
    // If the thread is gone or locked, fall through and start a fresh one.
    if (thread && (!thread.archived || (await thread.setArchived(false).catch(() => null)))) {
      return thread;
    }
  }

  if (!pendingThreads.has(user.id)) {
    pendingThreads.set(
      user.id,
      createThread(user).finally(() => pendingThreads.delete(user.id))
    );
  }
  return pendingThreads.get(user.id);
}

async function createThread(user) {
  const starter = await relayChannel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: `DMs with ${user.tag}`, iconURL: user.displayAvatarURL() })
        .setDescription(`<@${user.id}>`)
        .setFooter({ text: `${FOOTER_PREFIX}${user.id}` }),
    ],
    allowedMentions: { parse: [] },
  });
  const thread = await starter.startThread({
    name: user.displayName.slice(0, 100),
    autoArchiveDuration: 10080, // 1 week
  });
  remember(user.id, thread.id);
  return thread;
}

async function relayIncomingDm(message) {
  if (!relayChannel) return;

  const thread = await getThreadFor(message.author);
  const files = message.attachments.map((a) => ({ attachment: a.url, name: a.name }));
  const fallback = message.stickers.size ? '*(sent a sticker)*' : '*(empty message)*';

  await thread.send({
    content: message.content || (files.length ? undefined : fallback),
    files,
    allowedMentions: { parse: [] },
  });
}

async function sendReply(message) {
  if (message.content.startsWith(NOTE_PREFIX)) return;
  if (STAFF_ROLE_ID && !message.member?.roles.cache.has(STAFF_ROLE_ID)) return;

  const thread = message.channel;
  let userId = userByThread.get(thread.id);
  if (!userId) {
    userId = userIdFromStarter(await thread.fetchStarterMessage().catch(() => null));
    if (!userId) return;
    remember(userId, thread.id);
  }

  const files = message.attachments.map((a) => ({ attachment: a.url, name: a.name }));
  if (!message.content && files.length === 0) return;

  try {
    const user = await client.users.fetch(userId);
    await user.send({ content: message.content || undefined, files });
  } catch (err) {
    console.error(`Could not DM ${userId}:`, err.message);
    await message
      .reply("⚠️ Couldn't deliver that. They may have DMs closed or no longer share a server with the bot.")
      .catch(() => {});
  }
}

client.login(DISCORD_TOKEN);
