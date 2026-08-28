const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { parseDuration } = require('./moderation');
const { getLastDeleted, getLastEdited } = require('./messageLog');

const COLOR = '#a8e6ff';

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

async function handlePing(interaction) {
  const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
  const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;
  const wsPing = interaction.client.ws.ping;
  await interaction.editReply(`🏓 Pong! Round trip: **${roundTrip}ms** — WebSocket: **${wsPing >= 0 ? `${wsPing}ms` : 'n/a'}**`);
}

async function handleUptime(interaction) {
  const ms = interaction.client.uptime || 0;
  await interaction.reply({ content: `🕒 I've been running for **${formatDuration(ms)}**.`, ephemeral: true });
}

async function handleServerIcon(interaction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This only works in a server.', ephemeral: true });
  const url = guild.iconURL({ size: 1024 });
  if (!url) return interaction.reply({ content: "This server doesn't have an icon set.", ephemeral: true });
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(`${guild.name}'s icon`).setImage(url).setDescription(`[Direct link](${url})`);
  await interaction.reply({ embeds: [embed] });
}

async function handleBanner(interaction) {
  const target = interaction.options.getUser('user') || interaction.user;
  // Banners aren't included on the partial User a slash command option hands
  // back -- a fresh, forced fetch is the only way to actually get one.
  const fullUser = await interaction.client.users.fetch(target.id, { force: true }).catch(() => target);
  const url = fullUser.bannerURL ? fullUser.bannerURL({ size: 1024 }) : null;
  if (!url) return interaction.reply({ content: `**${target.tag}** doesn't have a banner set.`, ephemeral: true });
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(`${target.tag}'s banner`).setImage(url).setDescription(`[Direct link](${url})`);
  await interaction.reply({ embeds: [embed] });
}

async function handleAvatar(interaction) {
  const target = interaction.options.getUser('user') || interaction.user;
  const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;
  const url = (member || target).displayAvatarURL({ size: 1024 });

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${target.tag}'s avatar`)
    .setImage(url)
    .setDescription(`[Direct link](${url})`);
  await interaction.reply({ embeds: [embed] });
}

