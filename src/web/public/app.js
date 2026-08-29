let currentGuildId = null;
let allGuilds = [];
let faqCache = [];

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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function timeAgo(isoString) {
  const then = new Date(isoString.replace(' ', 'T') + 'Z').getTime();
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// --- View switching ---
function showServersView() {
  document.getElementById('view-dashboard').style.display = 'none';
  document.getElementById('view-servers').style.display = 'block';
}

function showDashboardView() {
  document.getElementById('view-servers').style.display = 'none';
  document.getElementById('view-dashboard').style.display = 'flex';
}

document.getElementById('sidebar-back').addEventListener('click', showServersView);
document.getElementById('sidebar-back').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') showServersView();
});

// --- Sidebar nav tabs ---
document.querySelectorAll('.sidebar-nav button.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-nav button.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// --- User menu dropdowns (navbar + sidebar variants) ---
function wireUserMenu(btnId, dropdownId) {
  const btn = document.getElementById(btnId);
  const dropdown = document.getElementById(dropdownId);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.user-menu-dropdown').forEach((d) => {
      if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');
  });
}
wireUserMenu('user-menu-btn', 'user-menu-dropdown');
wireUserMenu('user-menu-btn-sidebar', 'user-menu-dropdown-sidebar');
document.addEventListener('click', () => {
  document.querySelectorAll('.user-menu-dropdown').forEach((d) => d.classList.remove('open'));
});

async function logout() {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/login';
}
document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('logout-btn-sidebar').addEventListener('click', logout);

// --- Status ---
async function refreshStatus() {
  const status = await api('/api/status');
  const label = status.botOnline
    ? `<span class="status-dot online"></span>Bot online${status.ping != null ? ` · ${status.ping}ms` : ''}`
    : `<span class="status-dot offline"></span>Bot offline`;
  document.getElementById('bot-status').innerHTML = label;
  document.getElementById('bot-status-sidebar').innerHTML = label;
}

async function loadMe() {
  const me = await api('/api/me');
  const avatarUrl = me.avatar
    ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=32`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(me.id) % 5n)}.png`;
  for (const suffix of ['', '-sidebar']) {
    document.getElementById(`user-avatar${suffix}`).src = avatarUrl;
    document.getElementById(`user-name${suffix}`).textContent = me.username;
  }
}

// --- Servers picker ---
function guildInitial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

async function loadGuilds() {
  allGuilds = await api('/api/guilds');
  const grid = document.getElementById('server-grid');
  const empty = document.getElementById('server-empty');
  grid.innerHTML = '';

  if (allGuilds.length === 0) {
    empty.style.display = 'block';
    empty.textContent = "You don't have Manage Server permission in any server ModReply is installed in.";
    return;
  }
  empty.style.display = 'none';

  for (const g of allGuilds) {
    const card = document.createElement('div');
    card.className = 'server-card';
    const iconHtml = g.iconUrl
      ? `<img class="server-icon" src="${g.iconUrl}" alt="" />`
      : `<div class="server-icon">${escapeHtml(guildInitial(g.name))}</div>`;
    card.innerHTML = `
      ${iconHtml}
      <div class="server-name">${escapeHtml(g.name)}</div>
      <div class="server-meta">${g.memberCount != null ? `${g.memberCount} members` : ''}</div>
    `;
    card.addEventListener('click', () => openDashboard(g.id));
    grid.appendChild(card);
  }

  // Keep the sidebar's quick-switch <select> in sync.
  const picker = document.getElementById('guild-picker');
  picker.innerHTML = allGuilds.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
}

function openDashboard(guildId) {
  currentGuildId = guildId;
  document.getElementById('guild-picker').value = guildId;
  showDashboardView();
  loadAllForGuild();
}

document.getElementById('guild-picker').addEventListener('change', (e) => {
  currentGuildId = e.target.value;
  loadAllForGuild();
});

async function loadAllForGuild() {
  if (!currentGuildId) return;
  const results = await Promise.allSettled([loadFaq(), loadCategories(), loadRoles()]);
  const failed = results.find((r) => r.status === 'rejected');
  if (failed) console.error('Failed to load dashboard data:', failed.reason);
  renderOverview();
}

// --- Overview ---
function renderOverview() {
  const guild = allGuilds.find((g) => g.id === currentGuildId);
  const categoriesConfigured = document.querySelectorAll('#category-list .pill').length;
  const roleConfigured = document.getElementById('role-current').dataset.configured === '1';

  const stats = [
    { value: faqCache.length, label: 'FAQ entries', cls: '' },
    { value: categoriesConfigured, label: 'Ticket categories', cls: categoriesConfigured ? 'ok' : 'warn' },
    { value: roleConfigured ? 'Set' : 'Not set', label: 'Support role', cls: roleConfigured ? 'ok' : 'warn' },
  ];
  document.getElementById('stat-grid').innerHTML = stats
    .map(
      (s) => `
      <div class="stat-card">
        <div class="stat-value ${s.cls}">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`
    )
    .join('');

  const banners = document.getElementById('banners');
  banners.innerHTML = '';
  if (categoriesConfigured === 0) {
    banners.innerHTML += `<div class="banner">⚠ No ticket categories configured yet — /ask and /escalate won't respond anywhere in ${guild ? escapeHtml(guild.name) : 'this server'} until you add one in Ticket Categories.</div>`;
  }
  if (!roleConfigured) {
    banners.innerHTML += `<div class="banner">⚠ No support role configured yet — escalations have no one to ping until you set one in Support Role.</div>`;
  }

  const recentFaq = document.getElementById('recent-faq');
  const recent = [...faqCache].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 5);
  recentFaq.innerHTML = recent.length
    ? recent
        .map(
          (e) => `
        <div class="activity-row">
          <div class="activity-title">${escapeHtml(e.question)}</div>
          <div class="activity-meta">Updated ${timeAgo(e.updated_at)}</div>
        </div>`
        )
        .join('')
    : '<p class="muted">No FAQ entries yet.</p>';
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
  renderOverview();
});

async function loadFaq() {
  const entries = await api(`/api/guilds/${currentGuildId}/faq`);
  faqCache = entries;
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
      document.querySelector('[data-tab="faq"]').click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  tbody.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this FAQ entry?')) return;
      await api(`/api/guilds/${currentGuildId}/faq/${btn.dataset.delete}`, { method: 'DELETE' });
      await loadFaq();
      renderOverview();
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
      renderOverview();
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
  renderOverview();
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
  const currentEl = document.getElementById('role-current');
  currentEl.textContent = current ? `Currently pinging: ${current.name}` : 'No support role configured yet.';
  currentEl.dataset.configured = current ? '1' : '0';
}

document.getElementById('role-save').addEventListener('click', async () => {
  const picker = document.getElementById('role-picker');
  await api(`/api/guilds/${currentGuildId}/config`, {
    method: 'POST',
    body: JSON.stringify({ supportRoleId: picker.value }),
  });
  await loadRoles();
  renderOverview();
});

refreshStatus();
setInterval(refreshStatus, 15000);
loadMe();
loadGuilds();
