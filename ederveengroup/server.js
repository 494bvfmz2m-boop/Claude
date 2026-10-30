'use strict';

const path = require('path');

if (Number(process.versions.node.split('.')[0]) < 20) {
    console.error(`EderveenGroup needs Node.js 20 or newer (you have ${process.versions.node}). Get it free at https://nodejs.org/`);
    process.exit(1);
}

try {
    process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
    // no .env file; use the real environment
}

const express = require('express');
const multer = require('multer');
const addressparser = require('nodemailer/lib/addressparser');
const { htmlToText } = require('html-to-text');
const { createSessions } = require('./lib/session');
const { createStore } = require('./lib/store');
const { createAvatars } = require('./lib/avatars');
const totp = require('./lib/totp');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { sanitizeComposeHtml } = require('./lib/sanitize');
const mail = require('./lib/mail');

const fs = require('fs');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
const VIEWS = path.join(__dirname, 'views');
// Where the webmail lives: /mail by default; set BASE_PATH=/ to serve it at the root instead.
const BASE = ('/' + (process.env.BASE_PATH ?? '/mail')).replace(/\/+/g, '/').replace(/\/$/, '');
const BASE_URL = BASE + '/';

// `site` is the whole domain; `app` is the webmail, mounted at BASE.
const site = express();
const app = express.Router();
site.disable('x-powered-by');
// Trust X-Forwarded-* only from a proxy on this machine (e.g. Caddy) unless told otherwise.
site.set('trust proxy', process.env.TRUST_PROXY || 'loopback');

const sessions = createSessions({
    dataDir: DATA_DIR,
    cookiePath: BASE_URL,
    secureCookies: process.env.SECURE_COOKIES === 'true' || process.env.NODE_ENV === 'production'
});
const store = createStore(DATA_DIR);
const avatars = createAvatars(DATA_DIR);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });

site.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https: http:; frame-src 'self' about:; object-src 'none'; base-uri 'self'; form-action 'self'"
    });
    next();
});
app.use(sessions.middleware());
app.use(express.json({ limit: '2mb' }));

/* ---------- pages ---------- */

const pages = {};
function page(name) {
    if (!pages[name]) pages[name] = fs.readFileSync(path.join(VIEWS, name), 'utf8').replaceAll('%BASE%', BASE_URL);
    return pages[name];
}
const sendPage = (res, name, status = 200) => res.status(status).type('html').set('Cache-Control', 'no-cache').send(page(name));

app.get('/', (req, res) => (req.session ? sendPage(res, 'app.html') : res.redirect(BASE_URL + 'login')));
app.get('/login', (req, res) => (req.session ? res.redirect(BASE_URL) : sendPage(res, 'login.html')));
app.use(express.static(PUBLIC, { index: false, maxAge: '1h' }));

/* ---------- api plumbing ---------- */

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Every state-changing API call must carry this header: browsers won't send it
// cross-site without a CORS preflight, which we never approve (CSRF guard).
app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.get('X-EG') !== '1') return res.status(403).json({ error: 'Bad request origin' });
    next();
});

function requireAuth(req, res, next) {
    if (!req.session) return res.status(401).json({ error: 'Not signed in' });
    next();
}

const attempts = new Map();
function loginThrottle(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    const rec = (attempts.get(key) || []).filter(t => now - t < 15 * 60 * 1000);
    attempts.set(key, rec);
    if (rec.length >= 10) return res.status(429).json({ error: 'Too many attempts. Take a breather and try again in a few minutes.' });
    rec.push(now);
    next();
}

const folderOf = req => String(req.query.folder || req.body.folder || 'INBOX');
const uidList = v => [].concat(v || []).map(Number).filter(n => Number.isInteger(n) && n > 0);
const parseAddresses = v =>
    addressparser(String(v || ''), { flatten: true })
        .filter(a => a.address && /@/.test(a.address))
        .map(a => ({ name: a.name || '', address: a.address }));

/* ---------- auth ---------- */

