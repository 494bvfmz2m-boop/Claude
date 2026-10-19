const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');
const storage = require('./storage');
const { sendTemporary, isModerator, row } = require('./util');

const ephemeral = { flags: MessageFlags.Ephemeral };
const STATUS_FIELD = 'Status';

let client;

function init(discordClient) {
  client = discordClient;
}

const data = () => storage.data.suggestions;

// "@Bot suggestions setup": use this channel for suggestions.
async function setup(message) {
  await message.delete().catch(() => {});
  if (!isModerator(message.member)) return;
  data().channelId = message.channelId;
  storage.save();
  return sendTemporary(
    message.channel,
    { content: `✅ Suggestions will be posted here. Anyone can use \`@${client.user.username} suggest <idea>\`.` },
    15_000
  );
}

// "@Bot suggest <idea>": anyone can use this.
async function submit(message, idea) {
  await message.delete().catch(() => {});
  const reply = (content) =>
    sendTemporary(message.channel, { content: `${message.author} ${content}`, allowedMentions: { users: [message.author.id] } }, 10_000);

  if (!idea) return reply(`write your idea after the command, like \`@${client.user.username} suggest more emojis\`.`);
  const channel = data().channelId && (await client.channels.fetch(data().channelId).catch(() => null));
  if (!channel) return reply('suggestions are not set up yet. Ask staff to run `suggestions setup`.');

  const number = ++data().count;
  const post = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xfee75c)
        .setAuthor({ name: message.member?.displayName ?? message.author.username, iconURL: message.author.displayAvatarURL() })
        .setTitle(`Suggestion #${number}`)
        .setDescription(idea.slice(0, 4000))
        .addFields({ name: STATUS_FIELD, value: '⏳ Pending' }),
    ],
    components: [
      row(
        new ButtonBuilder().setCustomId('sg:approve').setLabel('Approve').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('sg:deny').setLabel('Deny').setStyle(ButtonStyle.Danger)
      ),
    ],
  });
  data().items[post.id] = { authorId: message.author.id, number };
  storage.save();
  await post.react('👍').catch(() => {});
  await post.react('👎').catch(() => {});
  return channel.id === message.channelId ? null : reply(`✅ your suggestion was posted in ${channel}.`);
}

async function handleInteraction(interaction) {
  if (!interaction.customId?.startsWith('sg:')) return;
  const [, action, verdict, messageId] = interaction.customId.split(':');

  if (!isModerator(interaction.member)) {
    return interaction.reply({ content: 'Only staff can approve or deny suggestions.', ...ephemeral });
  }

  if (action === 'approve' || action === 'deny') {
    return interaction.showModal(
      new ModalBuilder()
        .setCustomId(`sg:modal:${action}:${interaction.message.id}`)
        .setTitle(action === 'approve' ? 'Approve suggestion' : 'Deny suggestion')
        .addComponents(
          row(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Reason (optional, sent to them)')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(1000)
          )
        )
    );
  }

  if (action === 'modal') {
    const approved = verdict === 'approve';
    const reason = interaction.fields.getTextInputValue('reason').trim();
    const item = data().items[messageId];
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(approved ? 0x57f287 : 0xed4245)
      .setFields(
        { name: STATUS_FIELD, value: `${approved ? '✅ Approved' : '❌ Denied'} by ${interaction.user}` },
        ...(reason ? [{ name: 'Reason', value: reason }] : [])
      );
    await interaction.update({ embeds: [embed], components: [] });

    if (item) {
      delete data().items[messageId];
      storage.save();
      const author = await client.users.fetch(item.authorId).catch(() => null);
      await author
        ?.send(
          `Your suggestion **#${item.number}** in **${interaction.guild.name}** was ${approved ? 'approved ✅' : 'denied ❌'}.` +
            (reason ? `\n**Reason:** ${reason}` : '')
        )
        .catch(() => {});
    }
  }
}

module.exports = { init, setup, submit, handleInteraction };
