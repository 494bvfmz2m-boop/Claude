const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { buildGenericInviteUrl } = require('../web/lib/discordOAuth');

const GREETING_COLOR = '#5865F2';
const WEBSITE_URL = 'https://quellum.site';
const DISCORD_INVITE = 'https://discord.gg/5bNyCzsyJ2';

function buildGreetingEmbed() {
  return new EmbedBuilder()
    .setTitle('👋 Invite me to your server for me to work!')
    .setColor(GREETING_COLOR)
    .setDescription(
      "I only do anything once I'm in a server — I can't help over DMs. Add me with the button below, then " +
        `manage everything from the dashboard at [bot.quellum.site](${config.dashboardUrl || 'https://bot.quellum.site'}).`,
    )
    .addFields(
      { name: '🔗 Invite me', value: `[Add to a server](${buildGenericInviteUrl()})`, inline: true },
      { name: '🌐 Website', value: `[quellum.site](${WEBSITE_URL})`, inline: true },
      { name: '💬 Support server', value: `[Join Discord](${DISCORD_INVITE})`, inline: true },
      {
        name: 'What I do',
        value: 'Support tickets, moderation (bans/kicks/timeouts/warnings), reaction roles, a staff hierarchy with a live staff list, and a custom embed builder — all configured from the dashboard.',
      },
    )
    .setFooter({ text: "Once I'm dragged above the roles I manage, everything above just works." });
}

function register(client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || message.guildId) return; // only direct messages to the bot
    await message.channel.send({ embeds: [buildGreetingEmbed()] }).catch(() => {});
  });
}

module.exports = { register };