app.post('/api/login', loginThrottle, wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^[^\s@]+@[^\s@]+$/.test(email) || !password) return res.status(400).json({ error: 'Enter your full email address and password.' });
    let ok;
    try {
        ok = await mail.verifyLogin(email, password);
    } catch (err) {
        return res.status(502).json({ error: 'Could not reach Purelymail. Try again in a moment.' });
    }
    if (!ok) return res.status(401).json({ error: 'That email and password combo didn’t work.' });
    const remember = req.body.remember !== false;
    const tf = store.getTwofa(email);
    if (tf && tf.secret && !sessions.isTrusted(req, email, tf.since)) {
        // password is right; hand back a sealed 5-minute ticket for the code step
        const ticket = sessions.seal({ purpose: '2fa', email, password, remember, exp: Date.now() + 5 * 60 * 1000 });
        return res.json({ twofa: true, ticket, email });
    }
    attempts.delete(req.ip);
    sessions.start(res, { email, password, remember });
    res.json({ ok: true });
}));

/* ---------- two-factor ---------- */

const hashCode = c => crypto.createHash('sha256').update(c).digest('hex');
const normRecovery = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const lastStep = new Map(); // email -> last accepted TOTP step (blocks replaying a code)

function newRecoveryCodes() {
    const codes = Array.from({ length: 10 }, () => {
        const raw = totp.base32Encode(crypto.randomBytes(5)).slice(0, 8);
        return `${raw.slice(0, 4)}-${raw.slice(4)}`;
    });
    return { codes, hashes: codes.map(c => hashCode(normRecovery(c))) };
}

// Checks a 6-digit code or a recovery code (recovery codes are single use).
function checkSecondFactor(email, tf, input) {
    const code = String(input || '').trim();
    if (/^\d{3}\s?\d{3}$/.test(code)) {
        const step = totp.verify(tf.secret, code);
        if (step === null || step <= (lastStep.get(email) || 0)) return { ok: false };
        lastStep.set(email, step);
        return { ok: true };
    }
    const idx = tf.recovery.indexOf(hashCode(normRecovery(code)));
    if (idx < 0 || !normRecovery(code)) return { ok: false };
    tf.recovery.splice(idx, 1);
    store.setTwofa(email, tf);
    return { ok: true, usedRecovery: true, recoveryLeft: tf.recovery.length };
}

app.post('/api/login/2fa', loginThrottle, (req, res) => {
    const t = sessions.open(req.body.ticket, '2fa');
    if (!t) return res.status(401).json({ error: 'That sign-in took too long. Please start again.', restart: true });
    const tf = store.getTwofa(t.email);
    let result = { ok: true };
    if (tf && tf.secret) {
        result = checkSecondFactor(t.email, tf, req.body.code);
        if (!result.ok) return res.status(401).json({ error: 'That code didn\u2019t work. Check your authenticator and try again.' });
        if (req.body.trust) sessions.trustDevice(res, t.email, tf.since);
    }
    attempts.delete(req.ip);
    sessions.start(res, { email: t.email, password: t.password, remember: t.remember });
    res.json(result);
});

app.post('/api/logout', wrap(async (req, res) => {
    if (req.session) await mail.closeClient(req.session);
    sessions.clear(res);
    res.json({ ok: true });
}));

app.use('/api', requireAuth);

app.get('/api/me', (req, res) => {
    res.json({
        email: req.session.email,
        sessionExpires: new Date(req.session.exp).toISOString(),
        photo: avatars.photoVersion(req.session.email),
        settings: store.getSettings(req.session.email)
    });
});

/* ---------- profile pictures ---------- */

app.put('/api/profile/photo', (req, res) => {
    res.json({ photo: avatars.savePhoto(req.session.email, req.body.dataUrl) });
});

app.delete('/api/profile/photo', (req, res) => {
    avatars.removePhoto(req.session.email);
    res.json({ photo: null });
});

