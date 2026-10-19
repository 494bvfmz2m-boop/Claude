const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { sendTemporary, isModerator, row } = require('./util');

const PROMPT_MS = 120_000;
const CHALLENGE_MS = 120_000;
const COOLDOWN_MS = 30_000;
const ephemeral = { flags: MessageFlags.Ephemeral };
const ITEMS = [
  ['🍎', 'apple'],
  ['🍌', 'banana'],
  ['🍇', 'grapes'],
  ['🍒', 'cherries'],
  ['🥕', 'carrot'],
  ['🍋', 'lemon'],
  ['🍉', 'watermelon'],
  ['🍓', 'strawberry'],
];

const prompts = new Map(); // setup button message ID -> owner ID
// The right answer is kept here rather than in the buttons, so bots can't read it from the button IDs.
const challenges = new Map(); // user ID -> { answer, roleId, expires }
const cooldowns = new Map(); // user ID -> time they may try again

const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

async function openPrompt(message) {
  await message.delete().catch(() => {});
  if (!isModerator(message.member) || !message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return sendTemporary(message.channel, { content: `${message.author}, you need **Manage Roles** for this.`, allowedMentions: { parse: [] } }, 10_000);
  }
  const prompt = await message.channel.send({
    content: `${message.author} Set up a verification button in this channel?`,
    components: [
      row(
        new ButtonBuilder().setCustomId('verify:setup').setLabel('Set up').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('verify:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      ),
    ],
    allowedMentions: { parse: [] },
  });
  prompts.set(prompt.id, message.author.id);
  setTimeout(() => {
    prompts.delete(prompt.id);
    prompt.delete().catch(() => {});
  }, PROMPT_MS);
}

function setupModal() {
  const input = (id, label, style, required, placeholder, value) => {
    const field = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setPlaceholder(placeholder);
    if (value) field.setValue(value);
    return row(field);
  };
  return new ModalBuilder()
    .setCustomId('verify:setup-modal')
    .setTitle('Verification')
    .addComponents(
      input('role', 'Role to give after verifying', TextInputStyle.Short, true, 'Verified'),
      input('title', 'Title', TextInputStyle.Short, true, 'Welcome!', '✅ Verify to get access'),
      input(
        'description',
        'Message',
        TextInputStyle.Paragraph,
        true,
        'Click the button below to get access.',
        'Click the button below and pick the right picture to get access to the server.'
      )
    );
}

function findRole(guild, text) {
  const id = text.match(/^<@&(\d+)>$|^(\d{17,20})$/);
  if (id) return guild.roles.cache.get(id[1] ?? id[2]) ?? null;
  const name = text.replace(/^@/, '').toLowerCase();
  return guild.roles.cache.find((r) => r.name.toLowerCase() === name) ?? null;
}

async function handleInteraction(interaction) {
  if (!interaction.customId?.startsWith('verify:')) return;
  const [, action, arg] = interaction.customId.split(':');

  switch (action) {
    case 'setup':
    case 'cancel': {
      const ownerId = prompts.get(interaction.message.id);
      if (ownerId && ownerId !== interaction.user.id) {
        return interaction.reply({ content: "This menu isn't yours.", ...ephemeral });
      }
      prompts.delete(interaction.message.id);
      if (action === 'setup') await interaction.showModal(setupModal());
      else await interaction.deferUpdate();
      return interaction.message.delete().catch(() => {});
    }
    case 'setup-modal': {
      if (!isModerator(interaction.member)) return interaction.reply({ content: "You can't do that.", ...ephemeral });
      const role = findRole(interaction.guild, interaction.fields.getTextInputValue('role').trim());
      const problem = !role
        ? "❌ I couldn't find that role. Type its exact name."
        : role.managed || role.id === interaction.guild.id
          ? `❌ **${role.name}** can't be given out by bots.`
          : !role.editable
            ? `❌ I can't give **${role.name}**. Drag my role above it in Server Settings → Roles.`
            : null;
      if (problem) return interaction.reply({ content: problem, ...ephemeral });

      await interaction.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle(interaction.fields.getTextInputValue('title').trim())
            .setDescription(interaction.fields.getTextInputValue('description').trim()),
        ],
        components: [
          row(new ButtonBuilder().setCustomId(`verify:start:${role.id}`).setLabel('Verify').setEmoji('✅').setStyle(ButtonStyle.Success)),
        ],
      });
      await interaction.reply({
        content: `✅ Verification posted. It gives **${role.name}**.\n\nTo lock the server: make your channels visible only to **${role.name}** (not @everyone), and make this channel the only one @everyone can see.`,
        ...ephemeral,
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 60_000);
      return;
    }
    case 'start':
      return startChallenge(interaction, arg);
    case 'pick':
      return checkAnswer(interaction, Number(arg));
  }
}

async function startChallenge(interaction, roleId) {
  if (interaction.member.roles.cache.has(roleId)) {
    return interaction.reply({ content: "You're already verified. 🎉", ...ephemeral });
  }
  const waitUntil = cooldowns.get(interaction.user.id) ?? 0;
  if (waitUntil > Date.now()) {
    return interaction.reply({ content: `⏳ Try again <t:${Math.ceil(waitUntil / 1000)}:R>.`, ...ephemeral });
  }

  const options = shuffle(ITEMS).slice(0, 4);
  const answer = Math.floor(Math.random() * options.length);
  challenges.set(interaction.user.id, { answer, roleId, expires: Date.now() + CHALLENGE_MS });
  return interaction.reply({
    content: `Click the **${options[answer][1]}**:`,
    components: [
      row(
        ...options.map(([emoji], i) =>
          new ButtonBuilder().setCustomId(`verify:pick:${i}`).setEmoji(emoji).setStyle(ButtonStyle.Secondary)
        )
      ),
    ],
    ...ephemeral,
  });
}

async function checkAnswer(interaction, picked) {
  const challenge = challenges.get(interaction.user.id);
  challenges.delete(interaction.user.id);
  if (!challenge || challenge.expires < Date.now()) {
    return interaction.update({ content: '⌛ That expired. Click **Verify** again.', components: [] });
  }
  if (picked !== challenge.answer) {
    cooldowns.set(interaction.user.id, Date.now() + COOLDOWN_MS);
    return interaction.update({ content: '❌ Wrong one. You can try again in 30 seconds.', components: [] });
  }
  try {
    await interaction.member.roles.add(challenge.roleId, 'Passed verification');
    await interaction.update({ content: "✅ You're verified, welcome!", components: [] });
  } catch (err) {
    console.error('Could not give verification role:', err.message);
    await interaction.update({ content: "⚠️ You passed, but I couldn't give you the role. Please tell a staff member.", components: [] });
  }
}

module.exports = { openPrompt, handleInteraction };
