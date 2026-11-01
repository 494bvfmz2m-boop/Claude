'use strict';

// Calendars from elsewhere (a webcal/iCal link from Magister, Google Calendar, Outlook…):
// fetched by the server (only from public addresses), read, and turned into the events that
// happen in a window around today, repeats and time zones worked out.
//
// Times come out as
//   all-day   { allDay: true, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }   (end inclusive)
//   timed     { start: '…Z', end: '…Z' }                                  (UTC instants)
//   floating  { start: 'YYYY-MM-DDTHH:mm', end: …, floating: true }      (same clock time anywhere)

const crypto = require('crypto');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { isPublicIp } = require('./servers');

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_INSTANCES = 8000;
const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');

/* ---------- links people paste ---------- */

/** a pasted link → the address of its .ics file (webcal:, Google share links…) */
function normalizeUrl(input) {
    let s = String(input || '').trim();
    if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:\/\//i, 'https://');
    let u;
    try {
        u = new URL(s);
    } catch {
        throw Object.assign(new Error('That doesn’t look like a link. Paste the whole address, starting with https:// or webcal://'), { status: 400 });
    }
    if (!/^https?:$/.test(u.protocol)) throw Object.assign(new Error('Only https://, http:// and webcal:// links work here'), { status: 400 });
    if (u.username || u.password) throw Object.assign(new Error('Leave the user name and password out of the link'), { status: 400 });
    // Google Calendar's "share" links point at a page; the calendar itself is at /ical/<id>/public/basic.ics
    if (u.hostname === 'calendar.google.com' && !u.pathname.includes('/ical/')) {
        let id = u.searchParams.get('src');
        const cid = u.searchParams.get('cid');
        if (!id && cid) {
            try {
                id = Buffer.from(cid.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
            } catch {
                id = null;
            }
            if (!/@/.test(id || '')) id = cid; // some links carry the id itself
        }
        if (id) return `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`;
    }
    return u.toString();
}

/* ---------- fetching, only from the public internet ---------- */

function guardedLookup(allowPrivate) {
    return (host, opts, cb) => {
        dns.lookup(host, { all: true }, (err, addrs) => {
            if (err) return cb(err);
            const ok = allowPrivate ? addrs : addrs.filter(a => isPublicIp(a.address));
            if (!ok.length || ok.length < addrs.length) return cb(Object.assign(new Error('not a public address'), { code: 'EPRIVATE' }));
            if (opts && opts.all) return cb(null, ok);
            cb(null, ok[0].address, ok[0].family);
        });
    };
}

function fetchOnce(url, allowPrivate) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        if (net.isIP(u.hostname.replace(/^\[|\]$/g, '')) && !allowPrivate && !isPublicIp(u.hostname.replace(/^\[|\]$/g, ''))) {
            return reject(Object.assign(new Error('That calendar is on a private network'), { status: 400 }));
        }
        const lib = u.protocol === 'https:' ? https : http;
        const req = lib.get(u, { lookup: guardedLookup(allowPrivate), timeout: 15000, headers: { 'User-Agent': 'EderveenGroup-Calendar/1.0', Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5', 'Accept-Encoding': 'gzip, deflate' } }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve({ redirect: new URL(res.headers.location, u).toString() });
            }
            if (res.statusCode !== 200) {
                res.resume();
                const why =
                    res.statusCode === 404 && u.hostname === 'calendar.google.com'
                        ? 'Google says this calendar isn’t public. In Google Calendar, open Settings → your calendar → Integrate calendar, and copy the “Secret address in iCal format”.'
                        : res.statusCode === 401 || res.statusCode === 403
                          ? 'That calendar needs a sign-in, so it can’t be read from a link. Copy its secret or private link instead.'
                          : `The calendar’s server answered ${res.statusCode}`;
                return reject(Object.assign(new Error(why), { status: 400 }));
            }
            const enc = String(res.headers['content-encoding'] || '');
            const body = enc.includes('gzip') ? res.pipe(zlib.createGunzip()) : enc.includes('deflate') ? res.pipe(zlib.createInflate()) : res;
            const chunks = [];
            let size = 0;
            body.on('data', c => {
                size += c.length;
                if (size > MAX_BYTES) {
                    req.destroy();
                    reject(Object.assign(new Error('That calendar is too big'), { status: 400 }));
                } else chunks.push(c);
            });
            body.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8') }));
            body.on('error', reject);
        });
        req.on('timeout', () => req.destroy(Object.assign(new Error('The calendar’s server didn’t answer in time'), { status: 400 })));
        req.on('error', err =>
            reject(
                err.status
                    ? err
                    : Object.assign(new Error(err.code === 'EPRIVATE' ? 'That calendar is on a private network' : err.code === 'ENOTFOUND' ? `${u.hostname} doesn’t exist` : 'Couldn’t reach the calendar’s server'), { status: 400 })
            )
        );
    });
}

