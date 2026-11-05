// Jarvis: your own AI assistant, like J.A.R.V.I.S. in Iron Man (admins only). Talk to him or type:
// he answers out loud, and can look at and add to your agenda, tasks and notes, check your mail,
// chats and the weather, and tell you how the site is doing. He runs on the AI service set up in
// Admin → AI. Speech to text and text to speech are the browser's own.
(function () {
    const { $, esc, ic, toast } = window.EG;
    const root = $('#jarvis');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const synth = window.speechSynthesis;
    const keep = {
        get(area, key, d) {
            try {
                const v = JSON.parse(area.getItem(key));
                return v == null ? d : v;
            } catch {
                return d;
            }
        },
        set(area, key, v) {
            try {
                area.setItem(key, JSON.stringify(v));
            } catch {
                /* private window: just not remembered */
            }
        }
    };
    const PREFS = 'eg-jarvis';
    // the small pop-up in the other apps (jarvis-dock.js) shows this page in a frame
    const mini = /[?&]mini=1\b/.test(location.search) && window.parent !== window;
    if (mini) {
        document.body.classList.add('jv-mini');
        const base = document.querySelector('base');
        if (base) base.target = '_top'; // links (Tasks, Calendar, Admin…) open in the app, not in the pop-up
    }
    let status = null;
    let log = []; // the conversation: kept on the server, so it's the same on every device
    const prefs = { speak: true, wake: false, convo: true, sounds: true, lang: 'auto', voice: '', rate: 1, pitch: 0.9, ...keep.get(localStorage, PREFS, {}) };
    prefs.rate = Math.min(1.3, Math.max(0.7, Number(prefs.rate) || 1));
    prefs.pitch = Math.min(1.2, Math.max(0.6, Number(prefs.pitch) || 0.9));
    let state = 'idle'; // idle · listening · thinking · speaking
    let busy = false;
    let where = keep.get(sessionStorage, 'eg-jarvis-where', null);
    const savePrefs = () => keep.set(localStorage, PREFS, prefs);
    const lang = () => (prefs.lang === 'auto' ? navigator.language || 'en-GB' : prefs.lang);
    const dutch = () => /^nl/i.test(lang());
    const NL = /\b(de|het|een|ik|je|jij|jouw|niet|van|en|dat|op|voor|met|zijn|er|maar|ook|nog|wat|vandaag|morgen|heb|hebt|heeft|staat|geen|uw|taak|taken|alle|nieuwe|graag|meneer|mevrouw)\b/gi;
    const EN = /\b(the|you|a|to|and|of|your|it|for|on|today|tomorrow|have|has|are|no|what|there|with|all|new|sir|ma'am)\b/gi;
    const isDutch = t => (String(t).match(NL) || []).length > (String(t).match(EN) || []).length;
    const ACT_ICON = { task: 'check', done: 'check', event: 'calendar', note: 'note', memory: 'sparkle', forget: 'eraser', type: 'pen', email: 'mail', chat: 'send', changed: 'pen', deleted: 'trash', restored: 'undo', mailed: 'mail', chatted: 'send', admin: 'shield', open: 'external' };
    const WEATHERY = /weather|weer|rain|regen|umbrella|paraplu|temperat|forecast|outside|buiten|cold|warm|koud|jas|coat|snow|sneeuw|wind|brief|ochtend|morning|today|vandaag/i;

    /* ---------- the page ---------- */
    const segs = Array.from({ length: 12 }, (_, i) => `<rect x="96" y="44" width="8" height="13" rx="2" transform="rotate(${i * 30} 100 100)"/>`).join('');
    const ORB = `<svg viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="jvCore"><stop offset="0" stop-color="#fff"/><stop offset=".32" stop-color="#d9fbff"/><stop offset=".62" stop-color="#3fdcff" stop-opacity=".7"/><stop offset="1" stop-color="#0a84ff" stop-opacity="0"/></radialGradient><radialGradient id="jvHalo"><stop offset=".55" stop-color="#3fdcff" stop-opacity="0"/><stop offset=".8" stop-color="#3fdcff" stop-opacity=".16"/><stop offset="1" stop-color="#3fdcff" stop-opacity="0"/></radialGradient></defs>
        <circle class="jv-halo" cx="100" cy="100" r="99" fill="url(#jvHalo)"/>
        <g class="jv-r jv-r1"><circle cx="100" cy="100" r="93" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="1.5 5.5" opacity=".75"/></g>
        <g class="jv-r jv-r2"><circle cx="100" cy="100" r="82" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="46 10 8 10" opacity=".5"/></g>
        <g class="jv-r jv-r3"><circle cx="100" cy="100" r="69" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="150 40 30 40" opacity=".9"/></g>
        <g class="jv-r jv-r4" fill="currentColor" opacity=".8">${segs}</g>
        <g class="jv-core"><circle cx="100" cy="100" r="36" fill="url(#jvCore)"/><circle cx="100" cy="100" r="17" fill="#effeff"/></g></svg>`;

    function page() {
        root.innerHTML = `<div class="jv">
            <section class="jv-side">
                <div class="jv-title"><h1>J.A.R.V.I.S.</h1><span class="jv-title-acts"><button class="icon-btn" data-settings aria-label="Jarvis settings" title="Settings">${ic('settings')}</button>${mini ? `<a class="icon-btn" href="/jarvis/" target="_top" aria-label="Open Jarvis full size" title="Open full size">${ic('maximize')}</a><button class="icon-btn" data-close aria-label="Close Jarvis" title="Close (Esc)">${ic('x')}</button>` : ''}</span></div>
                <p class="jv-sys" id="jv-sys"></p>
                <button class="jv-orb" id="jv-orb" data-state="idle" aria-label="Talk to Jarvis" title="Tap and speak">${ORB}</button>
                <p class="jv-status" id="jv-status" aria-live="polite"></p>
                <p class="jv-heard" id="jv-heard"></p>
                <div class="jv-chips" id="jv-chips"></div>
            </section>
            <section class="jv-main">
                <div class="jv-log" id="jv-log" aria-live="polite"></div>
                <form class="jv-bar" id="jv-bar" autocomplete="off">
                    ${SR ? `<button type="button" class="jv-mic" data-mic aria-label="Speak to Jarvis" title="Speak">${ic('mic')}</button>` : ''}
                    <textarea class="input" id="jv-input" rows="1" placeholder="${dutch() ? 'Vraag Jarvis iets…' : 'Ask Jarvis anything…'}" maxlength="2000" enterkeyhint="send" aria-label="Message to Jarvis"></textarea>
                    <button type="button" class="icon-btn" data-mute aria-pressed="${!prefs.speak}"></button>
                    <button class="btn btn-primary jv-send" aria-label="Send">${ic('send')}</button>
                </form>
            </section>
        </div>`;
        $('#jv-sys').textContent = status && status.on ? `Online · ${status.model || status.service}${status.backups && status.backups.length ? ` · ${status.backups.length === 1 ? '1 backup' : `${status.backups.length} backups`}` : ''}${status.control === 'full' ? ' · full control' : ''}` : 'Offline';
        muteButton();
        chips();
        drawLog();
        setState(state);
    }
    // the message box grows with what you write (up to a few lines)
    function grow() {
        const el = $('#jv-input');
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(150, el.scrollHeight)}px`;
    }
    function muteButton() {
        const b = $('[data-mute]', root);
        if (!b) return;
        b.innerHTML = ic(prefs.speak ? 'volume' : 'volumeoff');
        b.title = prefs.speak ? 'Jarvis speaks his answers (tap to mute)' : 'Muted (tap to hear Jarvis)';
        b.setAttribute('aria-label', b.title);
        b.setAttribute('aria-pressed', String(!prefs.speak));
    }
    function chips() {
        const list = dutch()
            ? [['Geef me een briefing', 'Geef me een briefing'], ['Wat staat er vandaag?', 'Wat staat er vandaag op mijn agenda?'], ['Nieuwe mail?', 'Heb ik nieuwe mail?'], ['Taak toevoegen', 'Zet op mijn takenlijst: '], ['Hoe gaat het met de site?', 'Hoe gaat het met de site?']]
            : [['Brief me', 'Brief me'], ['What’s on today?', 'What’s on my agenda today?'], ['Any new mail?', 'Any new mail?'], ['Add a task', 'Add a task: '], ['How’s the site?', 'How’s the site doing?']];
        $('#jv-chips').innerHTML = status && status.on ? list.map(([label, say]) => `<button class="jv-chip" data-say="${esc(say)}">${esc(label)}</button>`).join('') : '';
    }
    function who() {
        if (!status) return '';
        if (status.address === 'name') return status.name;
        return (dutch() ? { sir: 'meneer', "ma'am": 'mevrouw', boss: 'baas' } : { sir: 'sir', "ma'am": 'ma’am', boss: 'boss' })[status.address] || status.name;
    }
    function greeting() {
        const h = new Date().getHours();
        if (dutch()) return `${h < 6 ? 'Goedenacht' : h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'}, ${who()}. Alle systemen draaien. Waarmee kan ik helpen?`;
        if (h < 5) return `Burning the midnight oil, ${who()}? All systems are online. What can I do for you?`;
        return `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, ${who()}. All systems are online. How can I help?`;
    }
    let drawn = 0; // messages already on screen (only new ones fade in)
    // his words, laid out: paragraphs, and lists where he made one
    function fmt(t) {
        const item = /^\s*(?:[-•*]|\d+[.)])\s+/;
        return String(t || '')
            .replace(/\r/g, '')
            .split(/\n{2,}/)
            .map(block => {
                const lines = block.split('\n').filter(l => l.trim());
                if (lines.length > 1 && lines.every(l => item.test(l))) {
                    const tag = /^\s*\d/.test(lines[0]) ? 'ol' : 'ul';
                    return `<${tag}>${lines.map(l => `<li>${esc(l.replace(item, ''))}</li>`).join('')}</${tag}>`;
                }
                return `<p>${lines.map(esc).join('<br>')}</p>`;
            })
            .join('');
    }
    function bubble(m, i = Infinity) {
        const seen = i < drawn ? ' seen' : '';
        const at = Number.isFinite(i) && i > 0 ? ` data-i="${i - 1}"` : '';
        if (m.role === 'user') return `<div class="jv-msg me${seen}"${at}><p>${esc(m.content)}</p></div>`;
        const acts = (m.actions || []).filter(a => a && a.text && !a.draft && !a.pending);
        const drafts = (m.actions || []).filter(a => a && a.draft);
        const asks = (m.actions || []).filter(a => a && a.pending);
        // (with Undo on what he changed)
        const undo = a => (a.undo ? (a.undone ? `<span class="jv-undone">${dutch() ? 'ongedaan' : 'undone'}</span>` : `<button type="button" class="jv-undo" data-undo="${esc(a.undo)}">${ic('undo')}<span>${dutch() ? 'Ongedaan maken' : 'Undo'}</span></button>`) : '');
        const act = a => `<span class="jv-act-wrap">${/^\/[a-z]/.test(String(a.href || '')) ? `<a class="jv-act${a.undone ? ' undone' : ''}" href="${esc(a.href)}">${ic(ACT_ICON[a.kind] || 'check')}<span>${esc(a.text)}</span></a>` : `<span class="jv-act">${ic(ACT_ICON[a.kind] || 'check')}<span>${esc(a.text)}</span></span>`}${undo(a)}</span>`;
        const tools = !at ? '' : m.error ? `<div class="jv-tools"><button type="button" class="btn btn-ghost" data-retry>${ic('refresh')}<span>${dutch() ? 'Opnieuw' : 'Try again'}</span></button></div>` : `<div class="jv-tools"><button type="button" class="icon-btn" data-copy title="${dutch() ? 'Kopiëren' : 'Copy'}" aria-label="Copy">${ic('copy')}</button>${synth ? `<button type="button" class="icon-btn" data-replay title="${dutch() ? 'Nog eens voorlezen' : 'Read it again'}" aria-label="Read it again">${ic('volume')}</button>` : ''}</div>`;
        return `<div class="jv-msg ai${m.error ? ' bad' : ''}${seen}"${at}><span class="jv-who">${m.error ? ic('alert') : ''}Jarvis</span><div class="jv-text">${fmt(m.content)}</div>${acts.length ? `<div class="jv-acts">${acts.map(act).join('')}</div>` : ''}${drafts.map(draftCard).join('')}${asks.map(askCard).join('')}${m.note ? `<small class="jv-note">${ic('refresh')}${esc(m.note)}</small>` : ''}${tools}</div>`;
    }
    // an email or chat message he wrote: change it if you like, then Send (nothing goes out before that)
    const rows = t => Math.min(14, Math.max(3, String(t || '').split('\n').length + Math.floor(String(t || '').length / 60)));
    const addr = list => (list || []).map(a => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', ');
    function draftCard(a) {
        const d = a.draft;
        const done = a.sent ? 'sent' : a.discarded ? 'discarded' : '';
        const off = done ? ' disabled' : '';
        const head = d.kind === 'email' ? `${ic('mail')}<b>Email</b>` : `${ic('send')}<b>Chat message</b><span>to ${esc(d.to.map(t => t.name).join(', '))}</span>`;
        return `<div class="jv-draft${done ? ` ${done}` : ''}" data-draft="${esc(d.id)}">
            <div class="jv-draft-head">${head}${done ? `<i>${a.sent ? `${ic('check')} Sent` : 'Discarded'}</i>` : ''}</div>
            ${d.kind === 'email' ? `<label class="jv-d-row"><span>To</span><input class="jv-d-to" value="${esc(addr(d.to))}"${off} spellcheck="false"></label>${d.cc && d.cc.length ? `<label class="jv-d-row"><span>Cc</span><input value="${esc(addr(d.cc))}" disabled></label>` : ''}<label class="jv-d-row"><span>Subject</span><input class="jv-d-subject" value="${esc(d.subject)}"${off}></label>` : ''}
            <textarea class="jv-d-text" rows="${rows(d.body || d.text)}"${off}>${esc(d.kind === 'email' ? d.body : d.text)}</textarea>
            ${done ? '' : `<div class="jv-draft-acts"><button type="button" class="btn btn-ghost" data-discard>Discard</button><button type="button" class="btn btn-primary" data-send>${ic('send')}<span>Send</span></button></div>`}
        </div>`;
    }
    // something he'll do once you tap "Do it" (without full control)
    function askCard(a) {
        const state = a.done ? 'done' : a.cancelled ? 'cancelled' : '';
        return `<div class="jv-confirm${state ? ` ${state}` : ''}" data-pending="${esc(a.pending.id)}">
            <span class="jv-confirm-what">${ic(state === 'done' ? 'check' : 'alert')}<b>${esc(state === 'done' && a.result ? a.result : a.pending.summary)}</b></span>
            ${state ? `<i>${state === 'done' ? 'Done' : 'Cancelled'}</i>` : '<div class="jv-draft-acts"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="button" class="btn btn-primary" data-doit>Do it</button></div>'}
        </div>`;
    }
    const askById = id => {
        for (const m of log) for (const a of m.actions || []) if (a.pending && a.pending.id === id) return a;
        return null;
    };
    async function answerAsk(card, yes) {
        const a = askById(card.dataset.pending);
        if (!a) return;
        card.querySelectorAll('button').forEach(b => (b.disabled = true));
        try {
            if (yes) {
                const r = await window.EG.call(`/api/jarvis/pending/${encodeURIComponent(a.pending.id)}`, { method: 'POST', body: {} });
                Object.assign(a, { done: Date.now(), result: r.text, href: r.href });
                toast(r.text || 'Done');
            } else {
                await window.EG.call(`/api/jarvis/pending/${encodeURIComponent(a.pending.id)}`, { method: 'DELETE' });
                a.cancelled = Date.now();
            }
            drawLog();
        } catch (err) {
            card.querySelectorAll('button').forEach(b => (b.disabled = false));
            toast(err.message, { bad: true });
        }
    }
    const draftById = id => {
        for (const m of log) for (const a of m.actions || []) if (a.draft && a.draft.id === id) return a;
        return null;
    };
    async function sendDraft(card, discard) {
        const a = draftById(card.dataset.draft);
        if (!a) return;
        const d = a.draft;
        const b = card.querySelector('[data-send]');
        if (b) b.disabled = true;
        try {
            if (discard) await window.EG.call(`/api/jarvis/drafts/${encodeURIComponent(d.id)}`, { method: 'DELETE' });
            else {
                const body = d.kind === 'email' ? { to: $('.jv-d-to', card).value, subject: $('.jv-d-subject', card).value, text: $('.jv-d-text', card).value } : { text: $('.jv-d-text', card).value };
                const r = await window.EG.call(`/api/jarvis/drafts/${encodeURIComponent(d.id)}/send`, { method: 'POST', body });
                a.href = r.href;
                toast(d.kind === 'email' ? 'Email sent' : 'Message sent');
            }
            a[discard ? 'discarded' : 'sent'] = Date.now();
            drawLog();
        } catch (err) {
            if (b) b.disabled = false;
            toast(err.message, { bad: true });
        }
    }
    function setup() {
        return `<div class="jv-setup">
            <h2>Jarvis needs a brain first</h2>
            <p>He thinks with the AI service set up in Admin → AI. A free key from Google is all he needs:</p>
            <ol>
                <li>Get a free <b>Gemini API key</b> at Google AI Studio: sign in with a Google account and tap <b>Create API key</b>.</li>
                <li>In <b>Admin → AI</b>, pick <b>Gemini</b>, paste the key and save it. If another service is in use, tap the <b>Use Gemini</b> button.</li>
                <li>Come back here and say hello.</li>
            </ol>
            <p class="cp-muted">Groq (console.groq.com) is free too and very fast. Claude works as well, on a paid key.</p>
            <div class="jv-setup-acts"><a class="btn btn-primary" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">${ic('key')}<span>Get a free Gemini key</span></a><a class="btn" href="/admin/#/ai">${ic('settings')}<span>Open Admin → AI</span></a></div>
        </div>`;
    }
    function drawLog() {
        const box = $('#jv-log');
        if (!box) return;
        const on = status && status.on;
        box.innerHTML = !on ? setup() : bubble({ role: 'assistant', content: greeting() }, drawn ? 0 : Infinity) + log.map((m, i) => bubble(m, i + 1)).join('') + (busy ? `<div class="jv-msg ai jv-wait" aria-label="Jarvis is working"><span class="jv-who">Jarvis</span><p><i></i><i></i><i></i><span id="jv-step">${esc(stepText)}</span></p></div>` : '');
        drawn = log.length + 1;
        $('#jv-input').disabled = !on;
        $('.jv-send', root).disabled = !on;
        if ($('[data-mic]', root)) $('[data-mic]', root).disabled = !on;
        $('#jv-orb').disabled = !on;
        box.scrollTop = box.scrollHeight;
        const last = box.lastElementChild;
        if (last && last.scrollIntoView && matchMedia('(max-width: 760px)').matches) last.scrollIntoView({ block: 'end' });
    }
    function setState(s) {
        state = s;
        const orb = $('#jv-orb');
        if (!orb) return;
        orb.dataset.state = s;
        const mic = $('[data-mic]', root);
        if (mic) {
            mic.classList.toggle('on', s === 'listening');
            mic.innerHTML = ic(s === 'listening' ? 'stop' : 'mic');
            mic.setAttribute('aria-label', s === 'listening' ? 'Stop listening' : 'Speak to Jarvis');
        }
        const nl = dutch();
        const line = !status || !status.on
            ? nl ? 'Offline: nog geen AI ingesteld' : 'Offline: no AI service set up yet'
            : {
                  idle: SR ? (prefs.wake && wakeOk ? (nl ? 'Zeg “Jarvis” en dan je vraag, of tik op de kern.' : 'Say “Jarvis” and then your question, or tap the core.') : desk() ? (nl ? 'Tik op de kern of houd de spatiebalk ingedrukt en praat, of typ hieronder.' : 'Tap the core or hold Space and speak, or type below.') : nl ? 'Tik op de kern en praat, of typ hieronder.' : 'Tap the core and speak, or type below.') : nl ? 'Typ hieronder. (Praten kan in Chrome, Edge en Safari.)' : 'Type below. (Speaking works in Chrome, Edge and Safari.)',
                  listening: talking && prefs.convo ? (nl ? 'Ik luister… zeg “bedankt” als je klaar bent.' : 'Listening… say “thanks” when you’re done.') : nl ? 'Ik luister…' : 'Listening…',
                  thinking: nl ? 'Even denken… (tik om te stoppen)' : 'Working on it… (tap to stop)',
                  speaking: nl ? 'Aan het woord. Tik om hem te onderbreken.' : 'Speaking. Tap to interrupt him.'
              }[s];
        $('#jv-status').textContent = line;
        if (s === 'speaking') pulse();
    }
    const desk = () => !matchMedia('(pointer: coarse)').matches;
    function heard(text) {
        const el = $('#jv-heard');
        if (el) el.textContent = text ? `“${text}”` : '';
    }

    /* ---------- talking to Jarvis ---------- */
    const tz = () => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch {
            return 'UTC';
        }
    };
    function locate() {
        return new Promise(resolve => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                p => {
                    where = { lat: Math.round(p.coords.latitude * 1000) / 1000, lon: Math.round(p.coords.longitude * 1000) / 1000 };
                    keep.set(sessionStorage, 'eg-jarvis-where', where);
                    resolve(where);
                },
                () => resolve(null),
                { timeout: 6000, maximumAge: 30 * 60 * 1000 }
            );
        });
    }
    // what he's doing right now ("Checking your agenda…"), streamed in while he works
    let stepText = '';
    const STEP_NL = { thinking: 'Even denken', get_agenda: 'Je agenda bekijken', get_tasks: 'Je taken bekijken', check_mail: 'Je mail bekijken', check_chats: 'Je chats bekijken', get_weather: 'Het weer bekijken', site_status: 'De site bekijken', write_email: 'De mail schrijven', write_chat: 'Het bericht schrijven', search_mail: 'In je mail zoeken', read_mail: 'De mail lezen', look_at_screen: 'Naar je scherm kijken', type_here: 'Klaarmaken om te schrijven', add_task: 'De taak toevoegen', add_event: 'In je agenda zetten', change_item: 'Het aanpassen', delete_item: 'Het verwijderen' };
    function step(name, label) {
        stepText = `${(dutch() && STEP_NL[name]) || label}…`;
        const el = $('#jv-step');
        if (el) el.textContent = stepText;
    }
    let asking = null; // the request in flight (tap the core while he thinks to cancel it)
    let voiceTurn = false; // the last thing you said was spoken (so he listens again after answering)
    async function send(text, { voice = false } = {}) {
        text = String(text || '').trim().slice(0, 2000);
        if (!text || busy || !status || !status.on) return;
        unlockSpeech();
        stopSpeaking();
        pauseWake();
        voiceTurn = voice;
        if (!voice) talking = false;
        log.push({ role: 'user', content: text });
        busy = true;
        stepText = dutch() ? 'Even denken…' : 'Thinking…';
        drawLog();
        setState('thinking');
        let reply = null;
        const ctl = (asking = new AbortController());
        try {
            if (!where && WEATHERY.test(text)) await locate();
            const res = await fetch('/api/jarvis/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson', 'X-EG': '1' },
                body: JSON.stringify({ message: text, tz: tz(), where, screen: screenNow() }),
                signal: ctl.signal
            });
            if (res.status === 401) return location.replace('/login?next=%2Fjarvis%2F');
            let data = {};
            if (/ndjson/.test(res.headers.get('content-type') || '') && res.body) {
                // line by line: steps as he goes, then the answer (or what went wrong)
                const reader = res.body.getReader();
                const dec = new TextDecoder();
                let buf = '';
                for (;;) {
                    const { value, done } = await reader.read();
                    if (value) buf += dec.decode(value, { stream: true });
                    let nl;
                    while ((nl = buf.indexOf('\n')) >= 0) {
                        const line = buf.slice(0, nl).trim();
                        buf = buf.slice(nl + 1);
                        if (!line) continue;
                        const msg = JSON.parse(line);
                        if (msg.step) step(msg.step, msg.label);
                        if (msg.done || msg.error) data = msg;
                    }
                    if (done) break;
                }
                if (data.error) throw new Error(data.error);
                if (!data.done) throw new Error('The answer was cut off. Try again?');
            } else {
                data = await res.json().catch(() => ({}));
                if (res.status === 409) {
                    status.on = false;
                    throw new Error(data.error || 'Jarvis needs an AI service first.');
                }
                if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
            }
            reply = String(data.reply || '…');
            log.push({ role: 'assistant', content: reply, actions: data.actions || [], via: data.service, note: handedOver(data) });
            for (const a of data.actions || []) if (a.kind === 'type' && (a.type || a.mode === 'clear')) typeIntoApp(a);
            // "open my calendar": on the screen you're on (the whole window, from the pop-up too)
            const go = (data.actions || []).find(a => a.open && /^\/[a-z]*\/?/.test(String(a.href || '')));
            if (go) setTimeout(() => (mini ? window.top : window).location.assign(go.href), 1200);
            if (data.memories) status.memories = data.memories;
            if (mini && (data.actions || []).some(a => a.undo || /^(changed|deleted|event|task|done|note|restored)$/.test(a.kind))) behindChanged = true;
        } catch (e) {
            if (e.name === 'AbortError') log.push({ role: 'assistant', content: dutch() ? 'Gestopt.' : 'Stopped.', error: true });
            else log.push({ role: 'assistant', content: e.message === 'Failed to fetch' ? 'I can’t reach the server just now. Check the connection?' : e.message, error: true });
        } finally {
            busy = false;
            if (asking === ctl) asking = null;
            if (status && !status.on) page();
            else drawLog();
        }
        setState('idle');
        if (ctl.signal.aborted) return;
        if (reply && prefs.speak && synth) speak(reply);
        else afterSpeech();
    }
    // after his answer: in a spoken conversation he listens again, otherwise back to waiting
    function afterSpeech() {
        if (talking && prefs.convo && voiceTurn && SR && !busy) setTimeout(() => talking && state === 'idle' && !busy && listen({ again: true }), 250);
        else {
            talking = false;
            resumeWake();
        }
    }

    // the app behind the pop-up: what's on it, and typing his text into it, bit by bit
    function screenNow() {
        if (!mini) return undefined;
        try {
            return window.parent.EGJarvisDock.screen();
        } catch {
            return undefined;
        }
    }
    function typeIntoApp(a) {
        try {
            window.parent.EGJarvisDock.type(a.type, {
                mode: a.mode || 'insert',
                onDone: ok => {
                    a.text = ok ? a.text.replace(/^Writing in/, 'Wrote in').replace(/^Rewriting/, 'Rewrote').replace(/^Clearing/, 'Cleared') : 'Stopped writing';
                    drawLog();
                }
            });
        } catch {
            a.text = 'Couldn’t write there';
        }
    }

    // when a backup service answered: say so, quietly
    function handedOver(data) {
        const failed = (data.switched || []).map(x => x.name);
        if (failed.length && data.service) return `${failed.join(' and ')} didn’t answer, so ${data.service} took over. He remembers everything.`;
        if (data.service && status.service && data.service !== status.service) return `${data.service} answered, while ${status.service} has a short rest.`;
        return '';
    }

    /* ---------- his voice ---------- */
    let voices = [];
    const loadVoices = () => (voices = synth ? synth.getVoices() : []);
    if (synth) {
        loadVoices();
        if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
    }
    // The closest to Jarvis that's free: the voices on the device, ranked. British and male first, and
    // their natural-sounding versions (Edge's "Online (Natural)", Apple's "Enhanced"/"Premium") above
    // the plain ones; the joke voices never.
    const PREFER = {
        en: ['Microsoft Ryan', 'Arthur', 'Daniel', 'Microsoft Thomas', 'Google UK English Male', 'Jamie', 'Oliver', 'Malcolm', 'Microsoft George', 'en-gb-x-rjs', 'en-gb-x-gbd', 'en-gb-x-gbb', 'Rishi'],
        nl: ['Microsoft Maarten', 'Xander', 'Google Nederlands', 'nl-nl-x-bmh', 'nl-nl-x-dma', 'Microsoft Frank']
    };
    const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Ralph|Fred|Kathy|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley)\b/i;
    const FEMALE = /female|Libby|Sonia|Maisie|Hazel|Susan|Serena|Kate|Stephanie|Martha|Fiona|Moira|Karen|Samantha|Tessa|Victoria|Allison|Ava|Zoe|Colette|Fenna|Ellen|Claire|Hanna|Femke/i;
    const QUALITY = v => (/Natural|Neural/i.test(v.name) ? 30 : /Premium/i.test(v.name) ? 26 : /Enhanced/i.test(v.name) ? 22 : /Online/i.test(v.name) ? 15 : 0);
    function score(v, nl) {
        const id = `${v.name} ${v.voiceURI || ''}`;
        if (NOVELTY.test(v.name)) return -1;
        let s = nl ? (/^nl/i.test(v.lang) ? 100 : -1) : /^en[-_]GB/i.test(v.lang) ? 100 : /^en/i.test(v.lang) ? 40 : -1;
        if (s < 0) return -1;
        const i = PREFER[nl ? 'nl' : 'en'].findIndex(n => id.includes(n));
        if (i >= 0) s += 60 - i * 3;
        s += QUALITY(v);
        if (FEMALE.test(v.name)) s -= 45;
        return s;
    }
    const ranked = nl => voices.map(v => [v, score(v, nl)]).filter(([, n]) => n >= 0).sort((a, b) => b[1] - a[1]).map(([v]) => v);
    function voiceFor(text) {
        if (prefs.voice) {
            const v = voices.find(x => (x.voiceURI || x.name) === prefs.voice) || voices.find(x => x.name === prefs.voice);
            if (v) return v;
        }
        return ranked(isDutch(text))[0] || null;
    }
    // what he says, made for speaking: no symbols or addresses, units in words
    function speakable(text) {
        const nl = isDutch(text);
        return String(text)
            .replace(/https?:\/\/\S+/g, '')
            .replace(/^\s*(?:[-•*]|\d+[.)])\s+/gm, '')
            .replace(/[*_#`~|]+/g, '')
            .replace(/\p{Extended_Pictographic}/gu, '')
            .replace(/\s*(?:→|->)\s*/g, nl ? ' naar ' : ' to ')
            .replace(/(\d)\s*°\s*C\b/g, nl ? '$1 graden' : '$1 degrees')
            .replace(/(\d)\s*km\/h\b/g, nl ? '$1 kilometer per uur' : '$1 kilometres an hour')
            .replace(/(\d)\s*%/g, nl ? '$1 procent' : '$1 percent')
            .replace(/\s*&\s*/g, nl ? ' en ' : ' and ')
            .replace(/\n+/g, '. ')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
    // short pieces: some browsers stop a long one halfway
    function pieces(text) {
        const out = [];
        for (const s of String(text).match(/[^.!?…]+[.!?…]*["”’)]*\s*|.+$/g) || [text]) {
            if (out.length && (out[out.length - 1] + s).length < 180) out[out.length - 1] += s;
            else out.push(s);
        }
        return out.map(s => s.trim()).filter(Boolean);
    }
    let speakingRun = 0;
    function speak(text) {
        if (!synth) return setState('idle');
        stopSpeaking();
        const run = ++speakingRun;
        const v = voiceFor(text);
        const parts = pieces(speakable(text));
        pauseWake();
        parts.forEach((p, i) => {
            const u = new SpeechSynthesisUtterance(p);
            if (v) {
                u.voice = v;
                u.lang = v.lang;
            } else u.lang = isDutch(text) ? 'nl-NL' : 'en-GB';
            // measured and a touch deep, like Jarvis (both can be set in his settings)
            u.rate = prefs.rate;
            u.pitch = prefs.pitch;
            u.onstart = () => run === speakingRun && setState('speaking');
            u.onboundary = () => (kick = 1);
            if (i === parts.length - 1)
                u.onend = u.onerror = () => {
                    if (run !== speakingRun) return;
                    if (state === 'speaking') setState('idle');
                    afterSpeech();
                };
            synth.speak(u);
        });
        // a voice that never starts (no voices, or blocked until the page is tapped): carry on anyway
        setTimeout(() => run === speakingRun && state !== 'speaking' && !synth.speaking && afterSpeech(), 4000);
    }
    function stopSpeaking() {
        speakingRun++;
        if (synth && (synth.speaking || synth.pending)) synth.cancel();
        if (state === 'speaking') setState('idle');
    }
    // Safari only lets a page speak after a tap has spoken once
    let unlocked = false;
    function unlockSpeech() {
        if (unlocked || !synth) return;
        unlocked = true;
        try {
            const u = new SpeechSynthesisUtterance(' ');
            u.volume = 0;
            synth.speak(u);
        } catch {
            /* nothing to unlock */
        }
    }
    // the core glows with his voice
    let kick = 0;
    let pulsing = false;
    function pulse() {
        if (pulsing) return;
        pulsing = true;
        const orb = $('#jv-orb');
        const t0 = performance.now();
        const step = now => {
            if (state !== 'speaking' && state !== 'listening') {
                pulsing = false;
                if (orb) orb.style.setProperty('--lvl', 1);
                return;
            }
            const t = (now - t0) / 1000;
            kick *= 0.88;
            const base = state === 'speaking' ? 0.07 * Math.abs(Math.sin(t * 9.3)) * (0.6 + 0.4 * Math.sin(t * 2.1)) : 0;
            if (orb) {
                orb.style.setProperty('--lvl', (1 + base + (state === 'listening' ? 0.2 : 0.12) * kick).toFixed(3));
                orb.style.setProperty('--mic', (state === 'listening' ? kick : 0).toFixed(3));
            }
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    /* ---------- listening ---------- */
    let rec = null;
    let wakeOk = true; // false once the microphone is refused
    let held = false; // wake listening paused (Jarvis is thinking or talking)
    const recLang = () => (prefs.lang === 'auto' ? navigator.language || 'en-GB' : prefs.lang);
    function stopRec(abort) {
        if (!rec) return;
        const r = rec;
        rec = null;
        r.onend = r.onresult = r.onerror = null;
        try {
            abort ? r.abort() : r.stop();
        } catch {
            /* already stopped */
        }
    }
    function micRefused(e) {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            wakeOk = false;
            toast('Allow the microphone for this site to talk to Jarvis (the icon in the address bar).', { bad: true });
            return true;
        }
        if (e.error === 'network') toast('Speech recognition needs the internet in this browser.', { bad: true });
        return false;
    }
    // Talking. Tap the core (or hold Space) and speak: what you say shows in the box as you go, and is
    // sent when you stop. In a conversation he listens again after every answer, like a phone call;
    // "thanks" or "that's all" (or a tap) ends it, and so does a few seconds of silence.
    let talking = false;
    const ENDS = /^(ok(ay)?[, ]+)?(thanks?|thank you( very much)?|cheers|that'?s (all|it)|that is all|stop|bye|goodbye|good night|never ?mind|no thanks?|dank( je| u)?( wel)?|bedankt|dat was (het|alles)|stop maar|doei|laat maar|tot (straks|later))( jarvis)?[.!]*$/i;
    function endConversation(say) {
        talking = false;
        cue('down');
        setState('idle');
        if (say && prefs.speak && synth) speak(dutch() ? `Tot uw dienst, ${who()}.` : `Very good, ${who()}.`);
        resumeWake();
    }
    function listen({ again = false, ptt = false } = {}) {
        if (!SR) return toast('Speaking to Jarvis works in Chrome, Edge and Safari. You can always type.');
        unlockSpeech();
        stopSpeaking();
        stopRec(true);
        const r = new SR();
        rec = r;
        r.ptt = ptt;
        r.lang = recLang();
        r.interimResults = true;
        r.continuous = ptt; // holding Space: keep listening through pauses until you let go
        r.maxAlternatives = 1;
        const box = $('#jv-input');
        let said = '';
        r.onresult = e => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) said += e.results[i][0].transcript;
                else interim += e.results[i][0].transcript;
            }
            const now = `${said}${interim}`.trim();
            heard(now);
            if (box) {
                box.value = now;
                grow();
            }
        };
        r.onerror = e => {
            if (micRefused(e)) talking = false;
            else if (e.error !== 'no-speech' && e.error !== 'aborted') toast(dutch() ? 'Dat verstond ik niet. Nog eens?' : 'I didn’t catch that. Try again?', { bad: true });
        };
        r.onend = () => {
            if (rec === r) rec = null;
            stopMeter();
            heard('');
            if (box) {
                box.value = '';
                grow();
            }
            const text = said.trim();
            if (text && talking && ENDS.test(text)) return endConversation(true);
            if (text) {
                cue('send');
                return send(text, { voice: true });
            }
            // nothing heard: a conversation ends quietly, a tap just goes back to waiting
            if (talking && again) return endConversation(false);
            setState('idle');
            resumeWake();
        };
        try {
            r.start();
            setState('listening');
            cue('up');
            pulse();
            startMeter();
        } catch {
            rec = null;
            setState('idle');
        }
    }
    function toggleListen() {
        // talking over him: he stops, and listens to you
        if (state === 'speaking') {
            stopSpeaking();
            talking = true;
            return listen();
        }
        // a tap while he listens in a conversation ends it; otherwise it sends what you said
        if (state === 'listening' && rec && !rec.wake) {
            if (talking && !$('#jv-input').value.trim()) {
                stopRec(true);
                stopMeter();
                return endConversation(false);
            }
            return rec.stop();
        }
        // a tap while he works cancels it
        if (busy) {
            if (asking) asking.abort();
            talking = false;
            return;
        }
        held = true;
        talking = true;
        listen();
    }
    // the core moves with your voice while he listens (computers; phones keep the microphone for listening)
    let meter = null;
    const appleTouch = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    async function startMeter() {
        if (meter || appleTouch() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            if (state !== 'listening') return stream.getTracks().forEach(t => t.stop());
            const A = window.AudioContext || window.webkitAudioContext;
            const ac = (cue.ctx = cue.ctx || new A());
            const src = ac.createMediaStreamSource(stream);
            const an = ac.createAnalyser();
            an.fftSize = 512;
            src.connect(an);
            const buf = new Uint8Array(an.fftSize);
            const m = (meter = { stream, src });
            const tick = () => {
                if (meter !== m) return;
                an.getByteTimeDomainData(buf);
                let sum = 0;
                for (const v of buf) sum += ((v - 128) / 128) ** 2;
                kick = Math.max(kick * 0.9, Math.min(1, Math.sqrt(sum / buf.length) * 7));
                requestAnimationFrame(tick);
            };
            tick();
        } catch {
            /* no level ring, no matter */
        }
    }
    function stopMeter() {
        if (!meter) return;
        meter.stream.getTracks().forEach(t => t.stop());
        try {
            meter.src.disconnect();
        } catch {
            /* gone */
        }
        meter = null;
    }
    // soft sounds: he starts listening (up), stops (down), heard you (send)
    function cue(kind) {
        if (!prefs.sounds) return;
        try {
            const A = window.AudioContext || window.webkitAudioContext;
            const c = (cue.ctx = cue.ctx || new A());
            const [f1, f2, vol, len] = { up: [660, 990, 0.09, 0.18], down: [700, 420, 0.07, 0.22], send: [990, 1320, 0.05, 0.1] }[kind] || [880, 1320, 0.1, 0.25];
            const o = c.createOscillator();
            const g = c.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(f1, c.currentTime);
            o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + len * 0.7);
            g.gain.setValueAtTime(0.0001, c.currentTime);
            g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + len);
            o.connect(g).connect(c.destination);
            o.start();
            o.stop(c.currentTime + len + 0.02);
        } catch {
            /* no sound, no matter */
        }
    }
    // the wake word: always listening for “Jarvis” while this page is open
    function chime() {
        try {
            const A = window.AudioContext || window.webkitAudioContext;
            chime.ctx = chime.ctx || new A();
            const c = chime.ctx;
            const o = c.createOscillator();
            const g = c.createGain();
            o.frequency.setValueAtTime(880, c.currentTime);
            o.frequency.exponentialRampToValueAtTime(1320, c.currentTime + 0.12);
            g.gain.setValueAtTime(0.0001, c.currentTime);
            g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
            o.connect(g).connect(c.destination);
            o.start();
            o.stop(c.currentTime + 0.26);
        } catch {
            /* no sound, no matter */
        }
    }
    const WAKE = /\b(jarvis|jarvi|jervis|jarvas|djarvis)\b[\s,.!?:;-]*(.*)$/i;
    function startWake() {
        if (mini || talking || !SR || !prefs.wake || !wakeOk || held || rec || busy || state === 'speaking' || document.hidden || !status || !status.on) return;
        const r = new SR();
        r.wake = true;
        rec = r;
        r.lang = recLang();
        r.interimResults = false;
        r.continuous = true;
        r.onresult = e => {
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (!e.results[i].isFinal) continue;
                const m = WAKE.exec(e.results[i][0].transcript.trim());
                if (!m) continue;
                stopRec(true);
                talking = true;
                if (m[2].trim().length > 2) send(m[2], { voice: true });
                else {
                    held = true;
                    listen();
                }
                return;
            }
        };
        r.onerror = e => micRefused(e) && setState('idle');
        // browsers stop listening after a while: start again
        r.onend = () => {
            if (rec === r) rec = null;
            setTimeout(startWake, 500);
        };
        try {
            r.start();
        } catch {
            rec = null;
        }
    }
    function pauseWake() {
        held = true;
        if (rec && rec.wake) stopRec(true);
    }
    function resumeWake() {
        held = false;
        setTimeout(startWake, 400);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? (rec && rec.wake ? stopRec(true) : null) : setTimeout(startWake, 400)));

    /* ---------- settings ---------- */
    const short = v => v.name.replace(/^Microsoft (\w+) Online \(Natural\) - .*$/, 'Microsoft $1 (Natural)').replace(/ - English \(United Kingdom\)| - Dutch \(Netherlands\)/, '');
    // a better free voice is often one download or one browser away
    function tip() {
        const best = ranked(dutch())[0];
        if (best && QUALITY(best) >= 22) return ''; // already a natural-sounding one
        const ua = navigator.userAgent;
        if (/iPhone|iPad|Macintosh/.test(ua) && !/Windows|Android/.test(ua))
            return /iPhone|iPad/.test(ua) || navigator.maxTouchPoints > 1
                ? 'For a smoother voice: iPhone Settings → Accessibility → Spoken Content → Voices → English → English (UK), download <b>Arthur</b> or <b>Daniel (Enhanced)</b>, then reload this page.'
                : 'For a smoother voice: System Settings → Accessibility → Spoken Content → System voice → Manage Voices → English (UK), download <b>Arthur</b> or <b>Daniel (Enhanced)</b>, then reload this page.';
        if (/Windows/.test(ua) && !/Edg\//.test(ua)) return 'The most Jarvis-like free voice is <b>Microsoft Ryan (Natural)</b>, which comes with Microsoft Edge: open Jarvis in Edge to hear it.';
        if (/Android/.test(ua)) return 'For another voice: Android Settings → Text-to-speech → Google → English (United Kingdom), and pick a male voice.';
        return '';
    }
    const binList = () => ((status.bin || []).length ? status.bin.slice().reverse().map(b => `<li><span>${esc(b.label)} <small>(${esc(b.app)})</small></span><button type="button" class="btn btn-ghost" data-restore="${esc(b.id)}">Restore</button></li>`).join('') : '<li class="jv-mem-none">Nothing.</li>');
    const memories = () => ((status.memories || []).length ? status.memories.map(f => `<li><span>${esc(f.text)}</span><button type="button" class="icon-btn" data-mem="${esc(f.id)}" aria-label="Forget this" title="Forget this">${ic('x')}</button></li>`).join('') : '<li class="jv-mem-none">Nothing yet.</li>');
    function settings() {
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        const addr = { name: status.name, sir: 'Sir', "ma'am": 'Ma’am', boss: 'Boss' };
        // best first: the British (or Dutch) male voices, natural-sounding ones on top
        const vs = [...ranked(dutch()), ...ranked(!dutch())];
        const auto = ranked(dutch())[0];
        back.innerHTML = `<div class="pf-crop jv-set" role="dialog" aria-modal="true" aria-labelledby="jv-set-h">
            <h2 id="jv-set-h">Jarvis</h2>
            <div class="jv-row"><span><b>He calls you</b></span><div class="seg" data-address>${status.addresses.map(a => `<button type="button" data-a="${esc(a)}" class="${status.address === a ? 'on' : ''}">${esc(addr[a] || a)}</button>`).join('')}</div></div>
            <label class="jv-row"><span><b>Speak answers out loud</b></span><input type="checkbox" class="cp-toggle" data-p="speak"${prefs.speak ? ' checked' : ''}></label>
            ${SR ? `<label class="jv-row"><span><b>Conversation mode</b><small>After he answers he listens again, so you can just keep talking, like a call. Say “thanks” or “that’s all”, or tap the core, to finish.${desk() ? ' Or hold Space to talk, and let go to send.' : ''}</small></span><input type="checkbox" class="cp-toggle" data-p="convo"${prefs.convo ? ' checked' : ''}></label>` : ''}
            <label class="jv-row"><span><b>Sounds</b><small>A soft tone when he starts and stops listening.</small></span><input type="checkbox" class="cp-toggle" data-p="sounds"${prefs.sounds ? ' checked' : ''}></label>
            ${synth ? `<label class="jv-row"><span><b>Voice</b><small>Free voices on this device, the most Jarvis-like first. Automatic picks a British man (or a Dutch one, for Dutch answers).</small></span><select class="input" data-voice><option value="">Automatic${auto ? ` (${esc(short(auto))})` : ''}</option>${vs.map(v => `<option value="${esc(v.voiceURI || v.name)}"${(v.voiceURI || v.name) === prefs.voice ? ' selected' : ''}>${esc(short(v))} (${esc(v.lang)})</option>`).join('')}</select></label>
            ${tip() ? `<p class="jv-tip">${ic('sparkle')}<span>${tip()}</span></p>` : ''}
            <label class="jv-row"><span><b>Speed</b></span><input type="range" class="jv-range" data-r="rate" min="0.7" max="1.3" step="0.05" value="${prefs.rate}"></label>
            <label class="jv-row"><span><b>Depth</b><small>Further right is deeper. Not every voice can change it.</small></span><input type="range" class="jv-range jv-depth" data-r="pitch" min="0.6" max="1.2" step="0.05" value="${prefs.pitch}"></label>
            <div class="jv-row jv-row-end"><button type="button" class="btn btn-ghost" data-reset>Like Jarvis</button><button type="button" class="btn" data-try>${ic('volume')}<span>Hear it</span></button></div>` : ''}
            <label class="jv-row"><span><b>I speak</b></span><select class="input" data-lang>${[['auto', 'Like this browser'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['nl-NL', 'Nederlands']].map(([v, l]) => `<option value="${v}"${prefs.lang === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            ${SR ? `<label class="jv-row"><span><b>Wake word “Jarvis”</b><small>Keeps listening while this page is open, so you can say “Jarvis, what’s on today?” without tapping. Your browser turns speech into text (Chrome and Edge do that on their servers).</small></span><input type="checkbox" class="cp-toggle" data-p="wake"${prefs.wake ? ' checked' : ''}></label>` : ''}
            <label class="jv-row"><span><b>Full control</b><small>On: he does what you ask straight away, sending, deleting and admin changes included. Off: those wait for you to tap “Do it” (or Send). Either way he only takes orders from you, never from what he reads in emails or messages.</small></span><input type="checkbox" class="cp-toggle" data-control${status.control === 'full' ? ' checked' : ''}></label>
            <div class="jv-mem"><b>What he remembers</b><small>Things you asked him to remember, or told him for later. Say “Jarvis, remember that…” or “forget…”.</small><ul id="jv-mem">${memories()}</ul></div>
            <div class="jv-mem"><b>Recently deleted by Jarvis</b><small>Kept for 30 days. Restore puts it back where it was.</small><ul id="jv-bin">${binList()}</ul></div>
            <p class="cp-muted">Thinking with ${esc(status.model || status.service || 'the AI service')}${status.backups && status.backups.length ? `, with ${esc(status.backups.join(', '))} as backup` : ''}. Change it in <a href="/admin/#/ai">Admin → AI</a>.</p>
            <div class="pf-crop-acts"><button type="button" class="btn btn-danger" data-forget>Forget this conversation</button><button type="button" class="btn btn-primary" data-x>Done</button></div>
        </div>`;
        document.body.append(back);
        const close = () => (back.remove(), document.removeEventListener('keydown', esc_));
        const esc_ = e => e.key === 'Escape' && close();
        document.addEventListener('keydown', esc_);
        back.addEventListener('click', async e => {
            if (e.target === back || e.target.closest('[data-x]')) return close();
            const a = e.target.closest('[data-a]');
            if (a) {
                try {
                    const r = await window.EG.call('/api/jarvis/prefs', { method: 'PUT', body: { address: a.dataset.a } });
                    status.address = r.address;
                    back.querySelectorAll('[data-a]').forEach(b => b.classList.toggle('on', b === a));
                    drawLog();
                } catch (err) {
                    toast(err.message, { bad: true });
                }
                return;
            }
            if (e.target.closest('[data-try]')) {
                unlockSpeech();
                speak(dutch() ? `Tot uw dienst, ${who()}. Alle systemen draaien naar behoren.` : `At your service, ${who()}. All systems are running as they should.`);
                return;
            }
            if (e.target.closest('[data-reset]')) {
                Object.assign(prefs, { voice: '', rate: 1, pitch: 0.9 });
                savePrefs();
                $('[data-voice]', back).value = '';
                $('[data-r="rate"]', back).value = 1;
                $('[data-r="pitch"]', back).value = 0.9;
                unlockSpeech();
                speak(dutch() ? `Zo beter, ${who()}?` : `Better, ${who()}?`);
                return;
            }
            const rs = e.target.closest('[data-restore]');
            if (rs) {
                try {
                    const r = await window.EG.call(`/api/jarvis/bin/${encodeURIComponent(rs.dataset.restore)}/restore`, { method: 'POST', body: {} });
                    status.bin = r.bin;
                    $('#jv-bin', back).innerHTML = binList();
                    toast('Put back');
                } catch (err) {
                    toast(err.message, { bad: true });
                }
                return;
            }
            const m = e.target.closest('[data-mem]');
            if (m) {
                try {
                    const r = await window.EG.call(`/api/jarvis/memory/${encodeURIComponent(m.dataset.mem)}`, { method: 'DELETE' });
                    status.memories = r.memories;
                    $('#jv-mem', back).innerHTML = memories();
                } catch (err) {
                    toast(err.message, { bad: true });
                }
                return;
            }
            if (e.target.closest('[data-forget]')) {
                try {
                    await window.EG.call('/api/jarvis/history', { method: 'DELETE' });
                } catch (err) {
                    return toast(err.message, { bad: true });
                }
                log = [];
                drawn = 0;
                stopSpeaking();
                drawLog();
                close();
                toast('The conversation is forgotten. What he was asked to remember stays.');
            }
        });
        back.addEventListener('change', async e => {
            if (e.target.matches('[data-control]')) {
                const want = e.target.checked ? 'full' : 'ask';
                try {
                    const r = await window.EG.call('/api/jarvis/prefs', { method: 'PUT', body: { control: want } });
                    status.control = r.control;
                    $('#jv-sys').textContent = '';
                    page();
                    toast(r.control === 'full' ? 'Full control: Jarvis acts straight away' : 'Jarvis asks before sending, deleting or admin changes');
                } catch (err) {
                    e.target.checked = !e.target.checked;
                    toast(err.message, { bad: true });
                }
                return;
            }
            const p = e.target.dataset.p;
            if (p) {
                prefs[p] = e.target.checked;
                if (p === 'wake') {
                    wakeOk = true;
                    if (prefs.wake) {
                        chime();
                        resumeWake();
                    } else stopRec(true);
                }
                if (p === 'speak') {
                    if (!prefs.speak) stopSpeaking();
                    muteButton();
                }
            }
            if (e.target.matches('[data-voice]')) prefs.voice = e.target.value;
            if (e.target.dataset.r) prefs[e.target.dataset.r] = Number(e.target.value);
            if (e.target.matches('[data-lang]')) {
                prefs.lang = e.target.value;
                stopRec(true);
                savePrefs();
                page();
                resumeWake();
            }
            savePrefs();
            setState(state);
        });
        $('[data-x]', back).focus();
    }

    /* ---------- what you tap ---------- */
    root.addEventListener('click', e => {
        if (e.target.closest('#jv-orb') || e.target.closest('[data-mic]')) return $('#jv-orb').classList.remove('invite'), toggleListen();
        if (e.target.closest('[data-settings]')) return status && settings();
        if (e.target.closest('[data-close]')) return closeMini();
        if (e.target.closest('[data-mute]')) {
            prefs.speak = !prefs.speak;
            savePrefs();
            if (!prefs.speak) stopSpeaking();
            muteButton();
            return;
        }
        const msg = e.target.closest('[data-i]');
        const m = msg && log[Number(msg.dataset.i)];
        if (m && e.target.closest('[data-copy]')) {
            navigator.clipboard.writeText(m.content).then(() => toast(dutch() ? 'Gekopieerd' : 'Copied'), () => toast('Couldn’t copy', { bad: true }));
            return;
        }
        if (m && e.target.closest('[data-replay]')) {
            unlockSpeech();
            talking = false;
            return speak(m.content);
        }
        if (m && e.target.closest('[data-retry]')) {
            // the question before this error, asked again (the failed try is taken out)
            const i = Number(msg.dataset.i);
            const q = log[i - 1] && log[i - 1].role === 'user' ? log[i - 1] : null;
            if (!q || busy) return;
            log.splice(i - 1, 2);
            drawn = 0;
            return send(q.content, { voice: voiceTurn });
        }
        const un = e.target.closest('[data-undo]');
        if (un) {
            un.disabled = true;
            window.EG.call(`/api/jarvis/undo/${encodeURIComponent(un.dataset.undo)}`, { method: 'POST', body: {} })
                .then(r => {
                    for (const x of log) for (const a of x.actions || []) if (a.undo === un.dataset.undo) a.undone = Date.now();
                    drawLog();
                    behindChanged = true;
                    toast(dutch() ? 'Ongedaan gemaakt' : `Undone: ${r.undone}`);
                })
                .catch(err => ((un.disabled = false), toast(err.message, { bad: true })));
            return;
        }
        const ask = e.target.closest('[data-pending]');
        if (ask && e.target.closest('[data-doit]')) return answerAsk(ask, true);
        if (ask && e.target.closest('[data-cancel]')) return answerAsk(ask, false);
        const card = e.target.closest('[data-draft]');
        if (card && e.target.closest('[data-send]')) return sendDraft(card, false);
        if (card && e.target.closest('[data-discard]')) return sendDraft(card, true);
        const c = e.target.closest('[data-say]');
        if (c) {
            const say = c.dataset.say;
            if (/[:]\s$/.test(say)) {
                const input = $('#jv-input');
                input.value = say;
                input.focus();
                input.setSelectionRange(say.length, say.length);
            } else send(say);
        }
    });
    root.addEventListener('input', e => {
        if (e.target.id === 'jv-input') return grow();
        const card = e.target.closest('[data-draft]');
        const a = card && draftById(card.dataset.draft);
        if (!a) return;
        if (e.target.matches('.jv-d-text')) a.draft[a.draft.kind === 'email' ? 'body' : 'text'] = e.target.value;
        if (e.target.matches('.jv-d-subject')) a.draft.subject = e.target.value;
        if (e.target.matches('.jv-d-to')) a.draft.to = e.target.value.split(',').map(x => ({ name: '', address: x.trim() })).filter(x => x.address);
    });
    root.addEventListener('submit', e => {
        e.preventDefault();
        const input = $('#jv-input');
        const text = input.value;
        input.value = '';
        grow();
        send(text);
    });
    // in the box: Enter sends, Shift+Enter is a new line, Up brings back what you said last
    root.addEventListener('keydown', e => {
        if (e.target.id !== 'jv-input') return;
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            $('#jv-bar').requestSubmit();
        } else if (e.key === 'ArrowUp' && !e.target.value) {
            const last = [...log].reverse().find(m => m.role === 'user');
            if (last) {
                e.preventDefault();
                e.target.value = last.content;
                grow();
            }
        }
    });
    // hold Space to talk (when you're not typing), let go to send
    const typingSomewhere = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName));
    let spaceHeld = false;
    document.addEventListener('keydown', e => {
        if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typingSomewhere(document.activeElement) || document.querySelector('.pf-crop-back') || !status || !status.on || !SR) return;
        e.preventDefault();
        if (busy) return;
        spaceHeld = true;
        if (state === 'speaking') stopSpeaking();
        talking = true;
        held = true;
        listen({ ptt: true });
    });
    document.addEventListener('keyup', e => {
        if (e.code !== 'Space' || !spaceHeld) return;
        e.preventDefault();
        spaceHeld = false;
        if (rec && rec.ptt) rec.stop();
    });
    document.addEventListener('keydown', e => {
        if (mini && e.altKey && e.code === 'KeyJ') return e.preventDefault(), closeMini();
        if (e.key !== 'Escape' || document.querySelector('.pf-crop-back')) return;
        if (state === 'speaking') stopSpeaking(), resumeWake();
        else if (state === 'listening' && rec && !rec.wake) {
            talking = false;
            stopRec(true);
            stopMeter();
            setState('idle');
            heard('');
            $('#jv-input').value = '';
            grow();
        } else if (busy && asking) asking.abort();
        else if (mini) closeMini();
    });
    // the pop-up around this page: it says when it opens and closes
    function closeMini() {
        try {
            window.parent.EGJarvisDock.close();
        } catch {
            /* not in the pop-up */
        }
    }
    let focusWhenReady = false;
    let behindChanged = false; // he changed something the app behind the pop-up shows: it refreshes when the pop-up closes
    window.jarvisMini = {
        opened(focus) {
            const input = $('#jv-input');
            if (focus && input && !input.disabled) input.focus();
            else focusWhenReady = focus; // still loading: as soon as he's ready
        },
        closed() {
            stopSpeaking();
            if (rec && !rec.wake) rec.abort();
            if (behindChanged && !/^\/(mail|docs|sheets|slides|whiteboard|photoedit|videoedit)\b/.test(window.parent.location.pathname)) {
                // (editors and Mail keep what you have open; the other apps simply show the new state)
                behindChanged = false;
                window.parent.location.reload();
            }
        }
    };

    fetch('/api/jarvis/status', { headers: { 'X-EG': '1' } })
        .then(async res => {
            if (res.status === 401) return location.replace('/login?next=%2Fjarvis%2F');
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Jarvis isn’t available');
            status = data;
            log = (data.history || []).filter(m => m && typeof m.content === 'string');
            page();
            if (focusWhenReady && !$('#jv-input').disabled) $('#jv-input').focus();
            // /jarvis/#talk (the widgets, Siri…): start talking; phones need a tap first, so the core asks for one
            if (location.hash === '#talk' && status.on && SR) {
                history.replaceState(null, '', location.pathname + location.search);
                if (appleTouch()) $('#jv-orb').classList.add('invite');
                else {
                    talking = true;
                    held = true;
                    listen();
                }
            }
            resumeWake();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Jarvis is unavailable</h1><p>${esc(e.message)}</p></div>`));
})();
