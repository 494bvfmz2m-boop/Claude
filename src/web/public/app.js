let currentGuildId = null;

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Tabs ---
document.querySelectorAll('.tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

// --- Status ---
async function refreshStatus() {
  const status = await api('/api/status');
  const el = document.getElementById('bot-status');
  el.innerHTML = status.botOnline
    ? `<span class="status-dot online"></span>${status.botTag}`
    : `<span class="status-dot offline"></span>Bot offline`;
}

// --- Guild picker ---
async function loadGuilds() {
  const guilds = await api('/api/guilds');
  const picker = document.getElementById('guild-picker');
  picker.innerHTML = '';
  if (guilds.length === 0) {
    picker.innerHTML = '<option>No servers — invite the bot first</option>';
    return;
  }
  for (const g of guilds) {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    picker.appendChild(opt);
  }
  currentGuildId = guilds[0].id;
  picker.value = currentGuildId;
  await loadAllForGuild();
}

document.getElementById('guild-picker').addEventListener('change', async (e) => {
  currentGuildId = e.target.value;
  await loadAllForGuild();
});

async function loadAllForGuild() {
  if (!currentGuildId) return;
  await Promise.all([loadFaq(), loadCategories(), loadRoles()]);
}

// --- FAQ tab ---
const faqForm = document.getElementById('faq-form');
const faqIdInput = document.getElementById('faq-id');
const faqQuestion = document.getElementById('faq-question');
const faqKeywords = document.getElementById('faq-keywords');
const faqAnswer = document.getElementById('faq-answer');
const faqSubmit = document.getElementById('faq-submit');
const faqCancel = document.getElementById('faq-cancel');

function resetFaqForm() {
  faqIdInput.value = '';
  faqForm.reset();
  faqSubmit.textContent = 'Add entry';
  faqCancel.style.display = 'none';
}

faqCancel.addEventListener('click', resetFaqForm);

faqForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    question: faqQuestion.value.trim(),
    keywords: faqKeywords.value.trim(),
    answer: faqAnswer.value.trim(),
  };
  if (faqIdInput.value) {
    await api(`/api/guilds/${currentGuildId}/faq/${faqIdInput.value}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    await api(`/api/guilds/${currentGuildId}/faq`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  resetFaqForm();
  await loadFaq();
});

async function loadFaq() {
  const entries = await api(`/api/guilds/${currentGuildId}/faq`);
  const tbody = document.getElementById('faq-rows');
  tbody.innerHTML = '';
  document.getElementById('faq-empty').style.display = entries.length ? 'none' : 'block';
  for (const entry of entries) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(entry.question)}</td>
      <td class="muted">${escapeHtml(entry.keywords || '')}</td>
      <td>${escapeHtml(entry.answer)}</td>
      <td class="row-actions">
        <button class="secondary" data-edit="${entry.id}">Edit</button>
        <button class="danger" data-delete="${entry.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const entry = entries.find((e) => e.id === Number(btn.dataset.edit));
      faqIdInput.value = entry.id;
      faqQuestion.value = entry.question;
      faqKeywords.value = entry.keywords || '';
      faqAnswer.value = entry.answer;
      faqSubmit.textContent = 'Save changes';
      faqCancel.style.display = 'inline-block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  tbody.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this FAQ entry?')) return;
      await api(`/api/guilds/${currentGuildId}/faq/${btn.dataset.delete}`, { method: 'DELETE' });
      await loadFaq();
    });
  });
}

// --- Categories tab ---
async function loadCategories() {
  const { available, configured } = await api(`/api/guilds/${currentGuildId}/categories`);
  const picker = document.getElementById('category-picker');
  const configuredSet = new Set(configured);
  const unconfigured = available.filter((c) => !configuredSet.has(c.id));

  picker.innerHTML = unconfigured.length
    ? unconfigured.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
    : '<option value="">No more categories to add</option>';

  const list = document.getElementById('category-list');
  list.innerHTML = '';
  for (const catId of configured) {
    const cat = available.find((c) => c.id === catId);
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.innerHTML = `${escapeHtml(cat ? cat.name : catId)} <button class="danger" data-remove-cat="${catId}" style="padding:2px 8px">✕</button>`;
    list.appendChild(pill);
  }
  list.querySelectorAll('[data-remove-cat]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/guilds/${currentGuildId}/categories/${btn.dataset.removeCat}`, { method: 'DELETE' });
      await loadCategories();
    });
  });
}

document.getElementById('category-add').addEventListener('click', async () => {
  const picker = document.getElementById('category-picker');
  if (!picker.value) return;
  await api(`/api/guilds/${currentGuildId}/categories`, {
    method: 'POST',
    body: JSON.stringify({ categoryId: picker.value }),
  });
  await loadCategories();
});

// --- Role tab ---
async function loadRoles() {
  const [roles, cfg] = await Promise.all([
    api(`/api/guilds/${currentGuildId}/roles`),
    api(`/api/guilds/${currentGuildId}/config`),
  ]);
  const picker = document.getElementById('role-picker');
  picker.innerHTML = roles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  if (cfg.support_role_id) picker.value = cfg.support_role_id;

  const current = roles.find((r) => r.id === cfg.support_role_id);
  document.getElementById('role-current').textContent = current
    ? `Currently pinging: ${current.name}`
    : 'No support role configured yet.';
}

document.getElementById('role-save').addEventListener('click', async () => {
  const picker = document.getElementById('role-picker');
  await api(`/api/guilds/${currentGuildId}/config`, {
    method: 'POST',
    body: JSON.stringify({ supportRoleId: picker.value }),
  });
  await loadRoles();
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

refreshStatus();
setInterval(refreshStatus, 15000);
loadGuilds();
