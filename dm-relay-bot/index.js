const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
} = require('discord.js');

const { DISCORD_TOKEN, DM_CHANNEL_ID, STAFF_ROLE_ID } = process.env;

if (!DISCORD_TOKEN || !DM_CHANNEL_ID) {
  console.error('Missing DISCORD_TOKEN or DM_CHANNEL_ID environment variable.');
  process.exit(1);
}

// Each forum post starts with a bot message whose footer holds the user ID.
// A post shares its starter message's ID, so no database is needed.
const FOOTER_PREFIX = 'User ID: ';
// Messages in a post starting with this stay internal and are not sent to the user.
const NOTE_PREFIX = '//';
const AUTO_CLOSE_MINUTES = 1440; // 24 hours of inactivity
const OPEN_TAG = 'Open';
const CLOSED_TAG = 'Closed';

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

let forum;
let openTagId;
let closedTagId;
const postByUser = new Map(); // userId -> { id, createdTimestamp }
const userByPost = new Map(); // postId -> userId
const pendingPosts = new Map(); // userId -> Promise<post>, avoids duplicate posts

function userIdFromStarter(message) {
  if (message?.author.id !== client.user.id) return null;
  const footer = message.embeds[0]?.footer?.text;
  return footer?.startsWith(FOOTER_PREFIX) ? footer.slice(FOOTER_PREFIX.length) : null;
}

function remember(userId, post) {
  const known = postByUser.get(userId);
  if (known && known.createdTimestamp > post.createdTimestamp) return;
  postByUser.set(userId, { id: post.id, createdTimestamp: post.createdTimestamp });
  userByPost.set(post.id, userId);
}

function forget(postId) {
  const userId = userByPost.get(postId);
  userByPost.delete(postId);
  if (userId && postByUser.get(userId)?.id === postId) postByUser.delete(userId);
}

function isRelayPost(channel) {
  return channel?.isThread() && channel.parentId === DM_CHANNEL_ID;
}

function isStaff(member) {
  return !STAFF_ROLE_ID || member?.roles.cache.has(STAFF_ROLE_ID);
}

// Makes sure the forum has Open/Closed tags. Needs Manage Channels; tags are skipped without it.
async function setupTags() {
  const find = (name) =>
    forum.availableTags.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id;
  if (!find(OPEN_TAG) || !find(CLOSED_TAG)) {
    const missing = [OPEN_TAG, CLOSED_TAG].filter((name) => !find(name)).map((name) => ({ name }));
    try {
      forum = await forum.setAvailableTags([...forum.availableTags, ...missing]);
    } catch (err) {
      console.warn('Could not create Open/Closed tags (needs Manage Channels):', err.message);
    }
  }
  openTagId = find(OPEN_TAG);
  closedTagId = find(CLOSED_TAG);
}

function tagsFor(post, tagId) {
  if (!tagId) return null;
  const others = post.appliedTags.filter((id) => id !== openTagId && id !== closedTagId);
  return [...others, tagId];
}

async function setStatusTag(post, tagId) {
  const tags = tagsFor(post, tagId);
  if (tags && !post.appliedTags.includes(tagId)) await post.setAppliedTags(tags).catch(() => {});
}

// Rebuild the user -> post lookup from the forum after a restart.
async function loadExistingPosts() {
  const posts = [...(await forum.threads.fetchActive()).threads.values()];
  let before;
  for (;;) {
    const { threads, hasMore } = await forum.threads.fetchArchived({ type: 'public', before, limit: 100 });
    posts.push(...threads.values());
    if (!hasMore || threads.size === 0) break;
    before = threads.last().archivedAt;
  }
  for (const post of posts) {
    if (post.ownerId !== client.user.id) continue;
    const userId = userIdFromStarter(await post.fetchStarterMessage().catch(() => null));
    if (userId) remember(userId, post);
  }
}

