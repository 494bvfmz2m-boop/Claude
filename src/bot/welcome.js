const { EmbedBuilder } = require('discord.js');
const { GuildSettings, GlobalBlocklist } = require('../db/repo');

const WELCOME_COLOR = '#23a55a';
const LEAVE_COLOR = '#a8e6ff';

const DEFAULT_WELCOME = "Welcome {user} to **{server}**! We're now at {membercount} members.";
const DEFAULT_LEAVE = '**{username}** has left **{server}**. Now at {membercount} members.';

function applyPlaceholders(template, { id, username, guild }) {
  return template
    .replaceAll('{user}', `<@${id}>`)
    .replaceAll('{username}', username)
    .replaceAll('{server}', guild.name)
    .replaceAll('{membercount}', String(guild.memberCount));
}

function register(client) {
  client.on('guildMemberAdd', async (member) => {
    // Bot-wide blocklist (managed from /admin) -- checked before anything
    // else so a blocked user never gets an autorole or a welcome message.
    if (GlobalBlocklist.has(member.id)) {
      await member.kick('Blocked bot-wide (ModSentry global blocklist)').catch(() => {});
      return;
    }

    const settings = GuildSettings.get(member.guild.id);

    if (settings.autorole_id) {
      const role = member.guild.roles.cache.get(settings.autorole_id);
      if (role) await member.roles.add(role).catch(() => {});
    }

    if (!settings.welcome_channel_id) return;
    const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
    if (!channel?.isTextBased()) return;

    const text = applyPlaceholders(settings.welcome_message || DEFAULT_WELCOME, {
      id: member.id, username: member.user?.username || 'Someone', guild: member.guild,
    });
    const embed = new EmbedBuilder().setColor(WELCOME_COLOR).setDescription(text).setTimestamp();
    if (member.user) embed.setThumbnail(member.user.displayAvatarURL());
    await channel.send({ embeds: [embed] }).catch(() => {});
  });

  client.on('guildMemberRemove', async (member) => {
    const settings = GuildSettings.get(member.guild.id);
    if (!settings.leave_channel_id) return;
    const channel = await member.guild.channels.fetch(settings.leave_channel_id).catch(() => null);
    if (!channel?.isTextBased()) return;

    const text = applyPlaceholders(settings.leave_message || DEFAULT_LEAVE, {
      id: member.id, username: member.user?.username || 'Someone', guild: member.guild,
    });
    const embed = new EmbedBuilder().setColor(LEAVE_COLOR).setDescription(text).setTimestamp();
    if (member.user) embed.setThumbnail(member.user.displayAvatarURL());
    await channel.send({ embeds: [embed] }).catch(() => {});
  });
}

module.exports = { register };
