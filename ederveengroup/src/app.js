'use strict';

// Builds the whole site: the Work in progress page at "/" and the webmail at config.base.

const express = require('express');
const compression = require('compression');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createDocs } = require('../lib/docs');
const { createVault } = require('../lib/vault');
const { createSessions, loadKey, seal, unseal } = require('../lib/session');
const { createBackend } = require('../lib/db');
const { createStore } = require('../lib/store');
const { createAvatars } = require('../lib/avatars');
const defaultMail = require('../lib/mail');
const { createSecurityHeaders, csrfGuard } = require('./security');
const { requireAuth } = require('./http');
const { assetVersion, createPages } = require('./pages');
const { createSecondFactor } = require('./twofa');
const { createSnoozeWaker } = require('./snooze');
const { createLinks } = require('../lib/links');
const { createOAuth } = require('../lib/oauth');
const { APP_ROUTE, APP_PAGES, ADMIN_ONLY, safeNext } = require('./routes-app');
const { adminRoutes, requestRoutes } = require('./routes/servers');

function createApp(config, { mail = defaultMail, checkMailbox } = {}) {
    // private account data in the database is encrypted with a key derived from the server secret
    const dataKey = crypto.createHmac('sha256', loadKey(config.dataDir)).update('derive\0data').digest();
    const backend = createBackend(config, { key: dataKey });
    const store = createStore(config.dataDir, { backend });
    const ctx = {
        config,
        store,
        mail,
        avatars: createAvatars(config.dataDir, { backend, store }),
        // one sign-in for the whole site (hub, Mail, Profile…); older cookies were scoped to /mail/
        sessions: createSessions({ dataDir: config.dataDir, cookiePath: '/', legacyPaths: [config.baseUrl], secureCookies: config.secureCookies, registry: store.sessions, ready: store.ready }),
        upload: multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 50 } }),
        checkCode: createSecondFactor(store),
        wakeDue: createSnoozeWaker({ store, mail }),
        links: null,
        checkMailbox, // tests swap in a stub; normally lib/servers.js signs in once to check
        pages: createPages({ viewsDir: config.viewsDir, publicDir: config.publicDir, baseUrl: config.baseUrl, version: assetVersion(config.publicDir) })
    };

    ctx.links = createLinks(ctx.sessions.deriveKey('links'));
    ctx.docs = createDocs(store.backend); // shared documents: chat, announcements, shared docs…
    // file contents for Files and Photos: on disk (FILES_DIR), encrypted with a key of their own
    ctx.vault = createVault({ dir: config.files.dir, key: ctx.sessions.deriveKey('vault') });
    // the site's activity log (Admin → Activity): every sign-in, and what admins change
    ctx.audit = entry =>
        ctx.docs
            .get('audit', () => ({ items: [] }))
            .then(d => {
                d.items.unshift({ t: Date.now(), ...entry });
                d.items.length = Math.min(d.items.length, 3000);
                ctx.docs.save('audit');
            })
            .catch(() => {});
    const logOne = store.logActivity;
    store.logActivity = (email, entry) => {
        logOne.call(store, email, entry);
        ctx.audit({ kind: 'signin', email: String(email).toLowerCase(), ok: !!entry.ok, method: entry.method, reason: entry.reason || '', ip: entry.ip || '', device: entry.ua ? require('./devices').describeDevice(entry.ua).label : '' });
    };
    // accepted addresses / domains use their own mail servers
    if (mail.useServers) mail.useServers(email => store.servers.profileFor(email), { allowPrivateHosts: config.allowPrivateMailHosts });
    // Microsoft / Google sign-ins: access tokens are renewed a few minutes before they expire
    // the app registrations come from the environment, or from Admin → Sign-in (secret sealed with a derived key)
    const signinKey = ctx.sessions.deriveKey('signin-apps');
    ctx.signinApps = {
        get(id) {
            const s = store.servers.getSignin(id);
            if (!s) return null;
            const secret = s.secret ? unseal(signinKey, s.secret) : null;
            return { clientId: s.clientId, clientSecret: secret && secret.v, tenant: s.tenant, hidden: !!s.hidden, secretHint: s.secretHint || '', savedAt: s.savedAt, savedBy: s.savedBy };
        },
        set(id, { clientId, clientSecret, tenant, hidden, by }) {
            const before = store.servers.getSignin(id) || {};
            const next = { ...before, hidden: !!hidden };
            if (clientId !== undefined) next.clientId = clientId;
            if (tenant !== undefined) next.tenant = tenant;
            if (clientSecret) Object.assign(next, { secret: seal(signinKey, { v: clientSecret }), secretHint: clientSecret.slice(-4), savedAt: Date.now(), savedBy: by });
            store.servers.setSignin(id, next);
        },
        clear(id) {
            const s = store.servers.getSignin(id);
            store.servers.setSignin(id, s && s.hidden ? { hidden: true } : null);
        }
    };
    ctx.oauth = createOAuth(config.oauth, { stored: id => ctx.signinApps.get(id) });
    const renewing = new Map();
    async function tokenFor({ email }) {
        await store.ready(email);
        const t = store.getOAuth(email);
        if (!t) throw Object.assign(new Error('Please sign in again'), { authenticationFailed: true });
        if (t.accessToken && t.expiresAt - Date.now() > 3 * 60 * 1000) return t.accessToken;
        if (!renewing.has(email)) {
            renewing.set(email, ctx.oauth.refresh(t.provider, t.refreshToken)
                .then(fresh => {
                    store.setOAuth(email, { ...t, ...fresh });
                    return fresh.accessToken;
                })
                .finally(() => renewing.delete(email)));
        }
        return renewing.get(email);
    }
    ctx.tokenFor = tokenFor;
    if (mail.useOAuth) mail.useOAuth({ servers: p => ctx.oauth.servers(p), token: tokenFor });
    const admin = adminRoutes(ctx);
    ctx.isAdmin = admin.isAdmin;
    ctx.adminOverview = admin.overview;
    ctx.isBlocked = admin.isBlocked;
    ctx.appOn = name => !(store.servers.getSettings().appsOff || []).includes(name);
    ctx.adminRouter = admin.router; // served at /api/admin (the Admin app)

    // start-up: create the tables and load the mail-server list; if the database can't be
    // reached, say so on every page and keep retrying
    const boot = { ok: false, error: null };
    const start = () =>
        (boot.promise = backend
            .init()
            .then(() => store.init())
            .then(() => {
                boot.ok = true;
                boot.error = null;
            })
            .catch(err => {
                boot.error = err;
                console.error(`Can't open the ${backend.kind === 'mysql' ? 'database' : 'data folder'}: ${err.message}. Retrying in 10 seconds.`);
                setTimeout(start, 10000);
            }));
    start();

    const site = express();
    site.disable('x-powered-by');
    site.set('trust proxy', config.trustProxy);
    site.use(async (req, res, next) => {
        if (!boot.ok) await boot.promise;
        if (boot.ok) return next();
        res.status(503).set('Retry-After', '10').type('text/plain').send('EderveenGroup can’t reach its database right now. It keeps retrying; refresh in a moment.');
    });
    // gzip/brotli text responses, except the live event stream (it must not be buffered)
    site.use(compression({ filter: (req, res) => !String(res.getHeader('Content-Type') || '').includes('event-stream') && !req.path.startsWith('/dav') && compression.filter(req, res) }));
    site.use(createSecurityHeaders({ scriptHashes: ctx.pages.scriptHashes }));

    site.use(ctx.sessions.middleware());
    const toLogin = (res, next) => res.redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);

    // the first time someone signs in they choose a username; every app page waits for that
    const needsName = req => req.session && !ctx.store.usernameOf(req.session.email);
    const toWelcome = (res, next) => res.redirect(`/welcome?next=${encodeURIComponent(next)}`);

    /* ---------- the hub: sign in at "/", then your apps ---------- */
    site.get('/', (req, res) => (!req.session ? ctx.pages.send(res, 'login.html') : needsName(req) ? toWelcome(res, '/') : ctx.pages.send(res, 'hub.html')));
    site.get('/welcome', (req, res) => {
        if (!req.session) return toLogin(res, '/welcome');
        if (!needsName(req)) return res.redirect(safeNext(req.query.next, config.baseUrl));
        ctx.pages.send(res, 'welcome.html');
    });
    // Files as a network drive for computers and phones (WebDAV, app passwords)
    const dav = require('./routes/dav')(ctx);
    ctx.davApi = dav.api;
    site.use('/dav', dav.handler);
    // Sign in with Microsoft / Google
    site.use(require('./routes/oauth')(ctx));
    site.use('/api', require('./routes/hub')(ctx));
    // a calendar subscription for phones (the address itself is the secret)
    site.get(/^\/cal\/([A-Za-z0-9_-]{20,400})\.ics$/, (req, res, next) => ((req.params.token = req.params[0]), ctx.calendarFeed(req, res, next)));
    site.get(/^\/w\/([A-Za-z0-9_-]{20,400})\.json$/, (req, res, next) => ((req.params.token = req.params[0]), ctx.widgetFeed(req, res, next)));
    site.get(/^\/w\/([A-Za-z0-9_-]{20,400})\/photo\/([A-Za-z0-9_-]{4,40})\.jpg$/, (req, res, next) => ((req.params.token = req.params[0]), (req.params.id = req.params[1]), ctx.widgetPhoto(req, res, next)));
    // a file someone shared from Files (the address itself is the secret)
    site.get('/s/:token', (req, res, next) => ctx.sharedFile(req, res, next));
    // a form to fill in (open to anyone with the link, unless the form asks to sign in)
    site.get('/r/:token', (req, res) => (/^[A-Za-z0-9_-]{16}$/.test(req.params.token) && ctx.appOn('forms') ? ctx.pages.send(res, 'respond.html') : ctx.pages.send(res, 'notfound.html', 404)));
    // Profile: the editor and everyone's public cards (/profile/#/username) are one page
    // (Express treats /profile and /profile/ alike, so one handler adds the slash the page needs)
    site.get('/profile', (req, res) => (req.path.endsWith('/') ? ctx.pages.send(res, 'profile.html') : res.redirect(301, '/profile/')));
    // Notes, Tasks, Contacts, Calendar, Files, Docs…: each a page of its own, signed in
    // (a page that isn't written yet is simply not found)
    ctx.appPages = APP_PAGES.filter(a => fs.existsSync(path.join(config.viewsDir, `${a}.html`)));
    for (const app of ctx.appPages) {
        site.get(`/${app}`, (req, res) => {
            if (!req.session) return toLogin(res, `/${app}/`);
            if (!ctx.appOn(app)) return ctx.pages.send(res, 'notfound.html', 404); // switched off in Admin
            if (ADMIN_ONLY.includes(app) && !ctx.isAdmin(req.session.email)) return ctx.pages.send(res, 'notfound.html', 404);
            if (needsName(req)) return toWelcome(res, `/${app}/`);
            if (!req.path.endsWith('/')) return res.redirect(301, `/${app}/`);
            ctx.pages.send(res, `${app}.html`);
        });
    }
    // the Admin app: only for ADMIN_EMAILS (everyone else just sees "not found")
    site.get('/admin', (req, res) => {
        if (!req.session) return toLogin(res, '/admin/');
        if (!ctx.isAdmin(req.session.email)) return ctx.pages.send(res, 'notfound.html', 404);
        if (needsName(req)) return toWelcome(res, '/admin/');
        if (!req.path.endsWith('/')) return res.redirect(301, '/admin/');
        // the overview comes with the page, so Admin is never empty, even before (or without) its script
        const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
        Promise.race([admin.overview(), new Promise(resolve => setTimeout(() => resolve(null), 3000))])
            .catch(() => null)
            .then(o => {
                const tile = (n, label, href) => `<a class="cp-tile" href="/admin/#/${href}"><b>${esc(n)}</b><span>${esc(label)}</span></a>`;
                const html = o
                    ? `<h1>Overview</h1><p class="cp-sub">Everything about your EderveenGroup at a glance.</p><div class="cp-tiles">${tile(o.people, 'people', 'people')}${tile(o.activeWeek, 'active this week', 'people')}${tile(o.pending, o.pending === 1 ? 'request waiting' : 'requests waiting', 'requests')}${tile(o.publicProfiles, 'public profiles', 'people')}${tile(o.twofa, 'use two-step', 'people')}${tile(o.failedWeek, 'failed sign-ins this week', 'people')}</div>
                       <section class="cp-card"><h2>Admins</h2><p class="cp-muted">${o.admins.map(esc).join(', ')}</p></section>`
                    : '<h1>Admin</h1><p class="cp-sub">Loading…</p>';
                ctx.pages.send(res, 'admin.html', 200, { overview: html });
            });
    });
    site.get('/login', (req, res) => (req.session ? res.redirect(safeNext(req.query.next, config.baseUrl)) : ctx.pages.send(res, 'login.html')));
    // installable as an app (Windows, Mac, Android, iPhone): it opens the hub
    site.get('/manifest.webmanifest', (req, res) => res.type('application/manifest+json').set('Cache-Control', 'no-cache').send(ctx.pages.manifest));
    site.get('/sw.js', (req, res) => {
        if (!ctx.pages.serviceWorker) return res.status(404).end();
        res.type('application/javascript').set('Cache-Control', 'no-cache').send(ctx.pages.serviceWorker);
    });

    /* ---------- the webmail ---------- */
    const app = express.Router();
    app.use(express.json({ limit: '2mb' }));

    // every screen has its own address (/inbox, /inbox/<link>, /f/<id>, /search/<code>, /settings/<tab>);
    // they all load the app, which then shows the right thing. Signed out: back here after login.
    app.get('/', (req, res) => (req.session ? res.redirect(config.baseUrl + 'inbox') : toLogin(res, config.baseUrl + 'inbox')));
    app.get(APP_ROUTE, (req, res) => {
        const here = config.baseUrl + req.path.slice(1);
        if (!req.session) return toLogin(res, here);
        if (needsName(req)) return toWelcome(res, here);
        ctx.pages.send(res, 'app.html');
    });
    // the form for bringing your own mail server (open to everyone)
    app.get('/request', (req, res) => ctx.pages.send(res, 'request.html'));
    // the sign-in page moved to the hub
    app.get('/login', (req, res) => {
        const next = String(req.query.next || '');
        toLogin(res, next && APP_ROUTE.test('/' + next) ? config.baseUrl + next : '');
    });
    // the old /mail/ service worker removes itself (the app is installed from "/" now)
    app.get('/sw.js', (req, res) =>
        res.type('application/javascript').set('Cache-Control', 'no-cache')
            .send("self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', e => e.waitUntil(self.registration.unregister()));\n"));
    app.use(
        express.static(config.publicDir, {
            index: false,
            setHeaders(res) {
                // versioned URLs never change, so they can be cached for a year
                res.set('Cache-Control', res.req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
            }
        })
    );

    const api = express.Router();
    api.use(csrfGuard);
    api.use(require('./routes/auth')(ctx));
    api.use(requestRoutes(ctx));
    api.use(requireAuth);
    api.use(require('./routes/account')(ctx));
    api.use('/2fa', require('./routes/twofa')(ctx));
    api.use(require('./routes/mail')(ctx));
    api.use(require('./routes/events')(ctx));
    api.use((req, res) => res.status(404).json({ error: 'Not found' }));
    app.use('/api', api);

    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err.authenticationFailed) {
            ctx.sessions.clear(res);
            return res.status(401).json({ error: req.session && req.session.provider ? 'Your sign-in expired. Please sign in again.' : 'Your mail password changed. Please sign in again.' });
        }
        if (err instanceof multer.MulterError) return res.status(413).json({ error: 'Attachments are limited to 25 MB each.' });
        if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That’s too large to send.' });
        if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request' });
        const status = err.status || 500;
        if (status >= 500) console.error(err);
        res.status(status).json({ error: status >= 500 ? err.responseText || err.response || err.message || 'Something went wrong' : err.message });
    });

    /* ---------- the rest of the domain ---------- */
    if (config.base) {
        // /mail -> /mail/ so relative URLs inside the app resolve correctly
        site.use((req, res, next) => {
            if (req.path !== config.base) return next();
            const q = req.originalUrl.slice(req.originalUrl.indexOf(config.base) + config.base.length);
            res.redirect(301, config.baseUrl + q);
        });
    }
    site.use(config.base, app);
    site.use((req, res) => ctx.pages.send(res, 'notfound.html', 404));

    return { site, ctx, ready: boot.promise, store, close: async () => (await store.flush(), await backend.close()) };
}

module.exports = { createApp };
