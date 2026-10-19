const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const storage = require('./storage');

const COMMAND = /^\/\/\s*(reaction[\s-]*roles?|rr)$/i;
const SESSION_MINUTES = 15;
const EMOJI_WAIT_MS = 120_000;
const MAX_PAIRS = 20; // Discord's limit of different reactions per message

let client;
const sessions = new Map(); // panel message ID -> setup session

function init(discordClient) {
  client = discordClient;
}

const isCommand = (content) => COMMAND.test(content.trim());
const messageUrl = ({ guildId, channelId, messageId }) =>
  `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;

// ---------- Setup panel ----------

async function handleCommand(message) {
  if (!message.inGuild()) return;
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return message.reply('You need the **Manage Roles** permission for this.');
  }
  const session = {
    ownerId: message.author.id,
    guildId: message.guildId,
    view: 'home',
    target: null,
    pairs: [],
    notice: null,
  };
  const panel = await message.reply({ ...render(session), allowedMentions: { parse: [] } });
  session.panel = panel;
  sessions.set(panel.id, session);
  setTimeout(() => endSession(panel.id, '⌛ This setup panel expired. Run `//reaction roles` again.'), SESSION_MINUTES * 60_000);
}

function pairLine(pair) {
  return `${pair.display} → <@&${pair.roleId}>`;
}

function render(session) {
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('Reaction roles');
  const button = (id, label, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(`rr:${id}`).setLabel(label).setStyle(style);
  let components = [];

  if (session.view === 'home') {
    embed.setDescription('Give people a role when they react to a message.');
    components = [
      new ActionRowBuilder().addComponents(
        button('setup', 'Set up a message', ButtonStyle.Primary),
        button('remove', 'Remove from a message', ButtonStyle.Danger),
        button('list', 'Show all'),
        button('cancel', 'Close')
      ),
    ];
  } else if (session.view === 'list') {
    const entries = Object.entries(storage.data.reactionRoles).filter(([, c]) => c.guildId === session.guildId);
    embed.setDescription(
      entries.length
        ? entries
            .map(([messageId, c]) => `**[Message](${messageUrl({ ...c, messageId })})**\n${c.pairs.map(pairLine).join('\n')}`)
            .join('\n\n')
            .slice(0, 4000)
        : 'No reaction roles set up yet.'
    );
    components = [new ActionRowBuilder().addComponents(button('back', 'Back'))];
  } else if (session.view === 'edit') {
    embed.setDescription(
      [
        `**Message:** ${messageUrl(session.target)}`,
        '',
        session.pairs.length ? session.pairs.map(pairLine).join('\n') : '*No roles yet. Pick one below.*',
      ].join('\n')
    );
    components = [
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('rr:role').setPlaceholder('Add a role…')
      ),
    ];
    if (session.pairs.length) {
      components.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('rr:unpair')
            .setPlaceholder('Remove a role…')
            .addOptions(
              session.pairs.map((p) => ({
                label: client.guilds.cache.get(session.guildId)?.roles.cache.get(p.roleId)?.name ?? p.roleId,
                value: p.emoji,
                emoji: p.emojiId ? { id: p.emojiId } : { name: p.emoji },
              }))
            )
        )
      );
    }
    components.push(
      new ActionRowBuilder().addComponents(button('save', 'Save', ButtonStyle.Success), button('cancel', 'Cancel'))
    );
  } else {
    embed.setDescription(session.notice ?? 'Done.');
    return { embeds: [embed], components: [] };
  }

  if (session.notice) embed.addFields({ name: '​', value: session.notice });
  return { embeds: [embed], components };
}

async function refresh(session, notice = null) {
  session.notice = notice;
  await session.panel.edit({ ...render(session), allowedMentions: { parse: [] } }).catch(() => {});
}

function endSession(panelId, text) {
  const session = sessions.get(panelId);
  if (!session) return;
  sessions.delete(panelId);
  session.view = 'done';
  session.waitToken = null;
  return refresh(session, text);
}

function messageModal(id, title) {
  return new ModalBuilder()
    .setCustomId(id)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('message')
          .setLabel('Message ID or message link')
          .setPlaceholder('Right-click the message → Copy Message ID / Copy Message Link')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
}

