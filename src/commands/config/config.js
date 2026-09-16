const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { updateGuildSettings, getGuildSettings } = require('../../database/db');
const cfg = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure the bot for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sc) => sc.setName('welcome').setDescription('Set the join announcement channel and message')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel for join messages').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption((o) => o.setName('message').setDescription('Use {user}, {server}, {membercount}')))
    .addSubcommand((sc) => sc.setName('leave').setDescription('Set the leave announcement channel and message')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel for leave messages').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption((o) => o.setName('message').setDescription('Use {user}, {server}, {membercount}')))
    .addSubcommand((sc) => sc.setName('logs').setDescription('Set the general/anti-raid log channel')
      .addChannelOption((o) => o.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((sc) => sc.setName('modlog').setDescription('Set the moderation action log channel')
      .addChannelOption((o) => o.setName('channel').setDescription('Mod log channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((sc) => sc.setName('tickets').setDescription('Configure the ticket system')
      .addChannelOption((o) => o.setName('category').setDescription('Category tickets are created under').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
      .addRoleOption((o) => o.setName('staff_role').setDescription('Role that can see/manage tickets'))
      .addChannelOption((o) => o.setName('log_channel').setDescription('Channel for ticket open/close logs').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((sc) => sc.setName('orders').setDescription('Set the channel for automatic order embeds')
      .addChannelOption((o) => o.setName('channel').setDescription('Order notifications channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((sc) => sc.setName('antiraid').setDescription('Configure anti-raid protection')
      .addBooleanOption((o) => o.setName('enabled').setDescription('Enable or disable anti-raid').setRequired(true))
      .addIntegerOption((o) => o.setName('join_threshold').setDescription('Joins within the window that trigger raid mode').setMinValue(2).setMaxValue(100))
      .addIntegerOption((o) => o.setName('window_seconds').setDescription('Time window in seconds').setMinValue(2).setMaxValue(300))
      .addIntegerOption((o) => o.setName('min_account_age_days').setDescription('Minimum Discord account age in days').setMinValue(0).setMaxValue(365))
      .addStringOption((o) => o.setName('action').setDescription('Action to take against flagged joins').addChoices({ name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' })))
    .addSubcommand((sc) => sc.setName('honeypot').setDescription('Configure the anti-raid honeypot trap channel')
      .addBooleanOption((o) => o.setName('enabled').setDescription('Enable or disable the honeypot').setRequired(true))
      .addChannelOption((o) => o.setName('channel').setDescription('Use an existing channel as the trap (skips creating one)').addChannelTypes(ChannelType.GuildText))
      .addStringOption((o) => o.setName('name').setDescription('Name for a new trap channel (used only when no channel is given and none exists yet)')))
    .addSubcommand((sc) => sc.setName('view').setDescription('View the current configuration')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'welcome') {
      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message');
      const fields = { welcome_channel_id: channel.id };
      if (message) fields.welcome_message = message;
      updateGuildSettings(guildId, fields);
      return interaction.reply({ content: `Welcome messages will be sent in ${channel}.`, ephemeral: true });
    }

    if (sub === 'leave') {
      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message');
      const fields = { leave_channel_id: channel.id };
      if (message) fields.leave_message = message;
      updateGuildSettings(guildId, fields);
      return interaction.reply({ content: `Leave messages will be sent in ${channel}.`, ephemeral: true });
    }

    if (sub === 'logs') {
      const channel = interaction.options.getChannel('channel', true);
      updateGuildSettings(guildId, { log_channel_id: channel.id });
      return interaction.reply({ content: `General/anti-raid logs will be sent in ${channel}.`, ephemeral: true });
    }

    if (sub === 'modlog') {
      const channel = interaction.options.getChannel('channel', true);
      updateGuildSettings(guildId, { mod_log_channel_id: channel.id });
      return interaction.reply({ content: `Moderation logs will be sent in ${channel}.`, ephemeral: true });
    }

    if (sub === 'tickets') {
      const category = interaction.options.getChannel('category', true);
      const staffRole = interaction.options.getRole('staff_role');
      const logChannel = interaction.options.getChannel('log_channel');
      const fields = { ticket_category_id: category.id };
      if (staffRole) fields.ticket_staff_role_id = staffRole.id;
      if (logChannel) fields.ticket_log_channel_id = logChannel.id;
      updateGuildSettings(guildId, fields);
      return interaction.reply({ content: `Tickets will be created under **${category.name}**. Use \`/ticketpanel\` to post the panel.`, ephemeral: true });
    }

    if (sub === 'orders') {
      const channel = interaction.options.getChannel('channel', true);
      updateGuildSettings(guildId, { order_channel_id: channel.id });
      return interaction.reply({ content: `Order embeds will be posted in ${channel}.`, ephemeral: true });
    }

    if (sub === 'antiraid') {
      const enabled = interaction.options.getBoolean('enabled', true);
      const fields = { antiraid_enabled: enabled ? 1 : 0 };
      const threshold = interaction.options.getInteger('join_threshold');
      const windowSec = interaction.options.getInteger('window_seconds');
      const minAge = interaction.options.getInteger('min_account_age_days');
      const action = interaction.options.getString('action');
      if (threshold != null) fields.antiraid_join_threshold = threshold;
      if (windowSec != null) fields.antiraid_join_window_ms = windowSec * 1000;
      if (minAge != null) fields.antiraid_min_account_age_days = minAge;
      if (action) fields.antiraid_action = action;
      updateGuildSettings(guildId, fields);
      return interaction.reply({ content: `Anti-raid ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
    }

    if (sub === 'honeypot') {
      const enabled = interaction.options.getBoolean('enabled', true);

      if (!enabled) {
        updateGuildSettings(guildId, { honeypot_enabled: 0 });
        return interaction.reply({ content: 'Honeypot disabled. The trap channel was left in place — delete it manually if you no longer want it.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const existingChannel = interaction.options.getChannel('channel');
      const name = interaction.options.getString('name');
      const settings = getGuildSettings(guildId);
      let channelId = existingChannel?.id || settings.honeypot_channel_id;

      if (!channelId) {
        const created = await interaction.guild.channels.create({
          name: name || '🚫│do-not-post-here',
          type: ChannelType.GuildText,
          topic: 'Staff only — do not send messages in this channel.',
          reason: 'Anti-raid honeypot channel',
        });
        channelId = created.id;
      }

      updateGuildSettings(guildId, { honeypot_enabled: 1, honeypot_channel_id: channelId });
      return interaction.editReply({
        content: `Honeypot enabled in <#${channelId}>. Anyone who posts there (other than staff with Ban Members/Moderate Members permissions) is instantly soft-banned — kicked and their recent messages purged, but not permanently banned. **Never link, mention, or post in this channel.**`,
      });
    }

    if (sub === 'view') {
      const s = getGuildSettings(guildId);
      const embed = new EmbedBuilder()
        .setColor(cfg.colors.primary)
        .setTitle('Current Configuration')
        .addFields(
          { name: 'Welcome Channel', value: s.welcome_channel_id ? `<#${s.welcome_channel_id}>` : 'Not set', inline: true },
          { name: 'Leave Channel', value: s.leave_channel_id ? `<#${s.leave_channel_id}>` : 'Not set', inline: true },
          { name: 'Log Channel', value: s.log_channel_id ? `<#${s.log_channel_id}>` : 'Not set', inline: true },
          { name: 'Mod Log Channel', value: s.mod_log_channel_id ? `<#${s.mod_log_channel_id}>` : 'Not set', inline: true },
          { name: 'Order Channel', value: s.order_channel_id ? `<#${s.order_channel_id}>` : 'Not set', inline: true },
          { name: 'Ticket Category', value: s.ticket_category_id ? `<#${s.ticket_category_id}>` : 'Not set', inline: true },
          { name: 'Ticket Staff Role', value: s.ticket_staff_role_id ? `<@&${s.ticket_staff_role_id}>` : 'Not set', inline: true },
          { name: 'Anti-Raid', value: s.antiraid_enabled ? `Enabled (${s.antiraid_join_threshold} joins / ${s.antiraid_join_window_ms / 1000}s, min age ${s.antiraid_min_account_age_days}d, action: ${s.antiraid_action})` : 'Disabled' },
          { name: 'Honeypot', value: s.honeypot_enabled ? `Enabled in <#${s.honeypot_channel_id}>` : 'Disabled' },
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
