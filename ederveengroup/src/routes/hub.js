'use strict';

// The site-wide API at /api (the mail app has its own at /mail/api): usernames now, and the
// Profile app. Each new EderveenGroup app adds its routes here.

const express = require('express');
const { wrap, httpError, requireAuth } = require('../http');
const { csrfGuard, createLimiter } = require('../security');
const usernames = require('../../lib/usernames');

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

    r.use((req, res) => res.status(404).json({ error: 'Not found' }));
    // eslint-disable-next-line no-unused-vars
    r.use((err, req, res, next) => {
        const status = err.status || (err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500);
        if (status >= 500) console.error(err);
        res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
    });
    return r;
};
