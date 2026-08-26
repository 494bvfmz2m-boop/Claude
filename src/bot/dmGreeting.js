const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const { AppSettings } = require('../db/repo');
const { isAuthorized } = require('./betaGate');
const { buildGenericInviteUrl } = require('../web/lib/discordOAuth');
const { buildOwnerPanelEmbed, buildOwnerPanelRow } = require('./ownerPanel');
const { sendWithForm } = require('./dmForm');

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

// While closed beta is on, nobody outside the allowlist gets handed the
// invite link at all -- the actual enforcement is betaGate.js leaving any
// unauthorized server the moment it joins, but there's no reason to dangle
// the link in front of someone it's just going to reject anyway.
function buildClosedBetaEmbed() {
  return new EmbedBuilder()
    .setTitle('🔒 Quellum is in closed beta')
    .setColor(GREETING_COLOR)
    .setDescription(
      `I'm not accepting new servers right now. Message **${config.betaContactHandle}** on Discord if you'd like to be added to the beta list.`,
    )
    .addFields({ name: '🌐 Website', value: `[quellum.site](${WEBSITE_URL})` });
}

function register(client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || message.guildId) return; // only direct messages to the bot

    if (config.ownerDiscordId && message.author.id === config.ownerDiscordId) {
      await message.channel.send({
        embeds: [buildOwnerPanelEmbed(client)],
        components: [buildOwnerPanelRow()],
      }).catch(() => {});
      return;
    }

    const locked = AppSettings.get().betaLocked;
    if (locked && !isAuthorized(message.author.id)) {
      await sendWithForm(message.client, {
        recipientId: message.author.id,
        recipientTag: message.author.tag,
        context: 'beta_gate',
        defaultSend: () => message.channel.send({ embeds: [buildClosedBetaEmbed()] }),
      }).catch(() => {});
      return;
    }
    await message.channel.send({ embeds: [buildGreetingEmbed()] }).catch(() => {});
  });
}

module.exports = { register };
