const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getRankForRoleIds } = require('./cache');
const { Hierarchies } = require('../db/repo');
const { getMemberAccess } = require('../web/lib/dashboardAccess');
const { ACTIONS, canUseAction } = require('./commandPermissions');

const INFO_COLOR = '#a8e6ff';

function permLine(label, has) {
  return `${has ? '✅' : '❌'} ${label}`;
}

// The full command list, independent of ACTIONS/commandPermissions.js --
// this covers every slash command that exists, including the ones (help,
// poll, tag get, etc.) nothing in that system gates at all.
function buildCommandList({ isOwner, isAdmin, perms, rank, grantedActionKeys }) {
  const staffOverride = isOwner || isAdmin;
  const hasManageMessages = perms.has(PermissionFlagsBits.ManageMessages);
  const inHierarchy = staffOverride || rank.rank > 0;

  const entries = [
    { name: 'help', available: true },
    { name: 'info', available: true },
    { name: 'introduction', available: true },
    { name: 'afk', available: true },
    { name: 'avatar', available: true },
    { name: 'userinfo', available: true },
    { name: 'serverinfo', available: true },
    { name: 'roleinfo', available: true },
    { name: 'emoji', available: true },
    { name: 'timestamp', available: true },
    { name: 'quote', available: true },
    { name: 'remind', available: true },
    { name: 'poll', available: true },
    { name: 'giveaway', available: true },
    { name: 'event', available: true },
    { name: 'tag get / list', available: true },
    { name: 'tag create / delete', available: hasManageMessages },
    { name: 'change (in a ticket)', available: true },
    { name: 'warnings', available: staffOverride || perms.has(PermissionFlagsBits.ModerateMembers) },
    { name: 'promote', available: inHierarchy },
    { name: 'demote', available: inHierarchy },
  ];
  for (const action of ACTIONS) {
    entries.push({ name: action.command || action.key, available: staffOverride || grantedActionKeys.has(action.key) });
  }
  return entries;
}

// "Tells the user what access they have" -- mirrors exactly the checks the
// dashboard and slash commands actually enforce, so there's one obvious
// place to answer "why can't I do X" without digging through Discord's
// role settings by hand.
async function handleInfo(interaction) {
  const target = interaction.options.getUser('user') || interaction.user;
  const guild = interaction.guild;
  const member = await guild.members.fetch(target.id).catch(() => null);

  if (!member) {
    return interaction.reply({ content: `${target.tag} isn't in this server.`, ephemeral: true });
  }

  const perms = member.permissions;
  const isOwner = guild.ownerId === member.id;
  const isAdmin = perms.has(PermissionFlagsBits.Administrator);

  const primaryHierarchy = Hierarchies.getPrimary(guild.id);
  const rank = primaryHierarchy ? getRankForRoleIds(primaryHierarchy.id, [...member.roles.cache.keys()]) : { rank: 0, roleId: null };
  const rankRole = rank.roleId ? guild.roles.cache.get(rank.roleId) : null;

  const dashAccess = await getMemberAccess(guild, member.id);
  const grantedActionKeys = new Set(ACTIONS.filter((a) => canUseAction(guild, member, a.key)).map((a) => a.key));
  const commandList = buildCommandList({ isOwner, isAdmin, perms, rank, grantedActionKeys });

  const embed = new EmbedBuilder()
    .setTitle(`ℹ️ ${target.tag}`)
    .setThumbnail(target.displayAvatarURL())
    .setColor(INFO_COLOR)
    .addFields(
      {
        name: 'Discord permissions',
        value: [
          permLine('Administrator', isAdmin),
          permLine('Manage Server', perms.has(PermissionFlagsBits.ManageGuild)),
          permLine('Ban Members', perms.has(PermissionFlagsBits.BanMembers)),
          permLine('Kick Members', perms.has(PermissionFlagsBits.KickMembers)),
          permLine('Moderate Members (timeout)', perms.has(PermissionFlagsBits.ModerateMembers)),
          permLine('Manage Roles', perms.has(PermissionFlagsBits.ManageRoles)),
          permLine('Manage Channels', perms.has(PermissionFlagsBits.ManageChannels)),
        ].join('\n'),
      },
      {
        name: 'ModSentry dashboard',
        value: dashAccess.level === 'full'
          ? '✅ Full access — can log in and manage this server at bot.modsentry.site'
          : dashAccess.level === 'limited'
            ? `✅ Limited access — can log in and use: ${[...dashAccess.areas].join(', ')}`
            : "❌ Can't access this server's dashboard (ask an admin to grant it from the Permissions page)",
      },
      {
        name: primaryHierarchy ? primaryHierarchy.name : 'Staff hierarchy',
        value: rank.rank > 0
          ? `Rank ${rank.rank} — ${rankRole ? rankRole.name : 'unknown role'}`
          : `Not part of the ${primaryHierarchy ? primaryHierarchy.name.toLowerCase() : 'staff'} hierarchy`,
      },
      {
        name: 'Commands',
        value: commandList.map((c) => permLine(`/${c.name}`, c.available)).join('\n'),
      },
    );

  if (isOwner) embed.setFooter({ text: 'Server owner — bypasses every rank and permission check' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { info: handleInfo };
