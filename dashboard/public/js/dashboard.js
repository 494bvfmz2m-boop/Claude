(function () {
  const state = {
    csrfToken: null,
    guilds: [],
    activeGuildId: null,
    activeTab: 'settings',
    channels: [],
    roles: [],
  };

  const guildListEl = document.getElementById('guild-list');
  const navTabsEl = document.getElementById('nav-tabs');
  const mainEl = document.getElementById('main');
  const toastEl = document.getElementById('toast');
  const logoutBtn = document.getElementById('logout-btn');

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function toast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast visible ${type}`;
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('visible'), 3500);
  }

  async function api(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (options.method && options.method !== 'GET') {
      headers['x-csrf-token'] = state.csrfToken;
    }
    const res = await fetch(path, Object.assign({}, options, { headers }));
    if (res.status === 401) {
      window.location.href = '/login.html';
      throw new Error('Not authenticated');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  async function init() {
    const session = await fetch('/auth/session').then((r) => r.json()).catch(() => ({ authenticated: false }));
    if (!session.authenticated) {
      window.location.href = '/login.html';
      return;
    }
    const csrf = await fetch('/auth/csrf').then((r) => r.json());
    state.csrfToken = csrf.csrfToken;

    logoutBtn.addEventListener('click', async () => {
      await fetch('/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });

    navTabsEl.addEventListener('click', (e) => {
      const tab = e.target.closest('.nav-tab');
      if (!tab) return;
      state.activeTab = tab.dataset.tab;
      [...navTabsEl.children].forEach((c) => c.classList.toggle('active', c === tab));
      renderTab();
    });

    await loadGuilds();
  }

  async function loadGuilds() {
    try {
      state.guilds = await api('/api/guilds');
    } catch (err) {
      guildListEl.innerHTML = `<div class="empty-state">Failed to load servers: ${esc(err.message)}</div>`;
      return;
    }
    if (state.guilds.length === 0) {
      guildListEl.innerHTML = '<div class="empty-state">The bot is not in any servers yet.</div>';
      return;
    }
    guildListEl.innerHTML = state.guilds.map((g) => `
      <div class="guild-item" data-id="${esc(g.id)}">
        ${g.icon ? `<img src="https://cdn.discordapp.com/icons/${esc(g.id)}/${esc(g.icon)}.png?size=64" alt="" />` : '<img alt="" />'}
        <span>${esc(g.name)}</span>
      </div>`).join('');

    guildListEl.querySelectorAll('.guild-item').forEach((item) => {
      item.addEventListener('click', () => selectGuild(item.dataset.id));
    });

    if (state.guilds.length === 1) selectGuild(state.guilds[0].id);
  }

  async function selectGuild(guildId) {
    state.activeGuildId = guildId;
    guildListEl.querySelectorAll('.guild-item').forEach((el) => el.classList.toggle('active', el.dataset.id === guildId));
    navTabsEl.style.display = 'flex';

    try {
      const [channels, roles] = await Promise.all([
        api(`/api/guilds/${guildId}/channels`),
        api(`/api/guilds/${guildId}/roles`),
      ]);
      state.channels = channels;
      state.roles = roles;
    } catch (err) {
      toast(`Failed to load server data: ${err.message}`, 'error');
      return;
    }
    await renderTab();
  }

  function channelOptions(types, selectedId, includeEmpty = true) {
    const filtered = state.channels.filter((c) => types.includes(c.type));
    const opts = filtered.map((c) => `<option value="${esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>#${esc(c.name)}</option>`);
    return (includeEmpty ? `<option value="">-- Not set --</option>` : '') + opts.join('');
  }

  function roleOptions(selectedId) {
    return '<option value="">-- Not set --</option>' + state.roles.map((r) => `<option value="${esc(r.id)}" ${r.id === selectedId ? 'selected' : ''}>@${esc(r.name)}</option>`).join('');
  }

  async function renderTab() {
    if (!state.activeGuildId) return;
    if (state.activeTab === 'settings') return renderSettings();
    if (state.activeTab === 'tickets') return renderTickets();
    if (state.activeTab === 'giveaways') return renderGiveaways();
    if (state.activeTab === 'orders') return renderOrders();
    if (state.activeTab === 'warnings') return renderWarnings();
  }

  // ---------------- Settings ----------------
  async function renderSettings() {
    mainEl.innerHTML = '<div class="loading">Loading settings...</div>';
    let s;
    try {
      s = await api(`/api/guilds/${state.activeGuildId}/settings`);
    } catch (err) {
      mainEl.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
      return;
    }

    const TEXT = [0, 5];
    const CATEGORY = [4];

    mainEl.innerHTML = `
      <h1>Settings</h1>
      <p class="hint">Configure moderation logging, welcome/leave messages, tickets, orders, and anti-raid.</p>

      <div class="card">
        <h3>Join &amp; Leave Messages</h3>
        <div class="grid-2">
          <div>
            <label>Welcome Channel</label>
            <select id="welcome_channel_id">${channelOptions(TEXT, s.welcome_channel_id)}</select>
          </div>
          <div>
            <label>Leave Channel</label>
            <select id="leave_channel_id">${channelOptions(TEXT, s.leave_channel_id)}</select>
          </div>
        </div>
        <label>Welcome Message <span style="color:var(--text-dim)">({user}, {server}, {membercount})</span></label>
        <textarea id="welcome_message" rows="2">${esc(s.welcome_message)}</textarea>
        <label>Leave Message</label>
        <textarea id="leave_message" rows="2">${esc(s.leave_message)}</textarea>
      </div>

      <div class="card">
        <h3>Logging</h3>
        <div class="grid-2">
          <div>
            <label>General / Anti-Raid Log Channel</label>
            <select id="log_channel_id">${channelOptions(TEXT, s.log_channel_id)}</select>
          </div>
          <div>
            <label>Moderation Log Channel</label>
            <select id="mod_log_channel_id">${channelOptions(TEXT, s.mod_log_channel_id)}</select>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Tickets</h3>
        <div class="grid-2">
          <div>
            <label>Ticket Category</label>
            <select id="ticket_category_id">${channelOptions(CATEGORY, s.ticket_category_id)}</select>
          </div>
          <div>
            <label>Staff Role</label>
            <select id="ticket_staff_role_id">${roleOptions(s.ticket_staff_role_id)}</select>
          </div>
        </div>
        <label>Ticket Log Channel</label>
        <select id="ticket_log_channel_id">${channelOptions(TEXT, s.ticket_log_channel_id)}</select>

        <h3 style="margin-top:20px">Panel Appearance</h3>
        <label>Panel Title</label>
        <input type="text" id="ticket_panel_title" value="${esc(s.ticket_panel_title)}" maxlength="256" />
        <label>Panel Description</label>
        <textarea id="ticket_panel_description" rows="3" maxlength="1000">${esc(s.ticket_panel_description)}</textarea>
        <div class="grid-2">
          <div>
            <label>Button Label</label>
            <input type="text" id="ticket_panel_button_label" value="${esc(s.ticket_panel_button_label)}" maxlength="80" />
          </div>
          <div>
            <label>Button Emoji <span style="color:var(--text-dim)">(unicode only)</span></label>
            <input type="text" id="ticket_panel_button_emoji" value="${esc(s.ticket_panel_button_emoji || '')}" maxlength="8" />
          </div>
        </div>
        <label>Embed Color</label>
        <input type="text" id="ticket_panel_color" value="${esc(s.ticket_panel_color)}" maxlength="7" placeholder="#5865F2" />
        <p class="hint" style="margin-top:10px">Both fields save with the button below. Once a category is set, run <code>/ticketpanel post #channel</code> in Discord to (re)post the panel with these changes — or use <code>/ticketpanel edit</code> for the same editor without leaving Discord.</p>
      </div>

      <div class="card">
        <h3>Orders</h3>
        <label>Order Notifications Channel</label>
        <select id="order_channel_id">${channelOptions(TEXT, s.order_channel_id)}</select>
      </div>

      <div class="card">
        <h3>Anti-Raid</h3>
        <label><input type="checkbox" id="antiraid_enabled" ${s.antiraid_enabled ? 'checked' : ''} style="width:auto;margin-right:8px" />Enabled</label>
        <div class="grid-2" style="margin-top:12px">
          <div>
            <label>Join Threshold</label>
            <input type="text" id="antiraid_join_threshold" value="${esc(s.antiraid_join_threshold)}" />
          </div>
          <div>
            <label>Window (seconds)</label>
            <input type="text" id="antiraid_join_window_s" value="${esc(s.antiraid_join_window_ms / 1000)}" />
          </div>
          <div>
            <label>Min Account Age (days)</label>
            <input type="text" id="antiraid_min_account_age_days" value="${esc(s.antiraid_min_account_age_days)}" />
          </div>
          <div>
            <label>Action</label>
            <select id="antiraid_action">
              <option value="kick" ${s.antiraid_action === 'kick' ? 'selected' : ''}>Kick</option>
              <option value="ban" ${s.antiraid_action === 'ban' ? 'selected' : ''}>Ban</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Anti-Raid Honeypot</h3>
        <p class="hint" style="margin-top:-4px">Creates (or reuses) a trap channel. Anyone other than staff who posts in it is instantly soft-banned (kicked + recent messages purged — not a permanent ban). Never link, mention, or post in this channel yourself.</p>
        <label><input type="checkbox" id="honeypot_enabled" ${s.honeypot_enabled ? 'checked' : ''} style="width:auto;margin-right:8px" />Enabled</label>
        <div class="grid-2" style="margin-top:12px">
          <div>
            <label>Trap Channel</label>
            <select id="honeypot_channel_id">${channelOptions(TEXT, s.honeypot_channel_id)}</select>
          </div>
          <div>
            <label>New Channel Name <span style="color:var(--text-dim)">(only used if none selected/exists)</span></label>
            <input type="text" id="honeypot_name" placeholder="🚫│do-not-post-here" />
          </div>
        </div>
        <div class="btn-row"><button id="save-honeypot" class="secondary">Save Honeypot</button></div>
      </div>

      <div class="btn-row">
        <button id="save-settings">Save Settings</button>
      </div>
    `;

    document.getElementById('save-settings').addEventListener('click', async () => {
      const payload = {
        welcome_channel_id: document.getElementById('welcome_channel_id').value || null,
        welcome_message: document.getElementById('welcome_message').value,
        leave_channel_id: document.getElementById('leave_channel_id').value || null,
        leave_message: document.getElementById('leave_message').value,
        log_channel_id: document.getElementById('log_channel_id').value || null,
        mod_log_channel_id: document.getElementById('mod_log_channel_id').value || null,
        ticket_category_id: document.getElementById('ticket_category_id').value || null,
        ticket_staff_role_id: document.getElementById('ticket_staff_role_id').value || null,
        ticket_log_channel_id: document.getElementById('ticket_log_channel_id').value || null,
        order_channel_id: document.getElementById('order_channel_id').value || null,
        antiraid_enabled: document.getElementById('antiraid_enabled').checked ? 1 : 0,
        antiraid_join_threshold: parseInt(document.getElementById('antiraid_join_threshold').value, 10) || 10,
        antiraid_join_window_ms: (parseInt(document.getElementById('antiraid_join_window_s').value, 10) || 10) * 1000,
        antiraid_min_account_age_days: parseInt(document.getElementById('antiraid_min_account_age_days').value, 10) || 0,
        antiraid_action: document.getElementById('antiraid_action').value,
        ticket_panel_title: document.getElementById('ticket_panel_title').value.trim(),
        ticket_panel_description: document.getElementById('ticket_panel_description').value.trim(),
        ticket_panel_button_label: document.getElementById('ticket_panel_button_label').value.trim(),
        ticket_panel_button_emoji: document.getElementById('ticket_panel_button_emoji').value.trim() || null,
        ticket_panel_color: document.getElementById('ticket_panel_color').value.trim(),
      };
      try {
        await api(`/api/guilds/${state.activeGuildId}/settings`, { method: 'POST', body: JSON.stringify(payload) });
        toast('Settings saved.');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    document.getElementById('save-honeypot').addEventListener('click', async (e) => {
      const btn = e.target;
      const payload = {
        enabled: document.getElementById('honeypot_enabled').checked,
        channel_id: document.getElementById('honeypot_channel_id').value || null,
        name: document.getElementById('honeypot_name').value.trim() || null,
      };
      btn.disabled = true;
      try {
        await api(`/api/guilds/${state.activeGuildId}/honeypot`, { method: 'POST', body: JSON.stringify(payload) });
        toast('Honeypot settings saved.');
        renderSettings();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
      }
    });
  }

  // ---------------- Tickets ----------------
  async function renderTickets() {
    mainEl.innerHTML = '<div class="loading">Loading tickets...</div>';
    let rows;
    try {
      rows = await api(`/api/guilds/${state.activeGuildId}/tickets`);
    } catch (err) {
      mainEl.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
      return;
    }
    mainEl.innerHTML = `
      <h1>Tickets</h1>
      <p class="hint">Tickets are opened by members via the panel and managed with buttons in Discord.</p>
      <div class="card">
        ${rows.length === 0 ? '<div class="empty-state">No tickets yet.</div>' : `
        <table>
          <thead><tr><th>#</th><th>User</th><th>Status</th><th>Claimed By</th><th>Opened</th></tr></thead>
          <tbody>
            ${rows.map((t) => `
              <tr>
                <td>${esc(t.ticket_number)}</td>
                <td>${esc(t.user_id)}</td>
                <td><span class="badge ${t.status === 'open' ? 'open' : 'closed'}">${esc(t.status)}</span></td>
                <td>${t.claimed_by ? esc(t.claimed_by) : '—'}</td>
                <td>${new Date(t.created_at).toLocaleString()}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    `;
  }

  // ---------------- Giveaways ----------------
  async function renderGiveaways() {
    mainEl.innerHTML = '<div class="loading">Loading giveaways...</div>';
    let rows;
    try {
      rows = await api(`/api/guilds/${state.activeGuildId}/giveaways`);
    } catch (err) {
      mainEl.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
      return;
    }
    const TEXT = [0, 5];
    mainEl.innerHTML = `
      <h1>Giveaways</h1>
      <p class="hint">Start a giveaway embed with an Enter button, or end one early.</p>

      <div class="card">
        <h3>Start a Giveaway</h3>
        <label>Channel</label>
        <select id="g-channel">${channelOptions(TEXT, null, false)}</select>
        <label>Prize</label>
        <input type="text" id="g-prize" placeholder="e.g. Discord Nitro" />
        <div class="grid-2">
          <div>
            <label>Winners</label>
            <input type="text" id="g-winners" value="1" />
          </div>
          <div>
            <label>Duration (minutes)</label>
            <input type="text" id="g-duration" value="60" />
          </div>
        </div>
        <div class="btn-row"><button id="g-start">Start Giveaway</button></div>
      </div>

      <div class="card">
        ${rows.length === 0 ? '<div class="empty-state">No giveaways yet.</div>' : `
        <table>
          <thead><tr><th>Prize</th><th>Winners</th><th>Entries</th><th>Status</th><th>Ends</th><th></th></tr></thead>
          <tbody>
            ${rows.map((g) => `
              <tr>
                <td>${esc(g.prize)}</td>
                <td>${esc(g.winner_count)}</td>
                <td>${esc(g.entries)}</td>
                <td><span class="badge ${g.ended ? 'ended' : 'active'}">${g.ended ? 'ended' : 'active'}</span></td>
                <td>${new Date(g.end_time).toLocaleString()}</td>
                <td>${!g.ended ? `<button class="danger end-giveaway" data-id="${g.id}">End</button>` : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    `;

    document.getElementById('g-start').addEventListener('click', async (e) => {
      const btn = e.target;
      const payload = {
        channel_id: document.getElementById('g-channel').value,
        prize: document.getElementById('g-prize').value.trim(),
        winner_count: parseInt(document.getElementById('g-winners').value, 10) || 1,
        duration_minutes: parseFloat(document.getElementById('g-duration').value),
      };
      if (!payload.channel_id || !payload.prize) return toast('Channel and prize are required.', 'error');
      btn.disabled = true;
      try {
        await api(`/api/guilds/${state.activeGuildId}/giveaways`, { method: 'POST', body: JSON.stringify(payload) });
        toast('Giveaway started!');
        renderGiveaways();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
      }
    });

    mainEl.querySelectorAll('.end-giveaway').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api(`/api/guilds/${state.activeGuildId}/giveaways/${btn.dataset.id}/end`, { method: 'POST' });
          toast('Giveaway ended.');
          renderGiveaways();
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });
  }

  // ---------------- Orders ----------------
  async function renderOrders() {
    mainEl.innerHTML = '<div class="loading">Loading orders...</div>';
    let rows;
    try {
      rows = await api(`/api/guilds/${state.activeGuildId}/orders`);
    } catch (err) {
      mainEl.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
      return;
    }
    mainEl.innerHTML = `
      <h1>Orders</h1>
      <p class="hint">Post an order embed manually, or configure the webhook in Settings for automatic order embeds from an external store.</p>

      <div class="card">
        <h3>Post an Order</h3>
        <div class="grid-2">
          <div>
            <label>Order Ref</label>
            <input type="text" id="o-ref" placeholder="#1042" />
          </div>
          <div>
            <label>Amount</label>
            <input type="text" id="o-amount" placeholder="$25.00" />
          </div>
        </div>
        <div class="grid-2">
          <div>
            <label>Product</label>
            <input type="text" id="o-product" placeholder="Premium Role" />
          </div>
          <div>
            <label>Customer</label>
            <input type="text" id="o-customer" placeholder="username" />
          </div>
        </div>
        <label>Status</label>
        <select id="o-status">
          <option value="received">Received</option>
          <option value="paid">Paid</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <div class="btn-row"><button id="o-post">Post Order Embed</button></div>
      </div>

      <div class="card">
        ${rows.length === 0 ? '<div class="empty-state">No orders yet.</div>' : `
        <table>
          <thead><tr><th>Ref</th><th>Product</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${rows.map((o) => `
              <tr>
                <td>${esc(o.order_ref)}</td>
                <td>${esc(o.product)}</td>
                <td>${esc(o.customer || '—')}</td>
                <td>${esc(o.amount || '—')}</td>
                <td>${esc(o.status)}</td>
                <td>${new Date(o.created_at).toLocaleString()}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    `;

    document.getElementById('o-post').addEventListener('click', async (e) => {
      const btn = e.target;
      const payload = {
        order_ref: document.getElementById('o-ref').value.trim(),
        product: document.getElementById('o-product').value.trim(),
        customer: document.getElementById('o-customer').value.trim(),
        amount: document.getElementById('o-amount').value.trim(),
        status: document.getElementById('o-status').value,
      };
      if (!payload.order_ref || !payload.product) return toast('Order ref and product are required.', 'error');
      btn.disabled = true;
      try {
        await api(`/api/guilds/${state.activeGuildId}/orders`, { method: 'POST', body: JSON.stringify(payload) });
        toast('Order embed posted!');
        renderOrders();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
      }
    });
  }

  // ---------------- Warnings ----------------
  async function renderWarnings() {
    mainEl.innerHTML = '<div class="loading">Loading warnings...</div>';
    let rows;
    try {
      rows = await api(`/api/guilds/${state.activeGuildId}/warnings`);
    } catch (err) {
      mainEl.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
      return;
    }
    mainEl.innerHTML = `
      <h1>Warnings</h1>
      <p class="hint">Issued with <code>/warn</code> in Discord. Use <code>/warnings clear</code> to remove them.</p>
      <div class="card">
        ${rows.length === 0 ? '<div class="empty-state">No warnings yet.</div>' : `
        <table>
          <thead><tr><th>User</th><th>Moderator</th><th>Reason</th><th>Date</th></tr></thead>
          <tbody>
            ${rows.map((w) => `
              <tr>
                <td>${esc(w.user_id)}</td>
                <td>${esc(w.moderator_id)}</td>
                <td>${esc(w.reason)}</td>
                <td>${new Date(w.created_at).toLocaleString()}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    `;
  }

  init();
})();
