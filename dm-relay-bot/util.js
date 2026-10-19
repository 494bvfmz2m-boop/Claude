const { ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('./config');

// Messages in a post starting with this stay internal and are not sent to the user.
const NOTE_PREFIX = '//';

function chunk(text, size = 2000) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
}

const UNIT_MS = { w: 604_800_000, d: 86_400_000, h: 3_600_000, m: 60_000, s: 1000 };

// "2h", "1d12h", "30m" -> milliseconds, or null if it isn't a duration.
function parseDuration(text) {
  if (!/^(\d+[wdhms])+$/i.test(text)) return null;
  let ms = 0;
  for (const [, amount, unit] of text.matchAll(/(\d+)([wdhms])/gi)) {
    ms += Number(amount) * UNIT_MS[unit.toLowerCase()];
  }
  return ms > 0 ? ms : null;
}

const timestamp = (ms, style = 'R') => `<t:${Math.floor(ms / 1000)}:${style}>`;

// Sends a message that deletes itself after a while.
async function sendTemporary(channel, payload, ms = 60_000) {
  const sent = await channel.send(payload);
  setTimeout(() => sent.delete().catch(() => {}), ms);
  return sent;
}

// "1h 5m" style text for a duration in milliseconds.
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return '<1m';
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && `${d}d`, h && `${h}h`, !d && m && `${m}m`].filter(Boolean).join(' ');
}

// Server-management commands: admins, the staff role if one is set, otherwise Manage Server.
function isModerator(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return config.staffRoleId
    ? member.roles.cache.has(config.staffRoleId)
    : member.permissions.has(PermissionFlagsBits.ManageGuild);
}

const row = (...components) => new ActionRowBuilder().addComponents(...components);

module.exports = { NOTE_PREFIX, chunk, parseDuration, timestamp, sendTemporary, formatDuration, isModerator, row };
