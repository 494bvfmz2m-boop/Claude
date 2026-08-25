const crypto = require('crypto');
const { EmbedBuilder } = require('discord.js');
const { Economy } = require('../db/repo');
const {
  EIGHT_BALL, FACTS, ROASTS, COMPLIMENTS, WOULD_YOU_RATHER,
  VIBE_CAPTIONS, RPS_CHOICES, RPS_EMOJI, pick,
} = require('./content');

const BRAND_COLOR = '#FF5C8A';

function baseEmbed() {
  return new EmbedBuilder().setColor(BRAND_COLOR);
}

function targetUser(interaction) {
  return interaction.options.getUser('user') || interaction.user;
}

async function handle8ball(interaction) {
  const question = interaction.options.getString('question');
  const embed = baseEmbed()
    .setTitle('🎱 The magic 8-ball says...')
    .addFields(
      { name: 'Question', value: question },
      { name: 'Answer', value: pick(EIGHT_BALL) },
    );
  await interaction.reply({ embeds: [embed] });
}

async function handleCoinflip(interaction) {
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  const emoji = result === 'Heads' ? '🪙' : '🥈';
  await interaction.reply(`${emoji} **${result}!**`);
}

function parseDice(input) {
  const match = /^(\d{1,2})d(\d{1,4})$/i.exec((input || '1d6').trim());
  if (!match) return null;
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  if (count < 1 || count > 20 || sides < 2 || sides > 1000) return null;
  return { count, sides };
}

