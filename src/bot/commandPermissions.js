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
  { key: 'ban', label: 'Ban', usage: '/ban <user> [reason]', description: 'Ban someone from the server' },
  { key: 'unban', label: 'Unban', usage: '/unban <user_id> [reason]', description: 'Lift a ban' },
  { key: 'kick', label: 'Kick', usage: '/kick <user> [reason]', description: 'Kick someone from the server' },
  { key: 'mute', label: 'Mute (timeout)', usage: '/mute <user> <duration> [reason]', description: 'Time someone out' },
  { key: 'unmute', label: 'Unmute (remove timeout)', usage: '/unmute <user> [reason]', description: 'Remove a timeout early' },
  { key: 'warn', label: 'Warn', usage: '/warn <user> <reason>', description: 'Log a warning (can auto-escalate)' },
  { key: 'clearwarnings', label: 'Clear warnings', usage: '/clearwarnings <user>', description: "Clear someone's warnings" },
  { key: 'purge', label: 'Purge messages', usage: '/purge [amount] [user]', description: 'Bulk-delete messages in the current channel' },
  { key: 'lockdown', label: 'Lock channels', usage: '/lockdown [reason]', description: 'Lock the current channel so only staff can send messages' },
  { key: 'unlockdown', label: 'Unlock channels', usage: '/unlockdown [reason]', description: 'Unlock a channel that was locked with /lockdown' },
  { key: 'nickname', label: 'Change nickname', command: 'nick', usage: '/nick <user> [nickname]', description: "Change someone's nickname" }, // action key stays 'nickname' for canUseAction/GATED_MOD_COMMANDS, but the actual slash command is /nick
  { key: 'slowmode', label: 'Set slowmode', usage: '/slowmode <seconds> [channel]', description: 'Set or clear slowmode on a channel' },
  { key: 'manage_roles', label: 'Add/remove roles', command: 'role', usage: '/role add|remove <user> <role>', description: "Add or remove a role from someone (can't touch a role at or above your own)" }, // action key stays 'manage_roles' for canUseAction/GATED_MOD_COMMANDS, but the actual slash command is /role
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