// Photo for any address: an uploaded EderveenGroup photo first, then Gravatar or company logo.
app.get('/api/avatar', wrap(async (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    res.set({ 'Content-Security-Policy': "default-src 'none'", 'Cross-Origin-Resource-Policy': 'same-origin' });
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) return res.status(400).end();
    const remote = store.getSettings(req.session.email).senderPhotos !== false;
    const hit = await avatars.lookup(email, { remote });
    if (!hit) return res.set('Cache-Control', 'private, max-age=3600').status(404).end();
    res.set({ 'Content-Type': hit.type, 'Cache-Control': 'private, max-age=86400' }).send(hit.buf);
}));

/* ---------- settings & contacts ---------- */

app.put('/api/settings', (req, res) => {
    const patch = { ...req.body };
    if (Array.isArray(patch.signatures)) {
        patch.signatures = patch.signatures.slice(0, 20).map(s => ({
            id: String(s.id || '').slice(0, 40) || Math.random().toString(36).slice(2),
            name: String(s.name || 'Signature').slice(0, 80),
            html: sanitizeComposeHtml(String(s.html || '')).slice(0, 50000)
        }));
    }
    if ('undoSendSeconds' in patch) patch.undoSendSeconds = Math.max(0, Math.min(30, Number(patch.undoSendSeconds) || 0));
    if ('displayName' in patch) patch.displayName = String(patch.displayName || '').slice(0, 120);
    if ('accent' in patch && !/^#[0-9a-f]{6}$/i.test(patch.accent)) delete patch.accent;
    res.json(store.updateSettings(req.session.email, patch));
});

app.get('/api/2fa', (req, res) => {
    const tf = store.getTwofa(req.session.email);
    res.json({ enabled: !!(tf && tf.secret), since: tf && tf.since, recoveryLeft: tf && tf.recovery ? tf.recovery.length : 0 });
});

app.post('/api/2fa/setup', wrap(async (req, res) => {
    const tf = store.getTwofa(req.session.email);
    if (tf && tf.secret) return res.status(400).json({ error: 'Two-factor is already on' });
    const secret = totp.generateSecret();
    store.setTwofa(req.session.email, { pending: secret });
    const uri = totp.otpauthUri(secret, req.session.email);
    const qr = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0d12', light: '#ffffff' } });
    res.json({ secret: secret.match(/.{1,4}/g).join(' '), uri, qr });
}));

app.post('/api/2fa/enable', (req, res) => {
    const tf = store.getTwofa(req.session.email);
    if (!tf || !tf.pending) return res.status(400).json({ error: 'Start setup first' });
    if (totp.verify(tf.pending, req.body.code) === null) return res.status(400).json({ error: 'That code didn\u2019t match. Make sure your phone\u2019s clock is right and try the newest code.' });
    const { codes, hashes } = newRecoveryCodes();
    store.setTwofa(req.session.email, { secret: tf.pending, since: Date.now(), recovery: hashes });
    res.json({ ok: true, recovery: codes });
});

app.post('/api/2fa/disable', (req, res) => {
    const tf = store.getTwofa(req.session.email);
    if (!tf || !tf.secret) return res.json({ ok: true });
    if (!checkSecondFactor(req.session.email, tf, req.body.code).ok) return res.status(400).json({ error: 'That code didn\u2019t work' });
    store.setTwofa(req.session.email, null);
    res.json({ ok: true });
});

app.post('/api/2fa/recovery', (req, res) => {
    const tf = store.getTwofa(req.session.email);
    if (!tf || !tf.secret) return res.status(400).json({ error: 'Two-factor is off' });
    if (!checkSecondFactor(req.session.email, tf, req.body.code).ok) return res.status(400).json({ error: 'That code didn\u2019t work' });
    const { codes, hashes } = newRecoveryCodes();
    store.setTwofa(req.session.email, { ...store.getTwofa(req.session.email), recovery: hashes });
    res.json({ recovery: codes });
});

app.get('/api/contacts', (req, res) => res.json(store.searchContacts(req.session.email, req.query.q)));

/* ---------- folders ---------- */

// Snoozes wake lazily: whenever the user is online (folder refreshes and the live stream).
const lastWake = new Map();
async function wakeDue(session, force) {
    const now = Date.now();
    if (!force && now - (lastWake.get(session.email) || 0) < 20000) return 0;
    lastWake.set(session.email, now);
    const due = store.takeDueSnoozes(session.email, now);
    return due.length ? mail.wakeSnoozes(session, due) : 0;
}

app.get('/api/folders', wrap(async (req, res) => {
    await wakeDue(req.session).catch(() => {});
    res.json(await mail.listFolders(req.session));
}));

app.get('/api/snoozes', (req, res) => res.json(store.listSnoozes(req.session.email)));

app.post('/api/messages/snooze', wrap(async (req, res) => {
    const until = Number(new Date(req.body.until));
    if (!until || until < Date.now() - 60000) return res.status(400).json({ error: 'Pick a time in the future' });
    const from = folderOf(req);
    const ids = await mail.snoozeMessages(req.session, from, uidList(req.body.uids));
    store.addSnoozes(req.session.email, ids.map(messageId => ({ messageId, until, from: from === 'Snoozed' ? 'INBOX' : from })));
    res.json({ ok: true, until });
}));

app.post('/api/folders', wrap(async (req, res) => {
    const name = String(req.body.name || '').trim();
    if (!name || name.length > 100) return res.status(400).json({ error: 'Pick a folder name' });
    await mail.createFolder(req.session, name);
    res.json({ ok: true });
}));

app.delete('/api/folders', wrap(async (req, res) => {
    await mail.deleteFolder(req.session, folderOf(req));
    res.json({ ok: true });
}));

app.post('/api/folders/empty', wrap(async (req, res) => {
    await mail.emptyFolder(req.session, folderOf(req));
    res.json({ ok: true });
}));

/* ---------- messages ---------- */

app.get('/api/messages', wrap(async (req, res) => {
    const result = await mail.listMessages(req.session, folderOf(req), {
        page: Math.max(0, Number(req.query.page) || 0),
        query: String(req.query.q || '').slice(0, 200),
        filter: String(req.query.filter || '')
    });
    res.json(result);
}));

app.get('/api/message', wrap(async (req, res) => {
    const msg = await mail.getMessage(req.session, folderOf(req), Number(req.query.uid), { markSeen: !req.query.peek });
    store.rememberContacts(req.session.email, msg.from);
    res.json(msg);
}));

app.get('/api/message/raw', wrap(async (req, res) => {
    const raw = await mail.getRaw(req.session, folderOf(req), Number(req.query.uid));
    res.type('text/plain; charset=utf-8').set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="message-${Number(req.query.uid)}.eml"`).send(raw);
}));

app.get('/api/attachment', wrap(async (req, res) => {
    const att = await mail.getAttachment(req.session, folderOf(req), Number(req.query.uid), Number(req.query.idx));
    const filename = (att.filename || 'attachment').replace(/["\r\n]/g, '');
    const safeInline = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain)$/i.test(att.contentType);
    res.set({
        'Content-Type': safeInline ? att.contentType : 'application/octet-stream',
        'Content-Disposition': `${safeInline && !req.query.download ? 'inline' : 'attachment'}; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
    });
    res.send(att.content);
}));

