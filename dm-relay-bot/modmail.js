const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const config = require('./config');
const storage = require('./storage');
const { PREFIX, chunk, parseDuration, timestamp } = require('./util');

// Each forum post starts with a bot message whose footer holds the user ID.
// A post shares its starter message's ID, so no database is needed to find it again.
const FOOTER_PREFIX = 'User ID: ';
const AUTO_CLOSE_MINUTES = 1440; // 24 hours of inactivity
const OPEN_TAG = 'Open';
const CLOSED_TAG = 'Closed';
const CLAIM_FIELD = 'Claimed by';
const UNCLAIMED = 'Nobody';
const DELIVERY_FAILED =
  "⚠️ Couldn't deliver that. They may have DMs closed or no longer share a server with the bot.";

const HELP = [
  '**In a post**',
  'Type normally to reply to the person.',
  '`// text` internal note, not sent',
  '`//close [reason]` close the post (reason is DMed to them)',
  '`//delete [reason]` delete the post (reason is DMed to them)',
  '`//s <name>` send a saved snippet',
  '`//snippet add <name> <text>` / `//snippet remove <name>` / `//snippets`',
  '`//remind <time> [note]` ping you later if still open, e.g. `//remind 2h`',
  '',
  '**Anywhere**',
  '`//reaction roles` open the reaction roles setup (needs Manage Roles)',
].join('\n');

let client;
let forum;
let openTagId;
let closedTagId;
const postByUser = new Map(); // userId -> { id, createdTimestamp }
const userByPost = new Map(); // postId -> userId
const dmQueues = new Map(); // userId -> Promise, keeps each user's DMs in order

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

async function userIdForPost(post) {
  let userId = userByPost.get(post.id);
  if (!userId) {
    userId = userIdFromStarter(await post.fetchStarterMessage().catch(() => null));
    if (userId) remember(userId, post);
  }
  return userId;
}

function isRelayPost(channel) {
  return Boolean(channel?.isThread() && channel.parentId === config.forumId);
}

function isStaff(member) {
  return !config.staffRoleId || Boolean(member?.roles.cache.has(config.staffRoleId));
}

const attachmentsOf = (message) =>
  message.attachments.map((a) => ({ attachment: a.url, name: a.name }));

// Makes sure the forum has Open/Closed tags. Needs Manage Channels; tags are skipped without it.
async function setupTags() {
  const find = (name) =>
    forum.availableTags.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id;
  const missing = [OPEN_TAG, CLOSED_TAG].filter((name) => !find(name)).map((name) => ({ name }));
  if (missing.length) {
    try {
      forum = await forum.setAvailableTags([...forum.availableTags, ...missing]);
    } catch (err) {
      console.warn('Could not create Open/Closed tags (needs Manage Channels):', err.message);
    }
  }
  openTagId = find(OPEN_TAG);
  closedTagId = find(CLOSED_TAG);
}

