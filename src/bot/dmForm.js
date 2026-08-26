// Lets the owner attach a short application form to an otherwise-plain DM:
// a button that opens a modal with up to 5 questions, whose answers get
// forwarded straight to the owner. Used two ways -- automatically in place
// of the closed-beta "message me on Discord" text (dmGreeting.js,
// betaGate.js), and manually from /admin's "Send a DM" tool. Either way, if
// no form is configured (or the caller doesn't ask for one), sendWithForm
// just runs the caller's own defaultSend and nothing here gets touched.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config');
const { AppSettings, DmFormSends } = require('../db/repo');

const FORM_COLOR = '#5865F2';
const MAX_QUESTIONS = 5;
const QUESTION_LABEL_MAX = 45; // Discord modal field label limit

function getFormConfig() {
  const { dmForm } = AppSettings.get();
  const questions = (dmForm.questions || []).filter((q) => q && q.trim()).slice(0, MAX_QUESTIONS);
  if (!dmForm.enabled || !dmForm.title.trim() || questions.length === 0) return null;
  return { title: dmForm.title.trim(), intro: dmForm.intro.trim(), questions };
}

// Sends the configured form (button -> modal -> answers DMed to the owner)
// if one is set up, otherwise falls through to defaultSend() unchanged.
// Returns 'form' when the form went out, or whatever defaultSend() returns.
async function sendWithForm(client, { recipientId, recipientTag, context, guildId, guildName, defaultSend }) {
  const form = getFormConfig();
  if (!form) return defaultSend();

  const sendId = DmFormSends.create({
    recipientId, recipientTag, context, guildId, guildName,
    title: form.title, intro: form.intro, questions: form.questions,
  });

  const embed = new EmbedBuilder()
    .setColor(FORM_COLOR)
    .setTitle(form.title)
    .setFooter({ text: 'Your answers go straight to the Quellum owner -- nothing is posted publicly.' });
  if (form.intro) embed.setDescription(form.intro);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dmform_open:${sendId}`).setLabel('Fill it out').setStyle(ButtonStyle.Primary),
  );

  const user = await client.users.fetch(recipientId);
  await user.send({ embeds: [embed], components: [row] });
  return 'form';
}

async function handleOpenButton(interaction, sendId) {
  const send = DmFormSends.get(sendId);
  if (!send) return interaction.reply({ content: "This form isn't available anymore." });
  if (send.responded) return interaction.reply({ content: "You've already submitted this one -- thanks!" });

  const modal = new ModalBuilder().setCustomId(`dmform_submit:${sendId}`).setTitle(send.title.slice(0, 45));
  send.questions.forEach((question, i) => {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`q${i}`)
          .setLabel(question.slice(0, QUESTION_LABEL_MAX))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000),
      ),
    );
  });
  return interaction.showModal(modal);
}

async function handleSubmitModal(interaction, sendId) {
  const send = DmFormSends.get(sendId);
  if (!send) return interaction.reply({ content: "This form isn't available anymore." });
  if (send.responded) return interaction.reply({ content: "You've already submitted this one -- thanks!" });

  const answers = send.questions.map((question, i) => ({
    question,
    answer: interaction.fields.getTextInputValue(`q${i}`),
  }));
  DmFormSends.markResponded(sendId, answers);
  await interaction.reply({ content: "Thanks -- sent!" });

  if (!config.ownerDiscordId) return;
  try {
    const owner = await interaction.client.users.fetch(config.ownerDiscordId);
    const embed = new EmbedBuilder()
      .setColor(FORM_COLOR)
      .setTitle('📝 Form accepted')
      .addFields(
        { name: 'From', value: `<@${send.recipient_id}> (${send.recipient_tag || send.recipient_id})`, inline: true },
        { name: 'Context', value: send.context === 'beta_gate' ? (send.guild_name ? `Closed-beta wall — ${send.guild_name}` : 'Closed-beta wall') : 'Manual send', inline: true },
        ...answers.map((a) => ({ name: a.question, value: a.answer || '—' })),
      )
      .setTimestamp();
    await owner.send({ embeds: [embed] }).catch(() => {});
  } catch {
    // owner unreachable -- the answers are still saved in dm_form_sends
  }
}

module.exports = { getFormConfig, sendWithForm, handleOpenButton, handleSubmitModal };