async function handleRoll(interaction) {
  const input = interaction.options.getString('dice') || '1d6';
  const dice = parseDice(input);
  if (!dice) {
    return interaction.reply({ content: `Couldn't parse "${input}" — try something like \`2d6\` (max 20 dice, 1000 sides).`, ephemeral: true });
  }
  const rolls = Array.from({ length: dice.count }, () => 1 + Math.floor(Math.random() * dice.sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  const embed = baseEmbed()
    .setTitle(`🎲 Rolling ${dice.count}d${dice.sides}`)
    .setDescription(rolls.length > 1 ? `${rolls.join(' + ')} = **${total}**` : `**${total}**`);
  await interaction.reply({ embeds: [embed] });
}

async function handleRps(interaction) {
  const userChoice = interaction.options.getString('choice');
  const botChoice = pick(RPS_CHOICES);

  let result;
  if (userChoice === botChoice) result = "It's a tie!";
  else if (
    (userChoice === 'rock' && botChoice === 'scissors')
    || (userChoice === 'paper' && botChoice === 'rock')
    || (userChoice === 'scissors' && botChoice === 'paper')
  ) result = 'You win! 🎉';
  else result = 'I win! 😎';

  const embed = baseEmbed()
    .setTitle('✊ Rock, Paper, Scissors')
    .setDescription(`You: ${RPS_EMOJI[userChoice]} ${userChoice}\nMe: ${RPS_EMOJI[botChoice]} ${botChoice}\n\n**${result}**`);
  await interaction.reply({ embeds: [embed] });
}

async function handleShip(interaction) {
  const user1 = interaction.options.getUser('user1');
  const user2 = interaction.options.getUser('user2');

  const key = [user1.id, user2.id].sort().join(':');
  const hash = crypto.createHash('sha256').update(key).digest();
  const percent = hash[0] % 101;

  const bar = '█'.repeat(Math.round(percent / 10)) + '░'.repeat(10 - Math.round(percent / 10));
  const verdict = percent >= 90 ? "soulmates, it's giving destiny"
    : percent >= 70 ? 'genuinely a great match'
      : percent >= 50 ? 'could work with effort'
        : percent >= 30 ? 'friendzone energy'
          : "yeah... it's not looking good";

  const embed = baseEmbed()
    .setTitle('💘 Compatibility Check')
    .setDescription(`**${user1.username}** × **${user2.username}**\n\n${bar} **${percent}%**\n\n${verdict}`);
  await interaction.reply({ embeds: [embed] });
}

async function handleRoast(interaction) {
  const user = targetUser(interaction);
  const embed = baseEmbed().setDescription(`${user}, ${pick(ROASTS)}`);
  await interaction.reply({ embeds: [embed] });
}

async function handleCompliment(interaction) {
  const user = targetUser(interaction);
  const embed = baseEmbed().setDescription(`${user}, ${pick(COMPLIMENTS)}`);
  await interaction.reply({ embeds: [embed] });
}

async function handleFact(interaction) {
  const embed = baseEmbed().setTitle('🧠 Random Fact').setDescription(pick(FACTS));
  await interaction.reply({ embeds: [embed] });
}

async function handleWyr(interaction) {
  const embed = baseEmbed().setTitle('🤔 Would You Rather').setDescription(pick(WOULD_YOU_RATHER));
  await interaction.reply({ embeds: [embed] });
}

async function handleVibecheck(interaction) {
  const user = targetUser(interaction);
  const percent = Math.floor(Math.random() * 101);
  const tier = VIBE_CAPTIONS.find((t) => percent >= t.min && percent <= t.max);
  const bar = '█'.repeat(Math.round(percent / 10)) + '░'.repeat(10 - Math.round(percent / 10));

  const embed = baseEmbed()
    .setTitle('✨ Vibe Check')
    .setDescription(`${user}'s vibe today:\n\n${bar} **${percent}%**\n*${tier.caption}*`);
  await interaction.reply({ embeds: [embed] });
}

function formatCooldown(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function handleDaily(interaction) {
  const result = Economy.claimDaily(interaction.guildId, interaction.user.id);
  if (!result.claimed) {
    return interaction.reply({ content: `You already claimed today. Come back in **${formatCooldown(result.msRemaining)}**.`, ephemeral: true });
  }
  const embed = baseEmbed()
    .setTitle('💰 Daily claimed!')
    .setDescription(`You got **${result.amount} coins**.\nBalance: **${result.balance}**`);
  await interaction.reply({ embeds: [embed] });
}

async function handleBalance(interaction) {
  const user = targetUser(interaction);
  const balance = Economy.getBalance(interaction.guildId, user.id);
  await interaction.reply(`${user.id === interaction.user.id ? 'You have' : `${user.username} has`} **${balance} coins**.`);
}

async function handleLeaderboard(interaction) {
  const rows = Economy.leaderboard(interaction.guildId, 10);
  if (rows.length === 0) {
    return interaction.reply('Nobody has any coins yet — be the first with `/daily`.');
  }
  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map((r, i) => `${medals[i] || `${i + 1}.`} <@${r.user_id}> — **${r.balance}**`);
  const embed = baseEmbed().setTitle('🏆 Leaderboard').setDescription(lines.join('\n'));
  await interaction.reply({ embeds: [embed] });
}

async function handleBet(interaction) {
  const amount = interaction.options.getInteger('amount');
  const balance = Economy.getBalance(interaction.guildId, interaction.user.id);

  if (amount > balance) {
    return interaction.reply({ content: `You only have **${balance} coins** — can't bet ${amount}.`, ephemeral: true });
  }

  const won = Math.random() < 0.48; // slight house edge
  const newBalance = Economy.addBalance(interaction.guildId, interaction.user.id, won ? amount : -amount);

  const embed = baseEmbed()
    .setTitle(won ? '🎉 You won!' : '💸 You lost!')
    .setDescription(`${won ? `+${amount}` : `-${amount}`} coins\nBalance: **${newBalance}**`);
  await interaction.reply({ embeds: [embed] });
}

module.exports = {
  '8ball': handle8ball,
  coinflip: handleCoinflip,
  roll: handleRoll,
  rps: handleRps,
  ship: handleShip,
  roast: handleRoast,
  compliment: handleCompliment,
  fact: handleFact,
  wyr: handleWyr,
  vibecheck: handleVibecheck,
  daily: handleDaily,
  balance: handleBalance,
  leaderboard: handleLeaderboard,
  bet: handleBet,
};
