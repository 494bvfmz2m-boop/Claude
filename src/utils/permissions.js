const { PermissionFlagsBits } = require('discord.js');

function isStaff(member, staffRoleId) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (staffRoleId && member.roles.cache.has(staffRoleId)) return true;
  return false;
}

function canModerate(moderator, target) {
  if (!target) return true;
  if (target.id === moderator.id) return false;
  if (target.roles?.highest && moderator.roles?.highest) {
    return moderator.roles.highest.position > target.roles.highest.position;
  }
  return true;
}

module.exports = { isStaff, canModerate };
