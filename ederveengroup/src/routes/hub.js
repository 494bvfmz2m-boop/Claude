'use strict';

// The site-wide API at /api (the mail app has its own at /mail/api): usernames now, and the
// Profile app. Each new EderveenGroup app adds its routes here.

const express = require('express');
const { wrap, httpError, requireAuth } = require('../http');
const { csrfGuard, createLimiter } = require('../security');
const usernames = require('../../lib/usernames');
const QRCode = require('qrcode');
const { cleanProfile, publicView, vcard } = require('../profile');

const originOf = req => `${req.protocol}://${String(req.get('host') || 'localhost').replace(/[^a-z0-9.:\-[\]]/gi, '')}`;

module.exports = function hubRoutes(ctx) {
    const { store } = ctx;
    const r = express.Router();
    r.use(express.json({ limit: '1mb' }));
    r.use(csrfGuard);
    const checks = createLimiter({ max: 120, windowMs: 60 * 1000 });

    /* ---------- usernames ---------- */
    // is a name free? (with a reason when it can't be used, and a few free alternatives)
    r.get('/username/check', requireAuth, wrap(async (req, res) => {
        if (checks.blocked(req.session.email)) throw httpError(429, 'Slow down a little');
        checks.hit(req.session.email);
        const name = usernames.clean(req.query.u);
        const reason = usernames.problem(name);
        if (reason) return res.json({ username: name, available: false, reason });
        const isFree = n => store.isUsernameFree(n, req.session.email);
        if (await isFree(name)) return res.json({ username: name, available: true });
        res.json({ username: name, available: false, reason: 'That one’s taken', suggestions: await usernames.alternatives(name, isFree) });
    }));

    r.post('/username', requireAuth, wrap(async (req, res) => {
        const name = usernames.clean(req.body.username);
        const reason = usernames.problem(name);
        if (reason) throw httpError(400, reason);
        if (!(await store.claimUsername(req.session.email, name))) throw httpError(409, 'That one’s taken. Try another.');
        res.json({ ok: true, username: name });
    }));

    r.get('/username/suggest', requireAuth, wrap(async (req, res) => {
        const first = usernames.fromEmail(req.session.email);
        const isFree = n => store.isUsernameFree(n, req.session.email);
        res.json({ username: !usernames.problem(first) && (await isFree(first)) ? first : (await usernames.alternatives(first, isFree, 1))[0] || '' });
    }));

    /* ---------- Profile: your card (signed in) ---------- */
    r.get('/profile', requireAuth, wrap(async (req, res) => {
        const email = req.session.email;
        const username = store.usernameOf(email);
        const saved = store.getProfile(email);
        // a first visit starts from what we already know
        const profile = saved || { visible: true, name: store.getSettings(email).displayName || '', email, showEmail: true, links: {} };
        res.json({ profile, username, account: email, created: !!saved, photo: await ctx.avatars.photoVersion(email), cardPhoto: (saved && saved.cardPhoto) || null, url: username ? `${originOf(req)}/profile/#/${username}` : null });
    }));

    r.put('/profile', requireAuth, wrap(async (req, res) => {
        const before = store.getProfile(req.session.email) || {};
        const profile = { ...cleanProfile(req.body), cardPhoto: before.cardPhoto || null }; // the card photo is only set by its own upload
        if (profile.photoMode === 'card' && !profile.cardPhoto) profile.photoMode = 'account';
        store.setProfile(req.session.email, profile);
        res.json({ ok: true, profile });
    }));

    // a photo just for the profile card
    r.put('/profile/photo', requireAuth, wrap(async (req, res) => {
        const version = await ctx.avatars.saveCardPhoto(req.session.email, req.body.dataUrl);
        const profile = { ...(store.getProfile(req.session.email) || cleanProfile({ email: req.session.email })), cardPhoto: version, photoMode: 'card' };
        store.setProfile(req.session.email, profile);
        res.json({ ok: true, cardPhoto: version, photoMode: 'card' });
    }));
    r.get('/profile/photo', requireAuth, wrap(async (req, res) => {
        const photo = await ctx.avatars.cardPhoto(req.session.email);
        if (!photo) return res.status(404).end();
        res.set({ 'Content-Type': photo.type, 'Cache-Control': 'private, max-age=86400', 'Content-Security-Policy': "default-src 'none'" }).send(photo.buf);
    }));
    r.delete('/profile/photo', requireAuth, wrap(async (req, res) => {
        await ctx.avatars.removeCardPhoto(req.session.email);
        const p = store.getProfile(req.session.email);
        if (p) store.setProfile(req.session.email, { ...p, cardPhoto: null, photoMode: p.photoMode === 'card' ? 'account' : p.photoMode });
        res.json({ ok: true });
    }));

    /* ---------- Profile: public cards (anyone with the link) ---------- */
    const lookups = createLimiter({ max: 240, windowMs: 60 * 1000 });
    async function cardFor(req) {
        if (lookups.blocked(req.ip)) throw httpError(429, 'Too many requests, try again in a minute');
        lookups.hit(req.ip);
        const name = usernames.clean(req.params.username);
        const email = /^[a-z][a-z0-9._-]{2,29}$/.test(name) ? await store.emailForUsername(name) : null;
        if (!email) throw httpError(404, 'There’s no profile here');
        await store.ready(email);
        const profile = store.getProfile(email);
        if (!profile || profile.visible === false) throw httpError(404, 'There’s no profile here');
        const mode = profile.photoMode || 'account';
        const photo = mode === 'none' ? null : mode === 'card' ? profile.cardPhoto : await ctx.avatars.photoVersion(email);
        return { email, mode, view: publicView(profile, { username: name, photo }), url: `${originOf(req)}/profile/#/${name}` };
    }
    // the photo the card shows: its own, or the mail photo
    const photoFor = (email, mode) => (mode === 'none' ? null : mode === 'card' ? ctx.avatars.cardPhoto(email) : ctx.avatars.uploaded(email));
    r.get('/profiles/:username', wrap(async (req, res) => {
        const { view, url } = await cardFor(req);
        res.set('Cache-Control', 'no-cache').json({ ...view, url });
    }));
    r.get('/profiles/:username/photo', wrap(async (req, res) => {
        const { email, mode } = await cardFor(req);
        const photo = await photoFor(email, mode);
        if (!photo) return res.status(404).end();
        res.set({ 'Content-Type': photo.type, 'Cache-Control': 'public, max-age=300', 'Content-Security-Policy': "default-src 'none'", 'Cross-Origin-Resource-Policy': 'same-origin' }).send(photo.buf);
    }));
    r.get('/profiles/:username/vcard', wrap(async (req, res) => {
        const { email, mode, view, url } = await cardFor(req);
        const photo = view.photo ? await photoFor(email, mode) : null;
        res.set({ 'Content-Type': 'text/vcard; charset=utf-8', 'Content-Disposition': `attachment; filename="${view.username}.vcf"`, 'Cache-Control': 'no-cache' }).send(vcard(view, { url, photo }));
    }));
    r.get('/profiles/:username/qr.svg', wrap(async (req, res) => {
        const { url } = await cardFor(req);
        const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0d18', light: '#ffffff' } });
        res.set({ 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }).send(svg);
    }));

    // the Admin app (only for ADMIN_EMAILS)
    if (ctx.adminRouter) r.use(ctx.adminRouter);

    r.use((req, res) => res.status(404).json({ error: 'Not found' }));
    // eslint-disable-next-line no-unused-vars
    r.use((err, req, res, next) => {
        const status = err.status || (err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500);
        if (status >= 500) console.error(err);
        res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
    });
    return r;
};
