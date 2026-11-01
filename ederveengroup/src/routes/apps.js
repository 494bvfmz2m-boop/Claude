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

const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, max);
const line = (v, max) => text(v, max).replace(/[\r\n\t]+/g, ' ').trim();
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const COLORS = ['', 'yellow', 'green', 'blue', 'purple', 'pink', 'orange'];

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
    }
};
const MAX_BYTES = 3 * 1024 * 1024; // per app per person

module.exports = function appRoutes(ctx) {
    const { store } = ctx;
    const r = express.Router();
    r.use(['/apps', '/directory'], requireAuth);

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
