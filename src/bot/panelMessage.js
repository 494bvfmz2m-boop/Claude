const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { TicketTypes } = require('../db/repo');

const BUTTONS_PER_ROW = 5;
const MAX_ROWS = 5;

function buildPanelMessage(panel) {
  const types = panel.ticket_type_ids
    .map((id) => TicketTypes.get(id))
    .filter(Boolean)
    .slice(0, BUTTONS_PER_ROW * MAX_ROWS);

  const embed = new EmbedBuilder()
    .setTitle(panel.title)
    .setDescription(panel.description)
    .setColor(panel.color || '#5865F2');

  if (types.length === 0) {
    return { embeds: [embed], components: [] };
  }

  const rows = [];
  for (let i = 0; i < types.length; i += BUTTONS_PER_ROW) {
    const chunk = types.slice(i, i + BUTTONS_PER_ROW);
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
