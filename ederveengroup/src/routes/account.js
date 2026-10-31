'use strict';

// Who you are: settings, profile photo, sender photos, contacts.

const express = require('express');
const { wrap, isEmail } = require('../http');
const { cleanSettingsPatch } = require('../settings');

module.exports = function accountRoutes({ store, avatars }) {
    const r = express.Router();

    r.get('/me', (req, res) => {
        res.json({
            email: req.session.email,
            sessionExpires: new Date(req.session.exp).toISOString(),
            photo: avatars.photoVersion(req.session.email),
            settings: store.getSettings(req.session.email)
        });
    });

    r.put('/settings', (req, res) => res.json(store.updateSettings(req.session.email, cleanSettingsPatch(req.body))));

    r.put('/profile/photo', (req, res) => res.json({ photo: avatars.savePhoto(req.session.email, req.body.dataUrl) }));
    r.delete('/profile/photo', (req, res) => {
        avatars.removePhoto(req.session.email);
        res.json({ photo: null });
    });

    // Photo for any address: an uploaded EderveenGroup photo first, then Gravatar or company logo.
    r.get('/avatar', wrap(async (req, res) => {
        const email = String(req.query.email || '').trim().toLowerCase();
        res.set({ 'Content-Security-Policy': "default-src 'none'", 'Cross-Origin-Resource-Policy': 'same-origin' });
        if (!isEmail(email)) return res.status(400).end();
        const remote = store.getSettings(req.session.email).senderPhotos !== false;
        const hit = await avatars.lookup(email, { remote });
        if (!hit) return res.set('Cache-Control', 'private, max-age=3600').status(404).end();
        res.set({ 'Content-Type': hit.type, 'Cache-Control': 'private, max-age=86400' }).send(hit.buf);
    }));

    r.get('/contacts', (req, res) => res.json(store.searchContacts(req.session.email, req.query.q)));

    return r;
};
