const { PermissionFlagsBits } = require('discord.js');
const { DashboardRoleAccess } = require('../../db/repo');

// Each dashboard route group maps to one of these. The Permissions page lets
// an owner/Manage-Server holder grant specific *other* roles access to
// specific areas without touching that role's real Discord permissions.
// Moderation actions still separately require the matching real Discord
// permission (see bot/moderation.js's ACTION_PERMISSION) -- granting the
// "moderation" area only controls who can reach the page at all.
const AREAS = [
  { key: 'tickets', label: 'Tickets', description: 'Ticket types, panels, and ticket history' },
  { key: 'embeds', label: 'Embeds', description: 'The custom embed builder' },
  { key: 'reaction_roles', label: 'Reaction Roles', description: 'Reaction role panels' },
  { key: 'moderation', label: 'Moderation', description: "Punishments, staff hierarchy, swear filter -- actual punishment actions still require the acting user's real Discord permission for that action" },
  { key: 'settings', label: 'Settings', description: 'Log channels and the ticket-banned role' },
];
const AREA_KEYS = new Set(AREAS.map((a) => a.key));

// level: 'full' (owner or real Administrator/Manage Server -- sees and can
// grant everything), 'limited' (only the granted areas), or 'none'.
async function getMemberAccess(guild, userId) {
  if (!guild || !userId) return { level: 'none', areas: new Set() };
  if (guild.ownerId === userId) return { level: 'full', areas: new Set(AREA_KEYS) };

  const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
  if (!member) return { level: 'none', areas: new Set() };

  if (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return { level: 'full', areas: new Set(AREA_KEYS) };
  }

  const areas = new Set();
  for (const grant of DashboardRoleAccess.listForGuild(guild.id)) {
    if (member.roles.cache.has(grant.roleId)) {
      grant.areas.forEach((a) => { if (AREA_KEYS.has(a)) areas.add(a); });
    }
  }
  return { level: areas.size > 0 ? 'limited' : 'none', areas };
}

module.exports = { AREAS, AREA_KEYS, getMemberAccess };
