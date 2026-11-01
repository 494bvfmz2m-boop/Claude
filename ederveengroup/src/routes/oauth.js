'use strict';

// "Sign in with Microsoft" / "Sign in with Google".
//   GET /auth/:provider            off to the provider's own sign-in page
//   GET /auth/:provider/callback   back again: check who it is, whether they may use
//                                  EderveenGroup, that their mailbox answers, then sign in
// Who may sign in is chosen in the Admin app: anyone, or only approved addresses and domains
// (others are turned into an access request). Admins can always sign in.

const express = require('express');
const { parseCookies } = require('../../lib/session');
const { safeNext } = require('../routes-app');
const { createLimiter } = require('../security');

const COOKIE = 'eg_oauth';
const TEN_MIN = 10 * 60 * 1000;

module.exports = function oauthRoutes(ctx) {
    const { config, store, sessions, oauth, mail } = ctx;
    const r = express.Router();
    const tries = createLimiter({ max: 30, windowMs: 15 * 60 * 1000 });
    const originOf = req => config.oauth.publicUrl || `${req.protocol}://${String(req.get('host') || 'localhost').replace(/[^a-z0-9.:\-[\]]/gi, '')}`;
    const redirectUri = (req, id) => `${originOf(req)}/auth/${id}/callback`;
    const cookie = (res, value, maxAge) => res.append('Set-Cookie', `${COOKIE}=${value}; Path=/auth/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${res.req.secure ? '; Secure' : ''}`);
    // back to the sign-in page with a short reason the page knows how to explain
    const fail = (res, why, provider) => res.redirect(`/login?oauth=${encodeURIComponent(why)}${provider ? `&provider=${provider}` : ''}`);

    r.get('/auth/:provider', (req, res) => {
        const id = req.params.provider;
        if (!oauth.has(id)) return fail(res, 'off', id);
        if (tries.blocked(req.ip)) return fail(res, 'busy', id);
        tries.hit(req.ip);
        const hint = /^[^\s@<>"]+@[^\s@<>"]+$/.test(String(req.query.email || '')) ? String(req.query.email) : '';
        const s = oauth.start(id, { redirectUri: redirectUri(req, id), loginHint: hint });
        // what we need when they come back, sealed (nobody can read or change it) for 10 minutes
        cookie(res, sessions.seal({ purpose: 'oauth', provider: id, state: s.state, nonce: s.nonce, verifier: s.verifier, next: safeNext(req.query.next, config.baseUrl), exp: Date.now() + TEN_MIN }), TEN_MIN / 1000);
        res.set('Cache-Control', 'no-store').redirect(s.url);
    });

    r.get('/auth/:provider/callback', async (req, res, next) => {
        const id = req.params.provider;
        const saved = sessions.open(parseCookies(req.headers.cookie)[COOKIE], 'oauth');
        cookie(res, '', 0); // one use only
        if (!saved || saved.provider !== id || !req.query.state || saved.state !== req.query.state) return fail(res, 'expired', id);
        if (req.query.error) return fail(res, req.query.error === 'access_denied' ? 'cancelled' : 'failed', id);
        let who;
        try {
            who = await oauth.finish(id, { code: req.query.code, verifier: saved.verifier, nonce: saved.nonce, redirectUri: redirectUri(req, id) });
        } catch (err) {
            if (err.code === 'unreachable') return fail(res, 'unreachable', id);
            if (err.code === 'no_email') return fail(res, 'no_email', id);
            console.error(`Sign in with ${id} failed:`, err.message);
            return fail(res, 'failed', id);
        }
        try {
            const email = who.email;
            await store.ready(email);
            const ip = req.ip;
            const ua = String(req.get('user-agent') || '');

            // may this account use EderveenGroup?
            const policy = store.servers.getSettings().oauthPolicy;
            if (!ctx.isAdmin(email) && policy !== 'anyone' && !store.servers.isAllowed(email)) {
                if (!store.servers.pendingFor(email)) {
                    store.servers.addRequest({ email, name: who.name, provider: who.mail, verified: true, ip, device: require('../devices').describeDevice(ua).label, note: '' });
                }
                return fail(res, 'pending', id);
            }

            // keep the tokens (encrypted with the rest of the account) and check the mailbox answers
            store.setOAuth(email, { ...who.tokens, name: who.name });
            if (!store.getSettings(email).displayName && who.name) store.updateSettings(email, { displayName: who.name.slice(0, 120) });
            let ok = false;
            try {
                ok = await mail.verifyLogin({ email, provider: who.mail });
            } catch {
                ok = false;
            }
            if (!ok) {
                store.logActivity(email, { ok: false, method: who.mail, reason: 'no-imap', ip, ua });
                return fail(res, who.mail === 'microsoft' ? 'imap_off_personal' : who.mail === 'microsoft-work' ? 'imap_off_work' : 'imap_off', id);
            }

            // two-step verification still applies to people who turned it on here
            const tf = store.getTwofa(email);
            if (tf && tf.secret && !sessions.isTrusted(req, email, tf.since)) {
                const ticket = sessions.seal({ purpose: '2fa', email, provider: who.mail, remember: true, exp: Date.now() + 5 * 60 * 1000 });
                return res.redirect(`/login?next=${encodeURIComponent(saved.next)}#twofa=${encodeURIComponent(ticket)}&email=${encodeURIComponent(email)}`);
            }
            sessions.start(res, { email, provider: who.mail, remember: true });
            store.logActivity(email, { ok: true, method: who.mail, ip, ua });
            res.redirect(saved.next);
        } catch (err) {
            next(err);
        }
    });

    // which buttons to show on the sign-in page: both, unless an admin hid one; "ready" once set up
    r.get('/api/auth/providers', (req, res) =>
        res.json(oauth.ids().filter(id => !(ctx.signinApps && (ctx.signinApps.get(id) || {}).hidden)).map(id => ({ id, name: oauth.name(id), ready: oauth.has(id) }))));

    return r;
};
