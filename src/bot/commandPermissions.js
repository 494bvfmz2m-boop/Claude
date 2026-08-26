const { PermissionFlagsBits } = require('discord.js');
const { CommandPermissions } = require('../db/repo');

// Fine-grained, per-action allow-lists that let an owner separate actions
// Discord's own permission bits can't split apart -- e.g. Ban Members covers
// both /ban and /unban, but a server might want a role that can ban but
// never unban. Enforced identically by the slash commands and the
// dashboard's punishment form, so Discord's own permission bits are no
// longer consulted for these actions at all: only the grants below (plus
// the owner/Administrator bypass) decide who can do what.
// Promote/demote aren't here -- they already have their own rank-based
// permission model (only someone higher in the staff hierarchy than the
// target can act on them, owner/Administrator bypass) which is a better fit
// for that specific action than a flat role grant, so they're left alone.
const ACTIONS = [
  { key: 'ban', label: 'Ban' },
  { key: 'unban', label: 'Unban' },
  { key: 'kick', label: 'Kick' },
  { key: 'mute', label: 'Mute (timeout)' },
  { key: 'unmute', label: 'Unmute (remove timeout)' },
  { key: 'warn', label: 'Warn' },
  { key: 'clearwarnings', label: 'Clear warnings' },
  { key: 'purge', label: 'Purge messages' },
];
const ACTION_KEYS = new Set(ACTIONS.map((a) => a.key));

// member here must be a real GuildMember (has .roles.cache and .permissions).
function canUseAction(guild, member, action) {
  if (!guild || !member) return false;
  if (guild.ownerId === member.id) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  return CommandPermissions.listForGuild(guild.id)
    .some((grant) => grant.action === action && member.roles.cache.has(grant.roleId));
}

module.exports = { ACTIONS, ACTION_KEYS, canUseAction };
