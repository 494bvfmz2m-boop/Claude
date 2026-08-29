const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const config = require('../config');
const db = require('../db');
const { findBestMatch } = require('../matcher');

const HUMAN_HELP_BUTTON_ID = 'request_human_support';

function isTicketChannel(channel) {
  if (!channel || !channel.guildId) return false;
  const categoryId =
    channel.type === ChannelType.GuildText || channel.type === ChannelType.PublicThread
      ? channel.parentId
      : null;
  // Threads created off a ticket channel: parent is the ticket channel itself,
  // so climb one more level to find its category.
  if (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread) {
    const parentChannel = channel.parent;
    const parentCategoryId = parentChannel ? parentChannel.parentId : null;
    return db.isTicketCategory(channel.guildId, parentCategoryId);
  }
  return db.isTicketCategory(channel.guildId, categoryId);
}

function buildSupportMention(guild, roleId) {
  if (!roleId) {
    return "⚠️ No support role has been configured yet. An admin needs to set one in the dashboard.";
  }
  const role = guild.roles.cache.get(roleId);
  return role ? `${role}` : `⚠️ The configured support role (${roleId}) no longer exists.`;
}

async function pingSupport(channel, { requestedBy, question, reason }) {
  const guildConfig = db.getGuildConfig(channel.guildId);
  const mention = buildSupportMention(channel.guild, guildConfig.support_role_id);

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🙋 Human support requested')
    .setDescription(reason || question || 'A user needs help with this ticket.')
    .addFields({ name: 'Requested by', value: `${requestedBy}`, inline: true })
    .setTimestamp();

  await channel.send({ content: mention, embeds: [embed] });
}

function buildHumanHelpRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(HUMAN_HELP_BUTTON_ID)
      .setLabel("This didn't help — get a human")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🙋')
  );
}

function createBot() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once('ready', () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
      } else if (interaction.isButton() && interaction.customId === HUMAN_HELP_BUTTON_ID) {
        await handleHumanHelpButton(interaction);
      }
    } catch (err) {
      console.error('Error handling interaction:', err);
      const payload = { content: 'Something went wrong handling that. Please try again.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });

  return client;
}

async function handleCommand(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'This command only works inside a server.', ephemeral: true });
    return;
  }

  if (!isTicketChannel(interaction.channel)) {
    await interaction.reply({
      content: 'This command only works inside a configured ticket channel.',
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === 'ask') {
    await handleAsk(interaction);
  } else if (interaction.commandName === 'escalate') {
    await handleEscalate(interaction);
  }
}

async function handleAsk(interaction) {
  const question = interaction.options.getString('question', true);
  const entries = db.listFaqEntries(interaction.guildId);
  const match = findBestMatch(question, entries);

  if (!match) {
    await interaction.reply({
      content: "I couldn't find a confident answer to that in the FAQ, so I'm pulling in support.",
    });
    await pingSupport(interaction.channel, {
      requestedBy: interaction.user,
      question,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(match.entry.question)
    .setDescription(match.entry.answer)
    .setFooter({ text: 'Automated answer from the FAQ database' });

  await interaction.reply({ embeds: [embed], components: [buildHumanHelpRow()] });
}

async function handleEscalate(interaction) {
  const reason = interaction.options.getString('reason') || null;
  await interaction.reply({ content: '📣 Pinging support now.' });
  await pingSupport(interaction.channel, {
    requestedBy: interaction.user,
    reason,
  });
}

async function handleHumanHelpButton(interaction) {
  if (!isTicketChannel(interaction.channel)) {
    await interaction.reply({ content: 'This only works inside a ticket channel.', ephemeral: true });
    return;
  }

  await interaction.reply({ content: '📣 Got it — pulling in support.' });
  await pingSupport(interaction.channel, {
    requestedBy: interaction.user,
    reason: 'The automated FAQ answer above did not resolve the issue.',
  });

  // Disable the button on the original message so it can't be spammed.
  const disabledRow = new ActionRowBuilder().addComponents(
    ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true)
  );
  await interaction.message.edit({ components: [disabledRow] }).catch(() => {});
}

module.exports = { createBot };
