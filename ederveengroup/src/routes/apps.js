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
    r.use(['/apps', '/apps-summary', '/directory', '/calendar'], requireAuth);

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

    /* ---------- the hub's glance at every app ---------- */
    r.get('/apps-summary', wrap(async (req, res) => {
        const email = req.session.email;
        const today = DAY.test(String(req.query.today || '')) ? String(req.query.today) : new Date().toISOString().slice(0, 10);
        const now = TIME.test(String(req.query.now || '')) ? String(req.query.now) : today + 'T00:00';
        const items = app => Object.values(doc(email, app).items);
        const tasks = items('tasks').filter(t => !t.done);
        const todays = items('calendar')
            .filter(e => occursOn(e, today))
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
            pages: ctx.appPages || null,
            files: { count: files.length, used: files.reduce((n, f) => n + (f.size || 0), 0) },
            ...extra
        });
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
