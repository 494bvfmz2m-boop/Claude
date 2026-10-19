const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const storage = require('./storage');
const { sendTemporary } = require('./util');

const COMMAND = /^(reaction[\s-]*roles?|rr)$/i;
const PROMPT_MS = 120_000; // the menu disappears if nothing is picked
const DONE_MS = 10_000; // success messages disappear after this
const LIST_MS = 60_000;
const MAX_PAIRS = 20; // Discord's limit of different reactions per message
const ephemeral = { flags: MessageFlags.Ephemeral };

let client;
const prompts = new Map(); // prompt message ID -> { ownerId, message }
const drafts = new Map(); // user ID -> last form values, to refill the form after a mistake

function init(discordClient) {
  client = discordClient;
}

const isCommand = (text) => COMMAND.test(text.trim());
const canManage = (member) => Boolean(member?.permissions.has(PermissionFlagsBits.ManageRoles));
const messageUrl = (config, messageId) =>
  `https://discord.com/channels/${config.guildId}/${config.channelId}/${messageId}`;
// Discord isn't consistent about the invisible variation selector in emojis like ❤️, so ignore it.
const normalize = (name) => name.replace(/️/g, '');
const emojiKey = (emoji) => emoji.id ?? normalize(emoji.name);

const row = (...components) => new ActionRowBuilder().addComponents(...components);
const button = (id, label, style = ButtonStyle.Secondary, emoji) => {
  const b = new ButtonBuilder().setCustomId(`rr:${id}`).setLabel(label).setStyle(style);
  return emoji ? b.setEmoji(emoji) : b;
};

// ---------- "@Bot reaction roles" menu ----------

async function openPrompt(message) {
  if (!message.inGuild()) return;
  await message.delete().catch(() => {});
  if (!canManage(message.member)) {
    return sendTemporary(
      message.channel,
      { content: `${message.author}, you need **Manage Roles** for reaction roles.`, allowedMentions: { parse: [] } },
      DONE_MS
    );
  }
  const prompt = await message.channel.send({
    content: `${message.author} **Reaction roles:** what do you want to do?`,
    components: [
      row(
        button('create', 'Create new', ButtonStyle.Primary, '➕'),
        button('edit', 'Edit', ButtonStyle.Secondary, '✏️'),
        button('delete', 'Delete', ButtonStyle.Danger, '🗑️'),
        button('list', 'Show all', ButtonStyle.Secondary, '📋'),
        button('cancel', 'Cancel')
      ),
    ],
    allowedMentions: { parse: [] },
  });
  prompts.set(prompt.id, { ownerId: message.author.id, message: prompt });
  setTimeout(() => closePrompt(prompt.id), PROMPT_MS);
}

function closePrompt(id) {
  const prompt = prompts.get(id);
  if (!prompt) return;
  prompts.delete(id);
  prompt.message.delete().catch(() => {});
}

function editorModal(customId, values = {}) {
  const input = (id, label, style, required, max, placeholder) => {
    const field = new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setRequired(required)
      .setMaxLength(max)
      .setPlaceholder(placeholder);
    if (values[id]) field.setValue(values[id]);
    return row(field);
  };
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Reaction roles')
    .addComponents(
      input('title', 'Title', TextInputStyle.Short, true, 256, 'Pick your roles'),
      input('description', 'Description (optional)', TextInputStyle.Paragraph, false, 2000, 'React below to get a role.'),
      input(
        'roles',
        'One per line: emoji + role name',
        TextInputStyle.Paragraph,
        true,
        2000,
        '🎮 Gamer\n🎨 Artist\n:pog: Announcements'
      )
    );
}

const readValues = (interaction) => ({
  title: interaction.fields.getTextInputValue('title').trim(),
  description: interaction.fields.getTextInputValue('description').trim(),
  roles: interaction.fields.getTextInputValue('roles').trim(),
});

// ---------- Parsing the "emoji role" lines ----------

