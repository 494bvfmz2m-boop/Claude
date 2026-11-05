// H.O.L.O. interface, settings screen, calendars & connected apps, outbound drafts.
// Talks to the main page through window.Galaxy and a few CustomEvents:
//   jarvis:state  {state, detail}   (listening / thinking / speaking / error / null)
//   jarvis:answer {…/chat response} (drafts, intent "settings")
//   jarvis:word / jarvis:level      (pulses for the core)
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const api = async (path, body) => {
    const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const data = await res.json().catch(() => ({ ok: false, error: `Server returned ${res.status}` }));
    if (!res.ok && !data.error) data.error = `Server returned ${res.status}`;
    return data;
  };
  const say = (text, lang = 'en') => window.Galaxy && Galaxy.speak && Galaxy.speak(text, lang);

  // ------------------------------------------------------------ interface mode
  function applyUi() {
    document.body.classList.toggle('holo', store.get('galaxy-ui', 'holo') === 'holo');
    document.body.classList.toggle('no-scan', store.get('galaxy-scan', '1') === '0');
  }
  applyUi();

  // ------------------------------------------------------------ HUD
  const hud = document.createElement('div');
  hud.innerHTML = `
    <div id="holo-scan"></div>
    <div id="holo-frame"><i></i><i></i><i></i><i></i></div>
    <div id="holo-core" data-state="idle" title="Jarvis: click for settings">
      <svg viewBox="-70 -70 140 140" aria-hidden="true">
        <defs><radialGradient id="coreGrad"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#9bf6ff"/>
          <stop offset="1" stop-color="#1e8fb8" stop-opacity="0"/></radialGradient></defs>
        <circle class="ring r1" r="64"/>
        <circle class="ring r2" r="55"/>
        <g class="ticks">${Array.from({ length: 36 }, (_, i) => {
          const a = i * 10 * Math.PI / 180, r1 = i % 3 ? 45 : 42, r2 = 48;
          return `<line x1="${(Math.cos(a) * r1).toFixed(1)}" y1="${(Math.sin(a) * r1).toFixed(1)}" x2="${(Math.cos(a) * r2).toFixed(1)}" y2="${(Math.sin(a) * r2).toFixed(1)}"/>`;
        }).join('')}</g>
        <circle class="ring r3" r="38"/>
        <g class="arcs"><path d="M 0 -31 A 31 31 0 0 1 26.8 -15.5"/><path d="M 0 31 A 31 31 0 0 1 -26.8 15.5"/></g>
        <circle class="heart" r="24"/>
      </svg>
      <div class="label">J.A.R.V.I.S.</div>
      <div class="state">STANDBY</div>
    </div>
    <div id="holo-readout">
      <div class="clock">--:--</div>
      <div class="date dim">—</div>
      <div><span class="dim">SYS</span> ONLINE · <span class="nodes">0</span> <span class="dim">NODES</span></div>
      <div class="next dim">No calendar linked</div>
      <div class="mail dim"></div>
    </div>
    <button class="gear" type="button" title="Settings (or say “open settings”)" aria-label="Settings">⚙</button>`;
  document.body.append(...hud.children);

  const core = $('#holo-core'), coreState = $('.state', core), heart = $('.heart', core);
  const STATE_LABEL = { idle: 'STANDBY', listening: 'LISTENING', thinking: 'PROCESSING', speaking: 'SPEAKING', error: 'ATTENTION' };
  document.addEventListener('jarvis:state', e => {
    let s = (e.detail && e.detail.state) || 'idle';
    if (s === 'error' && /Click anywhere/.test((e.detail && e.detail.detail) || '')) s = 'idle';   // just the audio hint
    core.dataset.state = s;
    coreState.textContent = s === 'idle' && window.Galaxy && Galaxy.isHandsFree && Galaxy.isHandsFree() ? 'SAY “JARVIS”' : (STATE_LABEL[s] || 'STANDBY');
    if (s !== 'speaking' && s !== 'listening') heart.style.transform = '';
  });
  let pulseT = null;
  const pulse = amount => {
    heart.style.transform = `scale(${1 + amount})`;
    clearTimeout(pulseT); pulseT = setTimeout(() => { heart.style.transform = ''; }, 140);
  };
  document.addEventListener('jarvis:word', () => pulse(.28));
  document.addEventListener('jarvis:handsfree', e => {
    if (core.dataset.state === 'idle' || !core.dataset.state) coreState.textContent = e.detail.on ? 'SAY “JARVIS”' : 'STANDBY';
  });
  document.addEventListener('jarvis:level', e => pulse(Math.min(.5, (e.detail || 0) * 6)));
  core.addEventListener('click', () => openSettings());
  $('.gear').addEventListener('click', () => openSettings());

  const clock = $('#holo-readout .clock'), dateEl = $('#holo-readout .date'), nodesEl = $('#holo-readout .nodes'), nextEl = $('#holo-readout .next');
  setInterval(() => {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    dateEl.textContent = d.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    nodesEl.textContent = window.Galaxy ? Galaxy.nodes.length : 0;
  }, 1000);

  async function refreshNext() {
    try {
      const { events = [] } = await api('api/upcoming');
      if (!events.length) { nextEl.textContent = settings && settings.calendars.length ? 'Nothing scheduled' : 'No calendar linked'; return; }
      const e = events[0], s = new Date(e.start);
      const when = e.all_day ? s.toLocaleDateString([], { weekday: 'short' }) + ' · all day'
        : (s.toDateString() === new Date().toDateString() ? '' : s.toLocaleDateString([], { weekday: 'short' }) + ' ')
          + s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      nextEl.textContent = `NEXT ${when} · ${e.title}`;
      nextEl.title = events.map(x => `${new Date(x.start).toLocaleString()} ${x.title}`).join('\n');
    } catch (e) {}
  }

  // ------------------------------------------------------------ settings data
  let settings = null;
  async function loadSettings() {
    const data = await api('api/settings');
    if (data && data.apps) settings = data;
    // remember the browser's timezone once, so calendar times are right
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (settings && !settings.timezone && tz) {
      const r = await api('api/settings', { action: 'set_timezone', timezone: tz });
      if (r.settings) settings = r.settings;
    }
    return settings;
  }
  const mailEl = $('#holo-readout .mail');
  async function refreshMail() {
    try {
      const m = await api('api/mail');
      mailEl.textContent = !m.connected ? '' : m.error ? 'MAIL · offline' : `MAIL · ${m.unread} unread`;
      if (m.accounts) mailEl.title = Object.entries(m.accounts).map(([k, v]) => `${k}: ${typeof v === 'number' ? v + ' unread' : v}`).join('\n');
      mailEl.title = m.error || '';
      mailEl.style.color = m.unread ? 'var(--holo-2)' : '';
    } catch (e) {}
  }
  loadSettings().then(() => {
    refreshNext(); refreshMail();
    if (settings && settings.prefs && window.Galaxy && Galaxy.setLang) Galaxy.setLang(settings.prefs.language);
    maybeAutoBriefing();
    const h = decodeURIComponent(location.hash || '');
    if (h.startsWith('#settings-apps')) {
      history.replaceState(null, '', location.pathname);
      openSettings('apps').then(() => {
        const err = h.split('error=')[1];
        const box = document.createElement('p');
        box.className = 'msg ' + (err ? 'err' : 'ok');
        box.textContent = err ? 'Sign-in failed: ' + err : 'Signed in. Jarvis can use that account now.';
        body.prepend(box);
        if (!err) say('Signed in, sir. Another set of keys for the household.');
      });
    }
  });
  setInterval(refreshNext, 5 * 60 * 1000);
  setInterval(refreshMail, 2 * 60 * 1000);

  // ------------------------------------------------------------ settings window
  const win = document.createElement('div');
  win.id = 'settings'; win.hidden = true;
  win.innerHTML = `
    <div class="win" role="dialog" aria-modal="true" aria-label="Settings">
      <header><h2>SYSTEM SETTINGS</h2><span class="sub">J.A.R.V.I.S. configuration</span>
        <button class="x" type="button" aria-label="Close settings">×</button></header>
      <nav>
        <button data-tab="interface">Interface</button>
        <button data-tab="calendars">Calendars</button>
        <button data-tab="apps">Connected apps</button>
        <button data-tab="voice">Voice</button>
        <button data-tab="assistant">Assistant</button>
      </nav>
      <div class="body"></div>
    </div>`;
  document.body.appendChild(win);
  const body = $('.body', win);
  let tab = 'interface', openApp = null, appFilter = '';
  win.addEventListener('click', e => { if (e.target === win) closeSettings(); });
  $('.x', win).onclick = closeSettings;
  win.querySelectorAll('nav button').forEach(b => b.onclick = () => { tab = b.dataset.tab; openApp = null; render(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !win.hidden) { e.stopImmediatePropagation(); closeSettings(); } }, true);

  async function openSettings(which) {
    if (which) tab = which;
    win.hidden = false;
    render();
    await loadSettings();
    render();
  }
  function closeSettings() { win.hidden = true; }

  function render() {
    win.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'interface') renderInterface();
    else if (tab === 'calendars') renderCalendars();
    else if (tab === 'apps') renderApps();
    else if (tab === 'voice') renderVoice();
    else renderAssistant();
  }

  function renderInterface() {
    const ui = store.get('galaxy-ui', 'holo');
    body.innerHTML = `
      <h3>INTERFACE</h3><p class="help">Choose how Jarvis presents himself.</p>
      <div class="choice">
        <label><input type="radio" name="ui" value="holo" ${ui === 'holo' ? 'checked' : ''}><b>H.O.L.O.</b>
          <span>Holographic HUD: reactive core, live readout, scanlines.</span></label>
        <label><input type="radio" name="ui" value="classic" ${ui !== 'holo' ? 'checked' : ''}><b>CLASSIC</b>
          <span>The original calm galaxy, nothing in the way.</span></label>
      </div>
      <label class="check"><input type="checkbox" id="opt-scan" ${store.get('galaxy-scan', '1') !== '0' ? 'checked' : ''}> Scanlines and sweep</label>
      <h4>Performance</h4>
      <div class="choice">${[['auto', 'AUTO', 'Measures your device and lowers detail if it stutters.'],
        ['high', 'HIGH', 'Full glow and starfield. For a decent graphics card.'],
        ['fast', 'FAST', 'Lighter glow and fewer stars. Smooth on laptops and phones.']].map(([v, b, d]) =>
        `<label><input type="radio" name="q" value="${v}" ${(Galaxy.getQuality ? Galaxy.getQuality() : 'auto') === v ? 'checked' : ''}><b>${b}</b><span>${d}</span></label>`).join('')}</div>
      <h4>Shortcuts</h4>
      <p class="help">Say or type <b>“open settings”</b> (or “open instellingen”) any time · <b>/</b> focuses the ask bar ·
        <b>Esc</b> closes this window · say <b>“send it”</b> to approve a draft.</p>`;
    body.querySelectorAll('input[name=ui]').forEach(r => r.onchange = () => { store.set('galaxy-ui', r.value); applyUi(); });
    $('#opt-scan', body).onchange = e => { store.set('galaxy-scan', e.target.checked ? '1' : '0'); applyUi(); };
    body.querySelectorAll('input[name=q]').forEach(r => r.onchange = () => Galaxy.setQuality && Galaxy.setQuality(r.value));
  }

  function renderCalendars() {
    const s = settings;
    if (!s) { body.innerHTML = '<p class="help">Loading…</p>'; return; }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    body.innerHTML = `
      <h3>CALENDARS</h3>
      <p class="help">Jarvis reads your calendars through their private <b>iCal link</b> (read-only). Ask him
        “what's on today?”, “am I free Thursday afternoon?” or “what's my week look like?”.</p>
      <div class="list" id="cal-list">${s.calendars.map(c => `
        <div class="item" style="color:${esc(c.color)}"><span class="dot"></span>
          <div class="grow" style="color:#eafcff"><b>${esc(c.name)}</b><small>${esc(c.url)}</small></div>
          <button class="hbtn danger" data-rm="${esc(c.id)}">Remove</button></div>`).join('') || '<p class="help">No calendars yet.</p>'}</div>
      <h4>Add a calendar</h4>
      <label class="f">Name</label><input type="text" id="cal-name" placeholder="Work, Personal, …">
      <label class="f">iCal link</label><input type="url" id="cal-url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics">
      <div class="row"><button class="hbtn primary" id="cal-add">Connect calendar</button></div>
      <div class="msg" id="cal-msg"></div>
      <details class="help"><summary>Where do I find the iCal link?</summary>
        <p><b>Google Calendar</b> (computer): Settings → click your calendar under “Settings for my calendars” →
          “Integrate calendar” → copy <i>Secret address in iCal format</i>.</p>
        <p><b>Outlook / Microsoft 365</b>: Settings → Calendar → Shared calendars → Publish a calendar → choose the
          calendar and “Can view all details” → Publish → copy the <i>ICS</i> link.</p>
        <p><b>iCloud</b>: Calendar app → right-click the calendar → Share Calendar → tick <i>Public Calendar</i> → copy the link
          (webcal:// links are fine).</p>
        <p>Keep these links private: anyone with one can read that calendar.</p></details>
      <h4>Timezone</h4>
      <p class="help">Times are shown in <b>${esc(s.timezone || tz)}</b>${s.timezone && s.timezone !== tz ?
        ` (this device is in ${esc(tz)}) <button class="hbtn" id="tz-fix">Use ${esc(tz)}</button>` : ''}.</p>
      <h4>Coming up</h4><div class="list events" id="cal-upcoming"><p class="help">…</p></div>`;
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
      const r = await api('api/settings', { action: 'remove_calendar', id: b.dataset.rm });
      if (r.settings) settings = r.settings; render(); refreshNext();
    });
    const fix = $('#tz-fix', body);
    if (fix) fix.onclick = async () => { const r = await api('api/settings', { action: 'set_timezone', timezone: tz }); if (r.settings) settings = r.settings; render(); };
    $('#cal-add', body).onclick = async () => {
      const msg = $('#cal-msg', body), btn = $('#cal-add', body);
      btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Reading the calendar…';
      const r = await api('api/settings', { action: 'add_calendar', name: $('#cal-name', body).value, url: $('#cal-url', body).value });
      btn.disabled = false;
      if (r.settings) settings = r.settings;
      if (!r.ok) { msg.className = 'msg err'; msg.textContent = r.error; return; }
      render(); refreshNext();
      say('Calendar connected, sir. I shall keep an eye on your appointments.');
    };
    api('api/upcoming').then(({ events = [], errors = [] }) => {
      const box = $('#cal-upcoming', body);
      if (!box) return;
      box.innerHTML = events.map(e => {
        const st = new Date(e.start), en = new Date(e.end);
        const when = e.all_day ? st.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' · all day'
          : st.toLocaleDateString([], { weekday: 'short', day: 'numeric' }) + ' ' + st.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            + '–' + en.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `<div class="item" style="color:${esc(e.color)}"><span class="dot"></span><time>${esc(when)}</time>
          <div class="grow" style="color:#eafcff">${esc(e.title)}<small>${esc([e.location, e.calendar].filter(Boolean).join(' · '))}</small></div></div>`;
      }).join('') + errors.map(x => `<p class="msg err">${esc(x)}</p>`).join('') || '<p class="help">Nothing in the next two weeks.</p>';
    });
  }

  function renderApps() {
    const s = settings;
    if (!s) { body.innerHTML = '<p class="help">Loading…</p>'; return; }
    const cat = s.catalogue;
    const order = ['Mail', 'Chat & messaging', 'Notifications', 'Tasks & projects', 'Documents', 'Calendars & suites', 'Smart home', 'Info', 'Automation'];
    const groupsOf = {};
    Object.keys(cat).forEach(k => {
      // spare mailboxes only show once the one before is connected
      const m = k.match(/^email_(\d)$/);
      if (m && !(s.apps[+m[1] === 2 ? 'email' : `email_${m[1] - 1}`] || {}).connected && !s.apps[k].connected) return;
      (groupsOf[cat[k].category || 'Other'] = groupsOf[cat[k].category || 'Other'] || []).push(k);
    });
    const connectedCount = Object.keys(cat).filter(k => s.apps[k].connected).length;
    const card = k => {
      const name = k.startsWith('email') && s.apps[k].fields.name ? `${cat[k].label} · ${s.apps[k].fields.name}` : cat[k].label;
      return `<button class="app ${openApp === k ? 'on' : ''}" data-app="${k}"><div class="ic">${esc(cat[k].icon)}</div>
        <b>${esc(name)}</b><span class="badge ${s.apps[k].connected ? 'on' : ''}">${s.apps[k].connected ? 'Connected' : 'Not connected'}</span></button>`;
    };
    body.innerHTML = `
      <h3>CONNECTED APPS</h3>
      <p class="help">${connectedCount} of ${Object.keys(cat).length} connected. Jarvis drafts emails, messages, tasks, events
        and documents for you; nothing leaves until you press <b>Send</b> (or say “send it”). Passwords and tokens stay on your server.</p>
      <input type="text" id="app-filter" placeholder="Filter apps…" style="margin:6px 0 4px" value="${esc(appFilter)}">
      ${[...order, ...Object.keys(groupsOf).filter(g => !order.includes(g))].filter(g => groupsOf[g]).map(g => {
        const keys = groupsOf[g].filter(k => !appFilter || (cat[k].label + ' ' + g).toLowerCase().includes(appFilter.toLowerCase()));
        return keys.length ? `<h4>${esc(g)}</h4><div class="apps">${keys.map(card).join('')}</div>` : '';
      }).join('')}
      <div id="appform"></div>`;
    const filt = $('#app-filter', body);
    filt.oninput = () => { appFilter = filt.value; const pos = filt.selectionStart; renderApps(); const f2 = $('#app-filter', body); f2.focus(); f2.setSelectionRange(pos, pos); };
    body.querySelectorAll('[data-app]').forEach(b => b.onclick = () => {
      openApp = openApp === b.dataset.app ? null : b.dataset.app; renderApps();
      if (openApp) setTimeout(() => $('#appform', body).scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
    });
    if (openApp) renderAppForm(openApp);
  }

  function renderAppForm(key) {
    const spec = settings.catalogue[key], st = settings.apps[key], box = $('#appform', body);
    box.className = 'appform holo-box';
    box.innerHTML = `
      <h3>${esc(spec.label.toUpperCase())}</h3><p class="help">${esc(spec.help)}</p>
      ${spec.fields.map(f => `<label class="f">${esc(f.label)}${f.required ? '' : ' <span style="opacity:.6">(optional)</span>'}</label>
        <input type="${f.secret ? 'password' : 'text'}" data-f="${f.key}" autocomplete="off"
          value="${f.secret ? '' : esc(st.fields[f.key])}" placeholder="${esc(f.secret && st.fields[f.key] ? 'saved ' + st.fields[f.key] + ' (leave empty to keep)' : (f.placeholder || ''))}">`).join('')}
      ${spec.oauth ? `<p class="help">Redirect URI to register: <code style="user-select:all">${esc(location.origin)}/oauth/${key}/callback</code></p>` : ''}
      <div class="row"><button class="hbtn primary" data-act="save">Save</button>
        ${spec.oauth ? `<button class="hbtn" data-act="signin" ${st.fields.client_id ? '' : 'disabled'}>${st.connected ? 'Sign in again' : 'Sign in'}</button>` : ''}
        <button class="hbtn" data-act="test" ${st.connected ? '' : 'disabled'}>Test</button>
        ${st.connected ? '<button class="hbtn danger" data-act="remove">Disconnect</button>' : ''}</div>
      <div class="msg"></div>`;
    const signin = box.querySelector('[data-act=signin]');
    if (signin) signin.onclick = () => { location.href = `oauth/${key}/start`; };
    const msg = $('.msg', box);
    const busy = (on, text) => { box.querySelectorAll('button').forEach(b => b.disabled = on); msg.className = 'msg'; msg.textContent = text || ''; };
    const done = r => {
      if (r.settings) settings = r.settings;
      const keepOpen = openApp; renderApps(); openApp = keepOpen;
      const m = $('#appform .msg', body);
      if (m) { m.className = 'msg ' + (r.ok ? 'ok' : 'err'); m.textContent = r.ok ? r.message : r.error; }
    };
    box.querySelector('[data-act=save]').onclick = async () => {
      const fields = {};
      box.querySelectorAll('[data-f]').forEach(i => { fields[i.dataset.f] = i.value; });
      busy(true, 'Saving…');
      const r = await api('api/settings', { action: 'save_app', app: key, fields });
      done(r);
      if (r.ok && r.settings.apps[key].connected) say(`${spec.label} connected, sir. Do try not to make me send anything regrettable.`);
    };
    const test = box.querySelector('[data-act=test]');
    if (test) test.onclick = async () => { busy(true, 'Testing…'); done(await api('api/settings', { action: 'test_app', app: key })); };
    const rm = box.querySelector('[data-act=remove]');
    if (rm) rm.onclick = async () => { busy(true); done(await api('api/settings', { action: 'remove_app', app: key })); };
  }

  function renderVoice() {
    const mode = store.get('galaxy-voice-mode', 'browser');
    const voices = (window.speechSynthesis && speechSynthesis.getVoices && speechSynthesis.getVoices()) || [];
    const chosen = store.get('galaxy-voice-name', '');
    body.innerHTML = `
      <h3>VOICE</h3>
      <h4>Listening (🎙)</h4>
      <div class="choice">
        <label><input type="radio" name="vm" value="browser" ${mode !== 'record' ? 'checked' : ''}><b>BROWSER</b>
          <span>The browser's own speech recognition (Chrome, Edge). Switches to the backup by itself if it fails.</span></label>
        <label><input type="radio" name="vm" value="record" ${mode === 'record' ? 'checked' : ''}><b>RECORD + GEMINI</b>
          <span>Records here and lets Gemini transcribe. Works in every browser; uses a little Gemini credit.</span></label>
      </div>
      <h4>Hands-free</h4>
      <label class="check"><input type="checkbox" id="opt-hf" ${Galaxy.isHandsFree && Galaxy.isHandsFree() ? 'checked' : ''}>
        Listen for “Jarvis” (also the 👂 button)</label>
      <p class="help">Say <b>“Jarvis, what's on today?”</b> in one go, or “Jarvis”, wait for the chime, then speak.
        This uses the browser's own free speech recognition (Chrome or Edge), never your API key. While it's on,
        the browser streams microphone audio to its speech service (Google for Chrome, Microsoft for Edge).
        Jarvis pauses listening while he answers.</p>
      <h4>Speaking</h4>
      <label class="f">Jarvis's voice (English)</label>
      <select id="voice-pick"><option value="">Automatic (British English preferred)</option>
        ${voices.filter(v => /^en/i.test(v.lang)).map(v => `<option value="${esc(v.name)}" ${v.name === chosen ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select>
      <div class="row"><button class="hbtn" id="voice-try">Test voice</button></div>
      <p class="help">Answers in other languages use a matching voice automatically. The 🔊 button in the ask bar mutes him.</p>`;
    body.querySelectorAll('input[name=vm]').forEach(r => r.onchange = () => Galaxy.setVoiceMode && Galaxy.setVoiceMode(r.value));
    $('#opt-hf', body).onchange = e => Galaxy.setHandsFree && Galaxy.setHandsFree(e.target.checked);
    $('#voice-pick', body).onchange = e => { store.set('galaxy-voice-name', e.target.value); Galaxy.refreshVoice && Galaxy.refreshVoice(); };
    $('#voice-try', body).onclick = () => say('Good evening, sir. This is how I sound at present.');
  }

  // ------------------------------------------------------------ drafts
  const DRAFT_FIELDS = {
    send_email: [['to', 'To', 'input'], ['cc', 'Cc', 'input'], ['subject', 'Subject', 'input'], ['body', 'Message', 'textarea']],
    send_chat: [['to', 'To', 'input'], ['text', 'Message', 'textarea']],
    create_document: [['title', 'Title', 'input'], ['content', 'Content', 'textarea']],
    create_task: [['title', 'Task', 'input'], ['due', 'Due', 'input'], ['notes', 'Notes', 'textarea']],
    create_event: [['title', 'Event', 'input'], ['start', 'Starts', 'input'], ['end', 'Ends', 'input'], ['location', 'Where', 'input'], ['notes', 'Notes', 'textarea']],
    home_control: [['action', 'Action', 'input'], ['entity_id', 'Device', 'input'], ['data', 'Extra (JSON)', 'input']],
    webhook: [['event', 'Event', 'input'], ['data', 'Data (JSON)', 'textarea']],
  };
  const OP_LABEL = { send_email: 'Email', send_chat: 'Message', create_document: 'Document', create_task: 'Task',
    create_event: 'Calendar event', home_control: 'Smart home', webhook: 'Webhook' };
  const OPTIONAL = new Set(['cc', 'to', 'due', 'end', 'location', 'notes', 'data']);
  let pending = [];

  function renderDrafts(drafts) {
    const answer = $('#answer');
    answer.querySelectorAll('.drafts').forEach(d => d.remove());
    pending = [];
    answer.classList.toggle('has-drafts', !!drafts.length);
    if (!drafts.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'drafts';
    drafts.forEach(d => {
      const card = document.createElement('div');
      card.className = 'draft';
      card.innerHTML = `<div class="dh">${esc(OP_LABEL[d.op] || d.op)} · ${esc(d.label)}<span class="await">Draft · awaiting approval</span></div>
        ${DRAFT_FIELDS[d.op].filter(([k]) => !(OPTIONAL.has(k) && !d.fields[k] && !(k === 'to' && d.op === 'send_email'))).map(([k, label, tag]) => `<label>${label}</label>${tag === 'input'
          ? `<input data-k="${k}" value="${esc(d.fields[k])}">` : `<textarea data-k="${k}">${esc(d.fields[k])}</textarea>`}`).join('')}
        <div class="row"><button class="hbtn primary" data-send>${d.op === 'home_control' ? 'Run' : d.op.startsWith('create') ? 'Create' : 'Send'}</button><button class="hbtn" data-drop>Discard</button></div>
        <div class="msg"></div>`;
      const msg = $('.msg', card), status = $('.dh span', card);
      const entry = { d, card, sent: false };
      const send = async () => {
        if (entry.sent) return;
        const fields = {};
        card.querySelectorAll('[data-k]').forEach(i => { fields[i.dataset.k] = i.value; });
        card.querySelectorAll('button').forEach(b => b.disabled = true);
        msg.className = 'msg'; msg.textContent = 'Sending…';
        const r = await api('api/outbox/send', { id: d.id, fields });
        if (r.ok) {
          entry.sent = true; card.classList.add('sent');
          status.className = 'done'; status.textContent = '✓ Sent';
          msg.className = 'msg ok'; msg.textContent = r.message;
          card.querySelectorAll('input, textarea').forEach(i => i.disabled = true);
          $('.row', card).remove();
          say(['Sent, sir.', 'Dispatched, sir.', 'Done. It is on its way, sir.'][Math.floor(Math.random() * 3)]);
        } else {
          card.querySelectorAll('button').forEach(b => b.disabled = false);
          msg.className = 'msg err'; msg.textContent = r.error;
        }
      };
      $('[data-send]', card).onclick = send;
      $('[data-drop]', card).onclick = async () => {
        await api('api/outbox/discard', { id: d.id });
        entry.sent = true; card.remove();
        if (!wrap.children.length) { wrap.remove(); answer.classList.remove('has-drafts'); }
      };
      entry.send = send;
      pending.push(entry);
      wrap.appendChild(card);
    });
    const undo = $('#a-undo', answer);
    answer.insertBefore(wrap, undo || null);
  }

  document.addEventListener('jarvis:answer', e => {
    const data = e.detail || {};
    renderDrafts(data.drafts || []);
    if (data.intent === 'settings') openSettings(data.settings_tab || (data.drafts ? 'apps' : undefined));
  });

  // ------------------------------------------------------------ voice/typed commands handled here
  const OPEN = /^\s*(?:(?:hey|ok|okay)\s+)?(?:jarvis[,!.\s]+)?(?:please\s+|can you\s+|could you\s+)?(?:open|show|go to|bring up|pull up|launch|open de|toon)\s+(?:the\s+|my\s+|de\s+|mijn\s+)?(settings|preferences|setup|config(?:uration)?|instellingen|calendar settings|calendars?|agenda('?s)?|apps?|connected apps|connections|koppelingen|interface|voice settings|voice)\b/i;
  const CLOSE = /^\s*(?:jarvis[,!.\s]+)?(?:close|hide|exit|sluit)\s+(?:the\s+|de\s+)?(settings|instellingen|preferences)\b/i;
  const SEND = /^\s*(?:jarvis[,!.\s]+)?(?:yes[,!.\s]*|yeah[,!.\s]*|ja[,!.\s]*)?(?:please\s+)?(send(?:\s+(?:it|that|this|the\s+(?:email|e-mail|mail|message|draft)))?|go ahead|do it|verstuur(?:\s+(?:het|maar|hem))?|verzend(?:\s+het)?|stuur(?:\s+(?:het|maar|hem))*(?:\s+op)?)\s*(?:now|nu)?[.!]*\s*$/i;
  const DROP = /^\s*(?:jarvis[,!.\s]+)?(cancel|discard|don'?t send|never mind|nevermind|niet versturen|annuleer|laat maar)\b/i;

  // ============================================================ ASSISTANT TAB
  function renderAssistant() {
    const s = settings;
    if (!s) { body.innerHTML = '<p class="help">Loading…</p>'; return; }
    const p = s.prefs, u = s.usage || {};
    const radio = (name, value, cur, b, d) => `<label><input type="radio" name="${name}" value="${value}" ${cur === value ? 'checked' : ''}><b>${b}</b><span>${d}</span></label>`;
    const msgApps = Object.keys(s.catalogue).filter(k => s.apps[k].connected && (s.catalogue[k].caps || []).includes('message'));
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    body.innerHTML = `
      <h3>ASSISTANT</h3>
      <h4>Brain (cost)</h4>
      <div class="choice">${radio('model', 'lite', p.model, 'LITE', 'Cheapest Gemini model. Plenty for everyday questions. (default)')}
        ${radio('model', 'flash', p.model, 'FLASH', 'Smarter, several times the price. For heavy writing and reasoning.')}</div>
      <p class="help">Today: <b>${u.requests || 0}</b> AI requests · <b>${(u.input || 0).toLocaleString()}</b> tokens in ·
        <b>${(u.output || 0).toLocaleString()}</b> out${s.model ? ` · model ${esc(s.model)}` : ''}.
        Free: status report, “remember that…”, hands-free listening, reminders firing, tasks list display.</p>
      <h4>Personality</h4>
      <div class="choice">${radio('pers', 'serious', p.personality, 'SERIOUS', 'Brief and businesslike.')}
        ${radio('pers', 'butler', p.personality, 'BUTLER', 'Dry wit, impeccable manners. (default)')}
        ${radio('pers', 'sarcastic', p.personality, 'SARCASTIC', 'Teasing. Affectionately unbearable.')}</div>
      <h4>Language</h4>
      <div class="choice">${radio('lang', 'auto', p.language, 'AUTO', 'Answers in the language you use.')}
        ${radio('lang', 'en', p.language, 'ENGLISH', 'British butler, listens in English.')}
        ${radio('lang', 'nl', p.language, 'NEDERLANDS', '“Meneer”. Luistert en spreekt Nederlands.')}</div>
      <h4>Daily briefing</h4>
      <label class="check"><input type="checkbox" data-p="briefing_auto" ${p.briefing_auto ? 'checked' : ''}> Brief me automatically on my first visit each day</label>
      <div class="row"><button class="hbtn" id="brief-now">Brief me now</button></div>
      <h4>Weekly review</h4>
      <label class="check"><input type="checkbox" data-p="review_enabled" ${p.review_enabled ? 'checked' : ''}> Write a weekly review note every</label>
      <div class="row"><select id="rev-day" style="width:auto">${days.map((d, i) => `<option value="${i}" ${p.review_day === i ? 'selected' : ''}>${d}</option>`).join('')}</select>
        <span>at</span><select id="rev-hour" style="width:auto">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${p.review_hour === h ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select>
        <button class="hbtn" id="rev-now">Write one now</button></div>
      <h4>Reminders reach my phone via</h4>
      <select id="rem-app"><option value="auto" ${p.reminder_app === 'auto' ? 'selected' : ''}>Automatic (first connected message app)</option>
        <option value="none" ${p.reminder_app === 'none' ? 'selected' : ''}>Only in the browser</option>
        ${msgApps.map(k => `<option value="${k}" ${p.reminder_app === k ? 'selected' : ''}>${esc(s.catalogue[k].label)}</option>`).join('')}</select>
      <p class="help">Reminders also pop up (and are spoken) in any open Jarvis tab. Tip: connect ntfy or Pushover for free phone notifications.</p>
      <h4>Search & smart home</h4>
      <label class="check"><input type="checkbox" data-p="smart_search" ${p.smart_search ? 'checked' : ''}> Search by meaning (Gemini embeddings: a tiny cost per question)</label>
      <label class="check"><input type="checkbox" data-p="home_instant" ${p.home_instant ? 'checked' : ''}> Run smart-home actions instantly (locks, alarms and garage doors always ask)</label>
      <div class="msg" id="pref-msg"></div>`;
    const save = async patch => {
      const r = await api('api/settings', { action: 'set_prefs', prefs: patch });
      if (r.settings) settings = r.settings;
      if (patch.language !== undefined && Galaxy.setLang) Galaxy.setLang(patch.language);
      const m = $('#pref-msg', body); if (m) { m.className = 'msg ' + (r.ok ? 'ok' : 'err'); m.textContent = r.ok ? 'Saved.' : r.error; }
    };
    body.querySelectorAll('input[name=model]').forEach(x => x.onchange = () => save({ model: x.value }));
    body.querySelectorAll('input[name=pers]').forEach(x => x.onchange = () => save({ personality: x.value }));
    body.querySelectorAll('input[name=lang]').forEach(x => x.onchange = () => save({ language: x.value }));
    body.querySelectorAll('[data-p]').forEach(x => x.onchange = () => save({ [x.dataset.p]: x.checked }));
    $('#rev-day', body).onchange = e => save({ review_day: +e.target.value });
    $('#rev-hour', body).onchange = e => save({ review_hour: +e.target.value });
    $('#rem-app', body).onchange = e => save({ reminder_app: e.target.value });
    $('#brief-now', body).onclick = () => { closeSettings(); briefMe(); };
    $('#rev-now', body).onclick = async e => {
      e.target.disabled = true; e.target.textContent = 'Writing…';
      const r = await api('api/review', {});
      e.target.disabled = false; e.target.textContent = 'Write one now';
      const m = $('#pref-msg', body);
      if (r.error) { m.className = 'msg err'; m.textContent = r.error; return; }
      m.className = 'msg ok'; m.textContent = `“${r.title}” is in your notes.`;
      Galaxy.reloadGraph(r.graph);
    };
  }

  // ============================================================ BRIEFING (one AI call) & STATUS REPORT (free)
  const isNl = () => settings && settings.prefs && settings.prefs.language === 'nl';
  async function briefMe() {
    Galaxy.setStatus('thinking', isNl() ? '(briefing)' : '(preparing your briefing)');
    Galaxy.showAnswer(isNl() ? 'Briefing' : 'Briefing', '…');
    const r = await api('api/briefing', {});
    Galaxy.setStatus(null);
    if (r.error) { Galaxy.showAnswer('Briefing', r.error); return; }
    Galaxy.showAnswer(isNl() ? 'Dagbriefing' : 'Your briefing', r.text);
    $('#a-text').style.whiteSpace = 'pre-line';
    say(r.speech || r.text.split('\n').slice(0, 3).join(' '), isNl() ? 'nl' : 'en');
  }
  function maybeAutoBriefing() {
    if (!settings || !settings.prefs || !settings.prefs.briefing_auto) return;
    const today = new Date().toISOString().slice(0, 10);
    if (store.get('galaxy-briefed', '') === today || new Date().getHours() < 5) return;
    const hasSources = settings.calendars.length || Object.values(settings.apps).some(a => a.connected);
    if (!hasSources) return;
    store.set('galaxy-briefed', today);
    setTimeout(briefMe, 3200);          // after the opening glide; it's spoken on the first click
  }
  async function statusReport() {
    const st = await api('api/status');
    const nl = isNl();
    const unread = Object.values(st.unread || {}).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
    const next = st.next_event ? `${new Date(st.next_event.start).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}: ${st.next_event.title}` : (nl ? 'niets gepland' : 'nothing scheduled');
    const lines = nl ? [
      `Alle systemen operationeel, meneer.`,
      `${st.notes} notities in ${st.folders} mappen · ${st.open_tasks} open taken · ${st.reminders} herinneringen.`,
      `${unread} ongelezen e-mails · volgende afspraak: ${next}.`,
      `${st.apps} apps gekoppeld · draait al ${st.uptime_h} uur · opslag: ${st.storage} · AI vandaag: ${st.usage.requests} verzoeken.`]
      : [
      `All systems nominal, sir${st.open_tasks > 10 ? ', though your task list is developing ambitions of its own' : ''}.`,
      `${st.notes} notes across ${st.folders} folders · ${st.open_tasks} open tasks · ${st.reminders} reminders pending.`,
      `${unread} unread emails · next appointment: ${next}.`,
      `${st.apps} apps connected · up ${st.uptime_h} h · storage: ${st.storage} · AI today: ${st.usage.requests} requests.`];
    Galaxy.showAnswer(nl ? 'Statusrapport' : 'Status report', lines.join('\n'));
    $('#a-text').style.whiteSpace = 'pre-line';
    say(nl ? `Alle systemen operationeel. ${st.open_tasks} open taken en ${unread} ongelezen e-mails.`
      : `All systems nominal, sir. ${st.open_tasks} open tasks and ${unread} unread emails.`, nl ? 'nl' : 'en');
  }

  // ============================================================ REMINDERS & NOTICES (polls the server; no AI)
  let alertsAfter = Date.now() / 1000;
  async function pollAlerts() {
    try {
      const r = await api(`api/alerts?after=${alertsAfter}`);
      alertsAfter = r.now || alertsAfter;
      (r.alerts || []).forEach(a => {
        Galaxy.chime(true);
        const nl = isNl();
        const head = a.kind === 'reminder' ? (nl ? '⏰ Herinnering' : '⏰ Reminder') : (nl ? 'Mededeling' : 'Notice');
        Galaxy.showAnswer(head, a.text);
        say(a.kind === 'reminder' ? (nl ? `Meneer, een herinnering: ${a.text}` : `Sir, a reminder: ${a.text}`) : a.text, nl ? 'nl' : 'en');
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Jarvis', { body: a.text });
      });
    } catch (e) {}
  }
  setInterval(pollAlerts, 20000);
  document.addEventListener('jarvis:answer', e => {
    const d = e.detail || {};
    if (d.done && d.done.length) {
      const a = $('#a-text');
      a.insertAdjacentHTML('beforeend', `<div class="msg ok" style="margin-top:8px">✓ ${d.done.map(esc).join(' · ')}</div>`);
      if (d.done.some(x => /Reminder set|Herinnering/.test(x)) && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    }
  });

  // ============================================================ TIMELINE
  const tl = document.createElement('div');
  tl.id = 'timeline'; tl.hidden = true;
  tl.innerHTML = `<button class="hbtn" id="tl-play" title="Watch the galaxy grow">▶</button>
    <input type="range" id="tl-range" min="0" max="1000" value="1000"><span id="tl-date"></span>
    <button class="hbtn" id="tl-close" title="Close timeline">×</button>`;
  document.body.appendChild(tl);
  const tlRange = $('#tl-range', tl), tlDate = $('#tl-date', tl);
  let tlMin = 0, tlMax = 0, tlTimer = null;
  function tlApply() {
    const t = tlMin + (tlMax - tlMin) * (+tlRange.value / 1000);
    Galaxy.setTimeCut(+tlRange.value >= 1000 ? null : t);
    const shown = Galaxy.nodes.filter(n => (n.t || 0) <= t).length;
    tlDate.textContent = `${new Date(t * 1000).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} · ${shown} notes`;
  }
  function openTimeline() {
    const ts = Galaxy.nodes.map(n => n.t || 0).filter(Boolean);
    if (!ts.length) return;
    tlMin = Math.min(...ts) - 1; tlMax = Math.max(...ts) + 1;
    tl.hidden = false; tlRange.value = 1000; tlApply();
  }
  function closeTimeline() { clearInterval(tlTimer); tlTimer = null; tl.hidden = true; Galaxy.setTimeCut(null); $('#tl-play', tl).textContent = '▶'; }
  tlRange.oninput = tlApply;
  $('#tl-close', tl).onclick = closeTimeline;
  $('#tl-play', tl).onclick = () => {
    if (tlTimer) { clearInterval(tlTimer); tlTimer = null; $('#tl-play', tl).textContent = '▶'; return; }
    if (+tlRange.value >= 1000) tlRange.value = 0;
    $('#tl-play', tl).textContent = '❚❚';
    tlTimer = setInterval(() => {
      tlRange.value = Math.min(1000, +tlRange.value + 8); tlApply();
      if (+tlRange.value >= 1000) { clearInterval(tlTimer); tlTimer = null; $('#tl-play', tl).textContent = '▶'; }
    }, 60);
  };

  // ============================================================ TOPIC CLUSTERS (labels in 3D)
  let clusterSprites = [], clusterTimer = null;
  function communities() {
    // label propagation over the direct-mention links (cheap, deterministic enough)
    const N = Galaxy.nodes.length, label = Galaxy.nodes.map((_, i) => i);
    const adj = Galaxy.nodes.map(() => []);
    Galaxy.Graph.graphData().links.forEach(l => {
      if (l.type !== 'mention') return;
      const a = l.source.id ?? l.source, b = l.target.id ?? l.target;
      adj[a].push(b); adj[b].push(a);
    });
    for (let it = 0; it < 12; it++) {
      let changed = false;
      for (let i = 0; i < N; i++) {
        if (!adj[i].length) continue;
        const c = {}; adj[i].forEach(j => { c[label[j]] = (c[label[j]] || 0) + 1; });
        const best = +Object.keys(c).sort((x, y) => c[y] - c[x] || x - y)[0];
        if (best !== label[i] && c[best] > (c[label[i]] || 0)) { label[i] = best; changed = true; }
      }
      if (!changed) break;
    }
    const groups = {};
    label.forEach((l, i) => (groups[l] = groups[l] || []).push(i));
    let out = Object.values(groups).filter(g => g.length >= 3);
    if (out.length < 2) {                     // a dense graph collapses into one blob: fall back to folders
      const byFolder = {};
      Galaxy.nodes.forEach((n, i) => (byFolder[n.group] = byFolder[n.group] || []).push(i));
      out = Object.values(byFolder).filter(g => g.length >= 2);
    }
    return out;
  }
  function textSprite(text) {
    const c = document.createElement('canvas'), g = c.getContext('2d'), font = '600 44px Orbitron, Rajdhani, sans-serif';
    text = text.toUpperCase();
    g.font = font; const w = Math.ceil(g.measureText(text).width) + 70; c.width = w; c.height = 84;
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(94,231,255,.9)'; g.shadowBlur = 16; g.fillStyle = '#dff8ff'; g.fillText(text, w / 2, 44);
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: .9 }));
    sp.scale.set(w / 5.5, 84 / 5.5, 1); sp.renderOrder = 20;
    return sp;
  }
  async function showClusters() {
    hideClusters();
    const groups = communities();
    if (!groups.length) return;
    const r = await api('api/clusters', { groups: groups.map(g => g.map(i => Galaxy.nodes[i].label)) });
    const names = r.names || groups.map((_, i) => `Cluster ${i + 1}`);
    const scene = Galaxy.Graph.scene();
    clusterSprites = groups.map((g, i) => { const sp = textSprite(names[i]); scene.add(sp); return { sp, g }; });
    const place = () => clusterSprites.forEach(({ sp, g }) => {
      let x = 0, y = 0, z = 0; g.forEach(i => { const n = Galaxy.nodes[i]; x += n.x || 0; y += n.y || 0; z += n.z || 0; });
      sp.position.set(x / g.length, y / g.length + 26, z / g.length);
    });
    place(); clusterTimer = setInterval(place, 250);
    say(isNl() ? `${groups.length} onderwerpen, meneer.` : `${groups.length} topics, sir. Your mind has neighbourhoods.`, isNl() ? 'nl' : 'en');
  }
  function hideClusters() {
    clearInterval(clusterTimer);
    clusterSprites.forEach(({ sp }) => { Galaxy.Graph.scene().remove(sp); sp.material.map.dispose(); sp.material.dispose(); });
    clusterSprites = [];
  }

  // view buttons next to the legend
  const views = document.createElement('div');
  views.id = 'views';
  views.innerHTML = `<button class="hbtn" id="v-time" title="Timeline: watch the galaxy grow (or say “show timeline”)">⏱ Timeline</button>
    <button class="hbtn" id="v-clusters" title="Name the topic clusters (or say “show clusters”)">◎ Topics</button>`;
  document.body.appendChild(views);
  $('#v-time').onclick = () => tl.hidden ? openTimeline() : closeTimeline();
  // sit just above the legend, whatever its height
  const placeViews = () => {
    const lg = document.getElementById('legend');
    if (lg && !lg.hidden && lg.offsetHeight) views.style.bottom = (innerHeight - lg.getBoundingClientRect().top + 8) + 'px';
  };
  placeViews(); setInterval(placeViews, 1000); window.addEventListener('resize', placeViews);
  $('#v-clusters').onclick = () => clusterSprites.length ? hideClusters() : showClusters();

  // ============================================================ LINKS & FILES -> NOTES
  async function ingest(payload, label) {
    Galaxy.setStatus('thinking', isNl() ? '(lezen en samenvatten)' : '(reading and summarising)');
    Galaxy.showAnswer(label, '…');
    const r = await api('api/ingest', payload);
    Galaxy.setStatus(null);
    if (r.error) { Galaxy.showAnswer(label, r.error); return; }
    Galaxy.reloadGraph(r.graph, { bornId: r.id, nearId: r.near });
    const n = Galaxy.byId(r.id);
    Galaxy.showAnswer(label, isNl() ? `Gelezen en opgeborgen als “${r.title}”, meneer.` : `Read, digested and filed as “${r.title}”, sir.`, n ? [r.id] : []);
    say(isNl() ? 'Gelezen en opgeborgen, meneer.' : 'Read, digested and filed, sir.', isNl() ? 'nl' : 'en');
    if (n) setTimeout(() => Galaxy.select(n), 700);
  }
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.hidden = true;
  fileInput.accept = '.pdf,.txt,.md,.csv,.json,.docx,.html,.htm,image/*';
  document.body.appendChild(fileInput);
  const readFile = f => new Promise((res, rej) => {
    if (f.size > 20 * 1024 * 1024) return rej(new Error('That file is over 20 MB.'));
    const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(f);
  });
  async function ingestFile(f) {
    try { await ingest({ name: f.name, mime: f.type, data: await readFile(f), note: $('#q').value.trim() }, `📎 ${f.name}`); $('#q').value = ''; }
    catch (e) { Galaxy.showAnswer(`📎 ${f.name}`, e.message); }
  }
  fileInput.onchange = () => { if (fileInput.files[0]) ingestFile(fileInput.files[0]); fileInput.value = ''; };
  const clip = document.createElement('button');
  clip.type = 'button'; clip.id = 'attach'; clip.title = 'Add a file or drop one anywhere (PDF, Word, text, image)'; clip.textContent = '📎';
  $('#ask').insertBefore(clip, $('#handsfree') || $('#mic'));
  clip.onclick = () => fileInput.click();
  window.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); document.body.classList.add('dropping'); } });
  window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
  window.addEventListener('drop', e => {
    document.body.classList.remove('dropping');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) { e.preventDefault(); ingestFile(f); }
  });

  // ============================================================ more spoken/typed commands
  const URL_RE = /(https?:\/\/[^\s<>"']+)/i;
  const BRIEF = /^\s*(?:(?:hey|ok|okay)\s+)?(?:jarvis[,!.\s]+)?(?:please\s+)?(brief me|briefing|morning briefing|daily briefing|good morning|give me (?:my|the) briefing|geef me (?:de |mijn )?briefing|briefing alsjeblieft|goedemorgen)\b/i;
  const STATUS = /^\s*(?:jarvis[,!.\s]+)?(?:give me (?:a |the )?)?(status report|system status|status|systeemstatus|statusrapport)\s*[.!?]*$/i;
  const TIMELINE = /^\s*(?:jarvis[,!.\s]+)?(show|open|hide|close|toon|sluit)\s+(?:the\s+|de\s+)?(timeline|tijdlijn)\b/i;
  const CLUSTERS = /^\s*(?:jarvis[,!.\s]+)?(show|hide|toon|verberg)\s+(?:the\s+|my\s+|de\s+)?(clusters|topics|onderwerpen)\b/i;
  const REVIEW = /^\s*(?:jarvis[,!.\s]+)?(?:do|write|make|schrijf|maak)\s+(?:my|the|a|mijn|de|een)?\s*(weekly review|week review|weekoverzicht|weekreview)\b/i;
  const extraIntercept = text => {
    if (BRIEF.test(text)) { briefMe(); return true; }
    if (STATUS.test(text)) { statusReport(); return true; }
    let m = text.match(TIMELINE);
    if (m) { /hide|close|sluit/i.test(m[1]) ? closeTimeline() : openTimeline(); return true; }
    m = text.match(CLUSTERS);
    if (m) { /hide|verberg/i.test(m[1]) ? hideClusters() : showClusters(); return true; }
    if (REVIEW.test(text)) {
      Galaxy.setStatus('thinking', '(weekly review)');
      api('api/review', {}).then(r => {
        Galaxy.setStatus(null);
        if (r.error) return Galaxy.showAnswer('Weekly review', r.error);
        Galaxy.reloadGraph(r.graph);
        const id = Galaxy.nodes.findIndex(n => n.label === r.title);
        Galaxy.showAnswer('Weekly review', `“${r.title}” is ready, sir.`, id >= 0 ? [id] : []);
        say('Your weekly review is ready, sir.');
        if (id >= 0) setTimeout(() => Galaxy.select(Galaxy.byId(id)), 700);
      });
      return true;
    }
    m = text.match(URL_RE);
    if (m && (/^\s*(?:jarvis[,!.\s]+)?(remember|save|read|summari[sz]e|onthoud|bewaar|lees|vat)\b/i.test(text) || text.trim() === m[1])) {
      ingest({ url: m[1], note: text.replace(m[1], '').trim() }, '🔗 ' + m[1].replace(/^https?:\/\//, '').slice(0, 60));
      return true;
    }
    return false;
  };

  window.JarvisUI = {
    open: openSettings, close: closeSettings,
    intercept(text) {
      if (extraIntercept(text)) return true;
      const live = pending.filter(p => !p.sent);
      if (live.length && SEND.test(text)) { live[0].send(); return true; }
      if (live.length && DROP.test(text)) { live.forEach(p => $('[data-drop]', p.card) && $('[data-drop]', p.card).click()); say('Discarded, sir.'); return true; }
      if (CLOSE.test(text)) { closeSettings(); return true; }
      const m = text.match(OPEN);
      if (m) {
        const w = m[1].toLowerCase();
        const which = /calendar|agenda/.test(w) ? 'calendars' : /app|connection|koppeling/.test(w) ? 'apps'
          : /voice/.test(w) ? 'voice' : /interface/.test(w) ? 'interface' : undefined;
        openSettings(which);
        const nl = /instellingen|toon|open de|agenda|koppelingen/i.test(text);
        say(nl ? 'De instellingen, meneer.' : ['Settings, sir.', 'Right away, sir. The settings.', 'Your controls, sir.'][Math.floor(Math.random() * 3)], nl ? 'nl' : 'en');
        return true;
      }
      return false;
    },
  };
})();