// Finds a message by link, or by ID in the panel's channel and then every other channel.
async function resolveMessage(guild, fallbackChannel, input) {
  const link = input.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
  if (link) {
    if (link[1] !== guild.id) return null;
    const channel = await guild.channels.fetch(link[2]).catch(() => null);
    return channel?.messages?.fetch(link[3]).catch(() => null) ?? null;
  }
  const id = input.match(/^\d{17,20}$/)?.[0];
  if (!id) return null;
  const channels = [
    fallbackChannel,
    ...guild.channels.cache.filter((c) => c.isTextBased() && c.id !== fallbackChannel.id).values(),
  ];
  for (const channel of channels) {
    const found = await channel.messages?.fetch(id).catch(() => null);
    if (found) return found;
  }
  return null;
}

async function handleInteraction(interaction) {
  if (!interaction.customId?.startsWith('rr:')) return;

  // Modal IDs carry the panel ID because the modal isn't attached to the panel message.
  const [, action, panelId = interaction.message?.id] = interaction.customId.split(':');
  const session = sessions.get(panelId);
  if (!session) {
    return interaction.reply({
      content: 'This panel expired. Run `//reaction roles` again.',
      flags: MessageFlags.Ephemeral,
    });
  }
  if (interaction.user.id !== session.ownerId) {
    return interaction.reply({
      content: `Only <@${session.ownerId}> can use this panel. Run \`//reaction roles\` to open your own.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  switch (action) {
    case 'setup':
      return interaction.showModal(messageModal(`rr:setup-modal:${panelId}`, 'Set up reaction roles'));
    case 'remove':
      return interaction.showModal(messageModal(`rr:remove-modal:${panelId}`, 'Remove reaction roles'));
    case 'list':
    case 'back':
      session.view = action === 'list' ? 'list' : 'home';
      session.notice = null;
      return interaction.update(render(session));
    case 'cancel':
      await interaction.deferUpdate();
      return endSession(panelId, 'Cancelled.');
    case 'setup-modal':
      return onSetupModal(interaction, session);
    case 'remove-modal':
      return onRemoveModal(interaction, session);
    case 'role':
      return onRolePicked(interaction, session);
    case 'unpair':
      session.pairs = session.pairs.filter((p) => p.emoji !== interaction.values[0]);
      session.notice = null;
      return interaction.update(render(session));
    case 'save':
      return onSave(interaction, session);
  }
}

async function onSetupModal(interaction, session) {
  await interaction.deferUpdate();
  const target = await resolveMessage(
    interaction.guild,
    session.panel.channel,
    interaction.fields.getTextInputValue('message').trim()
  );
  if (!target) {
    return refresh(session, "❌ Couldn't find that message. Use **Copy Message Link** if it's in another channel.");
  }
  session.target = { guildId: target.guildId, channelId: target.channelId, messageId: target.id };
  session.pairs = (storage.data.reactionRoles[target.id]?.pairs ?? []).map((p) => ({ ...p }));
  session.view = 'edit';
  return refresh(session);
}

async function onRemoveModal(interaction, session) {
  await interaction.deferUpdate();
  const input = interaction.fields.getTextInputValue('message').trim();
  const messageId = input.match(/(\d{17,20})\s*$/)?.[1];
  const existing = messageId && storage.data.reactionRoles[messageId];
  if (!existing) return refresh(session, '❌ That message has no reaction roles.');

  delete storage.data.reactionRoles[messageId];
  storage.save();
  const channel = await client.channels.fetch(existing.channelId).catch(() => null);
  const target = await channel?.messages.fetch(messageId).catch(() => null);
  if (target) {
    for (const pair of existing.pairs) {
      await target.reactions.cache.get(pair.emoji)?.users.remove(client.user.id).catch(() => {});
    }
  }
  sessions.delete(session.panel.id);
  session.view = 'done';
  return refresh(session, `🗑️ Removed reaction roles from ${messageUrl({ ...existing, messageId })}.`);
}

async function onRolePicked(interaction, session) {
  const role = interaction.roles.first();
  const problem =
    role.id === session.guildId || role.managed
      ? `❌ ${role} can't be given out by bots.`
      : !role.editable
        ? `❌ I can't give ${role}. Move my bot role above it in Server Settings → Roles, and make sure I have Manage Roles.`
        : session.pairs.length >= MAX_PAIRS && !session.pairs.some((p) => p.roleId === role.id)
          ? `❌ A message can have at most ${MAX_PAIRS} reaction roles.`
          : null;
  if (problem) {
    session.notice = problem;
    return interaction.update(render(session));
  }

  const token = Symbol('wait');
  session.waitToken = token;
  session.notice = `👉 **React to this panel** with the emoji for ${role}. Custom server emojis work too.`;
  await interaction.update(render(session));

  const reaction = await session.panel
    .awaitReactions({ filter: (_, user) => user.id === session.ownerId, max: 1, time: EMOJI_WAIT_MS })
    .then((collected) => collected.first())
    .catch(() => null);
  if (session.waitToken !== token) return; // another role was picked, or the session ended
  session.waitToken = null;
  if (!reaction) return refresh(session, `⌛ No emoji received for ${role}. Pick the role again.`);

  await reaction.users.remove(session.ownerId).catch(() => {});
  const { emoji } = reaction;
  if (emoji.id && !client.emojis.cache.has(emoji.id)) {
    return refresh(session, "❌ I can't use that emoji, it's from a server I'm not in. Pick the role again.");
  }
  const pair = {
    emoji: emoji.id ?? emoji.name,
    emojiId: emoji.id ?? null,
    display: emoji.toString(),
    roleId: role.id,
  };
  // One emoji per role and one role per emoji.
  session.pairs = session.pairs.filter((p) => p.emoji !== pair.emoji && p.roleId !== pair.roleId);
  session.pairs.push(pair);
  return refresh(session, `✅ Added ${pairLine(pair)}. Add another role or hit **Save**.`);
}

async function onSave(interaction, session) {
  await interaction.deferUpdate();
  const { target } = session;
  const channel = await client.channels.fetch(target.channelId).catch(() => null);
  const message = await channel?.messages.fetch(target.messageId).catch(() => null);
  if (!message) return refresh(session, '❌ That message no longer exists.');

  const previous = storage.data.reactionRoles[target.messageId]?.pairs ?? [];
  if (session.pairs.length) {
    storage.data.reactionRoles[target.messageId] = {
      guildId: target.guildId,
      channelId: target.channelId,
      pairs: session.pairs,
    };
  } else {
    delete storage.data.reactionRoles[target.messageId];
  }
  storage.save();

  const keep = new Set(session.pairs.map((p) => p.emoji));
  for (const pair of previous) {
    if (!keep.has(pair.emoji)) {
      await message.reactions.cache.get(pair.emoji)?.users.remove(client.user.id).catch(() => {});
    }
  }
  const failed = [];
  for (const pair of session.pairs) {
    await message.react(pair.emojiId ?? pair.emoji).catch(() => failed.push(pair.display));
  }

  sessions.delete(session.panel.id);
  session.view = 'done';
  const summary = session.pairs.length
    ? `✅ Saved for ${messageUrl(target)}\n\n${session.pairs.map(pairLine).join('\n')}`
    : `🗑️ Removed reaction roles from ${messageUrl(target)}.`;
  const warning = failed.length
    ? `\n\n⚠️ Couldn't add ${failed.join(' ')} to the message. Check I have **Add Reactions** and **Read Message History** there.`
    : '';
  return refresh(session, summary + warning);
}

// ---------- Giving and taking roles ----------

async function handleReaction(reaction, user, added) {
  if (user.id === client.user.id) return;
  const config = storage.data.reactionRoles[reaction.message.id];
  if (!config) return;
  const key = reaction.emoji.id ?? reaction.emoji.name;
  const pair = config.pairs.find((p) => p.emoji === key);
  if (!pair) return;

  const guild = await client.guilds.fetch(config.guildId);
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member || member.user.bot) return;
  if (added) await member.roles.add(pair.roleId, 'Reaction role');
  else await member.roles.remove(pair.roleId, 'Reaction role');
}

module.exports = { init, isCommand, handleCommand, handleInteraction, handleReaction };
