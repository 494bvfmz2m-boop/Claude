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
