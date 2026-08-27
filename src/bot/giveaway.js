const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Giveaways } = require('../db/repo');

const GIVEAWAY_COLOR = '#a8e6ff';
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

function buildGiveawayMessage(giveaway) {
  const embed = new EmbedBuilder()
    .setTitle(`🎉 ${giveaway.prize}`)
    .setColor(GIVEAWAY_COLOR)
    .addFields(
      { name: 'Winners', value: String(giveaway.winner_count), inline: true },
      { name: 'Entries', value: String(giveaway.entries.length), inline: true },
      { name: 'Ends', value: `<t:${Math.floor(new Date(giveaway.ends_at).getTime() / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: giveaway.hosted_by ? `Hosted by ${giveaway.hosted_by}` : 'Giveaway' })
    .setTimestamp();
  if (giveaway.required_role_id) embed.addFields({ name: 'Requirement', value: `Must have <@&${giveaway.required_role_id}>` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`giveaway_enter:${giveaway.id}`).setLabel('Enter').setStyle(ButtonStyle.Primary).setEmoji('🎉'),
  );
  return { embeds: [embed], components: [row] };
}

async function handleGiveawayStart(interaction) {
  const prize = interaction.options.getString('prize');
  const durationInput = interaction.options.getString('duration');
  const winnerCount = interaction.options.getInteger('winners') || 1;
  const requiredRole = interaction.options.getRole('required_role');

  const ms = parseDuration(durationInput);
  if (!ms) {
    return interaction.reply({ content: "Couldn't parse that duration -- use something like `10m`, `2h`, or `1d` (max 30d).", ephemeral: true });
  }

  const endsAt = new Date(Date.now() + ms);
  const draft = {
    id: 0,
    prize,
    winner_count: winnerCount,
    entries: [],
    ends_at: endsAt.toISOString(),
    required_role_id: requiredRole?.id || null,
    hosted_by: interaction.user.tag,
  };

  await interaction.reply(buildGiveawayMessage(draft));
  const message = await interaction.fetchReply();

  const id = Giveaways.create({
    guildId: interaction.guildId,
    channelId: message.channelId,
    messageId: message.id,
    prize,
    winnerCount,
    requiredRoleId: requiredRole?.id || null,
    hostedBy: interaction.user.tag,
    endsAt: endsAt.toISOString(),
  });

  await message.edit(buildGiveawayMessage({ ...draft, id })).catch(() => {});
}

async function handleGiveawayEnd(interaction) {
  const messageId = interaction.options.getString('message_id');
  const giveaway = Giveaways.getByMessage(messageId);
  if (!giveaway || giveaway.guild_id !== interaction.guildId) {
    return interaction.reply({ content: "Couldn't find an active giveaway with that message ID.", ephemeral: true });
  }
  if (giveaway.ended) {
    return interaction.reply({ content: 'That giveaway has already ended.', ephemeral: true });
  }

  Giveaways.markEnded(giveaway.id);
  await interaction.reply({ content: `Ending giveaway for **${giveaway.prize}** now.`, ephemeral: true });
  // The scheduler's next sweep (within 30s) picks winners and edits the
  // message -- avoids duplicating that logic here.
}

async function handleGiveawayReroll(interaction) {
  const messageId = interaction.options.getString('message_id');
  const giveaway = Giveaways.getByMessage(messageId);
  if (!giveaway || giveaway.guild_id !== interaction.guildId) {
    return interaction.reply({ content: "Couldn't find that giveaway.", ephemeral: true });
  }
  if (!giveaway.ended) {
    return interaction.reply({ content: "That giveaway hasn't ended yet.", ephemeral: true });
  }
  if (giveaway.entries.length === 0) {
    return interaction.reply({ content: 'Nobody entered, so there\'s nobody to reroll.', ephemeral: true });
  }

  const pool = [...giveaway.entries];
  const winners = [];
  const count = Math.min(giveaway.winner_count, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }

  await interaction.reply(`🎉 New winner${winners.length === 1 ? '' : 's'} for **${giveaway.prize}**: ${winners.map((w) => `<@${w}>`).join(', ')}`);
}

async function handleGiveawayCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'start') return handleGiveawayStart(interaction);
  if (sub === 'end') return handleGiveawayEnd(interaction);
  if (sub === 'reroll') return handleGiveawayReroll(interaction);
}

async function handleGiveawayEnter(interaction, giveawayId) {
  const giveaway = Giveaways.get(giveawayId);
  if (!giveaway || giveaway.ended) {
    return interaction.reply({ content: 'This giveaway has already ended.', ephemeral: true });
  }

  if (giveaway.required_role_id && !interaction.member.roles.cache.has(giveaway.required_role_id)) {
    return interaction.reply({ content: `You need <@&${giveaway.required_role_id}> to enter this giveaway.`, ephemeral: true });
  }

  const entries = new Set(giveaway.entries);
  let content;
  if (entries.has(interaction.user.id)) {
    entries.delete(interaction.user.id);
    content = "You've left the giveaway.";
  } else {
    entries.add(interaction.user.id);
    content = "You're entered! Good luck.";
  }
  const updatedEntries = [...entries];
  Giveaways.setEntries(giveaway.id, updatedEntries);

  await interaction.reply({ content, ephemeral: true });
  await interaction.message.edit(buildGiveawayMessage({ ...giveaway, entries: updatedEntries })).catch(() => {});
}

module.exports = { giveaway: handleGiveawayCommand, handleGiveawayEnter, buildGiveawayMessage };
