const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Events: EventsRepo } = require('../db/repo');

const EVENT_COLOR = '#a32ee2';

// Best-effort -- there's no date picker on a slash command option, so this
// accepts anything from a full ISO string to "friday 8pm". A value Date can
// actually parse becomes a Discord timestamp (auto-localized per viewer); an
// unparseable one is shown back exactly as typed instead of being rejected.
function formatWhen(input) {
  if (!input) return null;
  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) return `<t:${Math.floor(parsed.getTime() / 1000)}:F> (<t:${Math.floor(parsed.getTime() / 1000)}:R>)`;
  return input;
}

function buildEventMessage(event) {
  const embed = new EmbedBuilder()
    .setTitle(`📅 ${event.title}`)
    .setColor(EVENT_COLOR)
    .setFooter({ text: event.hosted_by ? `Hosted by ${event.hosted_by}` : 'Event' })
    .setTimestamp();

  if (event.description) embed.setDescription(event.description);
  const when = formatWhen(event.event_time);
  if (when) embed.addFields({ name: 'When', value: when });

  embed.addFields(
    { name: `✅ Going (${event.going.length})`, value: event.going.length ? event.going.map((id) => `<@${id}>`).join('\n') : '*Nobody yet*', inline: true },
    { name: `🤷 Maybe (${event.maybe.length})`, value: event.maybe.length ? event.maybe.map((id) => `<@${id}>`).join('\n') : '*Nobody yet*', inline: true },
    { name: `❌ Not going (${event.not_going.length})`, value: event.not_going.length ? event.not_going.map((id) => `<@${id}>`).join('\n') : '*Nobody yet*', inline: true },
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`event_rsvp:${event.id}:going`).setLabel('Going').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`event_rsvp:${event.id}:maybe`).setLabel('Maybe').setStyle(ButtonStyle.Secondary).setEmoji('🤷'),
    new ButtonBuilder().setCustomId(`event_rsvp:${event.id}:not_going`).setLabel("Not going").setStyle(ButtonStyle.Danger).setEmoji('❌'),
  );
  return { embeds: [embed], components: [row] };
}

async function handleEventCommand(interaction) {
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  const time = interaction.options.getString('time');

  const draft = { id: 0, title, description, event_time: time, hosted_by: interaction.user.tag, going: [], maybe: [], not_going: [] };
  await interaction.reply(buildEventMessage(draft));
  const message = await interaction.fetchReply();

  const id = EventsRepo.create({
    guildId: interaction.guildId,
    channelId: message.channelId,
    messageId: message.id,
    title,
    description,
    eventTime: time,
    hostedBy: interaction.user.tag,
  });

  await message.edit(buildEventMessage({ ...draft, id })).catch(() => {});
}

async function handleEventResponse(interaction, eventId, response) {
  const event = EventsRepo.getByMessage(interaction.message.id);
  if (!event || event.id !== eventId) {
    return interaction.reply({ content: "Couldn't find this event anymore.", ephemeral: true });
  }

  if (!['going', 'maybe', 'not_going'].includes(response)) {
    return interaction.reply({ content: 'Unknown RSVP option.', ephemeral: true });
  }

  const lists = { going: new Set(event.going), maybe: new Set(event.maybe), not_going: new Set(event.not_going) };
  const userId = interaction.user.id;
  const wasThisChoice = event[response].includes(userId);

  // Clear from every list first so RSVPing "going" after "maybe" (or a
  // second click of the same button, to un-RSVP) both do the right thing.
  Object.values(lists).forEach((set) => set.delete(userId));
  if (!wasThisChoice) lists[response].add(userId);

  const going = [...lists.going];
  const maybe = [...lists.maybe];
  const notGoing = [...lists.not_going];
  EventsRepo.setResponse(event.id, going, maybe, notGoing);

  await interaction.reply({ content: wasThisChoice ? "RSVP removed." : `Marked you as **${response === 'not_going' ? 'not going' : response}**.`, ephemeral: true });
  await interaction.message.edit(buildEventMessage({ ...event, going, maybe, not_going: notGoing })).catch(() => {});
}

module.exports = { event: handleEventCommand, handleEventResponse, buildEventMessage };
