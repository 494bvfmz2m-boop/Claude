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
    const prefs = { speak: true, wake: false, lang: 'auto', voice: '', rate: 1, pitch: 0.9, ...keep.get(localStorage, PREFS, {}) };
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
    const ACT_ICON = { task: 'check', done: 'check', event: 'calendar', note: 'note', memory: 'sparkle', forget: 'eraser', type: 'pen', email: 'mail', chat: 'send' };
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
                    <input class="input" id="jv-input" placeholder="${dutch() ? 'Vraag Jarvis iets…' : 'Ask Jarvis anything…'}" maxlength="2000" enterkeyhint="send">
                    <button type="button" class="icon-btn" data-mute aria-pressed="${!prefs.speak}"></button>
                    <button class="btn btn-primary jv-send" aria-label="Send">${ic('send')}</button>
                </form>
            </section>
        </div>`;
        $('#jv-sys').textContent = status && status.on ? `Online · ${status.model || status.service}${status.backups && status.backups.length ? ` · ${status.backups.length === 1 ? '1 backup' : `${status.backups.length} backups`}` : ''}` : 'Offline';
        muteButton();
        chips();
        drawLog();
        setState(state);
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
    function bubble(m, i = Infinity) {
        const seen = i < drawn ? ' seen' : '';
        if (m.role === 'user') return `<div class="jv-msg me${seen}"><p>${esc(m.content)}</p></div>`;
        const acts = (m.actions || []).filter(a => a && a.text && !a.draft);
        const drafts = (m.actions || []).filter(a => a && a.draft);
        const act = a => (/^\/[a-z]/.test(String(a.href || '')) ? `<a class="jv-act" href="${esc(a.href)}">${ic(ACT_ICON[a.kind] || 'check')}<span>${esc(a.text)}</span></a>` : `<span class="jv-act">${ic(ACT_ICON[a.kind] || 'check')}<span>${esc(a.text)}</span></span>`);
        return `<div class="jv-msg ai${m.error ? ' bad' : ''}${seen}"><span class="jv-who">${m.error ? ic('alert') : ''}Jarvis</span><p>${esc(m.content)}</p>${acts.length ? `<div class="jv-acts">${acts.map(act).join('')}</div>` : ''}${drafts.map(draftCard).join('')}${m.note ? `<small class="jv-note">${ic('refresh')}${esc(m.note)}</small>` : ''}</div>`;
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
        box.innerHTML = !on ? setup() : bubble({ role: 'assistant', content: greeting() }, drawn ? 0 : Infinity) + log.map((m, i) => bubble(m, i + 1)).join('') + (busy ? '<div class="jv-msg ai jv-wait" aria-label="Jarvis is thinking"><span class="jv-who">Jarvis</span><p><i></i><i></i><i></i></p></div>' : '');
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
                  idle: SR ? (prefs.wake && wakeOk ? (nl ? 'Zeg “Jarvis” en dan je vraag, of tik op de kern.' : 'Say “Jarvis” and then your question, or tap the core.') : nl ? 'Tik op de kern en praat, of typ hieronder.' : 'Tap the core and speak, or type below.') : nl ? 'Typ hieronder. (Praten kan in Chrome, Edge en Safari.)' : 'Type below. (Speaking works in Chrome, Edge and Safari.)',
                  listening: nl ? 'Ik luister…' : 'Listening…',
                  thinking: nl ? 'Even denken…' : 'Thinking…',
                  speaking: nl ? 'Aan het woord. Tik om te stoppen.' : 'Speaking. Tap to stop.'
              }[s];
        $('#jv-status').textContent = line;
        if (s === 'speaking') pulse();
    }
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
    async function send(text) {
        text = String(text || '').trim().slice(0, 2000);
        if (!text || busy || !status || !status.on) return;
        unlockSpeech();
        stopSpeaking();
        pauseWake();
        log.push({ role: 'user', content: text });
        busy = true;
        drawLog();
        setState('thinking');
        let reply = null;
        try {
            if (!where && WEATHERY.test(text)) await locate();
            const res = await fetch('/api/jarvis/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-EG': '1' },
                body: JSON.stringify({ message: text, tz: tz(), where, screen: screenNow() })
            });
            if (res.status === 401) return location.replace('/login?next=%2Fjarvis%2F');
            const data = await res.json().catch(() => ({}));
            if (res.status === 409) {
                status.on = false;
                throw new Error(data.error || 'Jarvis needs an AI service first.');
            }
            if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
            reply = String(data.reply || '…');
            log.push({ role: 'assistant', content: reply, actions: data.actions || [], via: data.service, note: handedOver(data) });
            for (const a of data.actions || []) if (a.kind === 'type' && a.type) typeIntoApp(a);
            if (data.memories) status.memories = data.memories;
        } catch (e) {
            log.push({ role: 'assistant', content: e.message === 'Failed to fetch' ? 'I can’t reach the server just now. Check the connection?' : e.message, error: true });
        } finally {
            busy = false;
            if (status && !status.on) page();
            else drawLog();
        }
        setState('idle');
        if (reply && prefs.speak && synth) speak(reply);
        else resumeWake();
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
                onDone: ok => {
                    a.text = ok ? a.text.replace(/^Writing in/, 'Wrote in') : 'Stopped writing';
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
                    resumeWake();
                };
            synth.speak(u);
        });
        // a voice that never starts (no voices, or blocked until the page is tapped): listen again anyway
        setTimeout(() => run === speakingRun && state !== 'speaking' && !synth.speaking && resumeWake(), 4000);
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
            if (orb) orb.style.setProperty('--lvl', (1 + base + 0.12 * kick).toFixed(3));
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
    // tap and talk: what you say is sent when you stop
    function listen() {
        if (!SR) return toast('Speaking to Jarvis works in Chrome, Edge and Safari. You can always type.');
        unlockSpeech();
        stopSpeaking();
        stopRec(true);
        const r = new SR();
        rec = r;
        r.lang = recLang();
        r.interimResults = true;
        r.continuous = false;
        r.maxAlternatives = 1;
        let said = '';
        r.onresult = e => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) said += e.results[i][0].transcript;
                else interim += e.results[i][0].transcript;
            }
            heard(`${said}${interim}`.trim());
            kick = 1;
        };
        r.onerror = e => {
            if (!micRefused(e) && e.error !== 'no-speech' && e.error !== 'aborted') toast('I didn’t catch that. Try again?', { bad: true });
        };
        r.onend = () => {
            if (rec === r) rec = null;
            heard('');
            if (said.trim()) send(said);
            else {
                setState('idle');
                resumeWake();
            }
        };
        try {
            r.start();
            setState('listening');
            pulse();
        } catch {
            rec = null;
            setState('idle');
        }
    }
    function toggleListen() {
        if (state === 'speaking') return stopSpeaking(), resumeWake();
        if (state === 'listening' && rec && !rec.wake) return rec.stop();
        if (busy) return;
        held = true;
        listen();
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
        if (mini || !SR || !prefs.wake || !wakeOk || held || rec || busy || state === 'speaking' || document.hidden || !status || !status.on) return;
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
                chime();
                if (m[2].trim().length > 2) send(m[2]);
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
            ${synth ? `<label class="jv-row"><span><b>Voice</b><small>Free voices on this device, the most Jarvis-like first. Automatic picks a British man (or a Dutch one, for Dutch answers).</small></span><select class="input" data-voice><option value="">Automatic${auto ? ` (${esc(short(auto))})` : ''}</option>${vs.map(v => `<option value="${esc(v.voiceURI || v.name)}"${(v.voiceURI || v.name) === prefs.voice ? ' selected' : ''}>${esc(short(v))} (${esc(v.lang)})</option>`).join('')}</select></label>
            ${tip() ? `<p class="jv-tip">${ic('sparkle')}<span>${tip()}</span></p>` : ''}
            <label class="jv-row"><span><b>Speed</b></span><input type="range" class="jv-range" data-r="rate" min="0.7" max="1.3" step="0.05" value="${prefs.rate}"></label>
            <label class="jv-row"><span><b>Depth</b><small>Further right is deeper. Not every voice can change it.</small></span><input type="range" class="jv-range jv-depth" data-r="pitch" min="0.6" max="1.2" step="0.05" value="${prefs.pitch}"></label>
            <div class="jv-row jv-row-end"><button type="button" class="btn btn-ghost" data-reset>Like Jarvis</button><button type="button" class="btn" data-try>${ic('volume')}<span>Hear it</span></button></div>` : ''}
            <label class="jv-row"><span><b>I speak</b></span><select class="input" data-lang>${[['auto', 'Like this browser'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['nl-NL', 'Nederlands']].map(([v, l]) => `<option value="${v}"${prefs.lang === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            ${SR ? `<label class="jv-row"><span><b>Wake word “Jarvis”</b><small>Keeps listening while this page is open, so you can say “Jarvis, what’s on today?” without tapping. Your browser turns speech into text (Chrome and Edge do that on their servers).</small></span><input type="checkbox" class="cp-toggle" data-p="wake"${prefs.wake ? ' checked' : ''}></label>` : ''}
            <div class="jv-mem"><b>What he remembers</b><small>Things you asked him to remember, or told him for later. Say “Jarvis, remember that…” or “forget…”.</small><ul id="jv-mem">${memories()}</ul></div>
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
        back.addEventListener('change', e => {
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
        if (e.target.closest('#jv-orb') || e.target.closest('[data-mic]')) return toggleListen();
        if (e.target.closest('[data-settings]')) return status && settings();
        if (e.target.closest('[data-close]')) return closeMini();
        if (e.target.closest('[data-mute]')) {
            prefs.speak = !prefs.speak;
            savePrefs();
            if (!prefs.speak) stopSpeaking();
            muteButton();
            return;
        }
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
        send(text);
    });
    document.addEventListener('keydown', e => {
        if (mini && e.altKey && e.code === 'KeyJ') return e.preventDefault(), closeMini();
        if (e.key !== 'Escape' || document.querySelector('.pf-crop-back')) return;
        if (state === 'speaking') stopSpeaking(), resumeWake();
        else if (state === 'listening' && rec && !rec.wake) rec.abort();
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
    window.jarvisMini = {
        opened(focus) {
            const input = $('#jv-input');
            if (focus && input && !input.disabled) input.focus();
            else focusWhenReady = focus; // still loading: as soon as he's ready
        },
        closed() {
            stopSpeaking();
            if (rec && !rec.wake) rec.abort();
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
            resumeWake();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Jarvis is unavailable</h1><p>${esc(e.message)}</p></div>`));
})();
