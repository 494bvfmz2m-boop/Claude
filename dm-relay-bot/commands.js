const { PermissionFlagsBits } = require('discord.js');
const modmail = require('./modmail');
const reactionRoles = require('./reactionRoles');
const { NOTE_PREFIX, sendTemporary } = require('./util');

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
  ].join('\n');
}

const canUse = (member) =>
  modmail.isStaff(member) || Boolean(member?.permissions.has(PermissionFlagsBits.ManageRoles));

async function handle(message, text) {
  if (!message.inGuild() || !canUse(message.member)) return;
  const command = text.split(/\s+/)[0].toLowerCase();

  if (command === '' || command === 'list' || command === 'help') {
    await message.delete().catch(() => {});
    return sendTemporary(message.channel, { content: listText(message.client), allowedMentions: { parse: [] } }, LIST_MS);
  }
  if (reactionRoles.isCommand(text)) return reactionRoles.openPrompt(message);
  if (modmail.isRelayPost(message.channel) && (await modmail.handleCommand(message, text))) return;

  await message.delete().catch(() => {});
  return sendTemporary(
    message.channel,
    { content: `Unknown command. Try \`@${message.client.user.username} list\`.`, allowedMentions: { parse: [] } },
    10_000
  );
}

module.exports = { parse, handle };
