const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('change')
    .setDescription('Move this ticket to a different category (keeps all messages)'),

  // No setDefaultMemberPermissions on these -- who can actually run them is
  // decided entirely by the Permissions page (owner/Administrator always
  // can; everyone else needs their role explicitly granted that action).
  // That lets an owner split actions Discord's own permission bits can't
  // (e.g. a role that can /ban but not /unban), so Discord's bits are no
  // longer consulted for these at all.
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .addUserOption((o) => o.setName('user').setDescription('Who to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
    .addIntegerOption((o) => o.setName('delete_days').setDescription('Delete their messages from the last N days (0-7)').setRequired(false).setMinValue(0).setMaxValue(7)),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .addStringOption((o) => o.setName('user_id').setDescription('The user ID to unban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .addUserOption((o) => o.setName('user').setDescription('Who to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Time out a member (mutes them for a duration)')
    .addUserOption((o) => o.setName('user').setDescription('Who to mute').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('e.g. 10m, 2h, 1d (max 28d)').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a member\'s mute (timeout)')
    .addUserOption((o) => o.setName('user').setDescription('Who to unmute').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member (logged, no automatic action)')
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
    .addUserOption((o) => o.setName('user').setDescription('Who to clear').setRequired(true)),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk-delete messages in this channel')
    .addIntegerOption((o) => o.setName('amount').setDescription('How many messages (1-100) -- leave blank to delete everything, with a confirmation first').setRequired(false).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user').setRequired(false)),

  new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock this channel so only staff can send messages')
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unlockdown')
    .setDescription('Unlock this channel')
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a staff member to the next rank up')
    .addUserOption((o) => o.setName('user').setDescription('Who to promote').setRequired(true)),

  new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demote a staff member to the next rank down')
    .addUserOption((o) => o.setName('user').setDescription('Who to demote').setRequired(true)),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription("See the commands you can actually use here, grouped by what they do"),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('See what access you (or someone else) have -- permissions, dashboard access, staff rank')
    .addUserOption((o) => o.setName('user').setDescription('Check someone else instead of yourself').setRequired(false)),

  new SlashCommandBuilder()
    .setName('introduction')
    .setDescription('Have ModSentry introduce itself -- what it does, how to set it up, and its commands'),

  new SlashCommandBuilder()
    .setName('afk')
    .setDescription("Mark yourself AFK -- clears automatically the next time you send a message")
    .addStringOption((o) => o.setName('message').setDescription("Why you're AFK, shown to anyone who pings you").setRequired(false)),

  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a reaction poll in this channel')
    .addStringOption((o) => o.setName('question').setDescription('The poll question').setRequired(true))
    .addStringOption((o) => o.setName('option1').setDescription('Option 1').setRequired(true))
    .addStringOption((o) => o.setName('option2').setDescription('Option 2').setRequired(true))
    .addStringOption((o) => o.setName('option3').setDescription('Option 3').setRequired(false))
    .addStringOption((o) => o.setName('option4').setDescription('Option 4').setRequired(false))
    .addStringOption((o) => o.setName('option5').setDescription('Option 5').setRequired(false))
    .addStringOption((o) => o.setName('duration').setDescription('Auto-close after, e.g. 10m, 2h, 1d (max 30d)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Run a giveaway in this channel')
    .addSubcommand((sc) => sc
      .setName('start')
      .setDescription('Start a giveaway')
      .addStringOption((o) => o.setName('prize').setDescription("What's being given away").setRequired(true))
      .addStringOption((o) => o.setName('duration').setDescription('Runs for, e.g. 10m, 2h, 1d (max 30d)').setRequired(true))
      .addIntegerOption((o) => o.setName('winners').setDescription('How many winners (default 1)').setRequired(false).setMinValue(1).setMaxValue(20))
      .addRoleOption((o) => o.setName('required_role').setDescription('Only members with this role can enter').setRequired(false)))
    .addSubcommand((sc) => sc
      .setName('end')
      .setDescription('End a giveaway early and pick winners')
      .addStringOption((o) => o.setName('message_id').setDescription("The giveaway message's ID").setRequired(true)))
    .addSubcommand((sc) => sc
      .setName('reroll')
      .setDescription('Pick new winner(s) for an ended giveaway')
      .addStringOption((o) => o.setName('message_id').setDescription("The giveaway message's ID").setRequired(true))),

  new SlashCommandBuilder()
    .setName('event')
    .setDescription('Post an event people can RSVP to')
    .addStringOption((o) => o.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption((o) => o.setName('time').setDescription('When it happens, e.g. "2026-09-01 18:00" or just "Friday 8pm"').setRequired(false))
    .addStringOption((o) => o.setName('description').setDescription('More details').setRequired(false)),

  new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Canned responses staff can post by name')
    .addSubcommand((sc) => sc
      .setName('get')
      .setDescription('Post a tag')
      .addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sc) => sc
      .setName('create')
      .setDescription('Create a tag (Manage Messages required)')
      .addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true))
      .addStringOption((o) => o.setName('content').setDescription('What it posts').setRequired(true)))
    .addSubcommand((sc) => sc
      .setName('delete')
      .setDescription('Delete a tag (Manage Messages required)')
      .addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sc) => sc
      .setName('list')
      .setDescription('List all tags')),

  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Show someone's avatar, full size")
    .addUserOption((o) => o.setName('user').setDescription('Whose avatar to show').setRequired(false)),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Account/member info for someone -- join date, roles, boost status')
    .addUserOption((o) => o.setName('user').setDescription('Who to look up').setRequired(false)),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('This server at a glance -- members, channels, roles, boosts'),

  new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('A role at a glance -- color, position, member count')
    .addRoleOption((o) => o.setName('role').setDescription('Which role').setRequired(true)),

  new SlashCommandBuilder()
    .setName('emoji')
    .setDescription("Show a big version of one of this server's custom emoji")
    .addStringOption((o) => o.setName('emoji').setDescription('The emoji -- paste it or type its name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a personal reminder')
    .addStringOption((o) => o.setName('time').setDescription('When, e.g. 10m, 2h, 3d').setRequired(true))
    .addStringOption((o) => o.setName('message').setDescription('What to remind you about').setRequired(false))
    .addBooleanOption((o) => o.setName('here').setDescription('Ping you in this channel instead of DMing (default: DM)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('timestamp')
    .setDescription('Generate a Discord timestamp you can paste into a message')
    .addStringOption((o) => o.setName('when').setDescription('From now, e.g. 10m, 2h, 3d').setRequired(true)),

  new SlashCommandBuilder()
    .setName('quote')
    .setDescription('Repost a message as a clean embed')
    .addStringOption((o) => o.setName('message').setDescription('Message link or ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('nick')
    .setDescription("Change someone's nickname")
    .addUserOption((o) => o.setName('user').setDescription('Who to rename').setRequired(true))
    .addStringOption((o) => o.setName('nickname').setDescription('New nickname (omit to clear it)').setRequired(false)),
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