async function handleUserInfo(interaction) {
  const target = interaction.options.getUser('user') || interaction.user;
  const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(target.tag)
    .setThumbnail((member || target).displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'ID', value: target.id, inline: true },
      { name: 'Bot?', value: target.bot ? 'Yes' : 'No', inline: true },
      { name: 'Account created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
    );

  if (member) {
    embed.addFields({
      name: 'Joined this server',
      value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown',
      inline: true,
    });
    if (member.premiumSinceTimestamp) {
      embed.addFields({ name: 'Boosting since', value: `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`, inline: true });
    }
    const roles = member.roles.cache.filter((r) => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position);
    embed.addFields({
      name: `Roles (${roles.size})`,
      value: roles.size > 0 ? [...roles.values()].map((r) => `<@&${r.id}>`).join(' ').slice(0, 1000) : '*None*',
    });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleMemberCount(interaction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This only works in a server.', ephemeral: true });

  const total = guild.memberCount;
  const cached = guild.members.cache;
  const bots = cached.filter((m) => m.user.bot).size;
  const humans = cached.size - bots;
  // memberCount is always accurate (Discord keeps it live over the gateway);
  // the human/bot split is only as good as what's cached, so it's flagged
  // when the cache clearly doesn't cover the whole server.
  const cacheNote = cached.size < total ? ` *(bot/human split based on ${cached.size} cached members)*` : '';
  await interaction.reply(`👥 **${guild.name}** has **${total}** members — **${humans}** humans, **${bots}** bots${cacheNote}.`);
}

const CHANNEL_TYPE_LABELS = {
  [ChannelType.GuildText]: 'Text',
  [ChannelType.GuildVoice]: 'Voice',
  [ChannelType.GuildCategory]: 'Category',
  [ChannelType.GuildAnnouncement]: 'Announcement',
  [ChannelType.GuildStageVoice]: 'Stage',
  [ChannelType.GuildForum]: 'Forum',
  [ChannelType.PublicThread]: 'Thread',
  [ChannelType.PrivateThread]: 'Private thread',
  [ChannelType.AnnouncementThread]: 'Announcement thread',
};

async function handleChannelInfo(interaction) {
  const channel = interaction.options.getChannel('channel') || interaction.channel;

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`#${channel.name}`)
    .addFields(
      { name: 'ID', value: channel.id, inline: true },
      { name: 'Type', value: CHANNEL_TYPE_LABELS[channel.type] || 'Unknown', inline: true },
      { name: 'Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true },
    );

  if (channel.parent) embed.addFields({ name: 'Category', value: channel.parent.name, inline: true });
  if ('nsfw' in channel) embed.addFields({ name: 'NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true });
  if ('rateLimitPerUser' in channel && channel.rateLimitPerUser) {
    embed.addFields({ name: 'Slowmode', value: `${channel.rateLimitPerUser}s`, inline: true });
  }
  if ('topic' in channel && channel.topic) embed.addFields({ name: 'Topic', value: channel.topic.slice(0, 500) });

  await interaction.reply({ embeds: [embed] });
}

async function handleInvite(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
    return interaction.reply({ content: 'You need Create Invite to do that.', ephemeral: true });
  }

  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const maxAgeHours = interaction.options.getInteger('max_age_hours');
  const maxUses = interaction.options.getInteger('max_uses');

  if (typeof channel.createInvite !== 'function') {
    return interaction.reply({ content: "I can't create an invite for that channel.", ephemeral: true });
  }

  let invite;
  try {
    invite = await channel.createInvite({
      maxAge: maxAgeHours != null ? maxAgeHours * 3600 : 86400,
      maxUses: maxUses || 0,
      unique: true,
      reason: `Requested by ${interaction.user.tag}`,
    });
  } catch (err) {
    return interaction.reply({ content: `Couldn't create an invite: ${err.message}`, ephemeral: true });
  }

  const expiryNote = maxAgeHours ? `expires in ${maxAgeHours}h` : 'expires in 24h';
  const usesNote = maxUses ? `, max ${maxUses} use${maxUses === 1 ? '' : 's'}` : '';
  await interaction.reply({ content: `🔗 ${invite.url} — ${expiryNote}${usesNote}`, ephemeral: true });
}

const EMOJI_MENTION_RE = /<(a?):(\w{2,32}):(\d+)>/;

async function handleSteal(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
    return interaction.reply({ content: 'You need Manage Expressions (emoji/stickers) to add an emoji.', ephemeral: true });
  }

  const input = interaction.options.getString('emoji').trim();
  const nameOption = interaction.options.getString('name');

  let url;
  let defaultName;
  const mentionMatch = EMOJI_MENTION_RE.exec(input);
  if (mentionMatch) {
    const [, animated, name, id] = mentionMatch;
    url = `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}`;
    defaultName = name;
  } else if (/^https?:\/\//i.test(input)) {
    url = input;
    defaultName = 'emoji';
  } else {
    return interaction.reply({ content: 'Give me a custom emoji (paste it) or a direct image URL.', ephemeral: true });
  }

  const name = (nameOption || defaultName).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);
  if (name.length < 2) {
    return interaction.reply({ content: 'Emoji names need to be at least 2 characters (letters, numbers, underscores only).', ephemeral: true });
  }

  let emoji;
  try {
    emoji = await interaction.guild.emojis.create({ attachment: url, name, reason: `Added by ${interaction.user.tag}` });
  } catch (err) {
    return interaction.reply({ content: `Couldn't add that emoji: ${err.message}`, ephemeral: true });
  }

  await interaction.reply(`✅ Added ${emoji.toString()} as \`:${emoji.name}:\``);
}

async function handleServerInfo(interaction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This only works in a server.', ephemeral: true });

  const owner = await guild.fetchOwner().catch(() => null);
  const channels = guild.channels.cache;
  const textCount = channels.filter((c) => c.type === ChannelType.GuildText).size;
  const voiceCount = channels.filter((c) => c.type === ChannelType.GuildVoice).size;

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: 'Owner', value: owner ? `<@${owner.id}>` : 'Unknown', inline: true },
      { name: 'Members', value: String(guild.memberCount), inline: true },
      { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Text channels', value: String(textCount), inline: true },
      { name: 'Voice channels', value: String(voiceCount), inline: true },
      { name: 'Roles', value: String(guild.roles.cache.size), inline: true },
      { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0} (tier ${guild.premiumTier})`, inline: true },
    )
    .setFooter({ text: `Server ID: ${guild.id}` });

  await interaction.reply({ embeds: [embed] });
}

async function handleRoleInfo(interaction) {
  const role = interaction.options.getRole('role');
  const embed = new EmbedBuilder()
    .setColor(role.color || COLOR)
    .setTitle(role.name)
    .addFields(
      { name: 'ID', value: role.id, inline: true },
      { name: 'Color', value: role.hexColor, inline: true },
      { name: 'Position', value: String(role.position), inline: true },
      { name: 'Members', value: String(role.members.size), inline: true },
      { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
      { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
      { name: 'Managed', value: role.managed ? 'Yes (bot/integration role)' : 'No', inline: true },
    );
  await interaction.reply({ embeds: [embed] });
}

async function handleEmoji(interaction) {
  const input = interaction.options.getString('emoji').trim();
  const idMatch = /:(\d+)>?$/.exec(input);
  const emoji = idMatch
    ? interaction.guild.emojis.cache.get(idMatch[1])
    : interaction.guild.emojis.cache.find((e) => e.name.toLowerCase() === input.replace(/:/g, '').toLowerCase());

  if (!emoji) {
    return interaction.reply({ content: "Couldn't find that emoji in this server.", ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`:${emoji.name}:`)
    .setImage(emoji.imageURL({ size: 256 }))
    .setDescription(`Markup: \`<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>\``)
    .addFields(
      { name: 'ID', value: emoji.id, inline: true },
      { name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
      { name: 'Created', value: `<t:${Math.floor(emoji.createdTimestamp / 1000)}:R>`, inline: true },
    );
  await interaction.reply({ embeds: [embed] });
}

const TIMESTAMP_STYLES = [
  ['t', 'Short time'], ['T', 'Long time'], ['d', 'Short date'], ['D', 'Long date'],
  ['f', 'Short date/time'], ['F', 'Long date/time'], ['R', 'Relative'],
];

function handleTimestamp(interaction) {
  const ms = parseDuration(interaction.options.getString('when'));
  if (!ms) {
    return interaction.reply({ content: 'Give a time from now, like `10m`, `2h`, or `3d`.', ephemeral: true });
  }
  const epoch = Math.floor((Date.now() + ms) / 1000);
  const lines = TIMESTAMP_STYLES.map(([code, label]) => `\`<t:${epoch}:${code}>\` → <t:${epoch}:${code}> — ${label}`);
  return interaction.reply({ content: lines.join('\n'), ephemeral: true });
}

const MESSAGE_LINK_RE = /discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)\/(\d+)/;

