'use strict';

const path = require('path');

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
const { sanitizeComposeHtml } = require('./lib/sanitize');
const mail = require('./lib/mail');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

const sessions = createSessions({ dataDir: DATA_DIR, secureCookies: process.env.SECURE_COOKIES === 'true' || process.env.NODE_ENV === 'production' });
const store = createStore(DATA_DIR);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20 } });

app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: http:; frame-src 'self' about:; object-src 'none'; base-uri 'none'; form-action 'self'"
    });
    next();
});
app.use(sessions.middleware());
app.use(express.json({ limit: '2mb' }));

/* ---------- pages ---------- */

app.get('/', (req, res) => (req.session ? res.sendFile(path.join(PUBLIC, 'app.html')) : res.redirect('/login')));
app.get('/login', (req, res) => (req.session ? res.redirect('/') : res.sendFile(path.join(PUBLIC, 'login.html'))));
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
    attempts.delete(req.ip);
    sessions.start(res, { email, password, remember: req.body.remember !== false });
    res.json({ ok: true });
}));

app.post('/api/logout', wrap(async (req, res) => {
    if (req.session) await mail.closeClient(req.session);
    sessions.clear(res);
    res.json({ ok: true });
}));

app.use('/api', requireAuth);

app.get('/api/me', (req, res) => {
    res.json({ email: req.session.email, sessionExpires: new Date(req.session.exp).toISOString(), settings: store.getSettings(req.session.email) });
});

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

app.get('/api/contacts', (req, res) => res.json(store.searchContacts(req.session.email, req.query.q)));

/* ---------- folders ---------- */

app.get('/api/folders', wrap(async (req, res) => res.json(await mail.listFolders(req.session))));

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
    req.on('close', () => {
        closed = true;
        clearInterval(ping);
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

app.listen(PORT, () => console.log(`EderveenGroup running on http://localhost:${PORT}`));
