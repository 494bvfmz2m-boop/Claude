'use strict';

// Storage for the hub apps that keep private things per person: Notes, Tasks and Contacts.
// Each is a collection of items, saved with the rest of the account (so encrypted in the
// database). Every field is validated here; the browser is never trusted.
//
//   GET    /api/apps/:app            all items
//   PUT    /api/apps/:app/:id        create or update one item
//   DELETE /api/apps/:app/:id        remove one
//   POST   /api/apps/contacts/import add the people you've emailed
//   GET    /api/directory?q=         EderveenGroup people with a public profile

const express = require('express');
const { wrap, httpError, requireAuth } = require('../http');
const usernames = require('../../lib/usernames');
const { seal, unseal } = require('../../lib/session');
const ical = require('../../lib/ical');
const { widgetScript, widgetPreviews, WIDGET_KINDS } = require('../../lib/widget');

const originOf = req => `${req.protocol}://${String(req.get('host') || 'localhost').replace(/[^a-z0-9.:\-[\]]/gi, '')}`;

const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, max);
const line = (v, max) => text(v, max).replace(/[\r\n\t]+/g, ' ').trim();
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const COLORS = ['', 'yellow', 'green', 'blue', 'purple', 'pink', 'orange'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const REPEATS = ['', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'];

const APPS = {
    notes: {
        max: 500,
        clean: v => ({
            title: line(v.title, 140),
            body: text(v.body, 20000),
            color: COLORS.includes(v.color) ? v.color : '',
            pinned: !!v.pinned
        })
    },
    tasks: {
        max: 2000,
        clean(v) {
            const t = line(v.text, 300);
            if (!t) throw httpError(400, 'Write what needs doing');
            const due = /^\d{4}-\d{2}-\d{2}$/.test(String(v.due || '')) && !isNaN(new Date(v.due)) ? v.due : '';
            return { text: t, note: text(v.note, 2000), due, done: !!v.done, doneAt: v.done ? Number(v.doneAt) || Date.now() : null, starred: !!v.starred };
        }
    },
    contacts: {
        max: 3000,
        clean(v) {
            const emails = [].concat(v.emails || []).map(e => line(e, 254).toLowerCase()).filter(Boolean).slice(0, 4);
            for (const e of emails) if (!EMAIL.test(e)) throw httpError(400, `“${e}” doesn’t look like an email address`);
            const phone = line(v.phone, 40);
            if (phone && !/^\+?[0-9 ()./-]{3,40}$/.test(phone)) throw httpError(400, 'Use only numbers, spaces, + ( ) - . in the phone number');
            const name = line(v.name, 100);
            if (!name && !emails.length) throw httpError(400, 'Give the contact a name or an email address');
            const username = usernames.clean(v.username);
            return { name, emails, phone, company: line(v.company, 100), note: text(v.note, 2000), username: username && !usernames.problem(username) ? username : '', favorite: !!v.favorite };
        }
    },
    calendar: {
        max: 3000,
        clean(v) {
            const title = line(v.title, 140);
            if (!title) throw httpError(400, 'Give the event a name');
            const allDay = !!v.allDay;
            let start = String(v.start || '');
            let end = String(v.end || '');
            if (allDay) {
                start = start.slice(0, 10);
                end = end.slice(0, 10) || start;
                if (!realDay(start)) throw httpError(400, 'Pick a day for the event');
                if (!realDay(end) || end < start) throw httpError(400, 'The event can’t end before it starts');
            } else {
                if (!realTime(start)) throw httpError(400, 'Pick a day and time for the event');
                if (!end) end = addMinutes(start, 60);
                if (!realTime(end) || end < start) throw httpError(400, 'The event can’t end before it starts');
            }
            const repeat = REPEATS.includes(v.repeat) ? v.repeat : '';
            const until = repeat && realDay(String(v.until || '')) && v.until >= start.slice(0, 10) ? v.until : '';
            return { title, allDay, start, end, repeat, until, location: line(v.location, 200), note: text(v.note, 4000), color: COLORS.includes(v.color) ? v.color : '' };
        }
    }
};
const MAX_BYTES = 2 * 1024 * 1024; // per app per person

// "2026-11-03T07:30:00.000Z" as a wall-clock time in a zone: "2026-11-03T08:30"
const localFmt = new Map();
function localOf(iso, tz) {
    if (!localFmt.has(tz)) localFmt.set(tz, new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    const p = Object.fromEntries(localFmt.get(tz).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// calendar times are wall-clock ("2026-11-03T14:00"), like a paper diary: they stay put when you travel
function realDay(d) {
    return DAY.test(d) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
}
function realTime(t) {
    return TIME.test(t) && realDay(t.slice(0, 10)) && +t.slice(11, 13) < 24 && +t.slice(14, 16) < 60;
}
const addMinutes = (t, m) => new Date(new Date(t + ':00Z').getTime() + m * 60000).toISOString().slice(0, 16);
const dayMs = d => Date.parse(d + 'T00:00:00Z');

/** does a (possibly repeating, possibly multi-day) event happen on this day? */
function occursOn(ev, day) {
    const first = ev.start.slice(0, 10);
    const span = Math.round((dayMs((ev.end || ev.start).slice(0, 10)) - dayMs(first)) / 864e5);
    if (day < first) return false;
    for (let back = 0; back <= span; back++) {
        // a multi-day event covers the days after each of its starts
        const s = new Date(dayMs(day) - back * 864e5);
        const sd = s.toISOString().slice(0, 10);
        if (sd < first) break;
        if (ev.until && sd > ev.until) continue;
        const f = new Date(dayMs(first));
        const hit = {
            '': sd === first,
            daily: true,
            weekdays: s.getUTCDay() > 0 && s.getUTCDay() < 6,
            weekly: s.getUTCDay() === f.getUTCDay(),
            monthly: s.getUTCDate() === f.getUTCDate(),
            yearly: s.getUTCDate() === f.getUTCDate() && s.getUTCMonth() === f.getUTCMonth()
        }[ev.repeat || ''];
        if (hit) return true;
    }
    return false;
}

// the calendar as an .ics file (RFC 5545), with floating times so a phone shows them as written
const ICS_FREQ = { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };
function ics(events, host) {
    const esc = s => String(s || '').replace(/[\\;,]/g, c => '\\' + c).replace(/\r?\n/g, '\\n');
    const day = d => d.replace(/-/g, '');
    const time = t => `${day(t.slice(0, 10))}T${t.slice(11, 13)}${t.slice(14, 16)}00`;
    const nextDay = d => new Date(dayMs(d) + 864e5).toISOString().slice(0, 10);
    // lines longer than 75 bytes are folded onto continuation lines
    const fold = l => {
        const out = [];
        let cur = '';
        for (const ch of l) {
            if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) {
                out.push(cur);
                cur = '';
            }
            cur += ch;
        }
        out.push(cur);
        return out.join('\r\n ');
    };
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EderveenGroup//Calendar//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:EderveenGroup', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
    for (const e of events) {
        lines.push('BEGIN:VEVENT', `UID:${e.id}@${host}`, `DTSTAMP:${stamp}`);
        if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${day(e.start)}`, `DTEND;VALUE=DATE:${day(nextDay(e.end || e.start))}`);
        else lines.push(`DTSTART:${time(e.start)}`, `DTEND:${time(e.end || e.start)}`);
        if (ICS_FREQ[e.repeat]) lines.push(`RRULE:${ICS_FREQ[e.repeat]}${e.until ? `;UNTIL=${day(e.until)}${e.allDay ? '' : 'T235959'}` : ''}`);
        lines.push(`SUMMARY:${esc(e.title)}`);
        if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
        if (e.note) lines.push(`DESCRIPTION:${esc(e.note)}`);
        lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
}

module.exports = function appRoutes(ctx) {
    const { store } = ctx;
    const r = express.Router();
    r.use(['/apps', '/apps-summary', '/directory', '/calendar', '/widget'], requireAuth);

    const doc = (email, app) => store.getApp(email, app) || { items: {} };
    const list = (email, app) => Object.entries(doc(email, app).items).map(([id, item]) => ({ id, ...item })).sort((a, b) => b.updatedAt - a.updatedAt);
    const appOf = req => {
        const a = APPS[req.params.app];
        if (!a) throw httpError(404, 'No such app');
        return a;
    };

    r.get('/apps/:app', (req, res) => {
        appOf(req);
        res.json({ items: list(req.session.email, req.params.app) });
    });

    r.put('/apps/:app/:id', (req, res) => {
        const a = appOf(req);
        const id = String(req.params.id);
        if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) throw httpError(400, 'Bad id');
        const d = doc(req.session.email, req.params.app);
        const before = d.items[id];
        if (!before && Object.keys(d.items).length >= a.max) throw httpError(413, `You can keep up to ${a.max} here. Remove some first.`);
        const now = Date.now();
        const item = { ...a.clean(req.body || {}), createdAt: before ? before.createdAt : now, updatedAt: now };
        const next = { items: { ...d.items, [id]: item } };
        if (JSON.stringify(next).length > MAX_BYTES) throw httpError(413, 'That’s more than can be saved here. Make it shorter or remove old items.');
        store.setApp(req.session.email, req.params.app, next);
        res.json({ id, ...item });
    });

    r.delete('/apps/:app/:id', (req, res) => {
        appOf(req);
        const d = doc(req.session.email, req.params.app);
        if (!d.items[req.params.id]) throw httpError(404, 'Already gone');
        const items = { ...d.items };
        delete items[req.params.id];
        store.setApp(req.session.email, req.params.app, { items });
        res.json({ ok: true });
    });

    // Contacts: bring in the people you've been emailing (learned by Mail as you read and send)
    r.post('/apps/contacts/import', (req, res) => {
        const email = req.session.email;
        const d = doc(email, 'contacts');
        const have = new Set(Object.values(d.items).flatMap(c => c.emails));
        const learned = store.searchContacts(email, '', 500);
        const items = { ...d.items };
        let added = 0;
        const now = Date.now();
        for (const c of learned) {
            if (have.has(c.address) || Object.keys(items).length >= APPS.contacts.max) continue;
            const id = 'm' + require('crypto').randomBytes(9).toString('base64url');
            items[id] = { name: line(c.name, 100), emails: [c.address], phone: '', company: '', note: '', username: '', favorite: false, createdAt: now, updatedAt: now };
            have.add(c.address);
            added++;
        }
        store.setApp(email, 'contacts', { items });
        res.json({ added, known: learned.length });
    });

    // for Jarvis: add or change one of someone's items, checked exactly like the apps' own saves
    ctx.appItems = {
        list: (email, app) => list(email, app),
        put(email, app, value, id = null) {
            const a = APPS[app];
            const d = doc(email, app);
            const key = id || `j${require('crypto').randomBytes(6).toString('base64url')}`;
            const before = d.items[key];
            if (!before && Object.keys(d.items).length >= a.max) throw httpError(413, `There are already ${a.max} here`);
            const now = Date.now();
            const item = { ...a.clean({ ...(before || {}), ...value }), createdAt: before ? before.createdAt : now, updatedAt: now };
            const next = { items: { ...d.items, [key]: item } };
            if (JSON.stringify(next).length > MAX_BYTES) throw httpError(413, 'That’s more than can be saved');
            store.setApp(email, app, next);
            return { id: key, ...item };
        },
        // (and take one away; Jarvis keeps a copy so it can be put back)
        remove(email, app, id) {
            const d = doc(email, app);
            const item = d.items[id];
            if (!item) return null;
            const items = { ...d.items };
            delete items[id];
            store.setApp(email, app, { items });
            return { id, ...item };
        }
    };

    /* ---------- the hub's glance at every app ---------- */
    r.get('/apps-summary', wrap(async (req, res) => {
        const email = req.session.email;
        const today = DAY.test(String(req.query.today || '')) ? String(req.query.today) : new Date().toISOString().slice(0, 10);
        const now = TIME.test(String(req.query.now || '')) ? String(req.query.now) : today + 'T00:00';
        const items = app => Object.values(doc(email, app).items);
        const tasks = items('tasks').filter(t => !t.done);
        // your own events, and those from shared calendars (in your time zone)
        const tz = ical.zoneOk(String(req.query.tz || '')) ? String(req.query.tz) : 'UTC';
        const shared = [];
        for (const [id, sub] of Object.entries(subs(email).items)) {
            if (sub.hidden) continue;
            for (const e of (await ctx.docs.get(`calsub:${id}`, () => ({ events: [] }))).events || []) {
                const start = e.allDay ? e.start : e.floating ? e.start : localOf(e.start, tz);
                const end = e.allDay ? e.end : e.floating ? e.end : localOf(e.end, tz);
                if (start.slice(0, 10) <= today && end.slice(0, 10) >= today) shared.push({ ...e, start, end, color: sub.color, repeat: '' });
            }
        }
        const todays = items('calendar')
            .filter(e => occursOn(e, today))
            .concat(shared)
            .sort((a, b) => (a.allDay ? '' : a.start.slice(11)).localeCompare(b.allDay ? '' : b.start.slice(11)));
        const next = todays.find(e => !e.allDay && e.start.slice(11) >= now.slice(11)) || null;
        const files = items('files').filter(f => f.kind === 'file');
        const extra = ctx.summaryExtras ? await ctx.summaryExtras(email) : {};
        res.json({
            notes: items('notes').length,
            tasks: { open: tasks.length, today: tasks.filter(t => t.due === today).length, overdue: tasks.filter(t => t.due && t.due < today).length },
            contacts: items('contacts').length,
            calendar: {
                today: todays.length,
                next: next && { title: next.title, at: next.start.slice(11) },
                items: todays.slice(0, 6).map(e => ({ title: e.title, allDay: e.allDay, at: e.start.slice(11, 16), location: e.location, color: e.color }))
            },
            pages: ctx.appPages ? ctx.appPages.filter(a => !ctx.appOn || ctx.appOn(a)) : null,
            news: ctx.docs ? (await ctx.docs.get('news', () => ({ items: [] }))).items.filter(n => !n.until || n.until > Date.now()).slice(0, 3) : [],
            files: { count: files.length, used: files.reduce((n, f) => n + (f.size || 0), 0) },
            photos: files.filter(f => /^(image|video)\//.test(f.type || '')).length,
            ...extra
        });
    }));

    /* ---------- Calendar: shared calendars from elsewhere (Magister, Google Calendar, Outlook…) ---------- */
    // added with their webcal/iCal link; the server fetches them (only from public addresses),
    // keeps the events from a few months back to a year and a half ahead, and refreshes them
    const SUB_LIMIT = 20;
    const STALE = 30 * 60 * 1000;
    const subs = email => store.getApp(email, 'calsubs') || { items: {} };
    const subView = (id, x) => ({ id, name: x.name, color: x.color, hidden: !!x.hidden, host: x.host, fetchedAt: x.fetchedAt || null, error: x.error || '', count: x.count || 0 });
    const refreshing = new Map();
    function refreshSub(email, id) {
        const key = `${email}|${id}`;
        if (refreshing.has(key)) return refreshing.get(key);
        const run = (async () => {
            const sub = subs(email).items[id];
            if (!sub) return;
            let patch;
            try {
                const text = await ical.fetchCalendar(sub.url, { allowPrivate: ctx.config.allowPrivateMailHosts });
                const now = Date.now();
                const r = ical.eventsBetween(text, now - 120 * 864e5, now + 550 * 864e5);
                const cache = await ctx.docs.get(`calsub:${id}`, () => ({}));
                cache.events = r.events;
                cache.fetchedAt = now;
                ctx.docs.save(`calsub:${id}`);
                patch = { fetchedAt: now, triedAt: now, error: '', count: r.events.length, calName: r.name };
            } catch (err) {
                patch = { triedAt: Date.now(), error: err.message || 'Couldn’t read that calendar' };
            }
            // the list may have changed meanwhile: change only this one, if it's still there
            const d = subs(email);
            if (d.items[id]) {
                Object.assign(d.items[id], patch);
                store.setApp(email, 'calsubs', d);
            }
            return patch;
        })().finally(() => refreshing.delete(key));
        refreshing.set(key, run);
        return run;
    }
    const subOf = (email, id) => {
        const x = subs(email).items[id];
        if (!x) throw httpError(404, 'That calendar isn’t here any more');
        return x;
    };
    r.get('/calendar/subscriptions', (req, res) => res.json(Object.entries(subs(req.session.email).items).map(([id, x]) => subView(id, x))));
    r.post('/calendar/subscriptions', wrap(async (req, res) => {
        const email = req.session.email;
        const url = ical.normalizeUrl(req.body.url);
        const d = subs(email);
        if (Object.keys(d.items).length >= SUB_LIMIT) throw httpError(400, `You can add up to ${SUB_LIMIT} calendars`);
        if (Object.values(d.items).some(x => x.url === url)) throw httpError(409, 'That calendar is already here');
        const id = require('crypto').randomBytes(9).toString('base64url');
        const used = Object.values(d.items).map(x => x.color);
        const color = COLORS.includes(req.body.color) && req.body.color ? req.body.color : COLORS.slice(1).find(c => !used.includes(c)) || 'green';
        d.items[id] = { url, host: new URL(url).hostname, name: line(req.body.name, 60), color, hidden: false, addedAt: Date.now() };
        store.setApp(email, 'calsubs', d);
        // read it now, so a wrong link is said straight away (and not kept)
        const r = await refreshSub(email, id);
        const now = subs(email);
        if (r && r.error) {
            delete now.items[id];
            store.setApp(email, 'calsubs', now);
            await ctx.docs.remove(`calsub:${id}`);
            throw httpError(400, r.error);
        }
        if (!now.items[id].name) {
            now.items[id].name = line(now.items[id].calName, 60) || (/magister/i.test(now.items[id].host) ? 'Magister' : /google/i.test(now.items[id].host) ? 'Google Calendar' : now.items[id].host);
            store.setApp(email, 'calsubs', now);
        }
        res.json(subView(id, now.items[id]));
    }));
    r.patch('/calendar/subscriptions/:id', (req, res) => {
        const email = req.session.email;
        subOf(email, req.params.id);
        const d = subs(email);
        const x = d.items[req.params.id];
        if ('name' in req.body && line(req.body.name, 60)) x.name = line(req.body.name, 60);
        if (COLORS.includes(req.body.color) && req.body.color) x.color = req.body.color;
        if ('hidden' in req.body) x.hidden = !!req.body.hidden;
        store.setApp(email, 'calsubs', d);
        res.json(subView(req.params.id, x));
    });
    r.delete('/calendar/subscriptions/:id', wrap(async (req, res) => {
        const email = req.session.email;
        subOf(email, req.params.id);
        const d = subs(email);
        delete d.items[req.params.id];
        store.setApp(email, 'calsubs', d);
        await ctx.docs.remove(`calsub:${req.params.id}`);
        res.json({ ok: true });
    }));
    r.post('/calendar/subscriptions/:id/refresh', wrap(async (req, res) => {
        subOf(req.session.email, req.params.id);
        await refreshSub(req.session.email, req.params.id);
        res.json(subView(req.params.id, subOf(req.session.email, req.params.id)));
    }));
    // the events of all shown shared calendars; ones not read for a while are refreshed meanwhile
    r.get('/calendar/external', wrap(async (req, res) => {
        const email = req.session.email;
        const calendars = [];
        const events = [];
        const busy = [];
        for (const [id, x] of Object.entries(subs(email).items)) {
            calendars.push(subView(id, x));
            const stale = Date.now() - (x.fetchedAt || 0) > STALE && Date.now() - (x.triedAt || 0) > 10 * 60 * 1000;
            if (stale) (refreshSub(email, id), busy.push(id));
            if (x.hidden) continue;
            for (const e of (await ctx.docs.get(`calsub:${id}`, () => ({ events: [] }))).events || []) events.push({ ...e, cal: id });
        }
        res.json({ calendars, events, refreshing: busy });
    }));

    /* ---------- Calendar: a private subscription address for phones and other calendar apps ---------- */
    const feedKey = ctx.sessions.deriveKey('calendar-feed');
    // the address is made once and kept, so it stays the same until you ask for a new one
    const newFeed = (email, n) => {
        const v = { n, token: seal(feedKey, { e: email, n }) };
        store.setApp(email, 'calfeed', { items: { v } });
        return v;
    };
    const feedUrl = (req, email) => {
        const v = doc(email, 'calfeed').items.v || newFeed(email, 1);
        return `${ctx.config.oauth.publicUrl || originOf(req)}/cal/${v.token}.ics`;
    };
    r.get('/calendar/feed', (req, res) => res.json({ url: feedUrl(req, req.session.email) }));
    r.post('/calendar/feed', (req, res) => {
        // a new address; the old one stops working
        const v = doc(req.session.email, 'calfeed').items.v || { n: 0 };
        newFeed(req.session.email, v.n + 1);
        res.json({ url: feedUrl(req, req.session.email) });
    });
    // GET /cal/<token>.ics, mounted on the site by src/app.js
    ctx.calendarFeed = wrap(async (req, res) => {
        const t = unseal(feedKey, String(req.params.token || ''));
        const gone = () => res.status(404).type('text/plain').send('This calendar address no longer works. Copy the new one from Calendar on EderveenGroup.');
        if (!t || !t.e || !(await store.ready(t.e))) return gone();
        const v = doc(t.e, 'calfeed').items.v;
        if (!v || v.n !== t.n || v.token !== req.params.token) return gone();
        res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'Content-Disposition': 'inline; filename="ederveengroup.ics"' });
        res.send(ics(list(t.e, 'calendar'), req.hostname));
    });

    /* ---------- Widgets: a private feed for home-screen widgets (Scriptable on iPhone) ---------- */
    // like the calendar address: made once, kept, and replaced (the old one stops) on request.
    // Each widget asks only for what it shows (?kind=calendar, tasks, notes…).
    const widgetKey = ctx.sessions.deriveKey('widget-feed');
    const siteOf = req => ctx.config.oauth.publicUrl || originOf(req);
    const newWidget = (email, n) => {
        const v = { n, token: seal(widgetKey, { e: email, n }) };
        store.setApp(email, 'widgetfeed', { items: { v } });
        return v;
    };
    const tokenOf = email => (doc(email, 'widgetfeed').items.v || newWidget(email, 1)).token;
    const widgetUrl = (req, email) => `${siteOf(req)}/w/${tokenOf(email)}.json`;
    const HEX = { '': '#4c8dff', blue: '#4c8dff', green: '#34d399', yellow: '#f5c542', orange: '#fb923c', pink: '#f472b6', purple: '#a78bfa' };
    const nextDay = d => new Date(dayMs(d) + 864e5).toISOString().slice(0, 10);
    // a wall-clock time in a zone ("2026-11-03T14:00", Europe/Amsterdam) as a moment (ms), for live countdowns
    function momentOf(local, tz) {
        const guess = Date.parse(`${local}:00Z`);
        let t = guess;
        for (let i = 0; i < 2; i++) t = guess - (Date.parse(`${localOf(new Date(t).toISOString(), tz)}:00Z`) - t);
        return t;
    }
    // the events from today over the next `span` days: yours (with repeats) and from shared calendars
    async function eventsAhead(email, tz, today, span) {
        const days = [today];
        while (days.length < span) days.push(nextDay(days[days.length - 1]));
        const last = days[days.length - 1];
        const own = Object.entries(doc(email, 'calendar').items).map(([id, x]) => ({ id, ...x }));
        const out = [];
        const seen = new Set();
        for (const day of days) {
            for (const e of own) {
                if (!occursOn(e, day)) continue;
                // an event over several days shows once, on the first day in view (repeats show each time)
                if (!e.repeat && seen.has(e.id)) continue;
                seen.add(e.id);
                // a repeat starts afresh each time; a long event that began earlier is under way
                const ongoing = !e.repeat && e.start.slice(0, 10) < day;
                const at = e.allDay || ongoing ? null : e.start.slice(11, 16);
                out.push({ title: e.title, day, at, end: e.allDay || !e.end ? null : e.end.slice(11, 16), allDay: !!e.allDay || ongoing, location: e.location || '', color: HEX[e.color] || HEX[''], ts: momentOf(`${day}T${at || '00:00'}`, tz) });
            }
        }
        for (const [id, sub] of Object.entries(subs(email).items)) {
            if (sub.hidden) continue;
            for (const e of (await ctx.docs.get(`calsub:${id}`, () => ({ events: [] }))).events || []) {
                const start = e.allDay || e.floating ? e.start : localOf(e.start, tz);
                const end = e.allDay || e.floating ? e.end || e.start : localOf(e.end || e.start, tz);
                if (start.slice(0, 10) > last || end.slice(0, 10) < today) continue;
                const day = start.slice(0, 10) < today ? today : start.slice(0, 10);
                const ongoing = start.slice(0, 10) < day;
                const at = e.allDay || ongoing ? null : start.slice(11, 16);
                out.push({ title: e.title || 'Event', day, at, end: e.allDay ? null : end.slice(11, 16), allDay: !!e.allDay || ongoing, location: e.location || '', color: HEX[sub.color] || HEX.green, ts: momentOf(`${day}T${at || '00:00'}`, tz) });
            }
        }
        return out.sort((a, b) => a.day.localeCompare(b.day) || (a.allDay ? 0 : 1) - (b.allDay ? 0 : 1) || String(a.at).localeCompare(String(b.at)));
    }
    const plain = v => String(v || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
    // what a widget shows; `kind` picks the parts (no kind: the overview)
    async function widgetData(email, tzIn, site, kind = 'overview', token = '') {
        const tz = ical.zoneOk(String(tzIn || '')) ? String(tzIn) : 'UTC';
        const now = localOf(new Date().toISOString(), tz);
        const today = now.slice(0, 10);
        const items = app => Object.entries(doc(email, app).items).map(([id, x]) => ({ id, ...x }));
        const settings = store.getSettings(email) || {};
        const out = {
            v: 2,
            kind,
            name: settings.displayName || store.usernameOf(email) || email.split('@')[0],
            date: today,
            now: now.slice(11),
            tz,
            links: { home: `${site}/`, calendar: `${site}/calendar/`, tasks: `${site}/tasks/`, notes: `${site}/notes/`, mail: `${site}/mail/`, chat: `${site}/chat/`, planner: `${site}/planner/`, photos: `${site}/photos/`, files: `${site}/files/` }
        };
        const has = (...k) => k.includes(kind);
        if (has('overview', 'calendar', 'today', 'nextup', 'countdown')) {
            const evs = await eventsAhead(email, tz, today, kind === 'countdown' ? 366 : kind === 'calendar' ? 14 : 7);
            // what's over today is left out (timed events that ended)
            const ahead = evs.filter(e => !(e.day === today && e.at && (e.end || e.at) < out.now && (e.end || e.at) !== '00:00'));
            if (kind === 'countdown') {
                // the first time each thing comes up, for counting down to
                const first = new Map();
                for (const e of ahead) if (!first.has(e.title.toLowerCase())) first.set(e.title.toLowerCase(), e);
                out.events = [...first.values()].slice(0, 60);
            } else out.events = ahead.slice(0, kind === 'calendar' ? 24 : 14);
            if (kind === 'calendar') {
                // this month at a glance: how many events each day
                const month = today.slice(0, 8) + '01';
                const counts = {};
                const all = await eventsAhead(email, tz, month, 31);
                for (const e of all) if (e.day.slice(0, 7) === today.slice(0, 7)) counts[e.day] = (counts[e.day] || 0) + 1;
                out.month = { first: month, days: counts };
            }
        }
        if (has('overview', 'tasks', 'today')) {
            const all = items('tasks');
            const open = all.filter(t => !t.done);
            const due = open.filter(t => (t.due && t.due <= today) || t.starred).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 12);
            // done on each of the last 7 days (oldest first), in the phone's time zone
            const week = [];
            for (let i = 6; i >= 0; i--) week.push(new Date(dayMs(today) - i * 864e5).toISOString().slice(0, 10));
            const doneDays = all.filter(t => t.done && t.doneAt).map(t => localOf(new Date(t.doneAt).toISOString(), tz).slice(0, 10));
            out.tasks = {
                open: open.length,
                today: open.filter(t => t.due === today).length,
                overdue: open.filter(t => t.due && t.due < today).length,
                doneToday: doneDays.filter(d => d === today).length,
                week: week.map(d => ({ day: d, done: doneDays.filter(x => x === d).length })),
                list: due.map(t => ({ text: t.text, due: t.due || '', late: !!(t.due && t.due < today), today: t.due === today, starred: !!t.starred }))
            };
        }
        if (has('notes')) {
            const NOTE = { '': '#e5e7eb', yellow: '#fde68a', green: '#bbf7d0', blue: '#bfdbfe', purple: '#ddd6fe', pink: '#fbcfe8', orange: '#fed7aa' };
            out.notes = items('notes')
                .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0))
                .slice(0, 8)
                .map(n => ({ title: n.title || '', text: plain(n.body).slice(0, 320), color: NOTE[n.color] || NOTE[''], pinned: !!n.pinned, updatedAt: n.updatedAt || 0 }));
            out.noteCount = Object.keys(doc(email, 'notes').items).length;
        }
        if (has('overview', 'inbox', 'today')) {
            const extra = ctx.summaryExtras ? await ctx.summaryExtras(email) : {};
            const mail = ((store.getApp(email, 'mailcount') || { items: {} }).items || {}).inbox || null;
            out.mail = mail ? { unread: mail.unread, at: mail.at } : null;
            out.chat = typeof extra.chat === 'number' ? extra.chat : null;
            out.planner = typeof extra.boardDue === 'number' ? extra.boardDue : null;
        }
        if (has('overview')) {
            const news = ctx.docs ? (await ctx.docs.get('news', () => ({ items: [] }))).items.filter(n => !n.until || n.until > Date.now())[0] : null;
            out.news = news ? { title: news.title || '', text: String(news.text || '').slice(0, 160) } : null;
        }
        if (has('memories')) {
            // a photo from this day in earlier years, like Memories on a phone; otherwise one for today
            const pics = items('files').filter(f => f.kind === 'file' && /^image\//.test(f.type || '') && f.thumb);
            const md = today.slice(5);
            const dayOfPic = f => localOf(new Date(f.taken || f.createdAt || 0).toISOString(), tz).slice(0, 10);
            const onThisDay = pics.filter(f => dayOfPic(f).slice(5) === md && dayOfPic(f) < today);
            const pool = onThisDay.length ? onThisDay : pics;
            const seed = [...today].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
            const pick = pool.length ? pool.sort((a, b) => a.id.localeCompare(b.id))[seed % pool.length] : null;
            out.photos = pics.length;
            out.photo = pick ? { url: `${site}/w/${token}/photo/${pick.id}.jpg`, day: dayOfPic(pick), years: onThisDay.length ? +today.slice(0, 4) - +dayOfPic(pick).slice(0, 4) : 0, onThisDay: onThisDay.length, name: pick.name } : null;
        }
        if (has('storage')) {
            const files = items('files').filter(f => f.kind === 'file');
            const used = files.reduce((n, f) => n + (f.size || 0), 0);
            const disk = ctx.vault && ctx.vault.disk ? await ctx.vault.disk().catch(() => null) : null;
            out.storage = { used, quota: (ctx.config.files && ctx.config.files.quota) || 0, free: disk ? disk.free : 0, files: files.length, photos: files.filter(f => /^image\//.test(f.type || '')).length, videos: files.filter(f => /^video\//.test(f.type || '')).length };
        }
        if (kind === 'overview') {
            // the first widget's shape (v1), kept for scripts copied before there were more kinds
            out.events = out.events || [];
        }
        return out;
    }
    ctx.agendaFor = (email, tz, from, span) => eventsAhead(email, tz, from, span);
    ctx.localOf = localOf;
    const widgetsOn = () => !ctx.appOn || ctx.appOn('widgets');
    r.get('/widget', wrap(async (req, res) => {
        if (!widgetsOn()) throw httpError(404, 'Widgets are switched off on this EderveenGroup');
        res.json({ feed: widgetUrl(req, req.session.email), kinds: WIDGET_KINDS });
    }));
    r.post('/widget', (req, res) => {
        const v = doc(req.session.email, 'widgetfeed').items.v || { n: 0 };
        newWidget(req.session.email, v.n + 1);
        res.json({ feed: widgetUrl(req, req.session.email) });
    });
    // the Scriptable script for one widget, with this person's feed in it
    r.get('/widget/script', (req, res) => {
        if (!widgetsOn()) throw httpError(404, 'Widgets are switched off on this EderveenGroup');
        const kind = WIDGET_KINDS.some(k => k.id === req.query.kind) ? req.query.kind : 'overview';
        const meta = WIDGET_KINDS.find(k => k.id === kind);
        const text = widgetScript({ feed: widgetUrl(req, req.session.email), site: siteOf(req), kind });
        res.set({ 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'private, no-store', ...(req.query.download ? { 'Content-Disposition': `attachment; filename="${meta.script.replace(/[^A-Za-z0-9 -]/g, '')}.js"` } : {}) }).send(text);
    });
    // every widget's script, wrapped so the Widgets page can draw live previews with them
    r.get('/widget/previews.js', (req, res) => {
        res.set({ 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'private, no-store' }).send(widgetPreviews({ feed: widgetUrl(req, req.session.email), site: siteOf(req) }));
    });
    // GET /w/<token>.json?tz=Europe/Amsterdam&kind=calendar, mounted on the site by src/app.js (no cookie: a widget has none)
    const feedHits = new Map();
    async function feedOwner(token) {
        const t = unseal(widgetKey, token);
        if (!widgetsOn() || !t || !t.e || !(await store.ready(t.e))) return null;
        const v = doc(t.e, 'widgetfeed').items.v;
        return v && v.n === t.n && v.token === token ? t.e : null;
    }
    function busy(token) {
        // iOS refreshes widgets a few times an hour; this is plenty, even for a dozen widgets
        const hour = Math.floor(Date.now() / 3600e3);
        const h = feedHits.get(token);
        const n = h && h.hour === hour ? h.n + 1 : 1;
        feedHits.set(token, { hour, n });
        if (feedHits.size > 5000) feedHits.clear();
        return n > 600;
    }
    ctx.widgetFeed = wrap(async (req, res) => {
        const token = String(req.params.token || '');
        const email = await feedOwner(token);
        if (!email) return res.status(404).json({ error: 'This widget link no longer works. Copy the script again from EderveenGroup → Widgets.' });
        if (busy(token)) return res.status(429).json({ error: 'Too many refreshes this hour' });
        const kind = WIDGET_KINDS.some(k => k.id === req.query.kind) ? String(req.query.kind) : 'overview';
        res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }).json(await widgetData(email, req.query.tz, siteOf(req), kind, token));
    });
    // GET /w/<token>/photo/<id>.jpg: the preview picture of one of your photos, for the Memories widget
    ctx.widgetPhoto = wrap(async (req, res) => {
        const token = String(req.params.token || '');
        const email = await feedOwner(token);
        const f = email && doc(email, 'files').items[req.params.id];
        if (!f || f.kind !== 'file' || !/^image\//.test(f.type || '') || !f.thumb || !ctx.vault) return res.status(404).end();
        if (busy(token)) return res.status(429).end();
        res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' }).end(await ctx.vault.readAll(f.thumb));
    });

    // EderveenGroup people with a public profile (search by name, username, company)
    r.get('/directory', wrap(async (req, res) => {
        const q = line(req.query.q, 60).toLowerCase().replace(/^@/, '');
        const out = [];
        for (const { email, username, profile } of await store.backend.listProfiles()) {
            if (!profile || profile.visible === false || profile.hidden || !username) continue;
            const hay = [username, profile.name, profile.headline, profile.company].join(' ').toLowerCase();
            if (q && !hay.includes(q)) continue;
            await store.ready(email);
            const mode = profile.photoMode || 'account';
            const photo = mode === 'none' ? null : mode === 'card' ? profile.cardPhoto : store.photoVersion(email);
            out.push({ username, name: profile.name || '', headline: profile.headline || '', company: profile.company || '', email: profile.showEmail === false ? '' : profile.email || '', phone: profile.phone || '', photo: photo || null });
            if (out.length >= 60) break;
        }
        res.json(out.sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username)));
    }));

    return r;
};

module.exports.APPS = APPS;
module.exports.occursOn = occursOn;
module.exports.ics = ics;
