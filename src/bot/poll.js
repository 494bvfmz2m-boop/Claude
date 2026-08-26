const { EmbedBuilder } = require('discord.js');

const POLL_COLOR = '#a8e6ff';
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

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

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${question}`)
    .setDescription(options.map((o, i) => `${NUMBER_EMOJIS[i]} ${o}`).join('\n\n'))
    .setColor(POLL_COLOR)
    .setFooter({ text: `Poll by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
  const message = await interaction.fetchReply();
  for (let i = 0; i < options.length; i++) {
    await message.react(NUMBER_EMOJIS[i]).catch(() => {});
  }
}

module.exports = { poll: handlePoll };
