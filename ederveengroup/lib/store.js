'use strict';

// Tiny per-user JSON store for settings, signatures and contacts.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
    displayName: '',
    theme: 'dark',
    accent: '#c9a66b',
    density: 'comfortable',
    loadRemoteImages: false,
    undoSendSeconds: 5,
    saveSentCopy: true,
    signatures: [],
    defaultSignature: null,
    replySignature: null
};

const MAX_CONTACTS = 500;

function createStore(dataDir) {
    const dir = path.join(dataDir, 'users');
    fs.mkdirSync(dir, { recursive: true });
    const cache = new Map();

    const fileFor = email => path.join(dir, crypto.createHash('sha256').update(email.toLowerCase()).digest('hex') + '.json');

    function load(email) {
        if (cache.has(email)) return cache.get(email);
        let data = {};
        try {
            data = JSON.parse(fs.readFileSync(fileFor(email), 'utf8'));
        } catch {
            // new user
        }
        const user = { settings: { ...DEFAULTS, ...(data.settings || {}) }, contacts: data.contacts || {} };
        cache.set(email, user);
        return user;
    }

    function save(email) {
        const file = fileFor(email);
        const tmp = file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(load(email), null, 2), { mode: 0o600 });
        fs.renameSync(tmp, file);
    }

    return {
        getSettings: email => load(email).settings,

        updateSettings(email, patch) {
            const user = load(email);
            for (const k of Object.keys(DEFAULTS)) {
                if (k in patch) user.settings[k] = patch[k];
            }
            save(email);
            return user.settings;
        },

        rememberContacts(email, addresses) {
            const user = load(email);
            let changed = false;
            for (const a of addresses) {
                if (!a || !a.address) continue;
                const addr = a.address.toLowerCase();
                if (addr === email.toLowerCase()) continue;
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
        }
    };
}

module.exports = { createStore };
