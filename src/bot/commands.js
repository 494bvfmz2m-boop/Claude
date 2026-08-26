const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('change')
    .setDescription('Move this ticket to a different category (keeps all messages)'),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('Who to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
    .addIntegerOption((o) => o.setName('delete_days').setDescription('Delete their messages from the last N days (0-7)').setRequired(false).setMinValue(0).setMaxValue(7)),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((o) => o.setName('user_id').setDescription('The user ID to unban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName('user').setDescription('Who to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Time out a member (mutes them for a duration)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Who to time out').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('e.g. 10m, 2h, 1d (max 28d)').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a member\'s timeout')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Who to un-timeout').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member (logged, no automatic action)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Who to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true)),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('See a member\'s warning history')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Who to check').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Who to clear').setRequired(true)),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk-delete messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName('amount').setDescription('How many messages (1-100) -- leave blank to delete everything, with a confirmation first').setRequired(false).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user').setRequired(false)),

  new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a staff member to the next rank up')
    .addUserOption((o) => o.setName('user').setDescription('Who to promote').setRequired(true)),

  new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demote a staff member to the next rank down')
    .addUserOption((o) => o.setName('user').setDescription('Who to demote').setRequired(true)),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('See what access you (or someone else) have -- permissions, dashboard access, staff rank')
    .addUserOption((o) => o.setName('user').setDescription('Check someone else instead of yourself').setRequired(false)),

  new SlashCommandBuilder()
    .setName('introduction')
    .setDescription('Have Quellum introduce itself -- what it does, how to set it up, and its commands'),
].map((c) => c.toJSON());

async function registerCommandsForGuild(guild) {
  try {
    await guild.commands.set(commands);
  } catch (err) {
    console.error(`Failed to register commands for guild ${guild.id}:`, err.message);
  }
}

async function registerAllGuildCommands(client) {
  await Promise.all([...client.guilds.cache.values()].map(registerCommandsForGuild));
}

module.exports = { registerAllGuildCommands, registerCommandsForGuild };
