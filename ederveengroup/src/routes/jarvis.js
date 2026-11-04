'use strict';

// Jarvis: an AI assistant for admins, like J.A.R.V.I.S. from Iron Man. He runs on the AI service set
// up in Admin → AI (Claude, or a free Gemini or Groq key…) and uses tools to look at and add to your
// agenda, tasks and notes, check your mail and chats, the weather, and how the site is doing.
//   GET  /api/jarvis/status     whether Jarvis can talk to you, and how he addresses you
//   PUT  /api/jarvis/prefs      { address }  "sir", "ma'am", "boss" or your name
//   POST /api/jarvis/chat       { messages: [{ role, content }], tz, where: { lat, lon } } → { reply, actions }

const express = require('express');
const { wrap, httpError, requireAuth } = require('../http');
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
    { name: 'site_status', description: 'How the user’s EderveenGroup site is doing (they are its admin): people, who was active this week, sign-in requests waiting, failed sign-ins, the version, storage.', parameters: { type: 'object', properties: {} } }
];

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
    const prefsOf = email => ((store.getApp(email, 'jarvis') || { items: {} }).items || {}).prefs || {};
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
        const s = ctx.aiService ? ctx.aiService() : null;
        res.json({ on: !!s, service: s ? s.name : null, model: s ? s.label : null, name: nameOf(req.session.email), address: prefsOf(req.session.email).address || 'name', addresses: ADDRESSES });
    });
    r.put('/jarvis/prefs', (req, res) => {
        const a = (req.body || {}).address;
        if (!ADDRESSES.includes(a)) throw httpError(400, 'Pick one of the ways to be addressed');
        store.setApp(req.session.email, 'jarvis', { items: { prefs: { ...prefsOf(req.session.email), address: a } } });
        res.json({ ok: true, address: a });
    });

    /* ---------- the tools ---------- */
    function toolsFor(req, tz, where) {
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
                default:
                    throw new Error(`No tool called ${name}`);
            }
        };
        return { run, actions };
    }

    /* ---------- talking ---------- */
    function system(email, tz, where) {
        const t = ctx.localOf(new Date().toISOString(), tz);
        const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${t.slice(0, 10)}T12:00:00Z`));
        const address = addressOf(email);
        return `You are J.A.R.V.I.S. (Jarvis), the personal AI assistant built into EderveenGroup, the private hub for mail, calendar, tasks, notes, files and more that ${nameOf(email)} runs as its administrator. You are speaking with ${nameOf(email)}. Address them as "${address}" now and then, the way Jarvis speaks to Tony Stark: calm, precise, loyal and quietly capable, with a dry, understated British wit. Keep the humour light and never overdo it.

Your replies are often read aloud, so:
- Be brief: one to three short sentences, unless they ask for detail or a briefing.
- No markdown, no emoji, no web addresses; a short list only when it really helps.
- Reply in the language they use (often Dutch or English).

Use your tools for anything about their agenda, tasks, notes, mail, chats, the weather or the site: never guess or make things up. When asked to add or tick off something, do it with a tool, then confirm in a few words. If something is unclear (which task, what time, which day), ask one short question first. You cannot delete anything or send messages to other people; say so politely if asked. For a briefing, look at today's agenda, tasks due, unread mail and chats${where ? ', the weather' : ''} and the site, and sum up what matters.

Now: ${weekday}, ${t.slice(11)} (${tz}).`;
    }

    r.post('/jarvis/chat', wrap(async (req, res) => {
        const email = req.session.email;
        const s = ctx.aiService ? ctx.aiService() : null;
        if (!s) throw Object.assign(httpError(409, 'Jarvis needs an AI service. Add a key in Admin → AI (a free Gemini key works).'), { expose: true });
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
        // the conversation so far: plain words, the last few turns, ending with what was just said
        const messages = [].concat(b.messages || []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && clip(m.content, 4000)).slice(-16).map(m => ({ role: m.role, content: clip(m.content, 4000) }));
        while (messages.length && messages[0].role !== 'user') messages.shift();
        if (!messages.length || messages[messages.length - 1].role !== 'user') throw httpError(400, 'Say something first');
        // providers want turns to alternate
        const turns = [];
        for (const m of messages) {
            if (turns.length && turns[turns.length - 1].role === m.role) turns[turns.length - 1].content += `\n${m.content}`;
            else turns.push({ ...m });
        }
        const { run, actions } = toolsFor(req, tz, where);
        let out;
        try {
            out = await ai.converse({ provider: s.provider, apiKey: s.apiKey, baseURL: s.baseURL, model: s.model, system: system(email, tz, where), messages: turns, tools: TOOLS, run });
        } catch (e) {
            if (e instanceof ai.AiError) throw Object.assign(httpError(e.status, e.message), { expose: true });
            throw e;
        }
        if (ctx.aiCount) ctx.aiCount(out.usage || {});
        res.json({ reply: out.text, actions, used: out.used.map(u => u.name), model: ctx.aiNamed ? ctx.aiNamed(s.provider, out.model) : out.model });
    }));
    return r;
};

module.exports.TOOLS = TOOLS;
