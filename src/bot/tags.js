const { PermissionFlagsBits } = require('discord.js');
const { Tags } = require('../db/repo');

function canManageTags(interaction) {
  return interaction.member?.permissions?.has(PermissionFlagsBits.ManageMessages);
}

async function handleTagGet(interaction) {
  const name = interaction.options.getString('name');
  const tag = Tags.get(interaction.guildId, name);
  if (!tag) return interaction.reply({ content: `No tag called \`${name}\`.`, ephemeral: true });
  return interaction.reply(tag.content);
}

async function handleTagCreate(interaction) {
  if (!canManageTags(interaction)) {
    return interaction.reply({ content: "You need Manage Messages to create tags.", ephemeral: true });
  }
  const name = interaction.options.getString('name').trim().toLowerCase();
  const content = interaction.options.getString('content');
  if (Tags.get(interaction.guildId, name)) {
    return interaction.reply({ content: `A tag called \`${name}\` already exists.`, ephemeral: true });
  }
  Tags.create(interaction.guildId, name, content, interaction.user.id);
  return interaction.reply({ content: `Created tag \`${name}\`.`, ephemeral: true });
}

async function handleTagDelete(interaction) {
  if (!canManageTags(interaction)) {
    return interaction.reply({ content: "You need Manage Messages to delete tags.", ephemeral: true });
  }
  const name = interaction.options.getString('name');
  const tag = Tags.get(interaction.guildId, name);
  if (!tag) return interaction.reply({ content: `No tag called \`${name}\`.`, ephemeral: true });
  Tags.delete(tag.id);
  return interaction.reply({ content: `Deleted tag \`${name}\`.`, ephemeral: true });
}

async function handleTagList(interaction) {
  const tags = Tags.listForGuild(interaction.guildId);
  if (tags.length === 0) return interaction.reply({ content: 'No tags yet.', ephemeral: true });
  return interaction.reply({ content: `**Tags:** ${tags.map((t) => `\`${t.name}\``).join(', ')}`, ephemeral: true });
}

async function handleTagCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'get') return handleTagGet(interaction);
  if (sub === 'create') return handleTagCreate(interaction);
  if (sub === 'delete') return handleTagDelete(interaction);
  if (sub === 'list') return handleTagList(interaction);
}

async function handleTagAutocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const tags = Tags.listForGuild(interaction.guildId);
  const matches = tags.filter((t) => t.name.toLowerCase().includes(focused)).slice(0, 25);
  return interaction.respond(matches.map((t) => ({ name: t.name, value: t.name }))).catch(() => {});
}

module.exports = { tag: handleTagCommand, handleTagAutocomplete };
