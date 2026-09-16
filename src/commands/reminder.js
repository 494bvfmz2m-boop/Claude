const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { DateTime } = require('luxon');
const db = require('../db');
const {
  FREQUENCIES,
  isValidFrequency,
  isValidTimezone,
  parseDateTime,
  findNextOccurrenceIndex,
  DATE_RE,
  TIME_RE,
} = require('../utils/time');
const { listEmbed, detailLine } = require('../utils/embeds');

const DEFAULT_TIME = '09:00';
const DEFAULT_TIMEZONE = 'UTC';

const FREQUENCY_CHOICES = Object.entries(FREQUENCIES).map(([value, { label }]) => ({ name: label, value }));

function frequencyOption(opt) {
  return opt
    .setName('frequency')
    .setDescription('How often should this repeat?')
    .addChoices(...FREQUENCY_CHOICES);
}

function canManage(interaction, reminder) {
  if (reminder.creatorId === interaction.user.id) return true;
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Manage reminders')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Create a new reminder')
        .addStringOption((opt) =>
          opt.setName('description').setDescription('What is this reminder about?').setRequired(true).setMaxLength(500),
        )
        .addStringOption((opt) => frequencyOption(opt).setRequired(true))
        .addStringOption((opt) =>
          opt.setName('date').setDescription('First occurrence date (YYYY-MM-DD)').setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('time').setDescription('Time of day, 24h HH:mm (default 09:00)').setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('timezone')
            .setDescription('IANA timezone, e.g. Europe/London (default UTC)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit an existing reminder')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('Reminder ID').setRequired(true).setAutocomplete(true),
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('New description').setRequired(false).setMaxLength(500),
        )
        .addStringOption((opt) => frequencyOption(opt).setRequired(false))
        .addStringOption((opt) => opt.setName('date').setDescription('New date (YYYY-MM-DD)').setRequired(false))
        .addStringOption((opt) => opt.setName('time').setDescription('New time, 24h HH:mm').setRequired(false))
        .addStringOption((opt) => opt.setName('timezone').setDescription('New IANA timezone').setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel a reminder')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('Reminder ID').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List active reminders for this server')),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'id') return;

    const query = String(focused.value).toLowerCase();
    const reminders = db.listReminders({ guildId: interaction.guildId });
    const choices = reminders
      .filter((r) => String(r.id).includes(query) || r.description.toLowerCase().includes(query))
      .slice(0, 25)
      .map((r) => ({
        name: `#${r.id} - ${r.description}`.slice(0, 100),
        value: r.id,
      }));

    await interaction.respond(choices);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'set') return handleSet(interaction);
    if (sub === 'edit') return handleEdit(interaction);
    if (sub === 'cancel') return handleCancel(interaction);
    if (sub === 'list') return handleList(interaction);
  },
};

async function handleSet(interaction) {
  const description = interaction.options.getString('description', true);
  const frequency = interaction.options.getString('frequency', true);
  const date = interaction.options.getString('date', true);
  const time = interaction.options.getString('time') ?? DEFAULT_TIME;
  const timezone = interaction.options.getString('timezone') ?? DEFAULT_TIMEZONE;

  const validationError = validateInputs({ frequency, date, time, timezone });
  if (validationError) {
    await interaction.reply({ content: validationError, ephemeral: true });
    return;
  }

  const anchor = parseDateTime(date, time, timezone);
  const anchorISO = anchor.toISO();
  const occurrenceIndex = findNextOccurrenceIndex(anchorISO, timezone, frequency, 0);

  if (frequency === 'once' && occurrenceIndex > 0) {
    await interaction.reply({
      content: 'That date and time is in the past. Please choose a future date/time for a one-time reminder.',
      ephemeral: true,
    });
    return;
  }

  const reminder = db.createReminder({
    guildId: interaction.guildId,
    creatorId: interaction.user.id,
    description,
    frequency,
    anchorISO,
    timezone,
    occurrenceIndex,
  });

  const guildConfig = db.getGuildConfig(interaction.guildId);
  const channelNote = guildConfig?.channelId
    ? `It will also be posted in <#${guildConfig.channelId}>.`
    : 'No reminder channel is configured for this server yet — use `/set channel` so it also posts there, otherwise only the DM will be sent.';

  await interaction.reply({
    content: `Reminder created.\n${detailLine(reminder)}\n\n${channelNote}`,
    ephemeral: true,
  });
}

