const { EmbedBuilder, Events, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { GuildSettings } = require('../db/repo');
const { emojiUrl } = require('./emoji');

const DELETE_COLOR = '#ed4245';
const EDIT_COLOR = '#a8e6ff';
const MAX_FIELD_LEN = 1000;

// In-memory only, on purpose -- /snipe and /editsnipe are for catching
// something that *just* happened, not a permanent record (the message log
// channel above is the real audit trail). Resets on every restart, and
// expires on its own after MAX_SNIPE_AGE_MS so a stale entry doesn't linger
// forever in a quiet channel.
const MAX_SNIPE_AGE_MS = 30 * 60 * 1000;
const lastDeleted = new Map(); // channelId -> { content, authorId, authorTag, avatarURL, deletedAt, attachments }
const lastEdited = new Map(); // channelId -> { before, after, authorId, authorTag, avatarURL, editedAt }

function getLastDeleted(channelId) {
  const entry = lastDeleted.get(channelId);
  if (!entry || Date.now() - entry.deletedAt > MAX_SNIPE_AGE_MS) return null;
  return entry;
}

function getLastEdited(channelId) {
  const entry = lastEdited.get(channelId);
  if (!entry || Date.now() - entry.editedAt > MAX_SNIPE_AGE_MS) return null;
  return entry;
}

function truncate(text) {
  if (!text) return '*(no text content)*';
  return text.length > MAX_FIELD_LEN ? `${text.slice(0, MAX_FIELD_LEN)}…` : text;
}

async function getLogChannel(guild) {
  if (!guild) return null;
  const settings = GuildSettings.get(guild.id);
  if (!settings.message_log_channel_id) return null;
  const channel = await guild.channels.fetch(settings.message_log_channel_id).catch(() => null);
  return channel?.isTextBased() ? channel : null;
}

// Discord only writes a MessageDelete audit log entry when someone deletes
// someone else's message with Manage Messages -- deleting your own message
// leaves no entry at all. Best-effort match: the most recent entry against
// this exact author in this exact channel, and only if it's fresh enough to
// plausibly be *this* deletion rather than some earlier one.
async function findDeleter(message) {
  if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;
  try {
    const logs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 });
    const entry = logs.entries.find((e) => (
      e.target?.id === message.author?.id
      && e.extra?.channel?.id === message.channelId
      && Date.now() - e.createdTimestamp < 10_000
    ));
    return entry?.executor || null;
  } catch {
    return null;
  }
}

function register(client) {
  // Only ever has content to show for messages that were in the cache before
  // they were deleted (discord.js's default cache, or ones the bot already
  // saw) -- a message deleted while genuinely uncached carries no content at
  // all, so those are silently skipped rather than logged as blank.
  client.on(Events.MessageDelete, async (message) => {
    try {
      if (!message.guild || message.author?.bot) return;
      if (message.partial) return;

      lastDeleted.set(message.channelId, {
        content: message.content,
        authorId: message.author?.id || null,
        authorTag: message.author?.tag || 'Unknown user',
        avatarURL: message.author?.displayAvatarURL?.() || null,
        deletedAt: Date.now(),
        attachments: [...message.attachments.values()].map((a) => a.url),
      });

      const channel = await getLogChannel(message.guild);
      if (!channel) return;

      const deleter = await findDeleter(message);

      const embed = new EmbedBuilder()
        .setColor(DELETE_COLOR)
        .setAuthor({ name: message.author?.tag || 'Unknown user', iconURL: message.author?.displayAvatarURL?.() })
        .setTitle('🗑️ Message deleted')
        .setThumbnail(emojiUrl('modsentry-scan.gif'))
        .setDescription(truncate(message.content))
        .addFields(
          { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
          {
            name: 'Deleted by',
            value: (deleter && deleter.id !== message.author?.id) ? `<@${deleter.id}> (${deleter.tag})` : 'Likely themselves — no mod audit entry found',
            inline: true,
          },
        )
        .setFooter({ text: `User ID: ${message.author?.id || 'unknown'}` })
        .setTimestamp();

      if (message.attachments.size > 0) {
        embed.addFields({ name: 'Attachments', value: [...message.attachments.values()].map((a) => a.name).join(', ') });
      }

      await channel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('Message log (delete) failed:', err.message);
    }
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
      if (!newMessage.guild || newMessage.author?.bot) return;
      if (oldMessage.partial || newMessage.partial) return;
      // Link unfurls and other embed-only updates fire this event too, with
      // identical content -- not an edit worth logging.
      if (oldMessage.content === newMessage.content) return;

      lastEdited.set(newMessage.channelId, {
        before: oldMessage.content,
        after: newMessage.content,
        authorId: newMessage.author?.id || null,
        authorTag: newMessage.author?.tag || 'Unknown user',
        avatarURL: newMessage.author?.displayAvatarURL?.() || null,
        editedAt: Date.now(),
      });

      const channel = await getLogChannel(newMessage.guild);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(EDIT_COLOR)
        .setAuthor({ name: newMessage.author?.tag || 'Unknown user', iconURL: newMessage.author?.displayAvatarURL?.() })
        .setTitle('✏️ Message edited')
        .setThumbnail(emojiUrl('modsentry-scan.gif'))
        .addFields(
          { name: 'Before', value: truncate(oldMessage.content) },
          { name: 'After', value: truncate(newMessage.content) },
          { name: 'Edited by', value: `<@${newMessage.author.id}> (${newMessage.author.tag})`, inline: true },
          { name: 'Channel', value: `<#${newMessage.channelId}>`, inline: true },
          { name: 'Jump to message', value: `[Click here](${newMessage.url})`, inline: true },
        )
        .setFooter({ text: `User ID: ${newMessage.author?.id || 'unknown'}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('Message log (edit) failed:', err.message);
    }
  });
}

module.exports = { register, getLastDeleted, getLastEdited };