async function setStatusTag(post, tagId) {
  if (!tagId || post.appliedTags.includes(tagId)) return;
  const others = post.appliedTags.filter((id) => id !== openTagId && id !== closedTagId);
  await post.setAppliedTags([...others, tagId]).catch(() => {});
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

async function init(discordClient) {
  client = discordClient;
  forum = await client.channels.fetch(config.forumId).catch(() => null);
  if (forum?.type !== ChannelType.GuildForum) {
    throw new Error(`Channel ${config.forumId} is not a forum channel the bot can see.`);
  }
  await setupTags();
  await loadExistingPosts();
  setInterval(() => checkReminders().catch((err) => console.error('Error checking reminders:', err)), 30_000);
  return { forum, posts: postByUser.size };
}

// ---------- Incoming DMs ----------

function relayIncomingDm(message) {
  if (!forum) return;
  const userId = message.author.id;
  const next = (dmQueues.get(userId) ?? Promise.resolve())
    .then(() => relayNow(message))
    .catch((err) => console.error('Error relaying DM:', err));
  dmQueues.set(userId, next);
  next.finally(() => {
    if (dmQueues.get(userId) === next) dmQueues.delete(userId);
  });
  return next;
}

async function relayNow(message) {
  const user = message.author;
  const { post, created, reopened } = await getPostFor(user);

  if ((created || reopened) && config.autoReply) {
    await user.send(config.autoReply).catch(() => {});
  }
  if (reopened && config.pingRoleId) {
    await post.send({
      content: `<@&${config.pingRoleId}> ${user.tag} wrote again.`,
      allowedMentions: { roles: [config.pingRoleId] },
    });
  }

  const files = attachmentsOf(message);
  const fallback = message.stickers.size ? '*(sent a sticker)*' : '*(empty message)*';
  await post.send({
    content: message.content || (files.length ? undefined : fallback),
    files,
    allowedMentions: { parse: [] },
  });
}

async function getPostFor(user) {
  const known = postByUser.get(user.id);
  if (known) {
    const post = await client.channels.fetch(known.id).catch(() => null);
    // If the post is gone or locked, fall through and start a fresh one.
    if (post && !post.locked) {
      const wasClosed = post.archived;
      const ok = await reopenPost(post).then(() => true, () => false);
      if (ok) return { post, created: false, reopened: wasClosed };
    }
  }
  return { post: await createPost(user), created: true, reopened: false };
}

async function reopenPost(post) {
  if (post.archived) await post.setArchived(false);
  await setStatusTag(post, openTagId);
}

async function userInfoFields(user) {
  const guild = forum.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);
  let roles = member
    ? member.roles.cache
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`)
        .join(' ')
    : '';
  if (roles.length > 1024) roles = `${roles.slice(0, roles.lastIndexOf(' ', 1000))} …`;
  return [
    { name: 'Account created', value: timestamp(user.createdTimestamp), inline: true },
    {
      name: 'Joined server',
      value: member?.joinedTimestamp ? timestamp(member.joinedTimestamp) : 'Not in server',
      inline: true,
    },
    { name: CLAIM_FIELD, value: UNCLAIMED, inline: true },
    { name: 'Roles', value: roles || 'None' },
  ];
}

async function createPost(user) {
  const post = await forum.threads.create({
    name: user.displayName.slice(0, 100),
    autoArchiveDuration: AUTO_CLOSE_MINUTES,
    appliedTags: openTagId ? [openTagId] : [],
    message: {
      content: config.pingRoleId ? `<@&${config.pingRoleId}> New DM from **${user.tag}**` : undefined,
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setAuthor({ name: `DMs with ${user.tag}`, iconURL: user.displayAvatarURL() })
          .setThumbnail(user.displayAvatarURL())
          .setDescription(
            `<@${user.id}>\n\nType here to reply. Start a message with \`${PREFIX}\` for an internal note, \`${PREFIX}help\` for commands.`
          )
          .addFields(await userInfoFields(user))
          .setFooter({ text: `${FOOTER_PREFIX}${user.id}` }),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('relay:claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('relay:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('relay:delete').setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        ),
      ],
      allowedMentions: { roles: config.pingRoleId ? [config.pingRoleId] : [] },
    },
  });
  remember(user.id, post);
  return post;
}

// ---------- Staff messages ----------

async function handleStaffMessage(message) {
  if (!isStaff(message.member)) return;
  const post = message.channel;
  const userId = await userIdForPost(post);
  if (!userId) return;

  if (message.content.startsWith(PREFIX)) return handleCommand(message, post, userId);

  const files = attachmentsOf(message);
  if (!message.content && files.length === 0) return;
  await deliver(message, userId, message.content, files);
}

// Sends text to the user, prefixed with the staff member's name unless replies are anonymous.
async function deliver(message, userId, content, files = []) {
  const name = message.member?.displayName ?? message.author.displayName;
  const text = config.anonymous ? content : `**${name}:** ${content}`.trim();
  const parts = text ? chunk(text) : [''];
  try {
    const user = await client.users.fetch(userId);
    for (const [i, part] of parts.entries()) {
      const last = i === parts.length - 1;
      await user.send({ content: part || undefined, files: last ? files : [] });
    }
    await setStatusTag(message.channel, openTagId);
    return true;
  } catch (err) {
    console.error(`Could not DM ${userId}:`, err.message);
    await message.reply(DELIVERY_FAILED).catch(() => {});
    return false;
  }
}

async function handleCommand(message, post, userId) {
  // "// text" (with a space) or an unknown command is just an internal note.
  const match = message.content.match(/^\/\/(\S+)(?:\s+([\s\S]*))?$/);
  if (!match) return;
  const command = match[1].toLowerCase();
  const args = (match[2] ?? '').trim();

  switch (command) {
    case 'close':
    case 'delete':
      return closeOrDelete(message, post, userId, command, args);
    case 's':
      return sendSnippet(message, userId, args);
    case 'snippet':
      return manageSnippet(message, args);
    case 'snippets':
      return listSnippets(message);
    case 'remind':
      return addReminder(message, post, args);
    case 'help':
      return message.reply({ content: HELP, allowedMentions: { parse: [] } });
  }
}