app.post('/api/messages/flags', wrap(async (req, res) => {
    const allowed = ['\\Seen', '\\Flagged', '\\Answered'];
    const add = [].concat(req.body.add || []).filter(f => allowed.includes(f));
    const remove = [].concat(req.body.remove || []).filter(f => allowed.includes(f));
    await mail.setFlags(req.session, folderOf(req), uidList(req.body.uids), { add, remove });
    res.json({ ok: true });
}));

app.post('/api/messages/move', wrap(async (req, res) => {
    let target = String(req.body.to || '');
    if (target === '\\Archive') target = (await mail.findSpecial(req.session, '\\Archive', ['archive'])) || 'Archive';
    if (target === '\\Junk') target = (await mail.findSpecial(req.session, '\\Junk', ['junk', 'spam'])) || 'Junk';
    if (!target) return res.status(400).json({ error: 'Missing target folder' });
    await mail.moveMessages(req.session, folderOf(req), uidList(req.body.uids), target);
    res.json({ ok: true, movedTo: target });
}));

app.post('/api/messages/delete', wrap(async (req, res) => {
    res.json(await mail.deleteMessages(req.session, folderOf(req), uidList(req.body.uids)));
}));

/* ---------- compose ---------- */

function composeInput(req) {
    const b = req.body;
    const html = sanitizeComposeHtml(String(b.html || ''));
    const settings = store.getSettings(req.session.email);
    return {
        fromName: settings.displayName || '',
        to: parseAddresses(b.to),
        cc: parseAddresses(b.cc),
        bcc: parseAddresses(b.bcc),
        subject: String(b.subject || '').slice(0, 998),
        html,
        text: htmlToText(html, { wordwrap: 78, selectors: [{ selector: 'img', format: 'skip' }] }),
        inReplyTo: b.inReplyTo || undefined,
        references: b.references ? String(b.references).split(/\s+/).filter(Boolean) : [],
        attachments: (req.files || []).map(f => ({ filename: f.originalname, content: f.buffer, contentType: f.mimetype })),
        forwardFrom: b.forwardFolder && b.forwardUid ? { folder: String(b.forwardFolder), uid: Number(b.forwardUid) } : null,
        draftUid: Number(b.draftUid) || null,
        answeredUid: Number(b.answeredUid) || null,
        answeredFolder: b.answeredFolder ? String(b.answeredFolder) : null
    };
}

