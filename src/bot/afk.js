const { AfkStatus } = require('../db/repo');

const AFK_PREFIX = '[AFK] ';
const MAX_NICKNAME_LEN = 32; // Discord's own cap
const MAX_MESSAGE_LEN = 200;

function trimTo(str, len) {
  return str.length > len ? str.slice(0, len) : str;
}

async function handleAfk(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  if (!guild || !member) {
    return interaction.reply({ content: 'This only works in a server.', ephemeral: true });
  }

  const message = (interaction.options.getString('message') || 'AFK').trim().slice(0, MAX_MESSAGE_LEN);

  // If they're already AFK (updating their message), keep the *original*
  // pre-AFK nickname on record rather than the current "[AFK] ..." one --
  // otherwise coming back would restore them to "[AFK] whatever" forever.
  const existing = AfkStatus.get(guild.id, member.id);
  const originalNickname = existing ? existing.original_nickname : member.nickname;
  const baseName = originalNickname || member.user.username;

  AfkStatus.set(guild.id, member.id, message, originalNickname);

  let renamed = true;
  try {
    await member.setNickname(trimTo(`${AFK_PREFIX}${baseName}`, MAX_NICKNAME_LEN));
  } catch {
    renamed = false; // missing Manage Nicknames, or the target outranks the bot -- not fatal
  }

  const note = renamed ? '' : " (couldn't update their nickname -- I need Manage Nicknames, and can't touch the server owner or anyone with a role at or above mine)";
  await interaction.reply(`💤 **${baseName}** went AFK: ${message}${note}`);
}

// Auto-clears the moment the AFK member sends any message again -- restores
// whatever nickname they had before, and announces it once.
async function clearAfk(message) {
  const status = AfkStatus.get(message.guild.id, message.author.id);
  if (!status) return;

  AfkStatus.clear(message.guild.id, message.author.id);

  const baseName = status.original_nickname || message.author.username;
  if (message.member) {
    await message.member.setNickname(status.original_nickname || null).catch(() => {});
  }
  await message.channel.send(`👋 **${baseName}** is no longer AFK.`).catch(() => {});
}

// Tells whoever pinged an AFK member that they're away -- one notice per
// AFK member per message, even if they were pinged more than once in it.
async function notifyPingedAfkUsers(message) {
  if (message.mentions.users.size === 0) return;
  const notified = new Set();
  for (const [, user] of message.mentions.users) {
    if (user.bot || user.id === message.author.id || notified.has(user.id)) continue;
    const status = AfkStatus.get(message.guild.id, user.id);
    if (!status) continue;
    notified.add(user.id);
    await message.channel.send(`💤 **${user.username}** is AFK: ${status.message || 'AFK'}`).catch(() => {});
  }
}

function register(client) {
  client.on('messageCreate', async (message) => {
    try {
      if (!message.guild || message.author.bot) return;
      await clearAfk(message);
      await notifyPingedAfkUsers(message);
    } catch (err) {
      console.error('AFK handling failed:', err.message);
    }
  });
}

module.exports = { register, afk: handleAfk };
