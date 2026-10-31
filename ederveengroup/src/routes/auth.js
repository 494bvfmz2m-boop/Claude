'use strict';

// Signing in and out, the 2FA code step, signed-in devices and sign-in activity.

const crypto = require('crypto');
const express = require('express');
const { wrap, isEmail, requireAuth } = require('../http');
const { createLimiter } = require('../security');
const { describeDevice } = require('../devices');

const FIFTEEN_MIN = 15 * 60 * 1000;
// a public handle for a session, so the real session id never leaves the server
const sessionRef = sid => crypto.createHash('sha256').update(sid).digest('base64url').slice(0, 16);

module.exports = function authRoutes({ sessions, store, mail, checkCode }) {
    const r = express.Router();
    const perIp = createLimiter({ max: 10, windowMs: FIFTEEN_MIN });
    const perAccount = createLimiter({ max: 8, windowMs: FIFTEEN_MIN });
    const codeGuesses = createLimiter({ max: 5, windowMs: FIFTEEN_MIN });
    const who = req => ({ ip: req.ip, ua: String(req.get('user-agent') || '') });

    function throttle(req, res, next) {
        if (perIp.blocked(req.ip)) return res.status(429).json({ error: 'Too many attempts. Take a breather and try again in a few minutes.' });
        perIp.hit(req.ip);
        next();
    }

    r.post('/login', throttle, wrap(async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        if (!isEmail(email) || !password || password.length > 1024) return res.status(400).json({ error: 'Enter your full email address and password.' });
        if (perAccount.blocked(email)) {
            store.logActivity(email, { ok: false, method: 'password', reason: 'locked', ...who(req) });
            return res.status(429).json({ error: 'Too many failed attempts for this account. Try again in 15 minutes.' });
        }
        let ok;
        try {
            ok = await mail.verifyLogin(email, password);
        } catch {
            return res.status(502).json({ error: 'Could not reach Purelymail. Try again in a moment.' });
        }
        if (!ok) {
            perAccount.hit(email);
            store.logActivity(email, { ok: false, method: 'password', reason: 'wrong-password', ...who(req) });
            return res.status(401).json({ error: 'That email and password combo didn’t work.' });
        }
        const remember = req.body.remember !== false;
        const tf = store.getTwofa(email);
        if (tf && tf.secret) {
            if (!sessions.isTrusted(req, email, tf.since)) {
                // password is right; hand back a sealed 5-minute ticket for the code step
                const ticket = sessions.seal({ purpose: '2fa', email, password, remember, exp: Date.now() + 5 * 60 * 1000 });
                return res.json({ twofa: true, ticket, email });
            }
        }
        perIp.reset(req.ip);
        perAccount.reset(email);
        sessions.start(res, { email, password, remember });
        store.logActivity(email, { ok: true, method: tf && tf.secret ? 'trusted-device' : 'password', ...who(req) });
        res.json({ ok: true });
    }));

    r.post('/login/2fa', throttle, (req, res) => {
        const t = sessions.open(req.body.ticket, '2fa');
        if (!t) return res.status(401).json({ error: 'That sign-in took too long. Please start again.', restart: true });
        const tf = store.getTwofa(t.email);
        let result = { ok: true, method: 'password' };
        if (tf && tf.secret) {
            if (codeGuesses.blocked(t.email)) return res.status(429).json({ error: 'Too many wrong codes. Wait 15 minutes, then sign in again.', restart: true });
            result = checkCode(t.email, tf, req.body.code);
            if (!result.ok) {
                codeGuesses.hit(t.email);
                store.logActivity(t.email, { ok: false, method: '2fa', reason: 'wrong-code', ...who(req) });
                return res.status(401).json({ error: 'That code didn’t work. Check your authenticator and try again.' });
            }
            if (req.body.trust) sessions.trustDevice(res, t.email, tf.since);
        }
        perIp.reset(req.ip);
        codeGuesses.reset(t.email);
        sessions.start(res, { email: t.email, password: t.password, remember: t.remember });
        store.logActivity(t.email, { ok: true, method: result.method, ...who(req) });
        res.json(result);
    });

    r.post('/logout', wrap(async (req, res) => {
        if (req.session) {
            store.sessions.revoke(req.session.email, req.session.sid);
            await mail.closeClient(req.session);
        }
        sessions.clear(res);
        res.json({ ok: true });
    }));

    r.post('/logout/everywhere', requireAuth, wrap(async (req, res) => {
        store.sessions.revokeAll(req.session.email);
        await mail.closeClient(req.session);
        sessions.clear(res);
        res.json({ ok: true });
    }));

    /* ---------- devices & activity ---------- */

    r.get('/sessions', requireAuth, (req, res) => {
        res.json(
            store.sessions.list(req.session.email).map(s => ({
                ref: sessionRef(s.sid),
                current: s.sid === req.session.sid,
                device: describeDevice(s.ua),
                ip: s.ip,
                created: s.created,
                lastSeen: s.lastSeen,
                remember: s.remember
            }))
        );
    });

    r.delete('/sessions/:ref', requireAuth, wrap(async (req, res) => {
        const target = store.sessions.list(req.session.email).find(s => sessionRef(s.sid) === req.params.ref);
        if (!target) return res.status(404).json({ error: 'That device is already signed out' });
        store.sessions.revoke(req.session.email, target.sid);
        const current = target.sid === req.session.sid;
        if (current) {
            await mail.closeClient(req.session);
            sessions.clear(res);
        }
        res.json({ ok: true, current });
    }));

    r.get('/activity', requireAuth, (req, res) => {
        res.json(store.listActivity(req.session.email).map(a => ({ ...a, device: describeDevice(a.ua), ua: undefined })));
    });

    return r;
};
