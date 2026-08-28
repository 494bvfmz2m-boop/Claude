const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { parseDuration } = require('./moderation');

const COLOR = '#a8e6ff';

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

module.exports = {
  avatar: handleAvatar,
  userinfo: handleUserInfo,
  serverinfo: handleServerInfo,
  roleinfo: handleRoleInfo,
  emoji: handleEmoji,
  timestamp: handleTimestamp,
  quote: handleQuote,
};
