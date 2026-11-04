'use strict';

// Jarvis: an AI assistant for admins, like J.A.R.V.I.S. from Iron Man. He runs on the AI service set
// up in Admin → AI (Claude, or a free Gemini or Groq key…) and uses tools to look at and add to your
// agenda, tasks and notes, check your mail and chats, the weather, and how the site is doing.
// If that service stops working (key refused, free limit reached, down), the next one with a key
// takes over in the middle of the answer, so nothing is done twice. His memory (the conversation and
// what he was asked to remember) is kept on the server, so it survives a switch, a reload or a new device.
//   GET    /api/jarvis/status        whether Jarvis can talk to you, how he addresses you, his memory
//   PUT    /api/jarvis/prefs         { address }  "sir", "ma'am", "boss" or your name
//   POST   /api/jarvis/chat          { message, tz, where: { lat, lon } } → { reply, actions, service, switched }
//   DELETE /api/jarvis/history       forget the conversation
//   DELETE /api/jarvis/memory/:id    forget one thing he remembered
//   POST   /api/jarvis/drafts/:id/send   { to?, subject?, text? }  send an email or chat message he wrote, once you tap Send
//   DELETE /api/jarvis/drafts/:id        throw that draft away
// He never sends anything himself: emails and chat messages are drafts you send with a tap. From the
// pop-up in another app he can also look at that page and type into the field you were in.

const express = require('express');
const { wrap, httpError, requireAuth, parseAddresses } = require('../http');
const { createLimiter } = require('../security');
const ai = require('../../lib/ai');

