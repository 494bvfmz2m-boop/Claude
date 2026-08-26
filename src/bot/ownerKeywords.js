// Quick keyword shortcuts for when the owner DMs the bot -- an alternative
// to clicking through the owner panel button for the three things actually
// worth checking often. Anything that isn't one of these keywords falls
// through to the normal panel (handled by the caller).
const { EmbedBuilder } = require('discord.js');
const { AppSettings, BetaAllowlist, DmFormTemplates, DmFormSends } = require('../db/repo');
const { buildServerListEmbed } = require('./ownerPanel');

const OWNER_COLOR = '#5865F2';
const FORMS_LIST_LIMIT = 15;

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
    .setTitle('ℹ️ Quellum — info')
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
    .setFooter({ text: 'DM me "servers" or "forms" for more.' });
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

  return false;
}

module.exports = { handleOwnerKeyword, buildInfoEmbed, buildFormsListEmbed, buildFormDetailEmbed };