async function fetchCalendar(url, { allowPrivate = false } = {}) {
    let at = url;
    for (let hops = 0; hops < 5; hops++) {
        const r = await fetchOnce(at, allowPrivate);
        if (r.redirect) {
            at = normalizeUrl(r.redirect);
            continue;
        }
        if (!/BEGIN:VCALENDAR/i.test(r.text.slice(0, 2000))) throw Object.assign(new Error('That link isn’t a calendar (no iCal data came back). Use the webcal/iCal link, not the web page.'), { status: 400 });
        return r.text;
    }
    throw Object.assign(new Error('That link sent us around in circles'), { status: 400 });
}

/* ---------- reading .ics ---------- */

const unescapeText = v => v.replace(/\\([\\;,nN])/g, (m, c) => (c === 'n' || c === 'N' ? '\n' : c));

function parseLines(text) {
    const raw = text.replace(/\r\n?/g, '\n').split('\n');
    const lines = [];
    for (const l of raw) {
        if ((l.startsWith(' ') || l.startsWith('\t')) && lines.length) lines[lines.length - 1] += l.slice(1);
        else if (l.trim()) lines.push(l);
    }
    return lines.map(l => {
        // NAME;PARAM=a;PARAM="b:c":value  (a colon inside quotes isn't the separator)
        let i = 0;
        let quoted = false;
        for (; i < l.length; i++) {
            if (l[i] === '"') quoted = !quoted;
            else if (l[i] === ':' && !quoted) break;
        }
        const head = l.slice(0, i);
        const value = l.slice(i + 1);
        const [name, ...params] = head.split(';');
        const p = {};
        for (const kv of params) {
            const eq = kv.indexOf('=');
            if (eq > 0) p[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1).replace(/^"|"$/g, '');
        }
        return { name: name.toUpperCase(), params: p, value };
    });
}

