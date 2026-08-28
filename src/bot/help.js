const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { canUseAction } = require('./commandPermissions');
const { getRankForRoleIds } = require('./cache');
const { Hierarchies } = require('../db/repo');

const HELP_COLOR = '#a8e6ff';

// [action key used by canUseAction, usage string, description]
const GATED_MOD_COMMANDS = [
  ['ban', '/ban <user> [reason]', 'Ban someone from the server'],
  ['unban', '/unban <user> [reason]', 'Lift a ban'],
  ['kick', '/kick <user> [reason]', 'Kick someone from the server'],
  ['mute', '/mute <user> <duration> [reason]', 'Time someone out'],
  ['unmute', '/unmute <user> [reason]', 'Remove a timeout early'],
  ['warn', '/warn <user> <reason>', 'Log a warning (can auto-escalate)'],
  ['clearwarnings', '/clearwarnings <user>', "Clear someone's warnings"],
  ['purge', '/purge [amount] [user]', 'Bulk-delete messages in this channel'],
  ['nickname', '/nick <user> [nickname]', "Change someone's nickname"],
];

// Only what this specific person can actually run right now, grouped the
// same way the dashboard's Permissions page thinks about actions -- so
// "why can't I see X" always has the same answer as /info gives.
async function handleHelp(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  const isOwnerOrAdmin = guild.ownerId === member.id || member.permissions.has(PermissionFlagsBits.Administrator);

  const moderation = GATED_MOD_COMMANDS
    .filter(([action]) => isOwnerOrAdmin || canUseAction(guild, member, action))
    .map(([, usage, desc]) => `\`${usage}\` — ${desc}`);
  // Not permission-gated on purpose -- anyone can check a warning history.
  moderation.push("`/warnings <user>` — See someone's warning history");

  const primaryHierarchy = Hierarchies.getPrimary(guild.id);
  const rank = primaryHierarchy ? getRankForRoleIds(primaryHierarchy.id, [...member.roles.cache.keys()]) : { rank: 0, roleId: null };
  const staff = (isOwnerOrAdmin || rank.rank > 0)
    ? [
        '`/promote <user>` — Move someone up the staff hierarchy',
        '`/demote <user>` — Move someone down the staff hierarchy',
      ]
    : [];

  const utility = [
    '`/info [user]` — See permissions, dashboard access, staff rank, and every command you can actually run',
    "`/introduction` — ModSentry's full welcome message, plus every registered command",
    '`/afk [message]` — Mark yourself AFK, with an optional reason -- clears automatically when you next send a message',
    '`/avatar [user]` — Show an avatar full size',
    '`/userinfo [user]` — Account/member info -- join date, roles, boost status',
    '`/serverinfo` — This server at a glance',
    '`/roleinfo <role>` — A role at a glance',
    '`/emoji <emoji>` — Show a big version of a custom emoji',
    '`/timestamp <when>` — Generate a Discord timestamp to paste into a message',
    '`/quote <message>` — Repost a message as a clean embed',
    '`/remind <time> [message] [here]` — Set a personal reminder',
    '`/poll <question> <option1> <option2> ... [duration]` — Post a reaction poll, optionally auto-closing after a set time',
    '`/giveaway start <prize> <duration> [winners] [required_role]` — Start a giveaway',
    '`/giveaway end <message_id>` / `/giveaway reroll <message_id>` — End early / pick new winners',
    '`/event <title> [time] [description]` — Post an event people can RSVP to',
    "`/tag get <name>` — Post a tag · `/tag list` — See all tags",
  ];
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    utility.push('`/tag create <name> <content>` / `/tag delete <name>` — Manage tags');
  }

  const embed = new EmbedBuilder()
    .setTitle('📖 ModSentry commands')
    .setColor(HELP_COLOR)
    .setDescription('Only shown below: what you can actually run right now. Run `/introduction` for the complete list.')
    .addFields(
      { name: '🎫 Tickets', value: '`/change` — Move this ticket to a different type (run it inside a ticket channel)' },
      { name: '🛡️ Moderation', value: moderation.join('\n') },
    );

  if (staff.length > 0) embed.addFields({ name: '👮 Staff hierarchy', value: staff.join('\n') });
  embed.addFields({ name: 'ℹ️ Utility', value: utility.join('\n') });

  if (!isOwnerOrAdmin && staff.length === 0 && moderation.length === 1) {
    embed.addFields({ name: 'Want more?', value: "Ask an admin to grant you actions from the dashboard's Permissions page." });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { help: handleHelp };
