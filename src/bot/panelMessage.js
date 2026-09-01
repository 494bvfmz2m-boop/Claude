const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { TicketTypes } = require('../db/repo');

const BUTTONS_PER_ROW = 5;
const MAX_BUTTON_ROWS = 5;

function buildPanelMessage(panel) {
  const types = panel.ticket_type_ids.map((id) => TicketTypes.get(id)).filter(Boolean);

  const embed = new EmbedBuilder()
    .setTitle(panel.title)
    .setDescription(panel.description)
    .setColor(panel.color || '#a32ee2');

  if (types.length === 0) {
    return { embeds: [embed], components: [] };
  }

  if (panel.style === 'select' && types.length > 1) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`panel_select:${panel.id}`)
      .setPlaceholder('Select a ticket category')
      .addOptions(types.slice(0, 25).map((t) => ({
        label: t.name,
        value: String(t.id),
        emoji: t.emoji || undefined,
      })));
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
  }

  const rows = [];
  const limited = types.slice(0, BUTTONS_PER_ROW * MAX_BUTTON_ROWS);
  for (let i = 0; i < limited.length; i += BUTTONS_PER_ROW) {
    const chunk = limited.slice(i, i + BUTTONS_PER_ROW);
    rows.push(new ActionRowBuilder().addComponents(
      chunk.map((t) => new ButtonBuilder()
        .setCustomId(`panel_open:${t.id}`)
        .setLabel(t.name)
        .setEmoji(t.emoji || '🎫')
        .setStyle(ButtonStyle.Primary)),
    ));
  }

  return { embeds: [embed], components: rows };
}

module.exports = { buildPanelMessage };
