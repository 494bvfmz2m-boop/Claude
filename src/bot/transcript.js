const { AttachmentBuilder } = require('discord.js');

async function fetchAllMessages(channel, maxMessages = 2000) {
  const all = [];
  let before;
  while (all.length < maxMessages) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return all.reverse();
}

function formatTimestamp(ms) {
  return new Date(ms).toLocaleString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

async function buildTranscript(channel) {
  const messages = await fetchAllMessages(channel);

  const lines = [`Transcript for #${channel.name}`, `Generated ${formatTimestamp(Date.now())}`, ''.padEnd(60, '=')];

  for (const m of messages) {
    const author = m.author?.tag || m.author?.username || 'Unknown user';
    const time = formatTimestamp(m.createdTimestamp);
    lines.push(`[${time}] ${author}:`);

    if (m.content) lines.push(m.content);

    for (const embed of m.embeds || []) {
      if (embed.title) lines.push(`[embed] ${embed.title}`);
      if (embed.description) lines.push(embed.description);
    }

    for (const attachment of m.attachments?.values() || []) {
      lines.push(`[attachment] ${attachment.name || attachment.url}: ${attachment.url}`);
    }

    lines.push('');
  }

  if (messages.length === 0) lines.push('(no messages)');

  return new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf-8'), { name: `transcript-${channel.name}.txt` });
}

module.exports = { buildTranscript };