// Outlook and Exchange name zones the Windows way; the common ones, as IANA names
const WINDOWS_ZONES = {
    'W. Europe Standard Time': 'Europe/Amsterdam', 'Romance Standard Time': 'Europe/Paris', 'Central Europe Standard Time': 'Europe/Budapest', 'Central European Standard Time': 'Europe/Warsaw',
    'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik', 'E. Europe Standard Time': 'Europe/Chisinau', 'FLE Standard Time': 'Europe/Kiev', 'GTB Standard Time': 'Europe/Bucharest',
    'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver', 'Pacific Standard Time': 'America/Los_Angeles', UTC: 'UTC', 'Coordinated Universal Time': 'UTC'
};
const zoneOk = tz => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
};
function zoneOf(tzid, fallback) {
    if (!tzid) return fallback;
    const t = tzid.replace(/^\/+/, '');
    if (WINDOWS_ZONES[t]) return WINDOWS_ZONES[t];
    if (zoneOk(t)) return t;
    const tail = t.match(/[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/); // "/mozilla.org/…/Europe/Amsterdam"
    return tail && zoneOk(tail[0]) ? tail[0] : fallback;
}

// how far a zone is ahead of UTC at an instant (ms)
const fmtCache = new Map();
function offsetAt(instant, tz) {
    if (!fmtCache.has(tz)) fmtCache.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
    const parts = Object.fromEntries(fmtCache.get(tz).formatToParts(new Date(instant)).map(x => [x.type, x.value]));
    const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
    return wall - Math.floor(instant / 1000) * 1000;
}
/** a wall-clock time in a zone ("naive" ms, as if UTC) → the real instant */
function zonedToUtc(naive, tz) {
    if (!tz || tz === 'UTC') return naive;
    let utc = naive - offsetAt(naive, tz);
    utc = naive - offsetAt(utc, tz);
    return utc;
}

/** "20261103T083000Z" / "20261103" (+ TZID) → { naive, tz, allDay } */
function parseTime(prop, calTz) {
    if (!prop) return null;
    const v = prop.value.trim();
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
    if (!m) return null;
    const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    if (!m[4] || prop.params.VALUE === 'DATE') return { naive, tz: null, allDay: true };
    if (m[7]) return { naive, tz: 'UTC', allDay: false };
    return { naive, tz: zoneOf(prop.params.TZID, calTz), allDay: false };
}
function parseDuration(v) {
    const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
    if (!m) return null;
    const ms = ((+m[2] || 0) * 7 * DAY) + (+m[3] || 0) * DAY + (+m[4] || 0) * 36e5 + (+m[5] || 0) * 6e4 + (+m[6] || 0) * 1e3;
    return m[1] === '-' ? -ms : ms;
}

/** the calendar's events (masters and moved/changed occurrences) and its name */
function parseCalendar(text) {
    const lines = parseLines(text);
    let name = '';
    let calTz = null;
    const events = [];
    let cur = null;
    let depth = 0; // inside VALARM and the like
    for (const l of lines) {
        if (l.name === 'BEGIN') {
            if (l.value.toUpperCase() === 'VEVENT' && !cur) cur = { props: {}, multi: {} };
            else if (cur) depth++;
            continue;
        }
        if (l.name === 'END') {
            if (cur && depth) depth--;
            else if (cur && l.value.toUpperCase() === 'VEVENT') {
                events.push(cur);
                cur = null;
            }
            continue;
        }
        if (!cur) {
            if (l.name === 'X-WR-CALNAME' && !name) name = unescapeText(l.value).trim().slice(0, 80);
            if (l.name === 'X-WR-TIMEZONE' && !calTz) calTz = zoneOf(l.value.trim(), null);
            continue;
        }
        if (depth) continue;
        if (l.name === 'EXDATE' || l.name === 'RDATE') (cur.multi[l.name] = cur.multi[l.name] || []).push(l);
        else if (!cur.props[l.name]) cur.props[l.name] = l;
    }
    return { name, calTz, events };
}

/* ---------- repeats (RRULE) ---------- */

const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function parseRule(v) {
    const r = Object.fromEntries(String(v).split(';').map(kv => kv.split('=')).filter(x => x.length === 2).map(([k, x]) => [k.toUpperCase(), x]));
    return {
        freq: r.FREQ,
        interval: Math.max(1, +r.INTERVAL || 1),
        count: r.COUNT ? +r.COUNT : null,
        until: r.UNTIL || null,
        byday: r.BYDAY ? r.BYDAY.split(',').map(d => { const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(d.trim()); return m && { n: m[1] ? +m[1] : 0, wd: WD[m[2]] }; }).filter(Boolean) : null,
        bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number).filter(Boolean) : null,
        bymonth: r.BYMONTH ? r.BYMONTH.split(',').map(Number).filter(Boolean) : null,
        wkst: WD[r.WKST] ?? 1
    };
}
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
// the start of every occurrence of a rule, as naive times, in order, until `to` (or COUNT/UNTIL)
function* occurrences(start, rule, untilNaive, to) {
    const d0 = new Date(start);
    const time = start - Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate());
    const at = (y, m, d) => Date.UTC(y, m, d) + time;
    let emitted = 0;
    for (let p = 0; p < 20000; p++) {
        let cands = [];
        if (rule.freq === 'DAILY') {
            const t = start + p * rule.interval * DAY;
            const d = new Date(t);
            if ((!rule.bymonth || rule.bymonth.includes(d.getUTCMonth() + 1)) && (!rule.bymonthday || rule.bymonthday.includes(d.getUTCDate())) && (!rule.byday || rule.byday.some(b => b.wd === d.getUTCDay()))) cands = [t];
            if (t > to) return;
        } else if (rule.freq === 'WEEKLY') {
            const weekStart = start - (((d0.getUTCDay() - rule.wkst + 7) % 7) * DAY) + p * rule.interval * 7 * DAY;
            if (weekStart > to) return;
            const days = rule.byday ? rule.byday.map(b => b.wd) : [d0.getUTCDay()];
            cands = days.map(wd => weekStart + ((wd - rule.wkst + 7) % 7) * DAY).filter(t => !rule.bymonth || rule.bymonth.includes(new Date(t).getUTCMonth() + 1));
        } else if (rule.freq === 'MONTHLY' || rule.freq === 'YEARLY') {
            const step = rule.freq === 'MONTHLY' ? rule.interval : 12 * rule.interval;
            const base = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + p * step, 1));
            if (Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1) > to) return;
            const months = rule.freq === 'YEARLY' && rule.bymonth ? rule.bymonth.map(m => [base.getUTCFullYear(), m - 1]) : [[base.getUTCFullYear(), base.getUTCMonth()]];
            for (const [y, m] of months) {
                const dim = daysInMonth(y, m);
                if (rule.bymonthday) {
                    for (const md of rule.bymonthday) {
                        const day = md > 0 ? md : dim + md + 1;
                        if (day >= 1 && day <= dim) cands.push(at(y, m, day));
                    }
                } else if (rule.byday) {
                    for (const { n, wd } of rule.byday) {
                        const all = [];
                        for (let day = 1; day <= dim; day++) if (new Date(Date.UTC(y, m, day)).getUTCDay() === wd) all.push(day);
                        const pick = n > 0 ? [all[n - 1]] : n < 0 ? [all[all.length + n]] : all;
                        for (const day of pick) if (day) cands.push(at(y, m, day));
                    }
                } else {
                    const day = d0.getUTCDate();
                    if (day <= dim) cands.push(at(y, m, day));
                }
            }
        } else return;
        cands.sort((a, b) => a - b);
        for (const t of cands) {
            if (t < start) continue;
            if (untilNaive != null && t > untilNaive) return;
            if (rule.count != null && emitted >= rule.count) return;
            emitted++;
            yield t;
        }
    }
}

