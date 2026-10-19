const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');

const { DISCORD_TOKEN, DM_CHANNEL_ID, STAFF_ROLE_ID } = process.env;

if (!DISCORD_TOKEN || !DM_CHANNEL_ID) {
  console.error('Missing DISCORD_TOKEN or DM_CHANNEL_ID environment variable.');
  process.exit(1);
}

// The user ID is stored in the embed footer, so replies keep working after a restart.
const FOOTER_PREFIX = 'User ID: ';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  // DM channels aren't cached, so this is needed to receive DMs at all.
  partials: [Partials.Channel],
});

let relayChannel;

client.once('ready', async () => {
  try {
    relayChannel = await client.channels.fetch(DM_CHANNEL_ID);
  } catch (err) {
    console.error(`Could not fetch channel ${DM_CHANNEL_ID}:`, err.message);
    process.exit(1);
  }
  if (!relayChannel?.isTextBased()) {
    console.error(`Channel ${DM_CHANNEL_ID} is not a text channel.`);
    process.exit(1);
  }
  console.log(`Logged in as ${client.user.tag}, relaying DMs to #${relayChannel.name}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    if (message.channel.type === ChannelType.DM) {
      await relayIncomingDm(message);
    } else if (message.channelId === DM_CHANNEL_ID && message.reference?.messageId) {
      await sendReply(message);
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

async function relayIncomingDm(message) {
  if (!relayChannel) return;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({
      name: `${message.author.tag} (${message.author.displayName})`,
      iconURL: message.author.displayAvatarURL(),
    })
    .setDescription(message.content || '*(no text)*')
    .setFooter({ text: `${FOOTER_PREFIX}${message.author.id}` })
    .setTimestamp(message.createdAt);

  const files = message.attachments.map((a) => ({ attachment: a.url, name: a.name }));

  await relayChannel.send({ embeds: [embed], files });
  await message.react('📨').catch(() => {});
}

async function sendReply(message) {
  if (STAFF_ROLE_ID && !message.member?.roles.cache.has(STAFF_ROLE_ID)) return;

  const original = await message.channel.messages
    .fetch(message.reference.messageId)
    .catch(() => null);
  if (!original || original.author.id !== client.user.id) return;

  const footer = original.embeds[0]?.footer?.text;
  if (!footer?.startsWith(FOOTER_PREFIX)) return;
  const userId = footer.slice(FOOTER_PREFIX.length);

  const files = message.attachments.map((a) => ({ attachment: a.url, name: a.name }));
  if (!message.content && files.length === 0) return;

  try {
    const user = await client.users.fetch(userId);
    await user.send({ content: message.content || undefined, files });
    await message.react('✅');
  } catch (err) {
    console.error(`Could not DM ${userId}:`, err.message);
    await message.react('❌').catch(() => {});
    await message
      .reply("Couldn't deliver that DM. The user may have DMs closed or no longer share a server with the bot.")
      .catch(() => {});
  }
}

client.login(DISCORD_TOKEN);
