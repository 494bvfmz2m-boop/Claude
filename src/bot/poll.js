const { EmbedBuilder } = require('discord.js');
const { Polls } = require('../db/repo');

const POLL_COLOR = '#a8e6ff';
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30d -- our own scheduler, not a Discord-imposed limit

function parseDuration(input) {
  const match = /^(\d+)\s*(m|h|d)$/i.exec((input || '').trim());
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  const unitMs = { m: 60000, h: 3600000, d: 86400000 }[match[2].toLowerCase()];
  const ms = amount * unitMs;
  if (ms <= 0 || ms > MAX_DURATION_MS) return null;
  return ms;
}

async function handlePoll(interaction) {
  const question = interaction.options.getString('question');
  const options = [];
  for (let i = 1; i <= 5; i++) {
    const opt = interaction.options.getString(`option${i}`);
    if (opt) options.push(opt.trim());
  }

  if (options.length < 2) {
    return interaction.reply({ content: 'Need at least 2 options to make a poll.', ephemeral: true });
  }

  const durationInput = interaction.options.getString('duration');
  let endsAt = null;
  if (durationInput) {
    const ms = parseDuration(durationInput);
    if (!ms) {
      return interaction.reply({ content: "Couldn't parse that duration -- use something like `10m`, `2h`, or `1d` (max 30d).", ephemeral: true });
    }
    endsAt = new Date(Date.now() + ms);
  }

  const description = options.map((o, i) => `${NUMBER_EMOJIS[i]} ${o}`).join('\n\n')
    + (endsAt ? `\n\nCloses <t:${Math.floor(endsAt.getTime() / 1000)}:R>` : '');

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${question}`)
    .setDescription(description)
    .setColor(POLL_COLOR)
    .setFooter({ text: `Poll by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
  const message = await interaction.fetchReply();
  for (let i = 0; i < options.length; i++) {
    await message.react(NUMBER_EMOJIS[i]).catch(() => {});
  }

  if (endsAt) {
    Polls.create({
      guildId: interaction.guildId,
      channelId: message.channelId,
      messageId: message.id,
      question,
      options,
      endsAt: endsAt.toISOString(),
    });
  }
}

module.exports = { poll: handlePoll };