function parseMessageLink(input, currentChannelId) {
  const trimmed = (input || '').trim();
  const linkMatch = MESSAGE_LINK_RE.exec(trimmed);
  if (linkMatch) {
    const [, guildId, channelId, messageId] = linkMatch;
    return { guildId: guildId === '@me' ? null : guildId, channelId, messageId };
  }
  if (/^\d{15,25}$/.test(trimmed)) {
    return { guildId: null, channelId: currentChannelId, messageId: trimmed };
  }
  return null;
}

async function handleQuote(interaction) {
  const parsed = parseMessageLink(interaction.options.getString('message'), interaction.channelId);
  if (!parsed) {
    return interaction.reply({ content: "That doesn't look like a message link or ID.", ephemeral: true });
  }
  if (parsed.guildId && parsed.guildId !== interaction.guildId) {
    return interaction.reply({ content: "That message is from a different server.", ephemeral: true });
  }

  const sourceChannel = await interaction.guild.channels.fetch(parsed.channelId).catch(() => null);
  if (!sourceChannel || !sourceChannel.isTextBased()) {
    return interaction.reply({ content: "Can't find that channel.", ephemeral: true });
  }

  // Only quote something the invoker could already see themselves --
  // otherwise this would let someone leak a private channel's content into
  // a public one just by pasting a message link.
  const memberPerms = sourceChannel.permissionsFor(interaction.member);
  if (!memberPerms || !memberPerms.has(PermissionFlagsBits.ViewChannel)) {
    return interaction.reply({ content: "You don't have access to that channel.", ephemeral: true });
  }

  const sourceMessage = await sourceChannel.messages.fetch(parsed.messageId).catch(() => null);
  if (!sourceMessage) {
    return interaction.reply({ content: "Couldn't find that message.", ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: sourceMessage.author.tag, iconURL: sourceMessage.author.displayAvatarURL() })
    .setDescription((sourceMessage.content || '*(no text content)*').slice(0, 4000))
    .addFields({ name: 'Source', value: `[Jump to message](${sourceMessage.url}) in <#${parsed.channelId}>` })
    .setTimestamp(sourceMessage.createdAt);

  const firstImage = sourceMessage.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (firstImage) embed.setImage(firstImage.url);

  await interaction.reply({ embeds: [embed] });
}

async function handlePin(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({ content: 'You need Manage Messages to pin something.', ephemeral: true });
  }

  const parsed = parseMessageLink(interaction.options.getString('message'), interaction.channelId);
  if (!parsed) {
    return interaction.reply({ content: "That doesn't look like a message link or ID.", ephemeral: true });
  }
  // Pins are channel-bound on Discord's side anyway -- reject a link from
  // elsewhere up front instead of letting the fetch below just fail.
  if (parsed.channelId !== interaction.channelId) {
    return interaction.reply({ content: 'I can only pin a message from this channel — go to that channel and run it there.', ephemeral: true });
  }

  const message = await interaction.channel.messages.fetch(parsed.messageId).catch(() => null);
  if (!message) {
    return interaction.reply({ content: "Couldn't find that message in this channel.", ephemeral: true });
  }
  if (message.pinned) {
    return interaction.reply({ content: 'That message is already pinned.', ephemeral: true });
  }

  try {
    await message.pin();
  } catch (err) {
    return interaction.reply({ content: `Couldn't pin that: ${err.message}`, ephemeral: true });
  }

  await interaction.reply(`📌 Pinned [that message](${message.url}).`);
}