function resolveEmoji(guild, token) {
  const custom = token.match(/^<a?:\w+:(\d+)>$/);
  let emoji = custom ? client.emojis.cache.get(custom[1]) : null;
  if (!custom) {
    const name = token.replace(/^:|:$/g, '').toLowerCase();
    const byName = (e) => e.name?.toLowerCase() === name;
    if (/^\w+$/.test(name)) emoji = guild.emojis.cache.find(byName) ?? client.emojis.cache.find(byName);
  }
  if (emoji) return { key: emoji.id, id: emoji.id, display: emoji.toString() };
  if (custom) return null; // a custom emoji from a server the bot isn't in
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u.test(token)) {
    return { key: normalize(token), id: null, display: token };
  }
  return null;
}

function resolveRole(guild, token) {
  const id = token.match(/^<@&(\d+)>$|^(\d{17,20})$/);
  if (id) return guild.roles.cache.get(id[1] ?? id[2]) ?? null;
  const name = token.replace(/^@/, '').toLowerCase();
  return guild.roles.cache.find((r) => r.name.toLowerCase() === name) ?? null;
}

function parseLines(guild, text) {
  const pairs = [];
  const errors = [];
  for (const [i, raw] of text.split('\n').entries()) {
    const line = raw.trim();
    if (!line) continue;
    const where = `Line ${i + 1}`;
    const match = line.match(/^(\S+)\s+(.+)$/);
    if (!match) {
      errors.push(`${where}: needs an emoji, a space, then a role name.`);
      continue;
    }
    const emoji = resolveEmoji(guild, match[1]);
    const role = resolveRole(guild, match[2].trim());
    if (!emoji) {
      errors.push(`${where}: \`${match[1]}\` isn't an emoji I can use. Paste the emoji itself, or type a server emoji's name like \`:pog:\`.`);
    } else if (!role) {
      errors.push(`${where}: there's no role called "${match[2].trim()}".`);
    } else if (role.managed || role.id === guild.id) {
      errors.push(`${where}: **${role.name}** can't be given out by bots.`);
    } else if (!role.editable) {
      errors.push(`${where}: I can't give **${role.name}**. Drag my role above it in Server Settings → Roles.`);
    } else if (pairs.some((p) => p.emoji === emoji.key)) {
      errors.push(`${where}: ${emoji.display} is used twice.`);
    } else if (pairs.some((p) => p.roleId === role.id)) {
      errors.push(`${where}: **${role.name}** is used twice.`);
    } else {
      pairs.push({ emoji: emoji.key, emojiId: emoji.id, display: emoji.display, roleId: role.id });
    }
  }
  if (pairs.length === 0 && errors.length === 0) errors.push('Add at least one role.');
  if (pairs.length > MAX_PAIRS) errors.push(`A message can have at most ${MAX_PAIRS} roles.`);
  return { pairs, errors };
}

// Turns a saved config back into form text, using role names unless two roles share a name.
function linesFor(guild, pairs) {
  return pairs
    .map((p) => {
      const role = guild.roles.cache.get(p.roleId);
      const unique = role && guild.roles.cache.filter((r) => r.name === role.name).size === 1;
      return `${p.display} ${unique ? role.name : `<@&${p.roleId}>`}`;
    })
    .join('\n');
}

// ---------- The posted message ----------

function buildPost({ title, description }, pairs) {
  const list = pairs.map((p) => `${p.display}  <@&${p.roleId}>`).join('\n');
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(title)
        .setDescription([description, list].filter(Boolean).join('\n\n'))
        .setFooter({ text: 'React to get a role · remove your reaction to lose it' }),
    ],
    allowedMentions: { parse: [] },
  };
}

async function addReactions(message, pairs) {
  const failed = [];
  for (const pair of pairs) {
    await message.react(pair.display).catch(() => failed.push(pair.display));
  }
  return failed.length
    ? `\n⚠️ Couldn't add ${failed.join(' ')}. Check I have **Add Reactions** and **Read Message History** here.`
    : '';
}

// ---------- Interactions ----------

// Modal answers edit the private message they came from, or start a new private one.
async function begin(interaction) {
  if (interaction.message?.flags.has(MessageFlags.Ephemeral)) await interaction.deferUpdate();
  else await interaction.deferReply(ephemeral);
}

async function finish(interaction, content, ms = DONE_MS) {
  await interaction.editReply({ content, components: [] });
  setTimeout(() => interaction.deleteReply().catch(() => {}), ms);
}

