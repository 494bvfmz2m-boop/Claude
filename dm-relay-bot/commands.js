const { PermissionFlagsBits } = require('discord.js');
const modmail = require('./modmail');
const reactionRoles = require('./reactionRoles');
const faq = require('./faq');
const stats = require('./stats');
const verify = require('./verify');
const suggestions = require('./suggestions');
const movieNight = require('./movieNight');
const { NOTE_PREFIX, sendTemporary, isModerator } = require('./util');

const LIST_MS = 120_000;

// Returns the text after "@Bot" (or the bot's own role mention), or null if the message doesn't start with one.
function parse(message) {
  const match = message.content.match(/^<@[!&]?(\d+)>\s*([\s\S]*)$/);
  if (!match) return null;
  const { client } = message;
  const botRoleId = message.guild?.roles.botRoleFor(client.user)?.id;
  if (match[1] !== client.user.id && match[1] !== botRoleId) return null;
  return match[2].trim();
}

function listText(client) {
  const at = (command) => `\`@${client.user.username} ${command}\``;
  return [
    '## What I can do',
    '**Inside a DM post**',
    '• Type normally: sent to the person',
    `• \`${NOTE_PREFIX} text\`: internal note, not sent`,
    `• ${at('close [reason]')}: close the post, the reason is DMed to them`,
    `• ${at('delete [reason]')}: delete the post, the reason is DMed to them`,
    `• ${at('s <name>')}: send a saved snippet`,
    `• ${at('snippet add <name> <text>')} / ${at('snippet remove <name>')} / ${at('snippets')}`,
    `• ${at('remind <time> [note]')}: ping you later if still open, e.g. ${at('remind 2h')}`,
    '• Buttons on each post: 🙋 Claim, 🔒 Close, 🗑️ Delete',
    '',
    '**Anywhere**',
    `• ${at('list')}: this list`,
    `• ${at('reaction roles')}: create, edit or delete reaction-role messages (needs Manage Roles)`,
    `• ${at('faq')}: automatic answers for common DM questions`,
    `• ${at('stats')}: staff stats, ratings and busiest hours`,
    `• ${at('verify')}: post a verification button in this channel`,
    `• ${at('suggestions setup')}: use this channel for suggestions`,
    `• ${at('movie night [name]')}: voice channel where only admins can talk and stream`,
    '',
    '**For everyone**',
    `• ${at('suggest <idea>')}: post a suggestion`,
  ].join('\n');
}

const canUse = (member) =>
  modmail.isStaff(member) || isModerator(member) || Boolean(member?.permissions.has(PermissionFlagsBits.ManageRoles));

async function handle(message, text) {
  if (!message.inGuild()) return;
  const command = text.split(/\s+/)[0].toLowerCase();
  const rest = text.slice(command.length).trim();

  if (command === 'suggest') return suggestions.submit(message, rest);
  if (!canUse(message.member)) return;

  if (command === '' || command === 'list' || command === 'help') {
    await message.delete().catch(() => {});
    return sendTemporary(message.channel, { content: listText(message.client), allowedMentions: { parse: [] } }, LIST_MS);
  }
  if (reactionRoles.isCommand(text)) return reactionRoles.openPrompt(message);
  if (command === 'faq') return faq.openMenu(message);
  if (command === 'stats') return stats.show(message);
  if (command === 'verify') return verify.openPrompt(message);
  if (/^suggestions?\s+setup$/i.test(text)) return suggestions.setup(message);
  const movie = text.match(/^movie[\s-]*night\b\s*([\s\S]*)$/i);
  if (movie) return movieNight.start(message, movie[1].trim());
  if (modmail.isRelayPost(message.channel) && (await modmail.handleCommand(message, text))) return;

  await message.delete().catch(() => {});
  return sendTemporary(
    message.channel,
    { content: `Unknown command. Try \`@${message.client.user.username} list\`.`, allowedMentions: { parse: [] } },
    10_000
  );
}

module.exports = { parse, handle };
