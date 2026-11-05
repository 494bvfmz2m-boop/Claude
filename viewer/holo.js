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
      mailEl.title = m.error || '';
      mailEl.style.color = m.unread ? 'var(--holo-2)' : '';
    } catch (e) {}
  }
  loadSettings().then(() => { refreshNext(); refreshMail(); });
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
      </nav>
      <div class="body"></div>
    </div>`;
  document.body.appendChild(win);
  const body = $('.body', win);
  let tab = 'interface', openApp = null;
  win.addEventListener('click', e => { if (e.target === win) closeSettings(); });
  $('.x', win).onclick = closeSettings;
  win.querySelectorAll('nav button').forEach(b => b.onclick = () => { tab = b.dataset.tab; openApp = null; render(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !win.hidden) { e.stopImmediatePropagation(); closeSettings(); } }, true);

  async function openSettings(which) {
    if (which) tab = which;
    win.hidden = false;
    try { Galaxy.Graph.pauseAnimation(); } catch (e) {}
    render();
    await loadSettings();
    render();
  }
  function closeSettings() { win.hidden = true; try { Galaxy.Graph.resumeAnimation(); } catch (e) {} }

  function render() {
    win.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'interface') renderInterface();
    else if (tab === 'calendars') renderCalendars();
    else if (tab === 'apps') renderApps();
    else renderVoice();
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
    body.innerHTML = `
      <h3>CONNECTED APPS</h3>
      <p class="help">Let Jarvis write emails, chat messages and documents for you. He always shows a <b>draft</b> first:
        nothing is sent until you press <b>Send</b> (or say “send it”). Passwords and tokens stay on your server.</p>
      <div class="apps">${Object.keys(cat).map(k => `
        <button class="app ${openApp === k ? 'on' : ''}" data-app="${k}"><div class="ic">${esc(cat[k].icon)}</div>
          <b>${esc(cat[k].label)}</b><span class="badge ${s.apps[k].connected ? 'on' : ''}">${s.apps[k].connected ? 'Connected' : 'Not connected'}</span></button>`).join('')}</div>
      <div id="appform"></div>`;
    body.querySelectorAll('[data-app]').forEach(b => b.onclick = () => { openApp = openApp === b.dataset.app ? null : b.dataset.app; renderApps(); });
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
      <div class="row"><button class="hbtn primary" data-act="save">Save</button>
        <button class="hbtn" data-act="test" ${st.connected ? '' : 'disabled'}>Test</button>
        ${st.connected ? '<button class="hbtn danger" data-act="remove">Disconnect</button>' : ''}</div>
      <div class="msg"></div>`;
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
    send_chat: [['text', 'Message', 'textarea']],
    create_document: [['title', 'Title', 'input'], ['content', 'Content', 'textarea']],
    webhook: [['event', 'Event', 'input'], ['data', 'Data (JSON)', 'textarea']],
  };
  const OP_LABEL = { send_email: 'Email', send_chat: 'Message', create_document: 'Document', webhook: 'Webhook' };
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
        ${DRAFT_FIELDS[d.op].filter(([k]) => !(k === 'cc' && !d.fields.cc)).map(([k, label, tag]) => `<label>${label}</label>${tag === 'input'
          ? `<input data-k="${k}" value="${esc(d.fields[k])}">` : `<textarea data-k="${k}">${esc(d.fields[k])}</textarea>`}`).join('')}
        <div class="row"><button class="hbtn primary" data-send>Send</button><button class="hbtn" data-drop>Discard</button></div>
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

  window.JarvisUI = {
    open: openSettings, close: closeSettings,
    intercept(text) {
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
