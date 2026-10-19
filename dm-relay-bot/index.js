const { Client, GatewayIntentBits, Partials, ChannelType } = require('discord.js');
const config = require('./config');
const storage = require('./storage');
const modmail = require('./modmail');
const reactionRoles = require('./reactionRoles');
const commands = require('./commands');
const stats = require('./stats');
const faq = require('./faq');
const verify = require('./verify');
const suggestions = require('./suggestions');
const movieNight = require('./movieNight');

if (!config.token || !config.forumId) {
  console.error('Missing DISCORD_TOKEN or DM_CHANNEL_ID environment variable.');
  process.exit(1);
}

storage.load();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  // DM channels and older messages aren't cached; partials let their events through.
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
});

let ready = false;

client.once('ready', async () => {
  try {
    const { forum, posts } = await modmail.init(client);
    reactionRoles.init(client);
    stats.init(client);
    suggestions.init(client);
    await movieNight.init(client);
    ready = true;
    console.log(`Logged in as ${client.user.tag}, relaying DMs to forum #${forum.name} (${posts} existing posts)`);
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
});

function on(event, handler) {
  client.on(event, async (...args) => {
    if (!ready) return;
    try {
      await handler(...args);
    } catch (err) {
      console.error(`Error in ${event}:`, err);
    }
  });
}

on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.type === ChannelType.DM) return modmail.relayIncomingDm(message);
  const command = commands.parse(message);
  if (command !== null) return commands.handle(message, command);
  if (modmail.isRelayPost(message.channel)) return modmail.handleStaffMessage(message);
});

on('interactionCreate', async (interaction) => {
  // Each module ignores interactions whose custom ID isn't its own.
  for (const feature of [modmail, reactionRoles, stats, faq, verify, suggestions, movieNight]) {
    await feature.handleInteraction(interaction);
  }
});

on('threadUpdate', modmail.handleThreadUpdate);
on('threadDelete', modmail.handleThreadDelete);
on('voiceStateUpdate', movieNight.handleVoiceState);
on('messageReactionAdd', (reaction, user) => reactionRoles.handleReaction(reaction, user, true));
on('messageReactionRemove', (reaction, user) => reactionRoles.handleReaction(reaction, user, false));

client.login(config.token);