const ADDRESSES = ['name', 'sir', "ma'am", 'boss'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);
const plain = v => String(v || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// what Jarvis can do (descriptions are for the AI)
const TOOLS = [
    { name: 'get_time', description: 'The current date, time and weekday where the user is.', parameters: { type: 'object', properties: {} } },
    { name: 'get_agenda', description: 'Events in the user’s calendar (including shared calendars), from today on.', parameters: { type: 'object', properties: { days: { type: 'integer', description: 'How many days to look ahead, 1 (just today) to 14. Default 1.' }, from: { type: 'string', description: 'Start day as YYYY-MM-DD, if not today.' } } } },
    { name: 'add_event', description: 'Add an event to the user’s calendar.', parameters: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: 'HH:MM, 24-hour. Leave out for an all-day event.' }, minutes: { type: 'integer', description: 'How long, in minutes (default 60).' }, location: { type: 'string' } }, required: ['title', 'date'] } },
    { name: 'get_tasks', description: 'The user’s open tasks (with due dates, late and starred ones) and how many were done today.', parameters: { type: 'object', properties: {} } },
    { name: 'add_task', description: 'Add a task to the user’s task list.', parameters: { type: 'object', properties: { text: { type: 'string' }, due: { type: 'string', description: 'YYYY-MM-DD, if it has a due date.' }, starred: { type: 'boolean' } }, required: ['text'] } },
    { name: 'complete_task', description: 'Tick off one of the user’s open tasks, found by (part of) its text.', parameters: { type: 'object', properties: { text: { type: 'string', description: 'The task’s text, or a distinctive part of it.' } }, required: ['text'] } },
    { name: 'get_notes', description: 'The user’s notes (title and the start of the text), pinned first, optionally only those matching a search.', parameters: { type: 'object', properties: { search: { type: 'string' } } } },
    { name: 'add_note', description: 'Write a new note for the user.', parameters: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['text'] } },
    { name: 'check_mail', description: 'How many unread emails are in the user’s inbox, and who the latest unread ones are from, with their subjects.', parameters: { type: 'object', properties: {} } },
    { name: 'check_chats', description: 'Unread chat messages on EderveenGroup and Planner cards due this week.', parameters: { type: 'object', properties: {} } },
    { name: 'get_weather', description: 'The weather where the user is now and the next three days.', parameters: { type: 'object', properties: {} } },
    { name: 'site_status', description: 'How the user’s EderveenGroup site is doing (they are its admin): people, who was active this week, sign-in requests waiting, failed sign-ins, the version, storage.', parameters: { type: 'object', properties: {} } },
    { name: 'remember', description: 'Keep something about the user for later conversations: a preference, a birthday, a name, a plan, or anything they ask you to remember. One short fact per call, written so it makes sense on its own later.', parameters: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] } },
    { name: 'forget', description: 'Forget something you remembered, when the user asks you to. Give (part of) what you remembered.', parameters: { type: 'object', properties: { about: { type: 'string' } }, required: ['about'] } },
    { name: 'find_people', description: 'Look up people by name: the user’s contacts, people they have emailed, and people on EderveenGroup (who can be sent chat messages). Gives their email addresses and usernames.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    { name: 'write_email', description: 'Write an email for the user. It is shown to them as a draft they can change and send with a tap: you can’t send it yourself. Use email addresses (find_people turns names into addresses).', parameters: { type: 'object', properties: { to: { type: 'array', items: { type: 'string' }, description: 'Email addresses' }, cc: { type: 'array', items: { type: 'string' } }, subject: { type: 'string' }, body: { type: 'string', description: 'The whole email, plain text, with a greeting and a sign-off in their name.' } }, required: ['to', 'subject', 'body'] } },
    { name: 'write_chat', description: 'Write a chat message on EderveenGroup for the user to someone there. It is shown as a draft they send with a tap: you can’t send it yourself.', parameters: { type: 'object', properties: { to: { type: 'string', description: 'Their username, email address or name.' }, text: { type: 'string' } }, required: ['to', 'text'] } }
];
// only when he's the pop-up over another app: what's on that page, and writing into it
const SCREEN_TOOLS = [
    { name: 'look_at_screen', description: 'What the user has open right now in the app behind you: the app, the page title, the field they were typing in, any selected text and the text on the page.', parameters: { type: 'object', properties: {} } },
    { name: 'type_here', description: 'Write text into the app behind you, where the user’s cursor was (a document, a note, an email, a chat box, a field). It appears there letter by letter. Plain text in their language; separate paragraphs with a blank line; no markdown or symbols.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }
];
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;
const MAX_LOG = 40; // messages kept (the AI is sent the last 16)
const MAX_FACTS = 60;

module.exports = function jarvisRoutes(ctx) {
    const { store, config } = ctx;
    const r = express.Router();
    r.use('/jarvis', requireAuth);
    r.use('/jarvis', (req, res, next) => {
        if (!ctx.isAdmin(req.session.email)) return res.status(403).json({ error: 'Jarvis is for admins' });
        if (ctx.appOn && !ctx.appOn('jarvis')) return res.status(404).json({ error: 'Jarvis is switched off on this EderveenGroup' });
        next();
    });
    const talks = createLimiter({ max: 200, windowMs: 60 * 60 * 1000 });
    // his memory, one record per admin: { prefs, log: [{ role, content, actions, via, at }], facts: [{ id, text, at }] }
    const mind = email => {
        const items = (store.getApp(email, 'jarvis') || {}).items || {};
        return { prefs: items.prefs || {}, log: Array.isArray(items.log) ? items.log : [], facts: Array.isArray(items.facts) ? items.facts : [], drafts: Array.isArray(items.drafts) ? items.drafts : [] };
    };
    const change = (email, fn) => {
        const m = mind(email);
        fn(m);
        m.log = m.log.slice(-MAX_LOG);
        m.facts = m.facts.slice(-MAX_FACTS);
        m.drafts = m.drafts.filter(d => Date.now() - d.at < 3 * 864e5).slice(-20); // drafts keep three days
        store.setApp(email, 'jarvis', { items: m });
        return m;
    };
    const prefsOf = email => mind(email).prefs;
    const newId = () => `m${require('crypto').randomBytes(6).toString('base64url')}`;
    // the first name: from the display name, or else the username ("jo.smith" → "Jo")
    const nameOf = email => {
        const s = store.getSettings(email) || {};
        const shown = String(s.displayName || '').trim().split(/\s+/)[0];
        if (shown) return shown;
        const u = String(store.usernameOf(email) || email.split('@')[0]).split(/[._-]/)[0] || 'there';
        return u.charAt(0).toUpperCase() + u.slice(1);
    };
    const addressOf = email => {
        const a = prefsOf(email).address;
        return ADDRESSES.includes(a) && a !== 'name' ? a : nameOf(email);
    };

    r.get('/jarvis/status', (req, res) => {
        const list = ctx.aiServices ? ctx.aiServices() : [];
        const s = list[0];
        // the pop-up button in every app only asks whether Jarvis is there (?lite=1)
        if (req.query.lite) return res.json({ on: !!s, service: s ? s.name : null });
        const m = mind(req.session.email);
        res.json({ on: !!s, service: s ? s.name : null, model: s ? s.label : null, backups: list.slice(1).map(x => x.name), name: nameOf(req.session.email), address: m.prefs.address || 'name', addresses: ADDRESSES, history: m.log, memories: m.facts });
    });
    r.put('/jarvis/prefs', (req, res) => {
        const a = (req.body || {}).address;
        if (!ADDRESSES.includes(a)) throw httpError(400, 'Pick one of the ways to be addressed');
        change(req.session.email, m => (m.prefs = { ...m.prefs, address: a }));
        res.json({ ok: true, address: a });
    });
    r.delete('/jarvis/history', (req, res) => {
        change(req.session.email, m => (m.log = []));
        res.json({ ok: true });
    });
    r.delete('/jarvis/memory/:id', (req, res) => {
        let found = false;
        const m = change(req.session.email, x => {
            found = x.facts.some(f => f.id === req.params.id);
            x.facts = x.facts.filter(f => f.id !== req.params.id);
        });
        if (!found) throw httpError(404, 'He doesn’t remember that');
        res.json({ ok: true, memories: m.facts });
    });

    /* ---------- people, for emails and chat messages ---------- */
    // everyone matching a name: their contacts, people they've emailed, and people on EderveenGroup
    async function peopleFor(email, q, chatOnly = false) {
        const out = new Map();
        const add = (p, source) => {
            const k = String(p.email || '').toLowerCase();
            if (!k) return;
            const cur = out.get(k) || { name: '', email: k, username: '', from: [] };
            if (p.name && !cur.name) cur.name = p.name;
            if (p.username) cur.username = p.username;
            if (!cur.from.includes(source)) cur.from.push(source);
            out.set(k, cur);
        };
        const match = (...xs) => xs.some(x => String(x || '').toLowerCase().includes(q));
        const onSite = ctx.chatPeople ? await ctx.chatPeople(email) : [];
        for (const p of onSite) if (match(p.name, p.username, p.email)) add(p, 'EderveenGroup');
        if (!chatOnly) {
            for (const c of ctx.appItems.list(email, 'contacts')) if (match(c.name, c.company, c.username, ...(c.emails || []))) for (const e of c.emails || []) add({ name: c.name, email: e }, 'contacts');
            for (const c of store.searchContacts(email, q, 20)) add({ name: c.name, email: c.address }, 'mailed before');
        }
        const exact = p => [p.name, p.username, p.email].some(x => String(x || '').toLowerCase() === q) || String(p.name || '').toLowerCase().split(/\s+/)[0] === q;
        const list = [...out.values()].map(p => ({ ...p, onEderveenGroup: onSite.some(x => x.email === p.email), exact: exact(p) }));
        return (chatOnly ? list.filter(p => p.onEderveenGroup) : list).slice(0, 10);
    }
    // addresses for an email: given as addresses, or names looked up (asking back when it's unclear)
    async function addressesFor(email, list, optional = false) {
        const out = [];
        for (const raw of [].concat(list || []).map(x => clip(x, 254)).filter(Boolean).slice(0, 20)) {
            const m = /<([^>]+)>/.exec(raw);
            const addr = (m ? m[1] : raw).trim().toLowerCase();
            if (EMAIL_RE.test(addr)) {
                out.push({ name: m ? raw.replace(/<[^>]+>/, '').replace(/"/g, '').trim() : '', address: addr });
                continue;
            }
            const found = await peopleFor(email, raw.toLowerCase());
            const sure = found.length === 1 ? found[0] : found.filter(p => p.exact).length === 1 ? found.find(p => p.exact) : null;
            if (sure) out.push({ name: sure.name, address: sure.email });
            else return { list: [], unclear: found.length ? `More than one address matches “${raw}”: ask which (${found.slice(0, 5).map(p => `${p.name || p.email} <${p.email}>`).join(', ')}).` : `No address found for “${raw}”: ask for their email address.` };
        }
        if (!optional && !out.length) return { list: [], unclear: 'Who should it go to? Ask for a name or an email address.' };
        return { list: out };
    }
    const escHtml = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

    /* ---------- the tools ---------- */
    function toolsFor(req, tz, where, screen) {
        const email = req.session.email;
        const now = () => ctx.localOf(new Date().toISOString(), tz);
        const today = () => now().slice(0, 10);
        const items = app => ctx.appItems.list(email, app);
        const actions = [];
        const plus = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
        const run = async (name, input) => {
            switch (name) {
                case 'get_time': {
                    const t = now();
                    return { date: t.slice(0, 10), time: t.slice(11), weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${t.slice(0, 10)}T12:00:00Z`)), timezone: tz };
                }
                case 'get_agenda': {
                    const days = Math.max(1, Math.min(14, Math.round(Number(input.days) || 1)));
                    const from = DAY.test(String(input.from || '')) ? input.from : today();
                    const evs = await ctx.agendaFor(email, tz, from, days);
                    return { from, days, events: evs.slice(0, 40).map(e => ({ title: e.title, day: e.day, time: e.allDay ? 'all day' : e.at, ends: e.end || undefined, where: e.location || undefined })) };
                }
                case 'add_event': {
                    const title = clip(input.title, 140);
                    const date = String(input.date || '');
                    if (!title || !DAY.test(date)) throw new Error('An event needs a title and a date (YYYY-MM-DD)');
                    const time = TIME.test(String(input.time || '')) ? input.time : null;
                    const minutes = Math.max(5, Math.min(24 * 60, Math.round(Number(input.minutes) || 60)));
                    const endAt = time ? new Date(Date.parse(`${date}T${time}:00Z`) + minutes * 60000).toISOString().slice(0, 16) : null;
                    const e = ctx.appItems.put(email, 'calendar', time ? { title, start: `${date}T${time}`, end: endAt, location: clip(input.location, 200) } : { title, allDay: true, start: date, end: date, location: clip(input.location, 200) });
                    actions.push({ kind: 'event', text: `Added “${e.title}” on ${date}${time ? ` at ${time}` : ''}`, href: '/calendar/' });
                    return { added: { title: e.title, start: e.start, end: e.end, allDay: !!e.allDay } };
                }
                case 'get_tasks': {
                    const all = items('tasks');
                    const t = today();
                    const open = all.filter(x => !x.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
                    return { open: open.slice(0, 40).map(x => ({ text: x.text, due: x.due || undefined, late: !!(x.due && x.due < t) || undefined, starred: x.starred || undefined })), openCount: open.length, doneToday: all.filter(x => x.done && x.doneAt && ctx.localOf(new Date(x.doneAt).toISOString(), tz).slice(0, 10) === t).length };
                }
                case 'add_task': {
                    const text = clip(input.text, 300);
                    if (!text) throw new Error('A task needs some text');
                    const due = DAY.test(String(input.due || '')) ? input.due : '';
                    const tk = ctx.appItems.put(email, 'tasks', { text, due, starred: !!input.starred });
                    actions.push({ kind: 'task', text: `Added task “${tk.text}”${due ? ` (due ${due === today() ? 'today' : due === plus(today(), 1) ? 'tomorrow' : due})` : ''}`, href: '/tasks/' });
                    return { added: { text: tk.text, due: tk.due || undefined } };
                }
                case 'complete_task': {
                    const q = clip(input.text, 300).toLowerCase();
                    if (!q) throw new Error('Say which task');
                    const open = items('tasks').filter(x => !x.done);
                    const hits = open.filter(x => x.text.toLowerCase() === q).concat(open.filter(x => x.text.toLowerCase() !== q && x.text.toLowerCase().includes(q)));
                    if (!hits.length) return { done: null, note: 'No open task matches that', open: open.slice(0, 15).map(x => x.text) };
                    if (hits.length > 1 && hits[0].text.toLowerCase() !== q) return { done: null, note: 'More than one task matches: ask which', matches: hits.slice(0, 6).map(x => x.text) };
                    const tk = ctx.appItems.put(email, 'tasks', { ...hits[0], done: true, doneAt: Date.now() }, hits[0].id);
                    actions.push({ kind: 'done', text: `Ticked off “${tk.text}”`, href: '/tasks/' });
                    return { done: tk.text };
                }
                case 'get_notes': {
                    const q = clip(input.search, 100).toLowerCase();
                    const notes = items('notes')
                        .map(n => ({ ...n, plain: plain(n.body) }))
                        .filter(n => !q || `${n.title} ${n.plain}`.toLowerCase().includes(q))
                        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
                    return { count: notes.length, notes: notes.slice(0, 15).map(n => ({ title: n.title || undefined, text: n.plain.slice(0, 400), pinned: n.pinned || undefined, updated: new Date(n.updatedAt || 0).toISOString().slice(0, 10) })) };
                }
                case 'add_note': {
                    const text = clip(input.text, 4000);
                    if (!text) throw new Error('A note needs some text');
                    const n = ctx.appItems.put(email, 'notes', { title: clip(input.title, 140), body: text });
                    actions.push({ kind: 'note', text: `Wrote a note${n.title ? ` “${n.title}”` : ''}`, href: '/notes/' });
                    return { added: { title: n.title || undefined } };
                }
                case 'check_mail': {
                    // straight from the mailbox, with your own sign-in; otherwise the last count seen
                    try {
                        const listed = await Promise.race([
                            (async () => {
                                const folders = await ctx.mail.listFolders(req.session);
                                const inbox = folders.find(f => f.specialUse === '\\Inbox' || f.path === 'INBOX');
                                const page = inbox && inbox.unseen ? await ctx.mail.listMessages(req.session, inbox.path, { filter: 'unread' }) : { messages: [] };
                                return { unread: inbox ? inbox.unseen : 0, latest: (page.messages || []).slice(0, 8).map(m => ({ from: (m.from && m.from[0] && (m.from[0].name || m.from[0].address)) || '', subject: m.subject || '(no subject)', when: m.date })) };
                            })(),
                            new Promise((_, no) => setTimeout(() => no(new Error('slow')), 10000))
                        ]);
                        return listed;
                    } catch {
                        const c = ((store.getApp(email, 'mailcount') || { items: {} }).items || {}).inbox;
                        return c ? { unread: c.unread, asOf: new Date(c.at).toISOString(), note: 'The mail server didn’t answer just now; this is the last count.' } : { unread: null, note: 'The mail server didn’t answer just now.' };
                    }
                }
                case 'check_chats': {
                    const x = ctx.summaryExtras ? await ctx.summaryExtras(email) : {};
                    return { unreadChats: x.chat == null ? null : x.chat, plannerCardsDueThisWeek: x.boardDue == null ? null : x.boardDue };
                }
                case 'get_weather': {
                    if (!where) return { error: 'The user’s location isn’t known (their browser didn’t share it).' };
                    const url = `https://api.open-meteo.com/v1/forecast?latitude=${where.lat.toFixed(3)}&longitude=${where.lon.toFixed(3)}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=4`;
                    const res = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null);
                    if (!res || !res.ok) throw new Error('The weather service (Open-Meteo) didn’t answer just now');
                    const w = await res.json();
                    return { units: 'Celsius, km/h, %', codes: 'WMO weather codes (0 clear, 1-3 cloudy, 45 fog, 51-67 drizzle/rain, 71-77 snow, 80-82 showers, 95+ thunder)', now: w.current, days: (w.daily && w.daily.time ? w.daily.time : []).map((d, i) => ({ day: d, code: w.daily.weather_code[i], max: w.daily.temperature_2m_max[i], min: w.daily.temperature_2m_min[i], rainChance: w.daily.precipitation_probability_max[i] })) };
                }
                case 'site_status': {
                    const o = ctx.adminOverview ? await ctx.adminOverview() : {};
                    let version = '';
                    try {
                        version = require('../../package.json').version;
                    } catch {
                        version = '';
                    }
                    return { people: o.people, activeThisWeek: o.activeWeek, signInRequestsWaiting: o.pending, failedSignInsThisWeek: o.failedWeek, usingTwoStep: o.twofa, publicProfiles: o.publicProfiles, storage: o.database, version, signInWith: o.signIns };
                }
                case 'find_people': {
                    const q = clip(input.name, 80).toLowerCase().replace(/^@/, '');
                    if (!q) throw new Error('Say whose name to look up');
                    return { people: await peopleFor(email, q) };
                }
                case 'write_email': {
                    const to = await addressesFor(email, input.to);
                    const cc = await addressesFor(email, input.cc || [], true);
                    if (to.unclear) return { draft: null, note: to.unclear };
                    if (cc.unclear) return { draft: null, note: cc.unclear };
                    const subject = clip(input.subject, 200);
                    const body = String(input.body || '').replace(/\r/g, '').slice(0, 20000).trim();
                    if (!to.list.length || !body) throw new Error('An email needs someone to send it to and some text');
                    const d = { id: newId(), kind: 'email', to: to.list, cc: cc.list, subject, body, at: Date.now() };
                    change(email, m => m.drafts.push(d));
                    actions.push({ kind: 'email', text: `Email to ${d.to.map(a => a.name || a.address).join(', ')}`, draft: d });
                    return { draft: { to: d.to, subject }, note: 'It’s shown to them as a draft with a Send button; it is not sent until they tap Send.' };
                }
                case 'write_chat': {
                    const people = await peopleFor(email, clip(input.to, 120).toLowerCase().replace(/^@/, ''), true);
                    const text = String(input.text || '').slice(0, 4000).trim();
                    if (!text) throw new Error('A chat message needs some text');
                    if (!people.length) return { draft: null, note: 'Nobody on EderveenGroup matches that name, so a chat message can’t be sent to them (maybe write an email instead).' };
                    if (people.length > 1 && !people.some(p => p.exact)) return { draft: null, note: 'More than one person matches: ask which', matches: people.slice(0, 6).map(p => ({ name: p.name, username: p.username })) };
                    const who = people.find(p => p.exact) || people[0];
                    const d = { id: newId(), kind: 'chat', to: [{ name: who.name || `@${who.username}`, address: who.email, username: who.username }], text, at: Date.now() };
                    change(email, m => m.drafts.push(d));
                    actions.push({ kind: 'chat', text: `Chat message to ${d.to[0].name}`, draft: d });
                    return { draft: { to: d.to[0].name }, note: 'It’s shown to them as a draft with a Send button; it is not sent until they tap Send.' };
                }
                case 'look_at_screen': {
                    if (!screen) return { note: 'You can only see their screen from the small Jarvis window in another app.' };
                    return screen;
                }
                case 'type_here': {
                    if (!screen) return { typed: false, note: 'Typing into an app only works from the small Jarvis window in that app.' };
                    if (!screen.focused) return { typed: false, note: 'They haven’t clicked into anything to write in: ask them to click where the text should go, then ask again.' };
                    const text = String(input.text || '').replace(/\r/g, '').slice(0, 20000);
                    if (!text.trim()) throw new Error('Nothing to type');
                    actions.push({ kind: 'type', text: `Writing in ${screen.app || 'the app'}`, type: text });
                    return { typed: true, where: `${screen.focused.kind}${screen.focused.label ? ` “${screen.focused.label}”` : ''} in ${screen.app}`, note: 'It’s being typed there now, letter by letter. Just say so in a few words; don’t repeat the text.' };
                }
                case 'remember': {
                    const text = clip(input.fact, 300);
                    if (!text) throw new Error('Say what to remember');
                    let note = null;
                    change(email, m => {
                        if (m.facts.some(f => f.text.toLowerCase() === text.toLowerCase())) note = 'Already remembered';
                        else if (m.facts.length >= MAX_FACTS) note = 'full';
                        else m.facts.push({ id: newId(), text, at: Date.now() });
                    });
                    if (note === 'full') return { remembered: null, note: `Your memory is full (${MAX_FACTS} things). Ask which old thing to forget first.` };
                    if (!note) actions.push({ kind: 'memory', text: `Remembered: ${text}` });
                    return { remembered: text, note: note || undefined };
                }
                case 'forget': {
                    const q = clip(input.about, 200).toLowerCase();
                    if (!q) throw new Error('Say what to forget');
                    const facts = mind(email).facts;
                    const words = q.split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3);
                    let hits = facts.filter(f => f.text.toLowerCase().includes(q) || q.includes(f.text.toLowerCase()));
                    if (!hits.length && words.length) hits = facts.filter(f => words.every(w => f.text.toLowerCase().includes(w)));
                    if (!hits.length) return { forgot: [], note: 'Nothing you remember matches that', remembered: facts.slice(-20).map(f => f.text) };
                    if (hits.length > 3) return { forgot: [], note: 'Several things match: ask which', matches: hits.slice(0, 8).map(f => f.text) };
                    change(email, m => (m.facts = m.facts.filter(f => !hits.some(h => h.id === f.id))));
                    actions.push({ kind: 'forget', text: `Forgot: ${hits.map(h => h.text).join('; ')}` });
                    return { forgot: hits.map(h => h.text) };
                }
                default:
                    throw new Error(`No tool called ${name}`);
            }
        };
        return { run, actions };
    }

    /* ---------- talking ---------- */
    function system(email, tz, where, done = [], screen = null) {
        const t = ctx.localOf(new Date().toISOString(), tz);
        const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${t.slice(0, 10)}T12:00:00Z`));
        const address = addressOf(email);
        return `You are J.A.R.V.I.S. (Jarvis), the personal AI assistant built into EderveenGroup, the private hub for mail, calendar, tasks, notes, files and more that ${nameOf(email)} runs as its administrator. You are speaking with ${nameOf(email)}. Address them as "${address}" now and then, the way Jarvis speaks to Tony Stark: calm, precise, loyal and quietly capable, with a dry, understated British wit. Keep the humour light and never overdo it.

Your replies are often read aloud, so:
- Be brief: one to three short sentences, unless they ask for detail or a briefing.
- No markdown, no emoji, no web addresses; a short list only when it really helps.
- Reply in the language they use (often Dutch or English).

Use your tools for anything about their agenda, tasks, notes, mail, chats, the weather or the site: never guess or make things up. When asked to add or tick off something, do it with a tool, then confirm in a few words. If something is unclear (which task, what time, which day), ask one short question first. You cannot delete any of their things (events, tasks, notes, mail). You can write emails and chat messages for them (write_email, write_chat; find_people turns names into addresses), but you never send anything yourself: they're shown as drafts with a Send button. Say in a few words what you wrote and that it's ready to send; don't read the whole message out. For a briefing, look at today's agenda, tasks due, unread mail and chats${where ? ', the weather' : ''} and the site, and sum up what matters.

You remember the recent conversation. For anything worth keeping longer (a preference, a birthday, a name, a plan) or when they ask you to remember something, save it with remember; when they ask you to forget something, use forget.${memoryOf(email)}${screenOf(screen)}${handover(done)}

Now: ${weekday}, ${t.slice(11)} (${tz}).`;
    }
    function screenOf(screen) {
        if (!screen) return '';
        return `\n\nThey're talking to you from the small Jarvis window over the ${screen.app || 'an'} app (“${screen.title}”).${screen.focused ? ` Their cursor was in: ${screen.focused.kind}${screen.focused.label ? ` “${screen.focused.label}”` : ''}.` : ''} When they ask you to write something there (in a document, a note, a field), write it with type_here: it's typed where their cursor is. Use look_at_screen when you need to see what they have open.`;
    }
    function memoryOf(email) {
        const facts = mind(email).facts;
        return facts.length ? `\n\nWhat you remember about them from earlier conversations (use it naturally, don't recite it):\n${facts.map(f => `- ${f.text}`).join('\n')}` : '';
    }
    // a backup service taking over halfway: what was already done, so it isn't done twice
    function handover(done) {
        if (!done.length) return '';
        let room = 10000;
        const lines = done.map(d => {
            const line = `- ${d.name}(${JSON.stringify(d.input || {})}) → ${JSON.stringify(d.out === undefined ? null : d.out).slice(0, Math.max(200, Math.min(1500, room)))}`;
            room -= line.length;
            return line;
        });
        return `\n\nThis answer was started on another AI service, which stopped working. For their latest message you already used these tools; don't use them again for the same thing, use what they found and carry on:\n${lines.join('\n')}`;
    }
    // a service that just failed waits its turn for a few minutes (the others go first)
    const resting = new Map();
    const ordered = list => {
        const now = Date.now();
        return [...list.filter(s => !(resting.get(s.provider) > now)), ...list.filter(s => resting.get(s.provider) > now)];
    };

    /* ---------- his drafts: sent only when you tap Send ---------- */
    const sends = createLimiter({ max: 30, windowMs: 60 * 60 * 1000 });
    const markDraft = (email, id, what) =>
        change(email, m => {
            m.drafts = m.drafts.filter(x => x.id !== id);
            for (const e of m.log) for (const a of e.actions || []) if (a.draft && a.draft.id === id) a[what] = Date.now();
        });
    r.post('/jarvis/drafts/:id/send', wrap(async (req, res) => {
        const email = req.session.email;
        const d = mind(email).drafts.find(x => x.id === req.params.id);
        if (!d) throw httpError(404, 'That draft isn’t here any more');
        if (sends.blocked(email)) throw httpError(429, 'That’s a lot of messages this hour');
        const b = req.body || {};
        let href;
        if (d.kind === 'email') {
            const to = b.to !== undefined ? parseAddresses(b.to) : d.to;
            if (!to.length || to.some(a => !EMAIL_RE.test(a.address))) throw httpError(400, 'Check the email addresses');
            const subject = b.subject !== undefined ? clip(b.subject, 200) : d.subject;
            const text = (b.text !== undefined ? String(b.text) : d.body).replace(/\r/g, '').slice(0, 20000);
            if (!text.trim()) throw httpError(400, 'The email is empty');
            const settings = store.getSettings(email) || {};
            const html = text.split(/\n{2,}/).map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
            sends.hit(email);
            try {
                await ctx.mail.sendMessage(req.session, { fromName: settings.displayName || '', to, cc: d.cc || [], bcc: [], subject, html, text, attachments: [] }, { saveSentCopy: settings.saveSentCopy !== false });
            } catch (e) {
                throw Object.assign(httpError(e.status && e.status < 500 ? e.status : 502, `The email couldn’t be sent: ${e.message}`), { expose: true });
            }
            store.rememberContacts(email, [...to, ...(d.cc || [])]);
            href = '/mail/';
        } else {
            const text = (b.text !== undefined ? String(b.text) : d.text).slice(0, 4000).trim();
            if (!text) throw httpError(400, 'The message is empty');
            if (!ctx.chatSend) throw httpError(404, 'Chat isn’t available');
            sends.hit(email);
            const sent = await ctx.chatSend(email, d.to.map(a => a.address), text);
            href = `/chat/#${sent.cid}`;
        }
        markDraft(email, d.id, 'sent');
        res.json({ ok: true, href });
    }));
    r.delete('/jarvis/drafts/:id', (req, res) => {
        markDraft(req.session.email, req.params.id, 'discarded');
        res.json({ ok: true });
    });

    r.post('/jarvis/chat', wrap(async (req, res) => {
        const email = req.session.email;
        const list = ctx.aiServices ? ctx.aiServices() : [];
        if (!list.length) throw Object.assign(httpError(409, 'Jarvis needs an AI service. Add a key in Admin → AI (a free Gemini key works).'), { expose: true });
        if (talks.blocked(email)) throw httpError(429, 'That’s a lot of talking this hour. Give me a moment, I’ll be right here.');
        talks.hit(email);
        const b = req.body || {};
        const tz = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(String(b.tz || '')) && (() => {
            try {
                new Intl.DateTimeFormat('en', { timeZone: b.tz });
                return true;
            } catch {
                return false;
            }
        })() ? b.tz : 'UTC';
        const lat = Number(b.where && b.where.lat);
        const lon = Number(b.where && b.where.lon);
        const where = isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && b.where ? { lat, lon } : null;
        const said = clip(b.message, 4000);
        if (!said) throw httpError(400, 'Say something first');
        // his memory of the conversation, then what was just said (providers want turns to alternate)
        const turns = [];
        for (const m of [...mind(email).log.filter(m => (m.role === 'user' || m.role === 'assistant') && m.content).slice(-15), { role: 'user', content: said }]) {
            const content = String(m.content).slice(0, 4000);
            if (turns.length && turns[turns.length - 1].role === m.role) turns[turns.length - 1].content += `\n${content}`;
            else turns.push({ role: m.role, content });
        }
        while (turns.length && turns[0].role !== 'user') turns.shift();
        // from the pop-up in another app: what's on that page (only sent from there)
        const sc = b.screen && typeof b.screen === 'object' ? b.screen : null;
        const screen = sc ? { app: clip(sc.app, 40), title: clip(sc.title, 200), path: clip(sc.path, 200), focused: sc.focused && typeof sc.focused === 'object' ? { kind: clip(sc.focused.kind, 40), label: clip(sc.focused.label, 120) } : null, selected: String(sc.selected || '').slice(0, 4000), text: String(sc.text || '').slice(0, 12000) } : null;
        const { run, actions } = toolsFor(req, tz, where, screen);
        // what the tools did, so a backup service can carry on without doing it again
        const done = [];
        const called = [];
        const tracked = async (name, input) => {
            called.push(name);
            const found = await run(name, input);
            done.push({ name, input, out: found });
            return found;
        };
        const switched = [];
        let out = null;
        let by = null;
        let last = null;
        for (const s of ordered(list)) {
            try {
                out = await ai.converse({ provider: s.provider, apiKey: s.apiKey, baseURL: s.baseURL, model: s.model, system: system(email, tz, where, done, screen), messages: turns, tools: screen ? TOOLS.concat(SCREEN_TOOLS) : TOOLS, run: tracked, timeoutMs: 45 * 1000, retries: 1 });
                by = s;
                resting.delete(s.provider);
                break;
            } catch (e) {
                if (!(e instanceof ai.AiError)) throw e;
                last = e;
                switched.push({ name: s.name, error: e.message });
                resting.set(s.provider, Date.now() + (e.status === 429 ? 3 : 1) * 60 * 1000);
            }
        }
        if (!out && !actions.length) throw Object.assign(httpError(last.status || 502, switched.length > 1 ? `None of the AI services answered. ${switched.map(x => `${x.name}: ${x.error}`).join(' ')}` : last.message), { expose: true });
        // every service stopped halfway, after doing something: say what was done
        const reply = out ? String(out.text || '…') : `${actions.map(a => a.text).join('. ')}. Then I lost my connection to the AI services, so I couldn’t finish. ${last.message}`;
        if (out && ctx.aiCount) ctx.aiCount(out.usage || {});
        const at = Date.now();
        const m = change(email, x => x.log.push({ role: 'user', content: said, at }, { role: 'assistant', content: reply.slice(0, 6000), actions, via: by ? by.name : null, at }));
        res.json({ reply, actions, used: called, service: by ? by.name : null, model: by ? (ctx.aiNamed ? ctx.aiNamed(by.provider, out.model) : out.model) : null, switched, memories: m.facts });
    }));
    return r;
};

module.exports.TOOLS = TOOLS;
