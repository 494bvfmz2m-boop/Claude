const { AttachmentBuilder } = require('discord.js');

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

async function buildTranscript(channel) {
  const messages = await fetchAllMessages(channel);

  const rows = messages.map((m) => {
    const time = new Date(m.createdTimestamp).toLocaleString('en-US', { hour12: false });
    const author = escapeHtml(m.author?.tag || m.author?.username || 'Unknown');
    const avatar = escapeHtml(m.author?.displayAvatarURL?.({ size: 64 }) || '');
    const content = escapeHtml(m.content || '').replace(/\n/g, '<br>');

    const embeds = (m.embeds || []).map((e) => {
      const title = escapeHtml(e.title || '');
      const desc = escapeHtml(e.description || '').replace(/\n/g, '<br>');
      const color = e.color ? `#${e.color.toString(16).padStart(6, '0')}` : '#5865F2';
      return `<div class="embed" style="border-left-color:${color}">
        ${title ? `<div class="embed-title">${title}</div>` : ''}
        ${desc ? `<div class="embed-desc">${desc}</div>` : ''}
      </div>`;
    }).join('');

    const attachments = [...(m.attachments?.values() || [])].map((a) => {
      const url = escapeHtml(a.url);
      const isImage = /\.(png|jpe?g|gif|webp)$/i.test(a.name || '');
      return isImage
        ? `<div class="attachment"><img src="${url}" alt="${escapeHtml(a.name)}" loading="lazy"></div>`
        : `<div class="attachment"><a href="${url}" target="_blank" rel="noopener">${escapeHtml(a.name || url)}</a></div>`;
    }).join('');

    return `<div class="message">
      <img class="avatar" src="${avatar}" alt="">
      <div class="body">
        <div class="meta"><span class="author">${author}</span><span class="time">${escapeHtml(time)}</span></div>
        ${content ? `<div class="content">${content}</div>` : ''}
        ${embeds}
        ${attachments}
      </div>
    </div>`;
  }).join('\n');

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<title>Transcript - ${escapeHtml(channel.name)}</title>
<style>
  body { background:#313338; color:#dbdee1; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin:0; padding:24px; }
  h1 { color:#fff; font-size:18px; }
  .message { display:flex; gap:12px; padding:8px 0; border-bottom:1px solid #3f4147; }
  .avatar { width:40px; height:40px; border-radius:50%; background:#5865F2; flex-shrink:0; }
  .meta { display:flex; gap:8px; align-items:baseline; }
  .author { font-weight:600; color:#fff; }
  .time { font-size:12px; color:#949ba4; }
  .content { white-space:pre-wrap; word-break:break-word; margin-top:2px; }
  .embed { border-left:4px solid #5865F2; background:#2b2d31; padding:8px 12px; margin-top:6px; border-radius:4px; max-width:520px; }
  .embed-title { font-weight:600; color:#fff; }
  .embed-desc { color:#dbdee1; margin-top:4px; }
  .attachment img { max-width:400px; border-radius:8px; margin-top:6px; display:block; }
  .attachment a { color:#00a8fc; }
</style>
</head><body>
<h1># ${escapeHtml(channel.name)} — transcript</h1>
${rows || '<p>No messages.</p>'}
</body></html>`;

  return new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `transcript-${channel.name}.html` });
}

module.exports = { buildTranscript };
