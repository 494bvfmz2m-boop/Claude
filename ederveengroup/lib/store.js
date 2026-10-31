'use strict';

// Tiny per-user JSON store: settings, signatures, templates, contacts, snoozes,
// two-factor, signed-in devices and recent sign-in activity. One file per account.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
    displayName: '',
    theme: 'dark',
    accent: '#4c8dff',
    senderPhotos: true,
    density: 'comfortable',
    loadRemoteImages: false,
    undoSendSeconds: 5,
    saveSentCopy: true,
    signatures: [],
    defaultSignature: null,
    replySignature: null,
    templates: [],
    conversations: true, // group messages into threads
    readingPane: 'right', // 'right' | 'off' (full-width list, messages open full size)
    afterAction: 'next', // after archive/delete in the reader: 'next' message or back to the 'list'
    tourDone: false
};

const MAX_CONTACTS = 500;
const MAX_SESSIONS = 30;
const MAX_ACTIVITY = 40;
const SESSION_IDLE_MAX = 31 * 24 * 60 * 60 * 1000; // matches the longest cookie lifetime
const TOUCH_PERSIST_EVERY = 5 * 60 * 1000;

function createStore(dataDir) {
    const dir = path.join(dataDir, 'users');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    try {
        fs.chmodSync(dataDir, 0o700);
    } catch {
        // best effort (e.g. Windows)
    }
    const cache = new Map();
    const lastPersist = new Map();

    const norm = email => String(email).trim().toLowerCase();
    const fileFor = email => path.join(dir, crypto.createHash('sha256').update(norm(email)).digest('hex') + '.json');

    function load(email) {
        email = norm(email);
        if (cache.has(email)) return cache.get(email);
        let data = {};
        try {
            data = JSON.parse(fs.readFileSync(fileFor(email), 'utf8'));
        } catch {
            // new user
        }
        const saved = data.settings || {};
        if (saved.accent === '#c9a66b' || saved.accent === '#7c5cff') delete saved.accent; // retired defaults
        const user = {
            settings: { ...DEFAULTS, ...saved },
            contacts: data.contacts || {},
            snoozes: data.snoozes || [],
            twofa: data.twofa || null,
            sessions: data.sessions || {},
            activity: data.activity || []
        };
        cache.set(email, user);
        return user;
    }

    function save(email) {
        email = norm(email);
        const file = fileFor(email);
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(load(email), null, 2), { mode: 0o600 });
        fs.renameSync(tmp, file);
        lastPersist.set(email, Date.now());
    }

    function pruneSessions(user) {
        const now = Date.now();
        for (const [sid, s] of Object.entries(user.sessions)) {
            if (now - (s.lastSeen || s.created || 0) > SESSION_IDLE_MAX) delete user.sessions[sid];
        }
        const ids = Object.keys(user.sessions);
        if (ids.length > MAX_SESSIONS) {
            ids.sort((a, b) => user.sessions[a].lastSeen - user.sessions[b].lastSeen)
                .slice(0, ids.length - MAX_SESSIONS)
                .forEach(sid => delete user.sessions[sid]);
        }
    }

    return {
        DEFAULTS,
        exists: email => cache.has(norm(email)) || fs.existsSync(fileFor(email)),

        /* ---------- settings ---------- */
        getSettings: email => load(email).settings,
        updateSettings(email, patch) {
            const user = load(email);
            for (const k of Object.keys(DEFAULTS)) {
                if (k in patch) user.settings[k] = patch[k];
            }
            save(email);
            return user.settings;
        },

        /* ---------- contacts (learned from mail you read and send) ---------- */
        rememberContacts(email, addresses) {
            const user = load(email);
            let changed = false;
            for (const a of addresses) {
                if (!a || !a.address) continue;
                const addr = a.address.toLowerCase();
                if (addr === norm(email)) continue;
                const c = user.contacts[addr] || { name: '', count: 0 };
                if (a.name) c.name = a.name;
                c.count++;
                c.last = Date.now();
                user.contacts[addr] = c;
                changed = true;
            }
            if (!changed) return;
            const entries = Object.entries(user.contacts);
            if (entries.length > MAX_CONTACTS) {
                entries.sort((a, b) => b[1].last - a[1].last);
                user.contacts = Object.fromEntries(entries.slice(0, MAX_CONTACTS));
            }
            save(email);
        },
        searchContacts(email, q) {
            q = (q || '').toLowerCase();
            return Object.entries(load(email).contacts)
                .filter(([addr, c]) => !q || addr.includes(q) || (c.name || '').toLowerCase().includes(q))
                .sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)
                .slice(0, 8)
                .map(([address, c]) => ({ address, name: c.name }));
        },

        /* ---------- snoozes (keyed by Message-ID because UIDs change when mail moves) ---------- */
        addSnoozes(email, entries) {
            const user = load(email);
            const ids = new Set(entries.map(e => e.messageId));
            user.snoozes = user.snoozes.filter(s => !ids.has(s.messageId)).concat(entries);
            save(email);
        },
        listSnoozes: email => load(email).snoozes,
        takeDueSnoozes(email, now = Date.now()) {
            const user = load(email);
            const due = user.snoozes.filter(s => s.until <= now);
            if (!due.length) return [];
            user.snoozes = user.snoozes.filter(s => s.until > now);
            save(email);
            return due;
        },

        /* ---------- two-factor: { secret, since, recovery: [sha256], pending? } ---------- */
        getTwofa: email => load(email).twofa,
        setTwofa(email, value) {
            load(email).twofa = value;
            save(email);
        },

        /* ---------- signed-in devices ---------- */
        sessions: {
            isActive: (email, sid) => !!load(email).sessions[sid],
            add(email, sid, info) {
                const user = load(email);
                const now = Date.now();
                user.sessions[sid] = { created: now, lastSeen: now, ip: info.ip || '', ua: info.ua || '', remember: !!info.remember };
                pruneSessions(user);
                save(email);
            },
            touch(email, sid, info) {
                const s = load(email).sessions[sid];
                if (!s) return;
                s.lastSeen = Date.now();
                if (info.ip) s.ip = info.ip;
                if (info.ua) s.ua = info.ua;
                // last-seen times are only written to disk every few minutes
                if (Date.now() - (lastPersist.get(norm(email)) || 0) > TOUCH_PERSIST_EVERY) save(email);
            },
            list: email => Object.entries(load(email).sessions).map(([sid, s]) => ({ sid, ...s })).sort((a, b) => b.lastSeen - a.lastSeen),
            revoke(email, sid) {
                const user = load(email);
                const had = !!user.sessions[sid];
                delete user.sessions[sid];
                save(email);
                return had;
            },
            revokeAll(email, exceptSid = null) {
                const user = load(email);
                for (const sid of Object.keys(user.sessions)) if (sid !== exceptSid) delete user.sessions[sid];
                save(email);
            }
        },

        /* ---------- sign-in activity ---------- */
        // Failures are only recorded for accounts that already exist here, so random
        // sign-in attempts can't create files.
        logActivity(email, entry) {
            if (!entry.ok && !this.exists(email)) return;
            const user = load(email);
            user.activity.unshift({ t: Date.now(), ...entry, ua: String(entry.ua || '').slice(0, 300) });
            user.activity.length = Math.min(user.activity.length, MAX_ACTIVITY);
            save(email);
        },
        listActivity: email => load(email).activity
    };
}

module.exports = { createStore, DEFAULTS };