async function handleEdit(interaction) {
  const id = interaction.options.getInteger('id', true);
  const reminder = db.getReminder(id);

  if (!reminder || !reminder.active || reminder.guildId !== interaction.guildId) {
    await interaction.reply({ content: `No active reminder with ID #${id} found in this server.`, ephemeral: true });
    return;
  }

  if (!canManage(interaction, reminder)) {
    await interaction.reply({
      content: 'You can only edit reminders you created, unless you have the Manage Server permission.',
      ephemeral: true,
    });
    return;
  }

  const description = interaction.options.getString('description');
  const frequency = interaction.options.getString('frequency');
  const date = interaction.options.getString('date');
  const time = interaction.options.getString('time');
  const timezone = interaction.options.getString('timezone');

  if (!description && !frequency && !date && !time && !timezone) {
    await interaction.reply({ content: 'Provide at least one field to change.', ephemeral: true });
    return;
  }

  const newFrequency = frequency ?? reminder.frequency;
  const newTimezone = timezone ?? reminder.timezone;

  const validationError = validateInputs({
    frequency: newFrequency,
    date,
    time,
    timezone: newTimezone,
    skipDate: !date,
    skipTime: !time,
  });
  if (validationError) {
    await interaction.reply({ content: validationError, ephemeral: true });
    return;
  }

  let newAnchorISO = reminder.anchorISO;
  if (date || time || timezone) {
    const currentAnchor = DateTime.fromISO(reminder.anchorISO, { zone: reminder.timezone });
    const finalDate = date ?? currentAnchor.toFormat('yyyy-MM-dd');
    const finalTime = time ?? currentAnchor.toFormat('HH:mm');
    const parsed = parseDateTime(finalDate, finalTime, newTimezone);
    if (!parsed) {
      await interaction.reply({ content: 'Could not parse the new date/time/timezone combination.', ephemeral: true });
      return;
    }
    newAnchorISO = parsed.toISO();
  }

  const newOccurrenceIndex = findNextOccurrenceIndex(newAnchorISO, newTimezone, newFrequency, 0);

  if (newFrequency === 'once' && newOccurrenceIndex > 0) {
    await interaction.reply({
      content: 'That date and time is in the past. Please choose a future date/time for a one-time reminder.',
      ephemeral: true,
    });
    return;
  }

  const updated = db.updateReminder(id, {
    description: description ?? reminder.description,
    frequency: newFrequency,
    anchorISO: newAnchorISO,
    timezone: newTimezone,
    occurrenceIndex: newOccurrenceIndex,
  });

  await interaction.reply({ content: `Reminder updated.\n${detailLine(updated)}`, ephemeral: true });
}

async function handleCancel(interaction) {
  const id = interaction.options.getInteger('id', true);
  const reminder = db.getReminder(id);

  if (!reminder || !reminder.active || reminder.guildId !== interaction.guildId) {
    await interaction.reply({ content: `No active reminder with ID #${id} found in this server.`, ephemeral: true });
    return;
  }

  if (!canManage(interaction, reminder)) {
    await interaction.reply({
      content: 'You can only cancel reminders you created, unless you have the Manage Server permission.',
      ephemeral: true,
    });
    return;
  }

  db.updateReminder(id, { active: false });
  await interaction.reply({ content: `Reminder #${id} ("${reminder.description}") has been cancelled.`, ephemeral: true });
}

async function handleList(interaction) {
  const reminders = db.listReminders({ guildId: interaction.guildId });
  const embed = listEmbed(reminders, { title: `Active Reminders — ${interaction.guild.name}` });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

function validateInputs({ frequency, date, time, timezone, skipDate = false, skipTime = false }) {
  if (!isValidFrequency(frequency)) {
    return `Invalid frequency. Choose one of: ${Object.values(FREQUENCIES).map((f) => f.label).join(', ')}.`;
  }
  if (!skipDate && !DATE_RE.test(date)) {
    return 'Invalid date format. Please use YYYY-MM-DD, e.g. 2026-01-31.';
  }
  if (!skipTime && !TIME_RE.test(time)) {
    return 'Invalid time format. Please use 24-hour HH:mm, e.g. 14:30.';
  }
  if (!isValidTimezone(timezone)) {
    return 'Invalid timezone. Use an IANA timezone name, e.g. Europe/London, America/New_York, or UTC.';
  }
  return null;
}
