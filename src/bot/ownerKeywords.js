// Quick keyword shortcuts for when the owner DMs the bot -- an alternative
// to clicking through the owner panel button for the three things actually
// worth checking often. Anything that isn't one of these keywords falls
// through to the normal panel (handled by the caller).
const { EmbedBuilder } = require('discord.js');
const { AppSettings, BetaAllowlist, DmFormTemplates, DmFormSends, Contacts } = require('../db/repo');
const { buildServerListEmbed } = require('./ownerPanel');

const OWNER_COLOR = '#5865F2';
const FORMS_LIST_LIMIT = 15;

const KEYWORD_HELP = [
  { word: 'servers', desc: 'Every server ModSentry is in, with an invite link' },
  { word: 'info', desc: 'Server/member counts, ping, uptime, and beta status' },
  { word: 'forms', desc: 'Recent forms sent — "forms <id>" for one in full' },
  { word: 'templates', desc: 'Saved DM form templates' },
  { word: 'contacts', desc: 'Your saved contact book' },
  { word: 'beta', desc: 'Closed beta status and the allowed-users list' },
  { word: 'help', desc: 'This list' },
];

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function buildInfoEmbed(client) {
  const settings = AppSettings.get();
  const guilds = [...client.guilds.cache.values()];
  const totalMembers = guilds.reduce((sum, g) => sum + (g.memberCount || 0), 0);

  return new EmbedBuilder()
    .setTitle('ℹ️ ModSentry — info')
    .setColor(OWNER_COLOR)
    .addFields(
      { name: 'Servers', value: String(guilds.length), inline: true },
      { name: 'Members reached', value: totalMembers.toLocaleString(), inline: true },
      { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
      { name: 'Uptime', value: formatUptime(client.uptime), inline: true },
      { name: 'Closed beta', value: settings.betaLocked ? 'On' : 'Off', inline: true },
      { name: 'Allowed users', value: String(BetaAllowlist.list().length), inline: true },
      { name: 'Form templates', value: String(DmFormTemplates.list().length), inline: true },
      { name: 'Forms sent', value: `${DmFormSends.count()} total, ${DmFormSends.countPending()} awaiting a reply`, inline: true },
    )
    .setFooter({ text: 'DM me "help" to see every keyword.' });
}

function buildBetaEmbed() {
  const settings = AppSettings.get();
  const allowlist = BetaAllowlist.list();

  const embed = new EmbedBuilder()
    .setTitle('🔒 Closed beta')
    .setColor(OWNER_COLOR)
    .addFields({
      name: 'Status',
      value: settings.betaLocked ? 'On — only allowed users can log in' : 'Off — anyone can log in',
    });

  if (allowlist.length === 0) {
    embed.addFields({ name: 'Allowed users', value: 'None added yet' });
  } else {
    embed.addFields({
      name: `Allowed users (${allowlist.length})`,
      value: allowlist.map((a) => `<@${a.discord_user_id}>`).join('\n').slice(0, 1024),
    });
  }
  return embed;
}

function buildTemplatesEmbed() {
  const templates = DmFormTemplates.list();
  const embed = new EmbedBuilder().setTitle(`📋 Form templates (${templates.length})`).setColor(OWNER_COLOR);

  if (templates.length === 0) {
    embed.setDescription('No templates yet — create one from /admin\'s "Application form templates" section.');
    return embed;
  }
  templates.forEach((t) => {
    embed.addFields({ name: t.name, value: `"${t.title}" — ${t.questions.length} question${t.questions.length === 1 ? '' : 's'}` });
  });
  return embed;
}

async function buildContactsEmbed(client) {
  const contacts = Contacts.list();
  const embed = new EmbedBuilder().setTitle(`📇 Contacts (${contacts.length})`).setColor(OWNER_COLOR);

  if (contacts.length === 0) {
    embed.setDescription('No contacts saved yet — add one from /admin\'s "Contacts" section.');
    return embed;
  }
  const lines = await Promise.all(contacts.map(async (c) => {
    try {
      const user = await client.users.fetch(c.discord_user_id);
      return `**${user.tag}** · \`${c.discord_user_id}\`${c.note ? ` · ${c.note}` : ''}`;
    } catch {
      return `Unknown user · \`${c.discord_user_id}\`${c.note ? ` · ${c.note}` : ''}`;
    }
  }));
  embed.setDescription(lines.join('\n').slice(0, 4096));
  return embed;
}

function buildHelpEmbed() {
  return new EmbedBuilder()
    .setTitle('🗒️ Owner keywords')
    .setColor(OWNER_COLOR)
    .setDescription(KEYWORD_HELP.map((k) => `**${k.word}** — ${k.desc}`).join('\n'))
    .setFooter({ text: 'DM me any of these, plain text, any time.' });
}

function summarizeSend(send) {
  const status = send.responded ? '✅ Answered' : '⏳ Waiting';
  const when = `<t:${Math.floor(new Date(`${send.created_at}Z`).getTime() / 1000)}:R>`;
  return `**#${send.id}** · ${send.recipient_tag || send.recipient_id} · ${send.template_name || send.title} · ${status} · ${when}`;
}

function buildFormsListEmbed() {
  const total = DmFormSends.count();
  const recent = DmFormSends.list(FORMS_LIST_LIMIT);

  const embed = new EmbedBuilder()
    .setTitle(`📝 Forms sent (${total})`)
    .setColor(OWNER_COLOR);

  if (recent.length === 0) {
    embed.setDescription("No forms have been sent yet — send one from /admin's \"Send a DM\" tool.");
    return embed;
  }

  embed.setDescription(recent.map(summarizeSend).join('\n'));
  embed.setFooter({ text: `Reply "forms <id>" to see one in full${total > recent.length ? ` — showing the ${recent.length} most recent` : ''}.` });
  return embed;
}

function buildFormDetailEmbed(sendId) {
  const send = DmFormSends.get(sendId);
  if (!send) return null;

  const embed = new EmbedBuilder()
    .setTitle(`📝 Form #${send.id} — ${send.template_name || send.title}`)
    .setColor(OWNER_COLOR)
    .addFields({ name: 'Sent to', value: `<@${send.recipient_id}> (${send.recipient_tag || send.recipient_id})`, inline: true })
    .setFooter({ text: send.responded ? `Answered ${send.responded_at}` : 'Still waiting on a reply' })
    .setTimestamp(new Date(`${send.created_at}Z`));

  if (send.responded && send.answers) {
    send.answers.forEach((a) => embed.addFields({ name: a.question.slice(0, 256), value: a.answer || '—' }));
  } else {
    send.questions.forEach((q, i) => embed.addFields({ name: `${i + 1}.`, value: q }));
  }
  return embed;
}

// Returns true if the message was a recognized keyword (and a reply was
// sent), false otherwise so the caller can fall back to the normal panel.
async function handleOwnerKeyword(message) {
  const text = message.content.trim().toLowerCase();

  if (text === 'servers') {
    await message.channel.send({ embeds: [await buildServerListEmbed(message.client)] });
    return true;
  }

  if (text === 'info') {
    await message.channel.send({ embeds: [buildInfoEmbed(message.client)] });
    return true;
  }

  if (text === 'forms') {
    await message.channel.send({ embeds: [buildFormsListEmbed()] });
    return true;
  }

  const formDetailMatch = text.match(/^forms\s+(\d+)$/);
  if (formDetailMatch) {
    const embed = buildFormDetailEmbed(Number(formDetailMatch[1]));
    await message.channel.send(embed ? { embeds: [embed] } : { content: `No form with ID ${formDetailMatch[1]}.` });
    return true;
  }

  if (text === 'beta' || text === 'allowlist') {
    await message.channel.send({ embeds: [buildBetaEmbed()] });
    return true;
  }

  if (text === 'templates') {
    await message.channel.send({ embeds: [buildTemplatesEmbed()] });
    return true;
  }

  if (text === 'contacts') {
    await message.channel.send({ embeds: [await buildContactsEmbed(message.client)] });
    return true;
  }

  if (text === 'help') {
    await message.channel.send({ embeds: [buildHelpEmbed()] });
    return true;
  }

  return false;
}

module.exports = {
  handleOwnerKeyword,
  buildInfoEmbed,
  buildFormsListEmbed,
  buildFormDetailEmbed,
  buildBetaEmbed,
  buildTemplatesEmbed,
  buildContactsEmbed,
  buildHelpEmbed,
};