async function closeOrDelete(message, post, userId, action, reason) {
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

async function closePost(post) {
  await setStatusTag(post, closedTagId);
  await post.setArchived(true);
}

async function deletePost(post) {
  forget(post.id);
  const before = storage.data.reminders.length;
  storage.data.reminders = storage.data.reminders.filter((r) => r.postId !== post.id);
  if (storage.data.reminders.length !== before) storage.save();
  await post.delete();
}

// ---------- Snippets ----------

async function sendSnippet(message, userId, args) {
  const name = args.split(/\s+/)[0]?.toLowerCase();
  const text = name && storage.data.snippets[name];
  if (!text) {
    return message.reply(`No snippet called \`${name || '?'}\`. See \`${PREFIX}snippets\`.`);
  }
  if (await deliver(message, userId, text)) {
    await message.reply({ content: `📎 Sent **${name}**:\n${text}`.slice(0, 2000), allowedMentions: { parse: [] } });
  }
}

async function manageSnippet(message, args) {
  const usage = `Usage: \`${PREFIX}snippet add <name> <text>\` or \`${PREFIX}snippet remove <name>\``;
  const match = args.match(/^(add|remove)\s+(\S+)(?:\s+([\s\S]+))?$/i);
  if (!match) return message.reply(usage);
  const action = match[1].toLowerCase();
  const name = match[2].toLowerCase();

  if (action === 'add') {
    if (!match[3]?.trim()) return message.reply(usage);
    storage.data.snippets[name] = match[3].trim();
    storage.save();
    return message.reply(`💾 Saved snippet **${name}**. Send it with \`${PREFIX}s ${name}\`.`);
  }
  if (!(name in storage.data.snippets)) return message.reply(`No snippet called \`${name}\`.`);
  delete storage.data.snippets[name];
  storage.save();
  return message.reply(`🗑️ Removed snippet **${name}**.`);
}

async function listSnippets(message) {
  const names = Object.keys(storage.data.snippets).sort();
  return message.reply(
    names.length
      ? `**Snippets:** ${names.map((n) => `\`${n}\``).join(', ')}`
      : `No snippets yet. Add one with \`${PREFIX}snippet add <name> <text>\`.`
  );
}

// ---------- Reminders ----------

async function addReminder(message, post, args) {
  const when = args.split(/\s+/)[0] ?? '';
  const ms = parseDuration(when);
  if (!ms) {
    return message.reply(`Usage: \`${PREFIX}remind <time> [note]\`, e.g. \`${PREFIX}remind 2h check back\` (m, h, d, w).`);
  }
  const at = Date.now() + ms;
  storage.data.reminders.push({
    postId: post.id,
    staffId: message.author.id,
    at,
    note: args.slice(when.length).trim(),
  });
  storage.save();
  return message.reply(`⏰ I'll remind you ${timestamp(at)} if this is still open.`);
}

async function checkReminders() {
  const now = Date.now();
  const due = storage.data.reminders.filter((r) => r.at <= now);
  if (due.length === 0) return;
  storage.data.reminders = storage.data.reminders.filter((r) => r.at > now);
  storage.save();

  for (const reminder of due) {
    const post = await client.channels.fetch(reminder.postId).catch(() => null);
    if (!post || post.archived) continue;
    await post
      .send({
        content: `⏰ <@${reminder.staffId}> reminder${reminder.note ? `: ${reminder.note}` : ''}`,
        allowedMentions: { users: [reminder.staffId] },
      })
      .catch(() => {});
  }
}

// ---------- Buttons ----------

async function handleInteraction(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('relay:')) return;
  if (!isRelayPost(interaction.channel)) return;

  if (!isStaff(interaction.member)) {
    await interaction.reply({ content: "You can't do that.", flags: MessageFlags.Ephemeral });
    return;
  }
  switch (interaction.customId) {
    case 'relay:claim':
      return toggleClaim(interaction);
    case 'relay:close':
      await interaction.reply(`🔒 Closed by ${interaction.user}.`);
      return closePost(interaction.channel);
    case 'relay:delete':
      return interaction.reply({
        content: 'Delete this conversation for good? The history will be gone.',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('relay:delete-confirm').setLabel('Yes, delete').setStyle(ButtonStyle.Danger)
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    case 'relay:delete-confirm':
      await interaction.deferUpdate();
      return deletePost(interaction.channel);
  }
}

// Claiming stores the claimer in the starter embed. Clicking again releases it; anyone else takes it over.
async function toggleClaim(interaction) {
  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  const fields = embed.data.fields ?? [];
  const index = fields.findIndex((f) => f.name === CLAIM_FIELD);
  const mine = `${interaction.user}`;
  const releasing = fields[index]?.value === mine;
  const field = { name: CLAIM_FIELD, value: releasing ? UNCLAIMED : mine, inline: true };
  if (index >= 0) embed.spliceFields(index, 1, field);
  else embed.addFields(field);

  await interaction.update({ embeds: [embed] });
  await interaction.channel.send({
    content: releasing ? `${mine} unclaimed this.` : `🙋 ${mine} claimed this.`,
    allowedMentions: { parse: [] },
  });
}

// ---------- Thread events ----------

// When Discord auto-archives an inactive post, flip its tag from Open to Closed.
async function handleThreadUpdate(oldPost, post) {
  if (!isRelayPost(post) || oldPost.archived || !post.archived) return;
  if (!openTagId || !post.appliedTags.includes(openTagId)) return;
  await post.setArchived(false);
  await closePost(post);
}

function handleThreadDelete(post) {
  forget(post.id);
}

module.exports = {
  init,
  isRelayPost,
  relayIncomingDm,
  handleStaffMessage,
  handleInteraction,
  handleThreadUpdate,
  handleThreadDelete,
};
