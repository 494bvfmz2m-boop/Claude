'use strict';

// Per-account data: settings, signatures, templates, contacts, snoozes, two-factor, signed-in
// devices, sign-in activity, username and public profile; plus the mail-server registry.
// Stored in MySQL or in files, see lib/db.js.

const crypto = require('crypto');
const { createFileBackend } = require('./db');

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
    tourDone: false,
    phoneTheme: 'light', // phones get their own (Apple-style) look: 'light' | 'dark' | 'system'
    newMailSound: true // a soft chime when mail arrives while the app is open
};

const MAX_CONTACTS = 500;
const MAX_SESSIONS = 30;
const MAX_ACTIVITY = 40;
const SESSION_IDLE_MAX = 31 * 24 * 60 * 60 * 1000; // matches the longest cookie lifetime
const TOUCH_PERSIST_EVERY = 5 * 60 * 1000;

// Accounts are loaded from the backend (lib/db.js) once and kept in memory; changes are written
// back in the background, one write per account at a time (later changes ride along). Anything
// that reads an account first awaits ready(email): the session middleware and sign-in do that.
function createStore(dataDir, { backend = createFileBackend(dataDir) } = {}) {
    const cache = new Map();
    const loading = new Map();
    const lastPersist = new Map();
    const writes = new Map();
    const norm = email => String(email).trim().toLowerCase();

    function blank() {
        return { settings: { ...DEFAULTS }, contacts: {}, snoozes: [], twofa: null, sessions: {}, activity: [], photo: null };
    }
    function hydrate(row) {
        const data = (row && row.data) || {};
        const saved = { ...(data.settings || {}) };
        if (saved.accent === '#c9a66b' || saved.accent === '#7c5cff') delete saved.accent; // retired defaults
        return {
            settings: { ...DEFAULTS, ...saved },
            contacts: data.contacts || {},
            snoozes: data.snoozes || [],
            twofa: data.twofa || null,
            sessions: data.sessions || {},
            activity: data.activity || [],
            photo: data.photo || null,
            username: (row && row.username) || null,
            profile: (row && row.profile) || null,
            persisted: !!row
        };
    }

    /** loads an account into memory (once); resolves to whether it existed before */
    function ready(email) {
        email = norm(email);
        if (cache.has(email)) return Promise.resolve(cache.get(email).persisted);
        if (!loading.has(email)) {
            loading.set(email, backend.loadUser(email).then(row => {
                if (!cache.has(email)) {
                    cache.set(email, hydrate(row));
                    if (row && row.migrated) save(email); // copied over from the old files
                }
                loading.delete(email);
                return cache.get(email).persisted;
            }, err => {
                loading.delete(email);
                throw err;
            }));
        }
        return loading.get(email);
    }

    function load(email) {
        email = norm(email);
        const user = cache.get(email);
        if (user) return user;
        // files can be read on the spot; a database must be awaited (ready) first
        if (!backend.loadUserSync) throw new Error(`account ${email} used before it was loaded`);
        cache.set(email, hydrate(backend.loadUserSync(email)));
        return cache.get(email);
    }

    function snapshot(user) {
        const { settings, contacts, snoozes, twofa, sessions, activity, photo } = user;
        return { data: { settings, contacts, snoozes, twofa, sessions, activity, photo }, username: user.username, profile: user.profile };
    }

    // one write at a time per account; changes made meanwhile go out in the next write
    function save(email) {
        email = norm(email);
        const user = load(email);
        user.persisted = true;
        lastPersist.set(email, Date.now());
        const w = writes.get(email);
        if (w) return void (w.again = true);
        const job = { again: false };
        job.done = (async () => {
            do {
                job.again = false;
                try {
                    await backend.saveUser(email, snapshot(user));
                } catch (err) {
                    console.error(`Couldn’t save ${email}:`, err.message);
                }
            } while (job.again);
            writes.delete(email);
        })();
        writes.set(email, job);
    }

    const registry = createServerRegistry(backend);

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
        backend,
        ready,
        /** waits for every pending write (tests, shutdown) */
        flush: async () => {
            while (writes.size) await Promise.all([...writes.values()].map(w => w.done));
            await registry.flush();
        },
        init: () => registry.init(),
        exists: email => {
            const u = cache.get(norm(email));
            return !!(u && u.persisted);
        },

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
        listActivity: email => load(email).activity,

        /* ---------- profile photo version (the photo itself lives in the backend) ---------- */
        photoVersion: email => load(email).photo,
        setPhotoVersion(email, version) {
            load(email).photo = version || null;
            save(email);
        },

        /* ---------- username and public profile ---------- */
        usernameOf: email => load(email).username,
        async claimUsername(email, username) {
            const user = load(email);
            if (user.username === username) return true;
            if (!user.persisted) {
                save(email);
                await writes.get(norm(email))?.done; // the row has to exist before it can take a name
            }
            const ok = await backend.claimUsername(norm(email), username, user.username);
            if (ok) user.username = username;
            return ok;
        },
        async isUsernameFree(username, email) {
            const owner = await backend.emailForUsername(username);
            return !owner || owner === norm(email || '');
        },
        emailForUsername: username => backend.emailForUsername(username),
        getProfile: email => load(email).profile,
        setProfile(email, profile) {
            load(email).profile = profile;
            save(email);
        },

        /* ---------- other mail servers (requests and accepted accounts) ---------- */
        servers: registry
    };
}