// Gated on Manage Messages -- content a moderator just deleted or edited
// (a slur, a doxx attempt, whatever) shouldn't be one command away from
// getting resurfaced in the channel by anyone who happens to be there.
async function handleSnipe(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({ content: 'You need Manage Messages to snipe a deleted message.', ephemeral: true });
  }

  const entry = getLastDeleted(interaction.channelId);
  if (!entry) {
    return interaction.reply({ content: "Nothing to snipe here — no recent deletion I remember.", ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: entry.authorTag, iconURL: entry.avatarURL || undefined })
    .setTitle('🗑️ Last deleted message')
    .setDescription(entry.content || '*(no text content)*')
    .setFooter({ text: `Deleted ${Math.max(0, Math.round((Date.now() - entry.deletedAt) / 1000))}s ago` });
  if (entry.attachments.length > 0) embed.addFields({ name: 'Attachments', value: entry.attachments.join('\n').slice(0, 1000) });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleEditSnipe(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({ content: 'You need Manage Messages to snipe an edited message.', ephemeral: true });
  }

  const entry = getLastEdited(interaction.channelId);
  if (!entry) {
    return interaction.reply({ content: "Nothing to snipe here — no recent edit I remember.", ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: entry.authorTag, iconURL: entry.avatarURL || undefined })
    .setTitle('✏️ Last edited message')
    .addFields(
      { name: 'Before', value: entry.before || '*(no text content)*' },
      { name: 'After', value: entry.after || '*(no text content)*' },
    )
    .setFooter({ text: `Edited ${Math.max(0, Math.round((Date.now() - entry.editedAt) / 1000))}s ago` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = {
  avatar: handleAvatar,
  userinfo: handleUserInfo,
  serverinfo: handleServerInfo,
  roleinfo: handleRoleInfo,
  emoji: handleEmoji,
  timestamp: handleTimestamp,
  quote: handleQuote,
  ping: handlePing,
  uptime: handleUptime,
  servericon: handleServerIcon,
  banner: handleBanner,
  pin: handlePin,
  snipe: handleSnipe,
  editsnipe: handleEditSnipe,
  membercount: handleMemberCount,
  channelinfo: handleChannelInfo,
  invite: handleInvite,
  steal: handleSteal,
};
