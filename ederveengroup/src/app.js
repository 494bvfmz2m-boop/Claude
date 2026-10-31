'use strict';

// Builds the whole site: the Work in progress page at "/" and the webmail at config.base.

const express = require('express');
const compression = require('compression');
const multer = require('multer');
const { createSessions } = require('../lib/session');
const { createStore } = require('../lib/store');
const { createAvatars } = require('../lib/avatars');
const defaultMail = require('../lib/mail');
const { createSecurityHeaders, csrfGuard } = require('./security');
const { requireAuth } = require('./http');
const { assetVersion, createPages } = require('./pages');
const { createSecondFactor } = require('./twofa');
const { createSnoozeWaker } = require('./snooze');

function createApp(config, { mail = defaultMail } = {}) {
    const store = createStore(config.dataDir);
    const ctx = {
        config,
        store,
        mail,
        avatars: createAvatars(config.dataDir),
        sessions: createSessions({ dataDir: config.dataDir, cookiePath: config.baseUrl, secureCookies: config.secureCookies, registry: store.sessions }),
        upload: multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 50 } }),
        checkCode: createSecondFactor(store),
        wakeDue: createSnoozeWaker({ store, mail }),
        pages: createPages({ viewsDir: config.viewsDir, publicDir: config.publicDir, baseUrl: config.baseUrl, version: assetVersion(config.publicDir) })
    };

    const site = express();
    site.disable('x-powered-by');
    site.set('trust proxy', config.trustProxy);
    // gzip/brotli text responses, except the live event stream (it must not be buffered)
    site.use(compression({ filter: (req, res) => !String(res.getHeader('Content-Type') || '').includes('event-stream') && compression.filter(req, res) }));
    site.use(createSecurityHeaders({ scriptHashes: ctx.pages.scriptHashes }));

    /* ---------- the webmail ---------- */
    const app = express.Router();
    app.use(ctx.sessions.middleware());
    app.use(express.json({ limit: '2mb' }));

    app.get('/', (req, res) => (req.session ? ctx.pages.send(res, 'app.html') : res.redirect(config.baseUrl + 'login')));
    app.get('/login', (req, res) => (req.session ? res.redirect(config.baseUrl) : ctx.pages.send(res, 'login.html')));
    // the service worker is rendered per deploy, so a new version installs itself
    app.get('/sw.js', (req, res) => {
        if (!ctx.pages.serviceWorker) return res.status(404).end();
        res.type('application/javascript').set({ 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': config.baseUrl }).send(ctx.pages.serviceWorker);
    });
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
            return res.status(401).json({ error: 'Your Purelymail password changed. Please sign in again.' });
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
    site.use(config.base || '/', app);
    if (config.base) {
        site.get('/', (req, res) => ctx.pages.send(res, 'landing.html'));
        site.use((req, res) => ctx.pages.send(res, 'landing.html', 404));
    }

    return { site, ctx };
}

module.exports = { createApp };
