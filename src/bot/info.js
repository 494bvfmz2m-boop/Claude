const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getRankForRoleIds } = require('./cache');

const INFO_COLOR = '#5865F2';

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
  const canUseDashboard = isOwner || perms.has(PermissionFlagsBits.ManageGuild);

  const rank = getRankForRoleIds(guild.id, [...member.roles.cache.keys()]);
  const rankRole = rank.roleId ? guild.roles.cache.get(rank.roleId) : null;

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
        name: 'Quellum dashboard',
        value: canUseDashboard
          ? '✅ Can log in and manage this server at bot.quellum.site'
          : "❌ Can't access this server's dashboard (needs Manage Server)",
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
