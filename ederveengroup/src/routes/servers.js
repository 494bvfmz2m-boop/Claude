'use strict';

// Bringing your own mail server: the public request form, and the admin panel that
// accepts (the address or its whole domain can then sign in) or rejects requests.
// The requester is emailed from the admin's own mailbox either way.

const express = require('express');
const { wrap, httpError } = require('../http');
const { createLimiter } = require('../security');
const { describeDevice } = require('../devices');
const servers = require('../../lib/servers');

const HOUR = 60 * 60 * 1000;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** public: submit a request, auto-detect settings */
function requestRoutes({ store, config, checkMailbox = servers.checkRequest }) {
    const r = express.Router();
    const submits = createLimiter({ max: 5, windowMs: HOUR });
    const lookups = createLimiter({ max: 30, windowMs: HOUR / 4 });

    r.get('/requests/autodetect', wrap(async (req, res) => {
        if (lookups.blocked(req.ip)) throw httpError(429, 'Slow down a little and try again in a few minutes.');
        lookups.hit(req.ip);
        res.json({ settings: await servers.autodetect(String(req.query.email || '')) });
    }));

    r.post('/requests', wrap(async (req, res) => {
        if (req.body.website) return res.json({ ok: true }); // a bot filled the hidden field
        if (submits.blocked(req.ip)) throw httpError(429, 'Too many requests from here. Try again in an hour.');
        submits.hit(req.ip);
        const request = servers.cleanRequest(req.body);
        if (store.servers.profileFor(request.email)) throw httpError(409, 'That address can already sign in. Go to the sign-in page.');
        if (store.servers.pendingFor(request.email)) throw httpError(409, 'There’s already a request for that address. You’ll get an email when it’s decided.');
        // proves the settings work and that the mailbox is yours; the password is not kept
        await checkMailbox(request, req.body.password, { allowPrivate: config.allowPrivateMailHosts });
        store.servers.addRequest({ ...request, verified: true, ip: req.ip, device: describeDevice(String(req.get('user-agent') || '')).label });
        res.json({ ok: true });
    }));

    return r;
}

/** signed in admins only: review requests, manage accepted servers */
function adminRoutes({ store, mail, config }) {
    const r = express.Router();
    const isAdmin = email => config.adminEmails.includes(String(email).toLowerCase());
    r.use('/admin', (req, res, next) => (!req.session ? res.status(401).json({ error: 'Please sign in' }) : isAdmin(req.session.email) ? next() : res.status(403).json({ error: 'Only admins can do that' })));

    r.get('/admin/requests', (req, res) => {
        const list = store.servers.listRequests();
        res.json([...list.filter(x => x.status === 'pending'), ...list.filter(x => x.status !== 'pending')].slice(0, 200));
    });

    async function decide(req, res, status) {
        const request = store.servers.getRequest(req.params.id);
        if (!request || request.status !== 'pending') throw httpError(404, 'That request was already handled');
        const scope = req.body.scope === 'domain' ? 'domain' : 'address';
        const reason = String(req.body.reason || '').slice(0, 500);
        const decided = store.servers.decide(request.id, { status, scope, reason, by: req.session.email });
        // tell them, from the admin's own mailbox (no stored passwords needed)
        let emailed = true;
        let emailError = null;
        try {
            const settings = store.getSettings(req.session.email);
            await mail.sendMessage(req.session, decisionEmail(decided, { origin: originOf(req), base: config.baseUrl, fromName: settings.displayName || '' }), { saveSentCopy: settings.saveSentCopy });
        } catch (err) {
            emailed = false;
            emailError = err.message;
        }
        res.json({ ok: true, request: decided, emailed, emailError });
    }
    r.post('/admin/requests/:id/accept', wrap((req, res) => decide(req, res, 'accepted')));
    r.post('/admin/requests/:id/reject', wrap((req, res) => decide(req, res, 'rejected')));

    r.get('/admin/servers', (req, res) => res.json(store.servers.listAccounts()));
    r.delete('/admin/servers/:key', (req, res) => {
        if (!store.servers.removeAccount(String(req.params.key))) throw httpError(404, 'Already removed');
        res.json({ ok: true });
    });

    return { router: r, isAdmin };
}

const originOf = req => `${req.protocol}://${String(req.get('host') || 'localhost').replace(/[^a-z0-9.:\-[\]]/gi, '')}`;

function decisionEmail(request, { origin, base, fromName }) {
    const name = request.name || request.email;
    const accepted = request.status === 'accepted';
    const signIn = `${origin}/login`;
    const via = request.provider ? (request.provider === 'google' ? 'Google' : 'Microsoft') : null;
    const subject = accepted ? 'Your mailbox is ready on EderveenGroup' : 'About your EderveenGroup request';
    const lines = accepted
        ? [
              `Good news: ${request.scope === 'domain' ? `everyone at @${request.email.split('@')[1]}` : request.email} can now use EderveenGroup.`,
              via ? `Sign in with ${via} on the sign-in page:` : 'Sign in with your email address and your mailbox password:'
          ]
        : [`Your request to add ${request.email} to EderveenGroup wasn’t accepted.`, ...(request.reason ? [`Reason: ${request.reason}`] : [])];
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:520px">
<p>Hi ${esc(name)},</p>${lines.map(l => `<p>${esc(l)}</p>`).join('')}
${accepted ? `<p><a href="${esc(signIn)}" style="display:inline-block;padding:11px 20px;border-radius:10px;background:#4c8dff;color:#fff;text-decoration:none;font-weight:600">${via ? `Sign in with ${esc(via)}` : 'Sign in to EderveenGroup'}</a></p>` : ''}
<p style="color:#6b7280">${esc(fromName || 'EderveenGroup')}</p></div>`;
    const text = `Hi ${name},\n\n${lines.join('\n\n')}${accepted ? `\n\n${signIn}` : ''}\n\n${fromName || 'EderveenGroup'}\n`;
    return { fromName, to: [{ name: request.name || '', address: request.email }], cc: [], bcc: [], subject, html, text, references: [], attachments: [] };
}

module.exports = { adminRoutes, decisionEmail, requestRoutes };
