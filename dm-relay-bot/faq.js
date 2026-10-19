const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');
const storage = require('./storage');
const { sendTemporary, isModerator, row } = require('./util');

const PROMPT_MS = 120_000;
const DONE_MS = 10_000;
const ephemeral = { flags: MessageFlags.Ephemeral };

let client;
let relay; // (messages) => passes held DMs on to staff, set by modmail
const prompts = new Map(); // menu message ID -> { ownerId, message }
const pending = new Map(); // user ID -> { messages, answerMessage } while they decide if the answer helped

function init(discordClient, relayToStaff) {
  client = discordClient;
  relay = relayToStaff;
}

const faqs = () => storage.data.faqs;
const button = (id, label, style = ButtonStyle.Secondary, emoji) => {
  const b = new ButtonBuilder().setCustomId(`faq:${id}`).setLabel(label).setStyle(style);
  return emoji ? b.setEmoji(emoji) : b;
};

// ---------- Answering DMs ----------

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function bestMatch(text) {
  let best = null;
  for (const [name, entry] of Object.entries(faqs())) {
    const hits = entry.keywords.filter((k) =>
      // Keywords match the start of a word, so "unban" also catches "unbanned".
      new RegExp(`(^|[^\\p{L}\\p{N}])${escape(k)}`, 'iu').test(text)
    ).length;
    if (hits && (!best || hits > best.hits)) best = { name, entry, hits };
  }
  return best;
}

// Called for a DM from someone with no open conversation. Returns true if an FAQ answer was sent instead.
async function offerAnswer(message) {
  const match = message.content && bestMatch(message.content);
  if (!match) return false;
  const answerMessage = await message.author
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(match.entry.title || match.name)
          .setDescription(match.entry.answer)
          .setFooter({ text: 'Did this answer your question?' }),
      ],
      components: [
        row(
          button('yes', 'Yes, thanks!', ButtonStyle.Success, '✅'),
          button('no', 'I still need help', ButtonStyle.Danger, '❌')
        ),
      ],
    })
    .catch(() => null);
  if (!answerMessage) return false;
  pending.set(message.author.id, { messages: [message], answerMessage });
  return true;
}

// If the person was looking at an FAQ answer and wrote again, they still need help: returns their held DMs.
function takePending(userId) {
  const held = pending.get(userId);
  if (!held) return null;
  pending.delete(userId);
  held.answerMessage.edit({ components: [] }).catch(() => {});
  return held.messages;
}

// ---------- "@Bot faq" menu ----------

async function openMenu(message) {
  await message.delete().catch(() => {});
  if (!isModerator(message.member)) return;
  const prompt = await message.channel.send({
    content: `${message.author} **FAQ answers:** sent automatically when a DM contains the keywords.`,
    components: [
      row(
        button('create', 'Add', ButtonStyle.Primary, '➕'),
        button('edit', 'Edit', ButtonStyle.Secondary, '✏️'),
        button('delete', 'Delete', ButtonStyle.Danger, '🗑️'),
        button('list', 'Show all', ButtonStyle.Secondary, '📋'),
        button('cancel', 'Cancel')
      ),
    ],
    allowedMentions: { parse: [] },
  });
  prompts.set(prompt.id, { ownerId: message.author.id, message: prompt });
  setTimeout(() => closePrompt(prompt.id), PROMPT_MS);
}

function closePrompt(id) {
  const prompt = prompts.get(id);
  if (!prompt) return;
  prompts.delete(id);
  prompt.message.delete().catch(() => {});
}

function editorModal(customId, values = {}) {
  const input = (id, label, style, required, max, placeholder) => {
    const field = new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setRequired(required)
      .setMaxLength(max)
      .setPlaceholder(placeholder);
    if (values[id]) field.setValue(values[id]);
    return row(field);
  };
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('FAQ answer')
    .addComponents(
      input('title', 'Title', TextInputStyle.Short, true, 100, 'How do I get unbanned?'),
      input('keywords', 'Keywords, separated by commas', TextInputStyle.Short, true, 400, 'unban, banned, appeal'),
      input('answer', 'Answer', TextInputStyle.Paragraph, true, 4000, 'Fill in the appeal form at …')
    );
}