client.once('ready', async () => {
  try {
    forum = await client.channels.fetch(DM_CHANNEL_ID);
  } catch (err) {
    console.error(`Could not fetch channel ${DM_CHANNEL_ID}:`, err.message);
    process.exit(1);
  }
  if (forum?.type !== ChannelType.GuildForum) {
    console.error(`Channel ${DM_CHANNEL_ID} is not a forum channel.`);
    process.exit(1);
  }
  await setupTags();
  await loadExistingPosts();
  console.log(
    `Logged in as ${client.user.tag}, relaying DMs to forum #${forum.name} (${postByUser.size} existing posts)`
  );
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    if (message.channel.type === ChannelType.DM) {
      await relayIncomingDm(message);
    } else if (isRelayPost(message.channel)) {
      await handleStaffMessage(message);
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() || !interaction.customId.startsWith('relay:')) return;
  if (!isRelayPost(interaction.channel)) return;

  try {
    if (!isStaff(interaction.member)) {
      await interaction.reply({ content: "You can't do that.", flags: MessageFlags.Ephemeral });
      return;
    }
    switch (interaction.customId) {
      case 'relay:close':
        await interaction.reply(`🔒 Closed by ${interaction.user}.`);
        await closePost(interaction.channel);
        break;
      case 'relay:delete':
        await interaction.reply({
          content: 'Delete this conversation for good? The history will be gone.',
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('relay:delete-confirm')
                .setLabel('Yes, delete')
                .setStyle(ButtonStyle.Danger)
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        break;
      case 'relay:delete-confirm':
        await interaction.deferUpdate();
        await deletePost(interaction.channel);
        break;
    }
  } catch (err) {
    console.error('Error handling button:', err);
  }
});

// When Discord auto-archives an inactive post, flip its tag from Open to Closed.
client.on('threadUpdate', async (oldPost, post) => {
  if (!isRelayPost(post) || oldPost.archived || !post.archived) return;
  if (!openTagId || !post.appliedTags.includes(openTagId)) return;
  try {
    await post.setArchived(false);
    await closePost(post);
  } catch (err) {
    console.error('Error closing archived post:', err.message);
  }
});

client.on('threadDelete', (post) => forget(post.id));

async function closePost(post) {
  await setStatusTag(post, closedTagId);
  await post.setArchived(true);
}

async function deletePost(post) {
  forget(post.id);
  await post.delete();
}

async function reopenPost(post) {
  if (post.archived) await post.setArchived(false);
  await setStatusTag(post, openTagId);
  return post;
}

async function getPostFor(user) {
  const known = postByUser.get(user.id);
  if (known) {
    const post = await client.channels.fetch(known.id).catch(() => null);
    // If the post is gone or locked, fall through and start a fresh one.
    const reopened = post && !post.locked && (await reopenPost(post).catch(() => null));
    if (reopened) return reopened;
  }

  if (!pendingPosts.has(user.id)) {
    pendingPosts.set(
      user.id,
      createPost(user).finally(() => pendingPosts.delete(user.id))
    );
  }
  return pendingPosts.get(user.id);
}

async function createPost(user) {
  const post = await forum.threads.create({
    name: user.displayName.slice(0, 100),
    autoArchiveDuration: AUTO_CLOSE_MINUTES,
    appliedTags: openTagId ? [openTagId] : [],
    message: {
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setAuthor({ name: `DMs with ${user.tag}`, iconURL: user.displayAvatarURL() })
          .setDescription(
            `<@${user.id}>\n\nType here to reply. Start a message with \`${NOTE_PREFIX}\` for an internal note.`
          )
          .setFooter({ text: `${FOOTER_PREFIX}${user.id}` }),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('relay:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('relay:delete').setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        ),
      ],
      allowedMentions: { parse: [] },
    },
  });
  remember(user.id, post);
  return post;
}

async function relayIncomingDm(message) {
  if (!forum) return;

  const post = await getPostFor(message.author);
  const files = message.attachments.map((a) => ({ attachment: a.url, name: a.name }));
  const fallback = message.stickers.size ? '*(sent a sticker)*' : '*(empty message)*';

  await post.send({
    content: message.content || (files.length ? undefined : fallback),
    files,
    allowedMentions: { parse: [] },
  });
}

async function handleStaffMessage(message) {
  if (!isStaff(message.member)) return;

  const post = message.channel;
  let userId = userByPost.get(post.id);
  if (!userId) {
    userId = userIdFromStarter(await post.fetchStarterMessage().catch(() => null));
    if (!userId) return;
    remember(userId, post);
  }

  // Typed versions of the buttons. Anything after the command is sent to the user as the reason.
  const command = message.content.trim().match(/^\/\/(close|delete)(?:\s+([\s\S]+))?$/i);
  if (command) {
    const action = command[1].toLowerCase();
    const reason = command[2]?.trim();
    if (reason) {
      const verb = action === 'close' ? 'closed' : 'deleted';
      try {
        const user = await client.users.fetch(userId);
        await user.send(`This conversation has been ${verb}.\n**Reason:** ${reason}`);
      } catch (err) {
        console.error(`Could not DM ${userId}:`, err.message);
        if (action === 'close') {
          await message.reply("⚠️ Couldn't send the reason to them, closing anyway.").catch(() => {});
        }
      }
    }
    return action === 'close' ? closePost(post) : deletePost(post);
  }
  if (message.content.startsWith(NOTE_PREFIX)) return;

  const files = message.attachments.map((a) => ({ attachment: a.url, name: a.name }));
  if (!message.content && files.length === 0) return;

  try {
    const user = await client.users.fetch(userId);
    await user.send({ content: message.content || undefined, files });
    await setStatusTag(post, openTagId);
  } catch (err) {
    console.error(`Could not DM ${userId}:`, err.message);
    await message
      .reply("⚠️ Couldn't deliver that. They may have DMs closed or no longer share a server with the bot.")
      .catch(() => {});
  }
}

client.login(DISCORD_TOKEN);
