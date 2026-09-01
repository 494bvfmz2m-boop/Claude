const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const config = require('../config');

const INTRO_COLOR = '#a32ee2';

// Best-effort -- needs the bot to have View Audit Log, and Discord only
// keeps bot-add entries for a limited time, so this can legitimately come
// back empty on an older server.
async function getAddedBy(guild) {
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 10 });
    const entry = logs.entries.find((e) => e.target?.id === guild.client.user.id);
    return entry?.executor ? `<@${entry.executor.id}>` : null;
  } catch {
    return null;
  }
}

async function handleIntroduction(interaction) {
  const guild = interaction.guild;
  await interaction.deferReply();

  const [addedBy, commands] = await Promise.all([
    getAddedBy(guild),
    guild.commands.fetch().catch(() => null),
  ]);

  const commandList = commands && commands.size > 0
    ? [...commands.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => `\`/${c.name}\` — ${c.description}`)
        .join('\n')
        .slice(0, 1024)
    : "Commands haven't finished registering yet -- try again in a minute.";

  const dashboardUrl = config.dashboardUrl || 'https://bot.xyphros.site';

  const embed = new EmbedBuilder()
    .setTitle("👋 Hi, I'm XyphrosMod!")
    .setColor(INTRO_COLOR)
    .setThumbnail(guild.client.user.displayAvatarURL())
    .setDescription(
      "I handle support tickets, moderation, reaction roles, and a staff hierarchy for this server -- " +
        "all configured from a web dashboard, no hosting needed on your end.",
    )
    .addFields(
      {
        name: '⚙️ Get set up',
        value: `1. Open **[bot.xyphros.site](${dashboardUrl})** and log in with Discord\n` +
          '2. Drag my **XyphrosMod** role above every role you want me to manage (Server Settings → Roles) -- ' +
          "otherwise ticket access, staff ranks, timeouts, and reaction roles won't work for those roles\n" +
          '3. Set up ticket types, panels, moderation, and staff ranks from the dashboard',
      },
      { name: '📋 Commands', value: commandList },
      { name: '➕ Added by', value: addedBy || 'Unknown', inline: true },
      { name: 'ℹ️ Check your access', value: 'Run `/info` to see your own permissions and dashboard access.', inline: true },
    )
    .setFooter({ text: 'XyphrosMod — a product of Xyphros Studios' });

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { introduction: handleIntroduction };
