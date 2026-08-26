// A short application form the owner can attach to a manual DM: a button
// that opens a modal, whose answers get forwarded straight to the owner.
// Always manual, always started from /admin's "Send a DM" tool by picking
// a saved template -- nothing here ever fires on its own. If the caller
// doesn't pass a template, sendWithForm just runs the caller's own
// defaultSend and nothing here gets touched.
//
// Discord caps a modal field's label at 45 characters, which is too short
// for a real question -- so the full questions are shown (numbered) in the
// DM embed itself, and the modal just asks for "Answer 1", "Answer 2", etc,
// with the question repeated as a placeholder for context.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config');
const { DmFormSends } = require('../db/repo');

const FORM_COLOR = '#a8e6ff';

async function sendWithForm(client, { recipientId, recipientTag, template, defaultSend }) {
  if (!template) return defaultSend();

  const sendId = DmFormSends.create({
    recipientId, recipientTag, templateName: template.name,
    title: template.title, intro: template.intro, questions: template.questions,
  });

  const embed = new EmbedBuilder()
    .setColor(FORM_COLOR)
    .setTitle(template.title)
    .setFooter({ text: 'Your answers go straight to the ModSentry owner -- nothing is posted publicly.' });
  if (template.intro) embed.setDescription(template.intro);
  template.questions.forEach((question, i) => {
    embed.addFields({ name: `${i + 1}.`, value: question });
  });

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
          .setLabel(`Answer ${i + 1}`)
          .setPlaceholder(question.slice(0, 100))
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
        { name: 'Form', value: send.template_name || send.title, inline: true },
        ...answers.map((a) => ({ name: a.question.slice(0, 256), value: a.answer || '—' })),
      )
      .setFooter({ text: `Reply "forms ${sendId}" to me any time to see this again.` })
      .setTimestamp();
    await owner.send({ embeds: [embed] }).catch(() => {});
  } catch {
    // owner unreachable -- the answers are still saved in dm_form_sends
  }
}

module.exports = { sendWithForm, handleOpenButton, handleSubmitModal };
