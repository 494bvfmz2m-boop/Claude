const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question')
    .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true)),

  new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin'),

  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll some dice')
    .addStringOption((o) => o.setName('dice').setDescription('e.g. 2d6, 1d20 (default 1d6)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Rock, paper, scissors against the bot')
    .addStringOption((o) => o.setName('choice').setDescription('Your move').setRequired(true)
      .addChoices(
        { name: 'Rock', value: 'rock' },
        { name: 'Paper', value: 'paper' },
        { name: 'Scissors', value: 'scissors' },
      )),

  new SlashCommandBuilder()
    .setName('ship')
    .setDescription('Calculate compatibility between two people')
    .addUserOption((o) => o.setName('user1').setDescription('First person').setRequired(true))
    .addUserOption((o) => o.setName('user2').setDescription('Second person').setRequired(true)),

  new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Playfully roast someone (all in good fun)')
    .addUserOption((o) => o.setName('user').setDescription('Who to roast (default: you)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('compliment')
    .setDescription('Send someone a genuine compliment')
    .addUserOption((o) => o.setName('user').setDescription('Who to compliment (default: you)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('fact')
    .setDescription('Get a random weird/interesting fact'),

  new SlashCommandBuilder()
    .setName('wyr')
    .setDescription('Get a random "would you rather" question'),

  new SlashCommandBuilder()
    .setName('vibecheck')
    .setDescription('Check someone\'s vibe level')
    .addUserOption((o) => o.setName('user').setDescription('Who to check (default: you)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily coins'),

  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your (or someone else\'s) coin balance')
    .addUserOption((o) => o.setName('user').setDescription('Who to check (default: you)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('See the richest people in this server'),

  new SlashCommandBuilder()
    .setName('bet')
    .setDescription('Bet coins on a coin flip — double or nothing')
    .addIntegerOption((o) => o.setName('amount').setDescription('How many coins to bet').setRequired(true).setMinValue(1)),
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
