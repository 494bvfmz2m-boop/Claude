const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { TicketTypes } = require('../db/repo');

function buildPanelMessage(panel) {
  const types = panel.ticket_type_ids.map((id) => TicketTypes.get(id)).filter(Boolean);

  const embed = new EmbedBuilder()
    .setTitle(panel.title)
    .setDescription(panel.description)
    .setColor(panel.color || '#5865F2');

  if (types.length === 0) {
    return { embeds: [embed], components: [] };
  }

  if (types.length === 1) {
    const t = types[0];
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`panel_open:${t.id}`)
        .setLabel(t.name)
        .setEmoji(t.emoji || '🎫')
        .setStyle(ButtonStyle.Primary),
    );
    return { embeds: [embed], components: [row] };
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`panel_select:${panel.id}`)
    .setPlaceholder('Select a ticket category')
    .addOptions(types.map((t) => ({
      label: t.name,
      value: String(t.id),
      emoji: t.emoji || undefined,
    })));

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] };
}

module.exports = { buildPanelMessage };