// One file for everyone: who asked to bring their own mail server, and which addresses or
// whole domains (written "@example.com") have been accepted, with their server settings.
const MAX_REQUESTS = 300;
const MAX_PENDING = 100;
function createServerRegistry(backend) {
    let data = { requests: [], accounts: {} };
    let writing = null;
    let again = false;
    const save = () => {
        if (writing) return void (again = true);
        writing = (async () => {
            do {
                again = false;
                try {
                    await backend.saveRegistry(data);
                } catch (err) {
                    console.error('Couldn’t save the mail server list:', err.message);
                }
            } while (again);
            writing = null;
        })();
    };
    const keyFor = (email, scope) => (scope === 'domain' ? '@' + email.split('@')[1] : email);
    return {
        async init() {
            const doc = await backend.loadRegistry();
            data = { requests: (doc && doc.requests) || [], accounts: (doc && doc.accounts) || {} };
        },
        flush: async () => {
            while (writing) await writing;
        },
        /** server settings for an address: its own entry, then its domain's, else null (default server) */
        profileFor(email) {
            const e = String(email || '').toLowerCase();
            return data.accounts[e] || data.accounts['@' + e.split('@')[1]] || null;
        },
        pendingFor: email => data.requests.find(r => r.status === 'pending' && r.email === String(email).toLowerCase()) || null,
        addRequest(req) {
            if (data.requests.filter(x => x.status === 'pending').length >= MAX_PENDING) throw Object.assign(new Error('There are a lot of open requests right now. Please try again later.'), { status: 429 });
            const r = { id: crypto.randomBytes(9).toString('base64url'), status: 'pending', createdAt: Date.now(), ...req };
            data.requests.unshift(r);
            // decided requests are history: drop the oldest ones first
            for (let i = data.requests.length - 1; data.requests.length > MAX_REQUESTS && i >= 0; i--) if (data.requests[i].status !== 'pending') data.requests.splice(i, 1);
            save();
            return r;
        },
        listRequests: () => data.requests,
        getRequest: id => data.requests.find(r => r.id === id) || null,
        decide(id, { status, scope = 'address', by, reason = '' }) {
            const r = data.requests.find(x => x.id === id);
            if (!r || r.status !== 'pending') return null;
            Object.assign(r, { status, decidedAt: Date.now(), decidedBy: by, reason: String(reason).slice(0, 500) });
            if (status === 'accepted') {
                r.scope = scope === 'domain' ? 'domain' : 'address';
                data.accounts[keyFor(r.email, r.scope)] = { imap: r.imap, smtp: r.smtp, login: r.login, addedAt: Date.now(), addedBy: by, requestId: r.id, name: r.name };
            }
            save();
            return r;
        },
        listAccounts: () => Object.entries(data.accounts).map(([key, a]) => ({ key, ...a })),
        removeAccount(key) {
            const had = !!data.accounts[key];
            delete data.accounts[key];
            save();
            return had;
        }
    };
}

module.exports = { createStore, DEFAULTS };