app.post('/api/send', upload.array('attachments'), wrap(async (req, res) => {
    const input = composeInput(req);
    const settings = store.getSettings(req.session.email);
    const result = await mail.sendMessage(req.session, input, { saveSentCopy: settings.saveSentCopy });
    store.rememberContacts(req.session.email, [...input.to, ...input.cc, ...input.bcc]);
    res.json({ ok: true, ...result });
}));

app.post('/api/drafts', upload.array('attachments'), wrap(async (req, res) => {
    res.json({ ok: true, ...(await mail.saveDraft(req.session, composeInput(req))) });
}));

/* ---------- live updates (Server-Sent Events over IMAP IDLE) ---------- */

app.get('/api/events', wrap(async (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    let stop = null;
    let closed = false;
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    const waker = setInterval(async () => {
        const woke = await wakeDue(req.session, true).catch(() => 0);
        if (woke) send('snooze', { woke });
    }, 30000);
    req.on('close', () => {
        closed = true;
        clearInterval(ping);
        clearInterval(waker);
        if (stop) stop();
    });
    try {
        stop = await mail.watchInbox(req.session, change => send('mailbox', change));
        if (closed) stop();
        else send('ready', {});
    } catch {
        send('unavailable', {});
        res.end();
    }
}));

/* ---------- errors ---------- */

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err.authenticationFailed) {
        sessions.clear(res);
        return res.status(401).json({ error: 'Your Purelymail password changed. Please sign in again.' });
    }
    if (err instanceof multer.MulterError) return res.status(413).json({ error: 'Attachments are limited to 25 MB each.' });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? (err.responseText || err.response || err.message || 'Something went wrong') : err.message });
});

/* ---------- the rest of the domain ---------- */

if (BASE) {
    // /mail -> /mail/ so relative URLs inside the app resolve correctly
    site.use((req, res, next) => {
        if (req.path !== BASE) return next();
        const q = req.originalUrl.slice(req.originalUrl.indexOf(BASE) + BASE.length);
        res.redirect(301, BASE_URL + q);
    });
}
site.use(BASE || '/', app);
if (BASE) {
    site.get('/', (req, res) => sendPage(res, 'landing.html'));
    site.use((req, res) => sendPage(res, 'landing.html', 404));
}

site.listen(PORT, () => {
    const url = `http://localhost:${PORT}${BASE_URL}`;
    console.log(`EderveenGroup is running.\n  Mail:    ${url}${BASE ? `\n  Website: http://localhost:${PORT}/` : ''}`);
    if (process.env.OPEN_BROWSER) openBrowser(url);
});

function openBrowser(url) {
    const { spawn } = require('child_process');
    const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    try {
        spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
    } catch {
        // no browser available; the URL is printed above
    }
}
