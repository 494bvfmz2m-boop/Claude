// Shared by the embed builder, ticket type welcome embed, and panel embed
// forms. Discord only renders mention pings inside an embed's description
// and field values (not the title/author/footer), so this is only ever
// wired up on those fields.
function insertMentionToken(targetId, token) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, start) + token + el.value.slice(end);
  const pos = start + token.length;
  el.focus();
  el.setSelectionRange(pos, pos);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertRoleMention(targetId, selectId) {
  const select = document.getElementById(selectId);
  if (!select || !select.value) return;
  insertMentionToken(targetId, `<@&${select.value}>`);
  select.value = '';
}

// datetime-local's value has no timezone info -- the browser (and so `new
// Date(...)`) treats it as whatever the *person filling out this form* means
// by that wall-clock time, in their own local timezone. Converting that to a
// Unix timestamp and wrapping it in Discord's <t:...> token is exactly how
// "event at 5pm" ends up correctly converted to each *viewer's* own local
// time when the message renders in Discord.
function insertTimestamp(targetId, timeInputId, formatSelectId) {
  const timeInput = document.getElementById(timeInputId);
  if (!timeInput || !timeInput.value) return;
  const unix = Math.floor(new Date(timeInput.value).getTime() / 1000);
  if (!Number.isFinite(unix)) return;
  const formatSelect = document.getElementById(formatSelectId);
  const format = formatSelect ? formatSelect.value : 'F';
  insertMentionToken(targetId, `<t:${unix}:${format}>`);
}

async function insertUserMention(targetId, inputId, guildId) {
  const input = document.getElementById(inputId);
  const q = (input?.value || '').trim();
  if (!q) return;
  try {
    const res = await fetch(`/dashboard/${guildId}/mentions/resolve-user?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      alert(`Couldn't find "${q}" in this server. Try their exact user ID instead.`);
      return;
    }
    const data = await res.json();
    insertMentionToken(targetId, `<@${data.id}>`);
    input.value = '';
  } catch {
    alert('Something went wrong looking that up.');
  }
}
