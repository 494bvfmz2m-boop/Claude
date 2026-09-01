const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { AppSettings } = require('../db/repo');
const { isAuthorized } = require('./betaGate');
const { buildGenericInviteUrl } = require('../web/lib/discordOAuth');
const { buildOwnerPanelEmbed, buildOwnerPanelRow } = require('./ownerPanel');
const { handleOwnerKeyword } = require('./ownerKeywords');
const { emojiUrl } = require('./emoji');

const GREETING_COLOR = '#a32ee2';
const WEBSITE_URL = 'https://xyphros.site';
const DISCORD_INVITE = 'https://discord.gg/5bNyCzsyJ2';

function buildGreetingEmbed() {
  return new EmbedBuilder()
    .setTitle('👋 Invite me to your server for me to work!')
    .setColor(GREETING_COLOR)
    .setThumbnail(emojiUrl('xyphros-online.gif'))
    .setDescription(
      "I only do anything once I'm in a server — I can't help over DMs. Add me with the button below, then " +
        `manage everything from the dashboard at [bot.xyphros.site](${config.dashboardUrl || 'https://bot.xyphros.site'}).`,
    )
    .addFields(
      { name: '🔗 Invite me', value: `[Add to a server](${buildGenericInviteUrl()})`, inline: true },
      { name: '🌐 Website', value: `[xyphros.site](${WEBSITE_URL})`, inline: true },
      { name: '💬 Support server', value: `[Join Discord](${DISCORD_INVITE})`, inline: true },
      {
        name: 'What I do',
        value: 'Support tickets, moderation (bans/kicks/timeouts/warnings), reaction roles, a staff hierarchy with a live staff list, and a custom embed builder — all configured from the dashboard.',
      },
    )
    .setFooter({ text: "Once I'm dragged above the roles I manage, everything above just works." });
}

// While closed beta is on, nobody outside the allowlist gets handed the
// invite link at all -- the actual enforcement is betaGate.js leaving any
// unauthorized server the moment it joins, but there's no reason to dangle
// the link in front of someone it's just going to reject anyway.
function buildClosedBetaEmbed() {
  return new EmbedBuilder()
    .setTitle('🔒 XyphrosMod is in closed beta')
    .setColor(GREETING_COLOR)
    .setDescription(
      `I'm not accepting new servers right now. Head to [bot.xyphros.site](${config.dashboardUrl || 'https://bot.xyphros.site'}) ` +
        'and click **Log in with Discord** — you\'ll get a **Request access** button there, and a DM from me the moment it\'s reviewed.',
    )
    .addFields({ name: '🌐 Website', value: `[xyphros.site](${WEBSITE_URL})` });
}

function register(client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || message.guildId) return; // only direct messages to the bot

    if (config.ownerDiscordId && message.author.id === config.ownerDiscordId) {
      const handled = await handleOwnerKeyword(message).catch(() => false);
      if (handled) return;
      await message.channel.send({
        embeds: [buildOwnerPanelEmbed(client)],
        components: [buildOwnerPanelRow()],
      }).catch(() => {});
      return;
    }

    const locked = AppSettings.get().betaLocked;
    const embed = (locked && !isAuthorized(message.author.id)) ? buildClosedBetaEmbed() : buildGreetingEmbed();
    await message.channel.send({ embeds: [embed] }).catch(() => {});
  });
}

module.exports = { register };
