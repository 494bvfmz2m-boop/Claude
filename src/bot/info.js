const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getRankForRoleIds } = require('./cache');
const { getMemberAccess } = require('../web/lib/dashboardAccess');
const { ACTIONS, canUseAction } = require('./commandPermissions');

const INFO_COLOR = '#a8e6ff';

function permLine(label, has) {
  return `${has ? '✅' : '❌'} ${label}`;
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

  const rank = getRankForRoleIds(guild.id, [...member.roles.cache.keys()]);
  const rankRole = rank.roleId ? guild.roles.cache.get(rank.roleId) : null;

  const dashAccess = await getMemberAccess(guild, member.id);
  const grantedActions = ACTIONS.filter((a) => canUseAction(guild, member, a.key));

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
        name: 'Moderation commands',
        value: isOwner || isAdmin
          ? '✅ All of them (owner/Administrator)'
          : grantedActions.length > 0
            ? grantedActions.map((a) => `\`/${a.key}\``).join(', ')
            : "None granted -- ask an admin to grant them from the Permissions page",
      },
      {
        name: 'Staff hierarchy',
        value: rank.rank > 0
          ? `Rank ${rank.rank} — ${rankRole ? rankRole.name : 'unknown role'}`
          : 'Not part of the staff hierarchy',
      },
    );

  if (isOwner) embed.setFooter({ text: 'Server owner — bypasses every rank and permission check' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { info: handleInfo };