/* ---------- everything together ---------- */

/**
 * The occurrences of a calendar's events between `from` and `to` (ms), ready to show.
 * Each: { id, title, location, note, allDay, start, end, floating? }
 */
function eventsBetween(text, from, to) {
    const { name, calTz, events } = parseCalendar(text);
    const out = [];
    const keyOf = (t, tz, allDay) => (allDay ? `d${t}` : `t${tz === null ? t : zonedToUtc(t, tz)}`);
    // changed or moved single occurrences, by event and original time
    const overrides = new Map();
    for (const e of events) {
        const rid = parseTime(e.props['RECURRENCE-ID'], calTz);
        const uid = e.props.UID && e.props.UID.value;
        if (rid && uid) overrides.set(`${uid}|${keyOf(rid.naive, rid.tz, rid.allDay)}`, e);
    }
    const emit = (e, s, length) => {
        if (out.length >= MAX_INSTANCES) return;
        const status = e.props.STATUS && e.props.STATUS.value.toUpperCase();
        if (status === 'CANCELLED') return;
        const title = unescapeText((e.props.SUMMARY && e.props.SUMMARY.value) || '').trim().slice(0, 200) || '(no title)';
        const location = unescapeText((e.props.LOCATION && e.props.LOCATION.value) || '').trim().slice(0, 200);
        const note = unescapeText((e.props.DESCRIPTION && e.props.DESCRIPTION.value) || '').trim().slice(0, 2000);
        const uid = (e.props.UID && e.props.UID.value) || title;
        let ev;
        if (s.allDay) {
            const startDay = new Date(s.naive).toISOString().slice(0, 10);
            const endDay = new Date(s.naive + Math.max(DAY, length) - DAY).toISOString().slice(0, 10);
            if (s.naive + Math.max(DAY, length) < from || s.naive > to) return;
            ev = { allDay: true, start: startDay, end: endDay };
        } else if (s.tz === null) {
            const f = t => new Date(t).toISOString().slice(0, 16);
            if (s.naive + length < from - DAY || s.naive > to + DAY) return;
            ev = { allDay: false, floating: true, start: f(s.naive), end: f(s.naive + length) };
        } else {
            const a = zonedToUtc(s.naive, s.tz);
            const b = zonedToUtc(s.naive + length, s.tz);
            if (b < from || a > to) return;
            ev = { allDay: false, start: new Date(a).toISOString(), end: new Date(Math.max(a, b)).toISOString() };
        }
        out.push({ id: crypto.createHash('sha1').update(`${uid}|${ev.start}`).digest('base64url').slice(0, 16), title, location, note, ...ev });
    };
    for (const e of events) {
        const s = parseTime(e.props.DTSTART, calTz);
        if (!s) continue;
        const endT = parseTime(e.props.DTEND, calTz);
        const dur = e.props.DURATION ? parseDuration(e.props.DURATION.value) : null;
        const length = endT ? Math.max(0, (endT.tz && s.tz && endT.tz !== s.tz ? zonedToUtc(endT.naive, endT.tz) - zonedToUtc(s.naive, s.tz) : endT.naive - s.naive)) : dur != null ? Math.max(0, dur) : s.allDay ? DAY : 0;
        if (e.props['RECURRENCE-ID']) {
            emit(e, s, length);
            continue;
        }
        const uid = e.props.UID && e.props.UID.value;
        const ex = new Set();
        for (const l of e.multi.EXDATE || []) for (const part of l.value.split(',')) {
            const t = parseTime({ value: part, params: l.params }, calTz);
            if (t) ex.add(keyOf(t.naive, t.tz || s.tz, t.allDay || s.allDay));
        }
        const one = t => {
            const key = keyOf(t, s.tz, s.allDay);
            if (ex.has(key) || overrides.has(`${uid}|${key}`)) return;
            emit(e, { ...s, naive: t }, length);
        };
        if (!e.props.RRULE) {
            one(s.naive);
        } else {
            const rule = parseRule(e.props.RRULE.value);
            let untilNaive = null;
            if (rule.until) {
                const u = parseTime({ value: rule.until, params: {} }, calTz);
                // UNTIL is in UTC when it ends in Z; compare in the event's own clock
                untilNaive = u ? (u.tz === 'UTC' && s.tz && s.tz !== 'UTC' ? u.naive + offsetAt(u.naive, s.tz) : u.allDay && !s.allDay ? u.naive + DAY - 1 : u.naive) : null;
            }
            // look a little past the window in the event's own clock (time zones)
            const toNaive = to + 2 * DAY;
            for (const t of occurrences(s.naive, rule, untilNaive, toNaive)) {
                if (out.length >= MAX_INSTANCES) break;
                if (t + length + 2 * DAY < from) continue;
                one(t);
            }
        }
        for (const l of e.multi.RDATE || []) for (const part of l.value.split(',')) {
            const t = parseTime({ value: part, params: l.params }, calTz);
            if (t) one(t.naive);
        }
    }
    out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    return { name, events: out };
}

module.exports = { normalizeUrl, fetchCalendar, parseCalendar, eventsBetween, zonedToUtc, parseRule, zoneOk };