async function showErrors(interaction, values, errors, retryId) {
  drafts.set(interaction.user.id, values);
  await interaction.editReply({
    content: `❌ Fix these and try again:\n${errors.map((e) => `• ${e}`).join('\n')}`.slice(0, 2000),
    components: [row(button(retryId, 'Fix it', ButtonStyle.Primary, '✏️'))],
  });
}

function ownedEntries(guildId) {
  return Object.entries(storage.data.reactionRoles).filter(([, c]) => c.guildId === guildId);
}

async function handleInteraction(interaction) {
  if (!interaction.customId?.startsWith('rr:')) return;
  const [, action, arg] = interaction.customId.split(':');

  const prompt = interaction.message && prompts.get(interaction.message.id);
  if (prompt && interaction.user.id !== prompt.ownerId) {
    return interaction.reply({
      content: `This menu isn't yours. Use \`@${client.user.username} reaction roles\` to open your own.`,
      ...ephemeral,
    });
  }
  if (!canManage(interaction.member)) {
    return interaction.reply({ content: 'You need **Manage Roles** for this.', ...ephemeral });
  }

  switch (action) {
    // Menu buttons: each one replaces the menu with a pop-up or a private message.
    case 'create':
      await interaction.showModal(editorModal('rr:create-modal'));
      return closePrompt(interaction.message.id);
    case 'edit':
    case 'delete':
      await pickMessage(interaction, action);
      return closePrompt(interaction.message.id);
    case 'list':
      await showList(interaction);
      return closePrompt(interaction.message.id);
    case 'cancel':
      await interaction.deferUpdate();
      return closePrompt(interaction.message.id);

    case 'create-modal':
      return onCreate(interaction);
    case 'retry-create':
      return interaction.showModal(editorModal('rr:create-modal', drafts.get(interaction.user.id)));

    case 'edit-pick':
      return openEditor(interaction, interaction.values[0]);
    case 'edit-modal':
      return onEdit(interaction, arg);
    case 'retry-edit':
      return interaction.showModal(editorModal(`rr:edit-modal:${arg}`, drafts.get(interaction.user.id)));

    case 'delete-pick':
      return confirmDelete(interaction, interaction.values[0]);
    case 'delete-confirm':
      return onDelete(interaction, arg);
    case 'dismiss':
      await interaction.deferUpdate();
      return interaction.deleteReply().catch(() => {});
  }
}

async function pickMessage(interaction, action) {
  const entries = ownedEntries(interaction.guildId).slice(0, 25);
  if (entries.length === 0) {
    await interaction.reply({ content: 'There are no reaction-role messages yet.', ...ephemeral });
    setTimeout(() => interaction.deleteReply().catch(() => {}), DONE_MS);
    return;
  }
  await interaction.reply({
    content: action === 'edit' ? 'Which message do you want to edit?' : 'Which message do you want to delete?',
    components: [
      row(
        new StringSelectMenuBuilder()
          .setCustomId(`rr:${action}-pick`)
          .setPlaceholder('Pick a message…')
          .addOptions(
            entries.map(([id, c]) => ({
              label: (c.title ?? 'Untitled message').slice(0, 100),
              description: `#${client.channels.cache.get(c.channelId)?.name ?? 'unknown'} · ${c.pairs.length} roles`.slice(0, 100),
              value: id,
            }))
          )
      ),
      row(button('dismiss', 'Cancel')),
    ],
    ...ephemeral,
  });
}

async function showList(interaction) {
  const entries = ownedEntries(interaction.guildId);
  const text = entries.length
    ? entries
        .map(([id, c]) => `**[${c.title ?? 'Message'}](${messageUrl(c, id)})**\n${c.pairs.map((p) => `${p.display} <@&${p.roleId}>`).join('  ')}`)
        .join('\n\n')
    : 'There are no reaction-role messages yet.';
  await interaction.reply({ content: text.slice(0, 2000), allowedMentions: { parse: [] }, ...ephemeral });
  setTimeout(() => interaction.deleteReply().catch(() => {}), LIST_MS);
}

async function onCreate(interaction) {
  await begin(interaction);
  const values = readValues(interaction);
  const { pairs, errors } = parseLines(interaction.guild, values.roles);
  if (errors.length) return showErrors(interaction, values, errors, 'retry-create');

  const post = await interaction.channel.send(buildPost(values, pairs));
  storage.data.reactionRoles[post.id] = {
    guildId: post.guildId,
    channelId: post.channelId,
    title: values.title,
    description: values.description,
    pairs,
  };
  storage.save();
  drafts.delete(interaction.user.id);
  const warning = await addReactions(post, pairs);
  return finish(interaction, `✅ Posted the reaction-role message.${warning}`, warning ? 30_000 : DONE_MS);
}

