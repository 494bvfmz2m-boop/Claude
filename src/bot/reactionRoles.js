const { EmbedBuilder, Events } = require('discord.js');
const { ReactionRolePanels } = require('../db/repo');

const CUSTOM_EMOJI = /^<a?:\w+:(\d+)>$/;

// Turns whatever someone typed into the emoji field into what we react with
// (a unicode string, or a custom emoji's numeric ID) and what we match
// incoming reactions against (reaction.emoji.id for custom, .name for
// unicode -- discord.js gives you exactly one of those per reaction).
function parseEmojiInput(raw) {
  const trimmed = (raw || '').trim();
  const custom = CUSTOM_EMOJI.exec(trimmed);
  if (custom) {
    return { reactWith: custom[1], matchKey: custom[1], display: trimmed };
  }
  return { reactWith: trimmed, matchKey: trimmed, display: trimmed };
}

function buildReactionRoleMessage(panel, guild) {
  const lines = panel.mappings.map((m) => {
    const role = guild.roles.cache.get(m.roleId);
    return `${m.display || m.emoji} — ${role ? `<@&${role.id}>` : 'Unknown role'}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(panel.title)
    .setDescription(`${panel.description}\n\n${lines.join('\n')}`)
    .setColor(panel.color || '#a8e6ff');

  return { embeds: [embed] };
}

async function postPanel(guild, channel, panel) {
  const message = await channel.send(buildReactionRoleMessage(panel, guild));
  for (const m of panel.mappings) {
    await message.react(m.reactWith || m.emoji).catch(() => {});
  }
  return message;
}

async function handleReaction(reaction, user, adding) {
  if (user.bot) return;
  if (reaction.partial) {
    try { await reaction.fetch(); } catch { return; }
  }

  const message = reaction.message;
  if (!message.guildId) return;

  const panel = ReactionRolePanels.getByMessage(message.id);
  if (!panel) return;

  const key = reaction.emoji.id || reaction.emoji.name;
  const mapping = panel.mappings.find((m) => m.matchKey === key);
  if (!mapping) return;

  const member = await message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  try {
    if (adding) await member.roles.add(mapping.roleId);
    else await member.roles.remove(mapping.roleId);
  } catch {
    // Missing permissions or the role sits above ModSentry's own -- nothing
    // sensible to report back through a reaction click, so just drop it.
  }
}

function register(client) {
  client.on(Events.MessageReactionAdd, (reaction, user) => handleReaction(reaction, user, true).catch(() => {}));
  client.on(Events.MessageReactionRemove, (reaction, user) => handleReaction(reaction, user, false).catch(() => {}));
}

module.exports = { register, postPanel, buildReactionRoleMessage, parseEmojiInput, handleReaction };