function readEntry(interaction) {
  const title = interaction.fields.getTextInputValue('title').trim();
  const keywords = [
    ...new Set(
      interaction.fields
        .getTextInputValue('keywords')
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  return { title, keywords, answer: interaction.fields.getTextInputValue('answer').trim() };
}

const keyFor = (title) => title.toLowerCase().replace(/\s+/g, '-').slice(0, 80);

function pickMenu(action, question) {
  const entries = Object.entries(faqs()).slice(0, 25);
  return {
    content: question,
    components: [
      row(
        new StringSelectMenuBuilder()
          .setCustomId(`faq:${action}-pick`)
          .setPlaceholder('Pick an answer…')
          .addOptions(
            entries.map(([key, e]) => ({
              label: (e.title || key).slice(0, 100),
              description: e.keywords.join(', ').slice(0, 100),
              value: key,
            }))
          )
      ),
    ],
    ...ephemeral,
  };
}

async function done(interaction, content) {
  if (interaction.message?.flags.has(MessageFlags.Ephemeral)) await interaction.update({ content, components: [] });
  else await interaction.reply({ content, ...ephemeral });
  setTimeout(() => interaction.deleteReply().catch(() => {}), DONE_MS);
}

async function handleInteraction(interaction) {
  if (!interaction.customId?.startsWith('faq:')) return;
  const [, action, arg] = interaction.customId.split(':');

  // Buttons under an FAQ answer in someone's DMs.
  if (action === 'yes' || action === 'no') {
    const held = pending.get(interaction.user.id);
    pending.delete(interaction.user.id);
    if (action === 'yes') {
      return interaction.update({ components: [], content: 'Great, glad that helped! Message me again any time.' });
    }
    await interaction.update({ components: [], content: "OK, I've passed your message on to the staff. They'll reply here soon." });
    if (held) await relay(held.messages);
    return;
  }

  const prompt = interaction.message && prompts.get(interaction.message.id);
  if (prompt && interaction.user.id !== prompt.ownerId) {
    return interaction.reply({ content: "This menu isn't yours.", ...ephemeral });
  }
  if (!isModerator(interaction.member)) {
    return interaction.reply({ content: "You can't manage FAQ answers.", ...ephemeral });
  }

  switch (action) {
    case 'create':
      await interaction.showModal(editorModal('faq:create-modal'));
      return closePrompt(interaction.message.id);
    case 'edit':
    case 'delete':
      closePrompt(interaction.message.id);
      if (Object.keys(faqs()).length === 0) return done(interaction, 'There are no FAQ answers yet.');
      return interaction.reply(pickMenu(action, action === 'edit' ? 'Which answer do you want to edit?' : 'Which answer do you want to delete?'));
    case 'list': {
      closePrompt(interaction.message.id);
      const text = Object.values(faqs())
        .map((e) => `**${e.title}**: ${e.keywords.map((k) => `\`${k}\``).join(', ')}`)
        .join('\n');
      await interaction.reply({ content: (text || 'There are no FAQ answers yet.').slice(0, 2000), ...ephemeral });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 60_000);
      return;
    }
    case 'cancel':
      await interaction.deferUpdate();
      return closePrompt(interaction.message.id);

    case 'create-modal': {
      const entry = readEntry(interaction);
      if (entry.keywords.length === 0) return done(interaction, '❌ Add at least one keyword.');
      faqs()[keyFor(entry.title)] = entry;
      storage.save();
      return done(interaction, `✅ Saved **${entry.title}**.`);
    }
    case 'edit-pick': {
      const key = interaction.values[0];
      const entry = faqs()[key];
      if (!entry) return done(interaction, '❌ That answer no longer exists.');
      return interaction.showModal(
        editorModal(`faq:edit-modal:${key}`, { ...entry, keywords: entry.keywords.join(', ') })
      );
    }
    case 'edit-modal': {
      const entry = readEntry(interaction);
      if (entry.keywords.length === 0) return done(interaction, '❌ Add at least one keyword.');
      delete faqs()[arg];
      faqs()[keyFor(entry.title)] = entry;
      storage.save();
      return done(interaction, `✅ Updated **${entry.title}**.`);
    }
    case 'delete-pick': {
      const entry = faqs()[interaction.values[0]];
      delete faqs()[interaction.values[0]];
      storage.save();
      return done(interaction, entry ? `🗑️ Deleted **${entry.title}**.` : 'Already deleted.');
    }
  }
}

module.exports = { init, offerAnswer, takePending, openMenu, handleInteraction };