async function openEditor(interaction, messageId) {
  const config = storage.data.reactionRoles[messageId];
  if (!config) return interaction.update({ content: '❌ That message no longer has reaction roles.', components: [] });
  return interaction.showModal(
    editorModal(`rr:edit-modal:${messageId}`, {
      title: config.title ?? '',
      description: config.description ?? '',
      roles: linesFor(interaction.guild, config.pairs),
    })
  );
}

async function fetchPosted(config, messageId) {
  const channel = await client.channels.fetch(config.channelId).catch(() => null);
  return channel?.messages.fetch(messageId).catch(() => null) ?? null;
}

async function onEdit(interaction, messageId) {
  await begin(interaction);
  const config = storage.data.reactionRoles[messageId];
  if (!config) return finish(interaction, '❌ That message no longer has reaction roles.');

  const values = readValues(interaction);
  const { pairs, errors } = parseLines(interaction.guild, values.roles);
  if (errors.length) return showErrors(interaction, values, errors, `retry-edit:${messageId}`);

  const message = await fetchPosted(config, messageId);
  if (!message) {
    delete storage.data.reactionRoles[messageId];
    storage.save();
    return finish(interaction, '❌ That message was deleted, so I removed its reaction roles.');
  }
  // Messages from before the bot posted its own can't be rewritten, only their roles change.
  if (message.author.id === client.user.id) await message.edit(buildPost(values, pairs));

  const keep = new Set(pairs.map((p) => p.emoji));
  for (const reaction of message.reactions.cache.values()) {
    if (!keep.has(emojiKey(reaction.emoji))) await reaction.users.remove(client.user.id).catch(() => {});
  }
  Object.assign(config, { title: values.title, description: values.description, pairs });
  storage.save();
  drafts.delete(interaction.user.id);
  const warning = await addReactions(message, pairs);
  return finish(interaction, `✅ Updated the reaction-role message.${warning}`, warning ? 30_000 : DONE_MS);
}

async function confirmDelete(interaction, messageId) {
  const config = storage.data.reactionRoles[messageId];
  if (!config) return interaction.update({ content: '❌ That message no longer has reaction roles.', components: [] });
  return interaction.update({
    content: `Delete **${config.title ?? 'this message'}**? The message and its reaction roles will be removed. Roles people already have stay.`,
    components: [row(button(`delete-confirm:${messageId}`, 'Yes, delete', ButtonStyle.Danger), button('dismiss', 'Cancel'))],
  });
}

async function onDelete(interaction, messageId) {
  const config = storage.data.reactionRoles[messageId];
  await interaction.update({ content: '🗑️ Deleted.', components: [] });
  setTimeout(() => interaction.deleteReply().catch(() => {}), DONE_MS);
  if (!config) return;
  delete storage.data.reactionRoles[messageId];
  storage.save();

  const message = await fetchPosted(config, messageId);
  if (message?.author.id === client.user.id) {
    await message.delete().catch(() => {});
  } else if (message) {
    // Not the bot's own message, so just take its reactions off.
    for (const pair of config.pairs) {
      await message.reactions.cache
        .find((r) => emojiKey(r.emoji) === normalize(pair.emoji))
        ?.users.remove(client.user.id)
        .catch(() => {});
    }
  }
}

// ---------- Giving and taking roles ----------

async function handleReaction(reaction, user, added) {
  if (user.id === client.user.id) return;
  const config = storage.data.reactionRoles[reaction.message.id];
  if (!config) return;
  const key = emojiKey(reaction.emoji);
  const pair = config.pairs.find((p) => normalize(p.emoji) === key);
  if (!pair) return;

  const guild = await client.guilds.fetch(config.guildId);
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member || member.user.bot) return;
  if (added) await member.roles.add(pair.roleId, 'Reaction role');
  else await member.roles.remove(pair.roleId, 'Reaction role');
}

module.exports = { init, isCommand, openPrompt, handleInteraction, handleReaction };
