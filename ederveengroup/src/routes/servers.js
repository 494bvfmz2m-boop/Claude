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
function adminRoutes(ctx) {
    const { store, mail, config } = ctx;
    const r = express.Router();
    // admins: everyone in ADMIN_EMAILS (fixed), plus people made admin in the Admin app
    const owner = email => config.adminEmails.includes(String(email).toLowerCase());
    const isAdmin = email => owner(email) || (store.servers.getSettings().admins || []).includes(String(email).toLowerCase());
    const blocked = email => (store.servers.getSettings().blocked || []).includes(String(email).toLowerCase());
    // a line in the site's activity log
    const act = (req, text, extra = {}) => ctx.audit && ctx.audit({ kind: 'admin', by: req.session.email, text, ...extra });
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
        act(req, `${status === 'accepted' ? 'Accepted' : 'Rejected'} ${request.email}${status === 'accepted' && scope === 'domain' ? ` (everyone @${request.email.split('@')[1]})` : ''}`);
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

    /* ---------- overview ---------- */
    r.get('/admin/overview', wrap(async (req, res) => {
        const people = await store.listPeople();
        const week = Date.now() - 7 * 864e5;
        res.json({
            people: people.length,
            activeWeek: people.filter(p => (p.lastSeen || 0) > week).length,
            publicProfiles: people.filter(p => p.profile === 'public').length,
            twofa: people.filter(p => p.twofa).length,
            failedWeek: people.reduce((n, p) => n + p.failedWeek, 0),
            pending: store.servers.listRequests().filter(r => r.status === 'pending').length,
            servers: store.servers.listAccounts().length,
            allowed: store.servers.listAllowed().length,
            signIns: people.reduce((m, p) => ((m[p.signIn] = (m[p.signIn] || 0) + 1), m), {}),
            providers: ctx.oauth ? ctx.oauth.enabled() : [],
            settings: store.servers.getSettings(),
            database: store.backend.kind,
            admins: [...new Set([...config.adminEmails, ...(store.servers.getSettings().admins || [])])]
        });
    }));

    /* ---------- people ---------- */
    r.get('/admin/people', wrap(async (req, res) =>
        res.json((await store.listPeople()).map(p => ({ ...p, role: owner(p.email) ? 'owner' : isAdmin(p.email) ? 'admin' : 'member', blocked: blocked(p.email), you: p.email === req.session.email })))));
    const setList = (key, email, on) => {
        const list = new Set(store.servers.getSettings()[key] || []);
        if (on) list.add(email);
        else list.delete(email);
        store.servers.updateSettings({ [key]: [...list] });
    };
    r.post('/admin/people/:email/role', wrap(async (req, res) => {
        const email = await person(req);
        if (owner(email)) throw httpError(409, 'Admins from ADMIN_EMAILS stay admins. Change that setting on the server to remove one.');
        if (email === req.session.email) throw httpError(400, 'Ask another admin to change your own role');
        setList('admins', email, !!req.body.admin);
        act(req, `${req.body.admin ? 'Made' : 'Removed'} ${email} ${req.body.admin ? 'an admin' : 'as admin'}`);
        res.json({ ok: true, role: isAdmin(email) ? 'admin' : 'member' });
    }));
    r.post('/admin/people/:email/block', wrap(async (req, res) => {
        const email = await person(req);
        if (email === req.session.email) throw httpError(400, 'You can’t block yourself');
        if (owner(email)) throw httpError(409, 'Admins from ADMIN_EMAILS can’t be blocked');
        setList('blocked', email, !!req.body.blocked);
        if (req.body.blocked) {
            setList('admins', email, false);
            store.sessions.revokeAll(email);
        }
        act(req, `${req.body.blocked ? 'Blocked' : 'Unblocked'} ${email}`);
        res.json({ ok: true, blocked: blocked(email) });
    }));
    const person = async req => {
        const email = String(req.params.email || '').toLowerCase();
        if (!(await store.ready(email))) throw httpError(404, 'No account with that address');
        return email;
    };
    r.post('/admin/people/:email/signout', wrap(async (req, res) => {
        const email = await person(req);
        if (email === req.session.email) throw httpError(400, 'Use Settings → Devices to sign yourself out');
        store.sessions.revokeAll(email);
        act(req, `Signed ${email} out everywhere`);
        res.json({ ok: true });
    }));
    r.post('/admin/people/:email/profile', wrap(async (req, res) => {
        const email = await person(req);
        const p = store.getProfile(email);
        if (!p) throw httpError(404, 'They don’t have a profile');
        const { hidden, ...rest } = p;
        store.setProfile(email, req.body.hidden ? { ...rest, hidden: true } : rest);
        act(req, `${req.body.hidden ? 'Hid' : 'Showed'} the profile card of ${email}`);
        res.json({ ok: true, hidden: !!req.body.hidden });
    }));

    /* ---------- Sign in with Microsoft / Google: the app registrations, pasted in here ---------- */
    const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const signinView = (req, id) => {
        const source = ctx.oauth.source(id);
        const env = source === 'env' ? config.oauth[id] : null;
        const s = ctx.signinApps.get(id) || {};
        return {
            id,
            name: ctx.oauth.name(id),
            ready: !!source,
            source,
            clientId: env ? env.clientId : s.clientId || '',
            secretSaved: !env && !!s.clientSecret,
            secretHint: env ? '' : s.secretHint || '',
            tenant: id === 'microsoft' ? (env ? env.tenant : s.tenant) || 'common' : '',
            hidden: !!s.hidden,
            savedAt: s.savedAt || null,
            savedBy: s.savedBy || '',
            redirectUri: `${config.oauth.publicUrl || originOf(req)}/auth/${id}/callback`
        };
    };
    const signinId = req => {
        if (!ctx.oauth.ids().includes(req.params.id)) throw httpError(404, 'No such sign-in option');
        return req.params.id;
    };
    r.get('/admin/signin', (req, res) => res.json(ctx.oauth.ids().map(id => signinView(req, id))));
    r.put('/admin/signin/:id', (req, res) => {
        const id = signinId(req);
        const b = req.body || {};
        const patch = { hidden: !!b.hidden, by: req.session.email };
        if ('clientId' in b || b.clientSecret) {
            if (ctx.oauth.source(id) === 'env') throw httpError(409, 'This one is set on the server (environment variables). Change it there, or remove those variables to set it here.');
            const clientId = String(b.clientId || '').trim();
            const secret = String(b.clientSecret || '').trim();
            if (id === 'microsoft' && !GUID.test(clientId)) throw httpError(400, 'Paste the Application (client) ID. It looks like 1a2b3c4d-5e6f-…');
            if (id === 'google' && !/^[\w-]{6,}\.apps\.googleusercontent\.com$/.test(clientId)) throw httpError(400, 'Paste the Client ID. It ends in .apps.googleusercontent.com');
            if (secret && id === 'microsoft' && GUID.test(secret)) throw httpError(400, 'That’s the secret’s ID. Copy its Value instead (Microsoft shows it once, right after you create it).');
            if (secret && (/\s/.test(secret) || secret.length < 8 || secret.length > 256)) throw httpError(400, 'That doesn’t look like a client secret. Copy it again, without spaces.');
            const had = ctx.signinApps.get(id);
            if (!secret && !(had && had.clientSecret)) throw httpError(400, 'Paste the client secret too');
            patch.clientId = clientId;
            if (secret) patch.clientSecret = secret;
            if (id === 'microsoft') {
                const tenant = String(b.tenant || 'common').trim().toLowerCase();
                if (!/^(common|organizations|consumers)$/.test(tenant) && !GUID.test(tenant) && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(tenant)) throw httpError(400, 'Directory: use common, or your tenant ID or domain');
                patch.tenant = tenant;
            }
        }
        ctx.signinApps.set(id, patch);
        act(req, 'clientId' in b || b.clientSecret ? `Set up Sign in with ${ctx.oauth.name(id)}` : `${b.hidden ? 'Hid' : 'Showed'} the ${ctx.oauth.name(id)} button`);
        res.json(signinView(req, id));
    });
    r.delete('/admin/signin/:id', (req, res) => {
        const id = signinId(req);
        ctx.signinApps.clear(id);
        act(req, `Switched off Sign in with ${ctx.oauth.name(id)}`);
        res.json(signinView(req, id));
    });

    /* ---------- who may sign in with Microsoft / Google ---------- */
    r.get('/admin/settings', (req, res) => res.json(store.servers.getSettings()));
    r.put('/admin/settings', (req, res) => {
        const patch = {};
        if ('oauthPolicy' in req.body) patch.oauthPolicy = req.body.oauthPolicy === 'anyone' ? 'anyone' : 'approved';
        if (patch.oauthPolicy) act(req, patch.oauthPolicy === 'anyone' ? 'Let anyone sign in with Microsoft or Google' : 'Only approved people may sign in with Microsoft or Google');
        res.json(store.servers.updateSettings(patch));
    });
    r.get('/admin/allowed', (req, res) => res.json(store.servers.listAllowed()));
    r.post('/admin/allowed', (req, res) => {
        const key = String(req.body.key || '').trim().toLowerCase();
        if (!/^(@[a-z0-9.-]+\.[a-z]{2,}|[^\s@<>"]+@[a-z0-9.-]+\.[a-z]{2,})$/.test(key)) throw httpError(400, 'Enter an address (ava@gmail.com) or a whole domain (@company.com)');
        store.servers.allow(key, { addedBy: req.session.email });
        act(req, `Allowed ${key.startsWith('@') ? `everyone ${key}` : key} to sign in`);
        res.json({ ok: true, key });
    });
    r.delete('/admin/allowed/:key', (req, res) => {
        if (!store.servers.disallow(String(req.params.key).toLowerCase())) throw httpError(404, 'Already removed');
        act(req, `Removed ${req.params.key} from who may sign in`);
        res.json({ ok: true });
    });

    r.get('/admin/servers', (req, res) => res.json(store.servers.listAccounts()));
    r.delete('/admin/servers/:key', (req, res) => {
        if (!store.servers.removeAccount(String(req.params.key))) throw httpError(404, 'Already removed');
        act(req, `Removed the mail server for ${req.params.key}`);
        res.json({ ok: true });
    });

    /* ---------- activity: sign-ins and admin actions across the whole site ---------- */
    r.get('/admin/activity', wrap(async (req, res) => {
        const log = ctx.docs ? (await ctx.docs.get('audit', () => ({ items: [] }))).items : [];
        const kind = ['signin', 'admin', 'failed'].includes(req.query.kind) ? req.query.kind : '';
        const list = kind === 'failed' ? log.filter(e => e.kind === 'signin' && !e.ok) : kind ? log.filter(e => e.kind === kind) : log;
        res.json(list.slice(0, 300));
    }));

    /* ---------- apps: switch an app off for everyone ---------- */
    r.get('/admin/apps', (req, res) => res.json({ pages: ctx.appPages || [], off: store.servers.getSettings().appsOff || [] }));
    r.put('/admin/apps', (req, res) => {
        const off = [].concat(req.body.off || []).filter(a => (ctx.appPages || []).includes(a));
        const before = store.servers.getSettings().appsOff || [];
        store.servers.updateSettings({ appsOff: off });
        const changed = [...off.filter(a => !before.includes(a)).map(a => `Switched off ${a}`), ...before.filter(a => !off.includes(a)).map(a => `Switched on ${a}`)];
        if (changed.length) act(req, changed.join(', '));
        res.json({ off });
    });

    /* ---------- news: short posts everyone sees on their dashboard ---------- */
    const newsDoc = () => ctx.docs.get('news', () => ({ items: [] }));
    r.get('/admin/news', wrap(async (req, res) => res.json((await newsDoc()).items)));
    r.post('/admin/news', wrap(async (req, res) => {
        const title = String(req.body.title || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 120);
        const body = String(req.body.body || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 2000);
        if (!title) throw httpError(400, 'Give the post a title');
        const d = await newsDoc();
        const settings = store.getSettings(req.session.email);
        const item = { id: require('crypto').randomBytes(8).toString('base64url'), title, body, by: settings.displayName || store.usernameOf(req.session.email) || req.session.email, at: Date.now(), until: Number(req.body.days) > 0 ? Date.now() + Math.min(365, Number(req.body.days)) * 864e5 : null };
        d.items.unshift(item);
        d.items.length = Math.min(d.items.length, 50);
        ctx.docs.save('news');
        act(req, `Posted “${title}”`);
        res.json(item);
    }));
    r.delete('/admin/news/:id', wrap(async (req, res) => {
        const d = await newsDoc();
        const item = d.items.find(n => n.id === req.params.id);
        if (!item) throw httpError(404, 'Already removed');
        d.items = d.items.filter(n => n !== item);
        ctx.docs.save('news');
        act(req, `Took down “${item.title}”`);
        res.json({ ok: true });
    }));

    return { router: r, isAdmin, isBlocked: blocked };
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
