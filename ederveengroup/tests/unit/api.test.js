'use strict';

// End-to-end HTTP tests of the real app, with a fake mail backend instead of IMAP/SMTP.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const totp = require('../../lib/totp');
const { loadConfig } = require('../../src/config');
const { createApp } = require('../../src/app');

const USER = 'jo@example.com', PASS = 'correct horse';
const USER2 = 'ann@example.com'; // a second person, for Chat

function fakeMail() {
    return {
        sent: [],
        verifyLogin: async (email, pw) => (email === USER || email === USER2) && pw === PASS,
        closeClient: async () => {},
        listFolders: async () => [{ path: 'INBOX', name: 'Inbox', specialUse: '\\Inbox', messages: 1, unseen: 1 }],
        listMessages: async () => ({ total: 1, page: 0, pageSize: 50, messages: [{ uid: 1, subject: 'Hi', from: [], to: [], flags: [], date: new Date().toISOString() }] }),
        async sendMessage(session, input) {
            this.sent.push(input);
            return { messageId: '<x@y>' };
        },
        wakeSnoozes: async () => 0,
        useServers(fn) {
            this.profileFor = fn;
        },
        watchInbox: async () => () => {}
    };
}

async function start(env = {}, opts = {}) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eg-api-'));
    const mail = fakeMail();
    const { site, ctx } = createApp(loadConfig({ DATA_DIR: dataDir, ...env }), { mail, ...opts });
    const server = await new Promise(r => {
        const s = site.listen(0, () => r(s));
        s.unref(); // a failed assertion mustn't leave the test run hanging
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    // a tiny browser: keeps cookies per "device"
    const device = (ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36') => {
        const jar = new Map();
        const send = async (method, url, body, extra = {}) => {
            const headers = { 'User-Agent': ua, 'X-EG': '1', ...extra };
            const form = body instanceof FormData;
            const raw = body instanceof Uint8Array; // a file upload
            if (raw) headers['Content-Type'] = 'application/octet-stream';
            else if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
            if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
            const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : form || raw ? body : JSON.stringify(body), redirect: 'manual' });
            for (const c of res.headers.getSetCookie()) {
                const [kv] = c.split(';');
                const i = kv.indexOf('=');
                if (/Max-Age=0/.test(c)) jar.delete(kv.slice(0, i));
                else jar.set(kv.slice(0, i), kv.slice(i + 1));
            }
            const type = res.headers.get('content-type') || '';
            return { status: res.status, headers: res.headers, body: type.includes('json') ? await res.json() : await res.text() };
        };
        send.cookies = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
        return send;
    };
    return { base, device, mail, dataDir, store: ctx.store, close: () => server.close() };
}

test('sign in, use the api, sign out', async () => {
    const app = await start();
    const d = app.device();
    assert.equal((await d('POST', '/mail/api/login', { email: USER, password: 'nope' })).status, 401);
    assert.equal((await d('POST', '/mail/api/login', { email: USER, password: PASS })).status, 200);
    assert.equal((await d('GET', '/mail/api/me')).body.email, USER);
    assert.equal((await d('GET', '/mail/api/messages')).body.messages[0].subject, 'Hi');
    await d('POST', '/mail/api/logout', {});
    assert.equal((await d('GET', '/mail/api/me')).status, 401);
    app.close();
});

test('state-changing calls need the CSRF header and a same-site Origin', async () => {
    const app = await start();
    const d = app.device();
    await d('POST', '/mail/api/login', { email: USER, password: PASS });
    assert.equal((await d('PUT', '/mail/api/settings', { theme: 'light' }, { 'X-EG': '' })).status, 403);
    assert.equal((await d('PUT', '/mail/api/settings', { theme: 'light' }, { Origin: 'https://evil.example' })).status, 403);
    const ok = await d('PUT', '/mail/api/settings', { theme: 'light', readingPane: 'sideways' });
    assert.equal(ok.body.theme, 'light');
    assert.equal(ok.body.readingPane, 'right');
    app.close();
});

test('two-step verification: setup, challenge, wrong code, right code, replay blocked', async () => {
    const app = await start();
    const d = app.device();
    await d('POST', '/mail/api/login', { email: USER, password: PASS });
    const setup = await d('POST', '/mail/api/2fa/setup', {});
    const secret = setup.body.secret.replace(/\s/g, '');
    const code = () => totp.hotp(secret, Math.floor(Date.now() / 30000));
    const en = await d('POST', '/mail/api/2fa/enable', { code: code() });
    assert.equal(en.body.recovery.length, 10);
    await d('POST', '/mail/api/logout', {});

    const login = await d('POST', '/mail/api/login', { email: USER, password: PASS });
    assert.equal(login.body.twofa, true);
    assert.doesNotMatch(JSON.stringify(login.body), new RegExp(PASS)); // ticket is sealed
    assert.equal((await d('POST', '/mail/api/login/2fa', { ticket: login.body.ticket, code: '000000' })).status, 401);
    const good = code();
    assert.equal((await d('POST', '/mail/api/login/2fa', { ticket: login.body.ticket, code: good })).status, 200);
    assert.equal((await d('GET', '/mail/api/me')).status, 200);

    // the same code can't be used again on another device
    const other = app.device('Mozilla/5.0 (iPhone) Safari/604.1');
    const l2 = await other('POST', '/mail/api/login', { email: USER, password: PASS });
    assert.equal((await other('POST', '/mail/api/login/2fa', { ticket: l2.body.ticket, code: good })).status, 401);
    // a recovery code works once
    const rc = en.body.recovery[0];
    assert.equal((await other('POST', '/mail/api/login/2fa', { ticket: l2.body.ticket, code: rc })).body.recoveryLeft, 9);
    const l3 = await app.device()('POST', '/mail/api/login', { email: USER, password: PASS });
    assert.equal((await app.device()('POST', '/mail/api/login/2fa', { ticket: l3.body.ticket, code: rc })).status, 401);
    app.close();
});

test('devices: list, sign out another device, activity log', async () => {
    const app = await start();
    const pc = app.device();
    const phone = app.device('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1');
    await pc('POST', '/mail/api/login', { email: USER, password: PASS });
    await phone('POST', '/mail/api/login', { email: USER, password: PASS });
    const list = (await pc('GET', '/mail/api/sessions')).body;
    assert.equal(list.length, 2);
    const iphone = list.find(s => s.device.os === 'iPhone');
    assert.equal(iphone.current, false);
    assert.equal('sid' in iphone, false); // the real session id never leaves the server
    await pc('DELETE', `/mail/api/sessions/${iphone.ref}`);
    assert.equal((await phone('GET', '/mail/api/me')).status, 401);
    assert.equal((await pc('GET', '/mail/api/me')).status, 200);
    const activity = (await pc('GET', '/mail/api/activity')).body;
    assert.equal(activity.length, 2);
    assert.equal(activity[0].ok, true);
    // sign out everything except this device
    const tablet = app.device('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Safari/537.36');
    await tablet('POST', '/mail/api/login', { email: USER, password: PASS });
    await phone('POST', '/mail/api/login', { email: USER, password: PASS });
    assert.equal((await pc('POST', '/mail/api/sessions/others', {})).body.signedOut, 2);
    assert.equal((await tablet('GET', '/mail/api/me')).status, 401);
    assert.equal((await phone('GET', '/mail/api/me')).status, 401);
    assert.equal((await pc('GET', '/mail/api/me')).status, 200);
    await pc('POST', '/mail/api/logout/everywhere', {});
    assert.equal((await pc('GET', '/mail/api/me')).status, 401);
    app.close();
});

test('an account locks after 8 wrong passwords, even from different IPs', async () => {
    const app = await start({ TRUST_PROXY: '1' });
    for (let i = 0; i < 8; i++) {
        const r = await app.device()('POST', '/mail/api/login', { email: USER, password: 'x' + i }, { 'X-Forwarded-For': `10.0.0.${i}` });
        assert.equal(r.status, 401);
    }
    const locked = await app.device()('POST', '/mail/api/login', { email: USER, password: PASS }, { 'X-Forwarded-For': '10.0.0.99' });
    assert.equal(locked.status, 429);
    app.close();
});

test('pages, redirects and security headers', async () => {
    const app = await start();
    const d = app.device();
    const landing = await d('GET', '/');
    assert.equal(landing.status, 200);
    assert.match(landing.body, /Welcome back/); // signed out, the root is the sign-in page
    assert.match(landing.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(landing.headers.get('x-frame-options'), 'DENY');
    assert.equal((await d('GET', '/mail')).status, 301);
    assert.equal((await d('GET', '/mail/')).headers.get('location'), '/login?next=%2Fmail%2Finbox');
    assert.equal((await d('GET', '/mail/login')).headers.get('location'), '/login');
    // deep links survive signing in
    assert.equal((await d('GET', '/mail/inbox/x7Kq2pW9aZc')).headers.get('location'), '/login?next=%2Fmail%2Finbox%2Fx7Kq2pW9aZc');
    assert.equal((await d('GET', '/nope')).status, 404);
    assert.equal((await d('GET', '/mail/api/me')).status, 401);
    app.close();
});

test('one batched call says which senders have a photo', async () => {
    const app = await start();
    const d = app.device();
    await d('POST', '/mail/api/login', { email: USER, password: PASS });
    await d('PUT', '/mail/api/settings', { senderPhotos: false }); // no Gravatar lookups from tests
    const png = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex').toString('base64');
    assert.equal((await d('PUT', '/mail/api/profile/photo', { dataUrl: png })).status, 200);
    const r = await d('POST', '/mail/api/avatars', { emails: [USER.toUpperCase(), 'nobody@example.com', 'not an email', 42] });
    assert.deepEqual(Object.keys(r.body.photos), [USER]);
    assert.equal((await d('POST', '/mail/api/avatars', { emails: 'x' })).body.photos && true, true);
    app.close();
});

test('pasted images go out as inline cid parts; stray or foreign parts are dropped', async () => {
    const app = await start();
    const d = app.device();
    await d('POST', '/mail/api/login', { email: USER, password: PASS });
    const fd = new FormData();
    fd.append('to', 'ava@example.com');
    fd.append('subject', 'pic');
    fd.append('html', '<p>look</p><img src="cid:img1abc@eg"><img src="blob:http://x/1">');
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    fd.append('inline', new Blob([png], { type: 'image/png' }), 'img1abc@eg');
    fd.append('inline', new Blob([png], { type: 'image/png' }), 'unused@eg');
    fd.append('inline', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'img2@eg');
    fd.append('attachments', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
    const r = await d('POST', '/mail/api/send', fd);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const sent = app.mail.sent[0];
    assert.match(sent.html, /src="cid:img1abc@eg"/);
    assert.doesNotMatch(sent.html, /blob:/);
    assert.deepEqual(sent.attachments.map(a => [a.filename, a.cid || null]), [['notes.txt', null], ['image-1.png', 'img1abc@eg']]);
    app.close();
});

test('oversized signatures are refused instead of being cut in half', async () => {
    const app = await start();
    const d = app.device();
    await d('POST', '/mail/api/login', { email: USER, password: PASS });
    const big = '<p>' + 'x'.repeat(210000) + '</p>';
    assert.equal((await d('PUT', '/mail/api/settings', { signatures: [{ name: 'Big', html: big }] })).status, 413);
    const ok = await d('PUT', '/mail/api/settings', { templates: [{ name: 'Thanks', subject: 'Thanks!', html: '<p>Thanks <script>x</script>so much</p>' }] });
    assert.equal(ok.body.templates[0].html, '<p>Thanks so much</p>');
    app.close();
});

test('service worker is rendered per deploy and only precaches versioned app files', async () => {
    const app = await start();
    const d = app.device();
    const sw = await d('GET', '/sw.js');
    assert.equal(sw.status, 200);
    assert.match(sw.headers.get('content-type'), /javascript/);
    assert.equal(sw.headers.get('cache-control'), 'no-cache');
    assert.doesNotMatch(sw.body, /%(V|BASE|ASSETS)%/);
    const assets = JSON.parse(/const ASSETS = (\[.*\]);/.exec(sw.body)[1]);
    assert.ok(assets.length > 10);
    assert.ok(assets.every(a => a.startsWith('/mail/') && /\?v=\w+$/.test(a) && !a.includes('/api/')));
    assert.ok(assets.includes(assets.find(a => a.includes('js/app/main.js'))));
    for (const a of assets.slice(0, 3)) assert.equal((await d('GET', a)).status, 200);
    app.close();
});

test('every page has its own address; message links resolve only for their owner and folder', async () => {
    const app = await start();
    const d = app.device();
    await d('POST', '/mail/api/login', { email: USER, password: PASS });
    await d('POST', '/api/username', { username: 'jo.smith' });
    assert.equal((await d('GET', '/mail/')).headers.get('location'), '/mail/inbox');
    assert.equal((await d('GET', '/login?next=%2Fmail%2Fsearch%2Fk7Qp2Xa9')).headers.get('location'), '/mail/search/k7Qp2Xa9');
    assert.equal((await d('GET', '/login?next=%2F%2Fevil.com')).headers.get('location'), '/'); // no open redirect
    assert.equal((await d('GET', '/login?next=https%3A%2F%2Fevil.com')).headers.get('location'), '/');
    assert.match((await d('GET', '/')).body, /hub-apps/); // signed in, the root is the hub
    for (const page of ['/mail/inbox', '/mail/settings/devices', '/mail/f/AbCdEf12'])
        assert.match((await d('GET', page)).body, /<base href="\/mail\/">/, page);
    const folders = (await d('GET', '/mail/api/folders')).body;
    assert.match(folders[0].id, /^[A-Za-z0-9_-]{8}$/);
    const msg = (await d('GET', '/mail/api/messages')).body.messages[0];
    assert.match(msg.link, /^[A-Za-z0-9_-]{11}$/);
    assert.equal((await d('GET', `/mail/api/link?folder=INBOX&t=${msg.link}`)).body.uid, msg.uid);
    assert.equal((await d('GET', `/mail/api/link?folder=Archive&t=${msg.link}`)).status, 404);
    assert.equal((await d('GET', '/mail/api/link?folder=INBOX&t=AAAAAAAAAAA')).status, 404);
    assert.equal((await app.device()('GET', `/mail/api/link?folder=INBOX&t=${msg.link}`)).status, 401);
    app.close();
});

test('bring your own server: request, admin accepts for the domain, requester is emailed', async () => {
    const checked = [];
    const app = await start({ ADMIN_EMAILS: USER }, { checkMailbox: async (req, pw) => checked.push([req.email, pw]) });
    const guest = app.device();
    const form = { name: 'Ava', email: 'ava@studio.io', imap: { host: 'imap.studio.io', port: 993 }, smtp: { host: 'smtp.studio.io', port: 465 }, password: 'secret', note: 'hi' };
    assert.equal((await guest('POST', '/mail/api/requests', form)).status, 200);
    assert.deepEqual(checked, [['ava@studio.io', 'secret']]);
    assert.equal((await guest('POST', '/mail/api/requests', form)).status, 409); // already waiting
    assert.equal((await guest('POST', '/mail/api/requests', { ...form, email: 'x@y.io' }, { 'X-EG': '' })).status, 403); // CSRF guard applies
    assert.match((await guest('GET', '/mail/request')).body, /Request access/);
    // the password never reaches disk
    assert.doesNotMatch(fs.readFileSync(path.join(app.dataDir, 'servers.json'), 'utf8'), /secret/);
    // a pending requester trying to sign in hears why
    assert.match((await app.device()('POST', '/mail/api/login', { email: 'ava@studio.io', password: 'secret' })).body.error, /waiting for approval/);

    const admin = app.device();
    await admin('POST', '/mail/api/login', { email: USER, password: PASS });
    const me = (await admin('GET', '/mail/api/me')).body;
    assert.equal(me.admin, true);
    assert.equal(me.pendingRequests, 1);
    const [req] = (await admin('GET', '/api/admin/requests')).body;
    assert.equal(req.verified, true);
    assert.equal('password' in req, false);
    const done = (await admin('POST', `/api/admin/requests/${req.id}/accept`, { scope: 'domain' })).body;
    assert.equal(done.emailed, true);
    assert.equal(app.mail.sent[0].to[0].address, 'ava@studio.io');
    assert.match(app.mail.sent[0].subject, /ready/);
    assert.match(app.mail.sent[0].html, /everyone at @studio\.io/);
    // anyone @studio.io now uses that server; others keep the default
    assert.equal(app.mail.profileFor('jo@studio.io').imap.host, 'imap.studio.io');
    assert.equal(app.mail.profileFor('jo@elsewhere.io'), null);
    assert.equal((await admin('POST', `/api/admin/requests/${req.id}/reject`, {})).status, 404); // already decided
    assert.equal((await admin('DELETE', `/api/admin/servers/${encodeURIComponent('@studio.io')}`)).status, 200);
    assert.equal(app.mail.profileFor('jo@studio.io'), null);
    app.close();
});

test('only admins see requests; rejecting emails the reason', async () => {
    const app = await start({ ADMIN_EMAILS: 'boss@example.com' }, { checkMailbox: async () => true });
    await app.device()('POST', '/mail/api/requests', { email: 'mo@shop.io', imap: { host: 'imap.shop.io', port: 993 }, smtp: { host: 'smtp.shop.io', port: 587 }, password: 'x' });
    const d = app.device();
    await d('POST', '/mail/api/login', { email: USER, password: PASS });
    assert.equal((await d('GET', '/api/admin/requests')).status, 403);
    assert.equal((await d('GET', '/mail/api/me')).body.admin, undefined);
    app.close();
    const app2 = await start({ ADMIN_EMAILS: USER }, { checkMailbox: async () => true });
    await app2.device()('POST', '/mail/api/requests', { email: 'mo@shop.io', imap: { host: 'imap.shop.io', port: 993 }, smtp: { host: 'smtp.shop.io', port: 587 }, password: 'x' });
    const a = app2.device();
    await a('POST', '/mail/api/login', { email: USER, password: PASS });
    const [req] = (await a('GET', '/api/admin/requests')).body;
    await a('POST', `/api/admin/requests/${req.id}/reject`, { reason: 'Not <b>now</b>' });
    assert.match(app2.mail.sent[0].html, /Not &lt;b&gt;now&lt;\/b&gt;/);
    assert.equal(app2.mail.profileFor('mo@shop.io'), null);
    app2.close();
});

test('request form refuses bad servers and floods', async () => {
    const app = await start({}, { checkMailbox: async () => true });
    const g = app.device();
    const ok = { email: 'a@b.io', imap: { host: 'imap.b.io', port: 993 }, smtp: { host: 'smtp.b.io', port: 465 }, password: 'x' };
    assert.equal((await g('POST', '/mail/api/requests', { ...ok, imap: { host: 'imap.b.io', port: 110 } })).status, 400);
    assert.equal((await g('POST', '/mail/api/requests', { ...ok, website: 'spam' })).body.ok, true); // bots get a fake success
    // the bad request above counted too: 5 tries an hour per address
    for (let i = 0; i < 4; i++) await g('POST', '/mail/api/requests', { ...ok, email: `u${i}@b.io` });
    assert.equal((await g('POST', '/mail/api/requests', { ...ok, email: 'late@b.io' })).status, 429);
    app.close();
});

test('the whole site installs as one app that opens the hub', async () => {
    const app = await start();
    const d = app.device();
    const m = await d('GET', '/manifest.webmanifest');
    assert.match(m.headers.get('content-type'), /manifest\+json/);
    const manifest = JSON.parse(typeof m.body === 'string' ? m.body : JSON.stringify(m.body));
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.scope, '/');
    assert.deepEqual(manifest.shortcuts.map(x => x.name), ['Mail', 'Calendar', 'Tasks', 'Files']);
    assert.match((await d('GET', '/mail/sw.js')).body, /unregister/); // the old /mail/ worker retires itself
    app.close();
});

test('first sign-in asks for a username; it must be free and valid; then the apps open', async () => {
    const app = await start();
    const d = app.device();
    await d('POST', '/mail/api/login', { email: USER, password: PASS });
    assert.equal((await d('GET', '/')).headers.get('location'), '/welcome?next=%2F');
    assert.equal((await d('GET', '/mail/inbox')).headers.get('location'), '/welcome?next=%2Fmail%2Finbox');
    assert.match((await d('GET', '/welcome')).body, /Choose your username/);
    assert.equal((await d('GET', '/api/username/suggest')).body.username, 'jouser'); // "jo" is too short
    assert.equal((await d('GET', '/api/username/check?u=admin')).body.reason, 'That name is reserved');
    assert.equal((await d('GET', '/api/username/check?u=Jo.Smith')).body.available, true);
    assert.equal((await d('POST', '/api/username', { username: '1bad' })).status, 400);
    assert.equal((await d('POST', '/api/username', { username: 'jo.smith' }, { 'X-EG': '' })).status, 403);
    assert.equal((await d('POST', '/api/username', { username: '@Jo.Smith' })).body.username, 'jo.smith');
    assert.equal((await d('GET', '/mail/api/me')).body.username, 'jo.smith');
    assert.equal((await d('GET', '/')).status, 200); // the hub
    assert.equal((await d('GET', '/welcome?next=%2Fmail%2Finbox')).headers.get('location'), '/mail/inbox');
    // someone else can't take it
    const other = app.device();
    app.mail.verifyLogin = async () => true;
    await other('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' });
    const taken = (await other('GET', '/api/username/check?u=jo.smith')).body;
    assert.equal(taken.available, false);
    assert.ok(taken.suggestions.length > 0);
    assert.equal((await other('POST', '/api/username', { username: 'jo.smith' })).status, 409);
    assert.equal((await app.device()('GET', '/api/username/check?u=x')).status, 401);
    app.close();
});

test('Profile: edit your card, share it at /profile/#/username, save as contact', async () => {
    const app = await start();
    const d = app.device();
    await d('POST', '/mail/api/login', { email: USER, password: PASS });
    await d('POST', '/api/username', { username: 'jo.smith' });
    const first = (await d('GET', '/api/profile')).body;
    assert.equal(first.created, false);
    assert.equal(first.profile.email, USER);
    assert.match(first.url, /\/profile\/#\/jo\.smith$/);
    // nothing public until it's saved
    const guest = app.device();
    assert.equal((await guest('GET', '/api/profiles/jo.smith')).status, 404);
    assert.equal((await d('PUT', '/api/profile', { name: 'Jo', website: 'javascript:alert(1)' })).status, 400);
    assert.equal((await d('PUT', '/api/profile', { name: 'Jo', links: { linkedin: 'https://evil.example/jo' } })).status, 400);
    assert.equal((await d('PUT', '/api/profile', { name: 'Jo', phone: '<script>' })).status, 400);
    const saved = (await d('PUT', '/api/profile', { name: 'Jo Smith', headline: 'Designer', company: 'Ederveen, Group', bio: 'Hi;\nthere', email: 'jo@work.example', phone: '+31 6 1234 5678', website: 'jo.example', links: { x: '@jo', github: 'https://github.com/jo' } })).body.profile;
    assert.equal(saved.website, 'https://jo.example/');
    assert.equal(saved.links.x, 'https://x.com/jo');
    const card = (await guest('GET', '/api/profiles/JO.SMITH')).body;
    assert.equal(card.name, 'Jo Smith');
    assert.equal(card.email, 'jo@work.example');
    assert.equal('visible' in card, false);
    assert.equal(JSON.stringify(card).includes(USER), false); // the sign-in address never shows
    const vcf = await guest('GET', '/api/profiles/jo.smith/vcard');
    assert.match(vcf.headers.get('content-type'), /text\/vcard/);
    assert.match(vcf.headers.get('content-disposition'), /jo\.smith\.vcf/);
    assert.match(vcf.body, /FN:Jo Smith/);
    assert.match(vcf.body, /ORG:Ederveen\\, Group/);
    assert.match(vcf.body, /NOTE:Hi\\;\\nthere/);
    assert.match(vcf.body, /TEL;TYPE=CELL:\+31 6 1234 5678/);
    assert.match((await guest('GET', '/api/profiles/jo.smith/qr.svg')).body, /<svg/);
    assert.match((await guest('GET', '/profile/')).body, /js\/profile\.js/);
    assert.equal((await guest('GET', '/profile')).headers.get('location'), '/profile/');
    // hide the email, then hide the whole profile
    await d('PUT', '/api/profile', { ...saved, showEmail: false });
    assert.equal((await guest('GET', '/api/profiles/jo.smith')).body.email, '');
    assert.doesNotMatch((await guest('GET', '/api/profiles/jo.smith/vcard')).body, /EMAIL/);
    await d('PUT', '/api/profile', { ...saved, visible: false });
    assert.equal((await guest('GET', '/api/profiles/jo.smith')).status, 404);
    // renaming moves the card
    await d('PUT', '/api/profile', { ...saved, visible: true });
    await d('POST', '/api/username', { username: 'jo.s' });
    assert.equal((await guest('GET', '/api/profiles/jo.smith')).status, 404);
    assert.equal((await guest('GET', '/api/profiles/jo.s')).body.name, 'Jo Smith');
    assert.equal((await guest('GET', '/api/profiles/..%2F..%2Fetc')).status, 404);
    assert.equal((await guest('PUT', '/api/profile', { name: 'x' })).status, 401);
    app.close();
});

test('Profile: the card can have its own photo, or the mail photo, or none', async () => {
    const app = await start();
    const d = app.device();
    const guest = app.device();
    await d('POST', '/mail/api/login', { email: USER, password: PASS });
    await d('POST', '/api/username', { username: 'jo.smith' });
    await d('PUT', '/mail/api/settings', { senderPhotos: false });
    const png = hex => 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a0000000d49484452' + hex, 'hex').toString('base64');
    await d('PUT', '/mail/api/profile/photo', { dataUrl: png('aa') }); // the mail photo
    await d('PUT', '/api/profile', { name: 'Jo' });
    const photo = async () => (await fetch(app.base + '/api/profiles/jo.smith/photo')).arrayBuffer().then(b => Buffer.from(b).toString('hex').slice(-2));
    assert.equal(await photo(), 'aa'); // by default the card shows the mail photo
    assert.equal((await d('PUT', '/api/profile/photo', { dataUrl: 'data:text/html;base64,PGI+' })).status, 400);
    const up = (await d('PUT', '/api/profile/photo', { dataUrl: png('bb') })).body;
    assert.equal(up.photoMode, 'card');
    assert.equal(await photo(), 'bb'); // its own photo now
    const me = (await d('GET', '/api/profile')).body;
    assert.equal(me.profile.photoMode, 'card');
    assert.ok(me.cardPhoto);
    // a client can't point the card at a photo it never uploaded
    await d('PUT', '/api/profile', { name: 'Jo', photoMode: 'account', cardPhoto: 123 });
    assert.equal((await d('GET', '/api/profile')).body.cardPhoto, me.cardPhoto);
    assert.equal(await photo(), 'aa');
    await d('PUT', '/api/profile', { name: 'Jo', photoMode: 'none' });
    assert.equal((await guest('GET', '/api/profiles/jo.smith')).body.photo, null);
    assert.equal((await fetch(app.base + '/api/profiles/jo.smith/photo')).status, 404);
    await d('DELETE', '/api/profile/photo');
    await d('PUT', '/api/profile', { name: 'Jo', photoMode: 'card' });
    assert.equal((await d('GET', '/api/profile')).body.profile.photoMode, 'account'); // no card photo left
    app.close();
});

test('Admin app: only admins; overview, people, sign out, hide a card, access rules', async () => {
    const app = await start({ ADMIN_EMAILS: USER });
    app.mail.verifyLogin = async () => true;
    const admin = app.device();
    await admin('POST', '/mail/api/login', { email: USER, password: PASS });
    await admin('POST', '/api/username', { username: 'boss' });
    const ava = app.device('Mozilla/5.0 (iPhone) Safari/604.1');
    await ava('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' });
    await ava('POST', '/api/username', { username: 'ava' });
    await ava('PUT', '/api/profile', { name: 'Ava' });
    // the page and the API are admin-only
    assert.equal((await ava('GET', '/admin/')).status, 404);
    assert.equal((await ava('GET', '/api/admin/overview')).status, 403);
    assert.equal((await app.device()('GET', '/api/admin/overview')).status, 401);
    assert.match((await admin('GET', '/admin/')).body, /js\/admin\.js/);
    assert.equal((await admin('GET', '/admin')).headers.get('location'), '/admin/');
    const o = (await admin('GET', '/api/admin/overview')).body;
    assert.equal(o.people, 2);
    assert.equal(o.publicProfiles, 1);
    assert.equal(o.settings.oauthPolicy, 'approved');
    assert.deepEqual(o.admins, [USER]);
    const people = (await admin('GET', '/api/admin/people')).body;
    const a = people.find(p => p.email === 'ava@example.com');
    assert.equal(a.username, 'ava');
    assert.equal(a.signIn, 'password');
    assert.equal(a.devices, 1);
    // hide Ava's card, then unhide it; her own saves can't undo an admin's hide
    await admin('POST', '/api/admin/people/ava%40example.com/profile', { hidden: true });
    assert.equal((await app.device()('GET', '/api/profiles/ava')).status, 404);
    await ava('PUT', '/api/profile', { name: 'Ava again' });
    assert.equal((await app.device()('GET', '/api/profiles/ava')).status, 404);
    await admin('POST', '/api/admin/people/ava%40example.com/profile', { hidden: false });
    assert.equal((await app.device()('GET', '/api/profiles/ava')).body.name, 'Ava again');
    // sign Ava out everywhere
    assert.equal((await admin('POST', '/api/admin/people/' + encodeURIComponent(USER) + '/signout', {})).status, 400);
    await admin('POST', '/api/admin/people/ava%40example.com/signout', {});
    assert.equal((await ava('GET', '/mail/api/me')).status, 401);
    // who may sign in with Microsoft / Google
    assert.equal((await admin('POST', '/api/admin/allowed', { key: 'not an address' })).status, 400);
    await admin('POST', '/api/admin/allowed', { key: '@Contoso.com' });
    assert.equal(app.store.servers.isAllowed('sam@contoso.com'), true);
    assert.equal(app.store.servers.isAllowed('sam@other.com'), false);
    await admin('DELETE', '/api/admin/allowed/%40contoso.com');
    assert.equal(app.store.servers.isAllowed('sam@contoso.com'), false);
    assert.equal((await admin('PUT', '/api/admin/settings', { oauthPolicy: 'anyone' })).body.oauthPolicy, 'anyone');
    assert.equal((await admin('PUT', '/api/admin/settings', { oauthPolicy: 'whatever' })).body.oauthPolicy, 'approved');
    app.close();
});

test('Notes, Tasks and Contacts: private per person, validated, with limits', async () => {
    const app = await start();
    app.mail.verifyLogin = async () => true;
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    assert.equal((await app.device()('GET', '/api/apps/notes')).status, 401);
    assert.equal((await app.device()('GET', '/notes/')).status, 302);
    for (const page of ['notes', 'tasks', 'contacts']) {
        assert.match((await jo('GET', `/${page}/`)).body, new RegExp(`js/${page}\\.js`));
        assert.equal((await jo('GET', `/${page}`)).headers.get('location'), `/${page}/`);
    }
    assert.equal((await jo('GET', '/api/apps/secrets')).status, 404);
    assert.equal((await jo('PUT', '/api/apps/notes/x', { title: 'a' })).status, 400); // id too short
    assert.equal((await jo('PUT', '/api/apps/notes/abc123', { title: 'a' }, { 'X-EG': '' })).status, 403);
    // notes
    const n = (await jo('PUT', '/api/apps/notes/note-001', { title: 'Shopping\nlist', body: 'milk\u0000', color: 'red', pinned: 1, extra: 'x' })).body;
    assert.equal(n.title, 'Shopping list');
    assert.equal(n.body, 'milk');
    assert.equal(n.color, '');
    assert.equal(n.pinned, true);
    assert.equal('extra' in n, false);
    const again = (await jo('PUT', '/api/apps/notes/note-001', { title: 'Shopping', body: 'milk, eggs', color: 'yellow' })).body;
    assert.equal(again.createdAt, n.createdAt);
    assert.equal(again.color, 'yellow');
    assert.equal((await jo('GET', '/api/apps/notes')).body.items.length, 1);
    // tasks
    assert.equal((await jo('PUT', '/api/apps/tasks/task-001', { text: '   ' })).status, 400);
    const t = (await jo('PUT', '/api/apps/tasks/task-001', { text: 'Call Ava', due: '2026-13-45', done: true })).body;
    assert.equal(t.due, '');
    assert.equal(typeof t.doneAt, 'number');
    assert.equal((await jo('PUT', '/api/apps/tasks/task-002', { text: 'Pay rent', due: '2026-12-01' })).body.due, '2026-12-01');
    assert.equal((await jo('DELETE', '/api/apps/tasks/task-001')).body.ok, true);
    assert.equal((await jo('DELETE', '/api/apps/tasks/task-001')).status, 404);
    assert.deepEqual((await jo('GET', '/api/apps/tasks')).body.items.map(x => x.text), ['Pay rent']);
    // contacts
    assert.equal((await jo('PUT', '/api/apps/contacts/ct-0001', { name: '' })).status, 400);
    assert.equal((await jo('PUT', '/api/apps/contacts/ct-0001', { name: 'Ava', emails: ['nope'] })).status, 400);
    assert.equal((await jo('PUT', '/api/apps/contacts/ct-0001', { name: 'Ava', phone: '<b>' })).status, 400);
    const c = (await jo('PUT', '/api/apps/contacts/ct-0001', { name: 'Ava', emails: ['Ava@Example.com'], phone: '+31 6 12', username: 'ava' })).body;
    assert.deepEqual(c.emails, ['ava@example.com']);
    // import the people Mail has learned, without duplicates
    assert.deepEqual((await jo('POST', '/api/apps/contacts/import', {})).body, { added: 0, known: 0 });
    app.store.rememberContacts(USER, [{ address: 'ava@example.com', name: 'Ava' }, { address: 'sam@example.com', name: 'Sam' }]);
    assert.equal((await jo('POST', '/api/apps/contacts/import', {})).body.added, 1);
    assert.equal((await jo('POST', '/api/apps/contacts/import', {})).body.added, 0);
    assert.equal((await jo('GET', '/api/apps/contacts')).body.items.length, 2);
    // someone else sees none of it
    const ava = app.device();
    await ava('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' });
    await ava('POST', '/api/username', { username: 'ava' });
    for (const a of ['notes', 'tasks', 'contacts']) assert.equal((await ava('GET', `/api/apps/${a}`)).body.items.length, 0);
    assert.equal((await ava('DELETE', '/api/apps/notes/note-001')).status, 404);
    // the directory lists public cards only
    await ava('PUT', '/api/profile', { name: 'Ava Jansen', company: 'Ederveen', email: 'ava@work.example' });
    assert.deepEqual((await jo('GET', '/api/directory')).body.map(p => p.username), ['ava']);
    assert.equal((await jo('GET', '/api/directory?q=@AVA')).body.length, 1);
    assert.equal((await jo('GET', '/api/directory?q=zzz')).body.length, 0);
    assert.equal(JSON.stringify((await jo('GET', '/api/directory')).body).includes('ava@work.example'), true); // she shows her email…
    await ava('PUT', '/api/profile', { name: 'Ava Jansen', email: 'ava@work.example', showEmail: false });
    assert.equal((await jo('GET', '/api/directory')).body[0].email, ''); // …until she hides it
    // the item limit holds
    const big = 'x'.repeat(19000);
    let status = 200;
    for (let i = 0; i < 200 && status === 200; i++) status = (await jo('PUT', `/api/apps/notes/bulk-${String(i).padStart(4, '0')}`, { body: big })).status;
    assert.equal(status, 413); // 3 MB per app
    app.close();
});

test('Admin → Sign-in: buttons always show; paste the keys to switch on; the secret never comes back', async () => {
    const app = await start({ ADMIN_EMAILS: USER });
    const guest = app.device();
    assert.deepEqual((await guest('GET', '/api/auth/providers')).body, [{ id: 'google', name: 'Google', ready: false }, { id: 'microsoft', name: 'Microsoft', ready: false }]);
    assert.match((await guest('GET', '/auth/microsoft')).headers.get('location'), /^\/login\?oauth=off&provider=microsoft$/);
    assert.equal((await guest('PUT', '/api/admin/signin/microsoft', { clientId: 'x' })).status, 401);
    const a = app.device();
    await a('POST', '/mail/api/login', { email: USER, password: PASS });
    await a('POST', '/api/username', { username: 'boss' });
    const ID = '1a2b3c4d-5e6f-4a8b-9c0d-112233445566';
    const SECRET = 'Ab1~cDeFgH.ijk_LmNoPqRsTuVwXyZ0123';
    assert.equal((await a('PUT', '/api/admin/signin/yahoo', {})).status, 404);
    assert.match((await a('PUT', '/api/admin/signin/microsoft', { clientId: 'nope', clientSecret: SECRET })).body.error, /Application \(client\) ID/);
    assert.match((await a('PUT', '/api/admin/signin/microsoft', { clientId: ID, clientSecret: ID })).body.error, /secret’s ID/);
    assert.match((await a('PUT', '/api/admin/signin/microsoft', { clientId: ID })).body.error, /secret too/);
    assert.match((await a('PUT', '/api/admin/signin/microsoft', { clientId: ID, clientSecret: SECRET, tenant: 'evil/../x' })).body.error, /Directory/);
    const on = (await a('PUT', '/api/admin/signin/microsoft', { clientId: ID, clientSecret: SECRET })).body;
    assert.equal(on.ready, true);
    assert.equal(on.source, 'admin');
    assert.equal(on.secretHint, '0123');
    assert.match(on.redirectUri, /^http:\/\/127\.0\.0\.1:\d+\/auth\/microsoft\/callback$/);
    const all = (await a('GET', '/api/admin/signin')).body;
    assert.equal(JSON.stringify(all).includes(SECRET), false);
    assert.deepEqual((await guest('GET', '/api/auth/providers')).body.map(p => [p.id, p.ready]), [['google', false], ['microsoft', true]]);
    const go = new URL((await guest('GET', '/auth/microsoft')).headers.get('location'));
    assert.equal(go.origin + go.pathname, 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    assert.equal(go.searchParams.get('client_id'), ID);
    // saving again without the secret keeps it
    assert.equal((await a('PUT', '/api/admin/signin/microsoft', { clientId: ID, tenant: 'contoso.com' })).body.secretHint, '0123');
    assert.match((await guest('GET', '/auth/microsoft')).headers.get('location'), /^https:\/\/login\.microsoftonline\.com\/contoso\.com\//);
    // Google: wrong-looking id, then hide its button
    assert.match((await a('PUT', '/api/admin/signin/google', { clientId: 'abc', clientSecret: 'GOCSPX-abcdefgh' })).body.error, /googleusercontent/);
    await a('PUT', '/api/admin/signin/google', { hidden: true });
    assert.deepEqual((await guest('GET', '/api/auth/providers')).body.map(p => p.id), ['microsoft']);
    // the secret is stored sealed, never in the clear
    await app.store.servers.flush();
    const files = [];
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(f => (f.isDirectory() ? walk(path.join(d, f.name)) : files.push(path.join(d, f.name))));
    walk(app.dataDir);
    assert.equal(files.some(f => fs.readFileSync(f, 'utf8').includes(SECRET)), false);
    assert.equal(files.some(f => fs.readFileSync(f, 'utf8').includes(ID)), true);
    // switch off
    assert.equal((await a('DELETE', '/api/admin/signin/microsoft')).body.ready, false);
    assert.deepEqual((await guest('GET', '/api/auth/providers')).body, [{ id: 'microsoft', name: 'Microsoft', ready: false }]); // google still hidden
    app.close();
    // keys from the environment win, and can't be overwritten here
    const env = await start({ ADMIN_EMAILS: USER, MICROSOFT_CLIENT_ID: ID, MICROSOFT_CLIENT_SECRET: SECRET });
    const b = env.device();
    await b('POST', '/mail/api/login', { email: USER, password: PASS });
    await b('POST', '/api/username', { username: 'boss' });
    assert.equal((await b('PUT', '/api/admin/signin/microsoft', { clientId: ID, clientSecret: SECRET })).status, 409);
    const m = (await b('GET', '/api/admin/signin')).body.find(p => p.id === 'microsoft');
    assert.equal(m.source, 'env');
    assert.equal(JSON.stringify(m).includes(SECRET), false);
    env.close();
});

test('Calendar: events are checked, repeat, show up on the hub, and phones can subscribe', async () => {
    const app = await start();
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    assert.match((await jo('GET', '/calendar/')).body, /js\/calendar\.js/);
    const put = (id, body) => jo('PUT', `/api/apps/calendar/${id}`, body);
    assert.match((await put('event-01', { title: '' })).body.error, /name/);
    assert.match((await put('event-01', { title: 'Dentist', start: '2026-02-30T10:00' })).body.error, /day and time/);
    assert.match((await put('event-01', { title: 'Dentist', start: '2026-11-03T10:00', end: '2026-11-03T09:00' })).body.error, /end before/);
    const e = (await put('event-01', { title: 'Dentist', start: '2026-11-03T14:00', location: 'Ede', repeat: 'monthly', until: '2026-01-01' })).body;
    assert.equal(e.end, '2026-11-03T15:00'); // an hour, unless said otherwise
    assert.equal(e.until, ''); // "until" before the start is ignored
    assert.equal((await put('event-02', { title: 'Holiday', allDay: true, start: '2026-12-24T09:00', end: '2026-12-26' })).body.start, '2026-12-24');
    await put('event-03', { title: 'Standup', start: '2026-11-02T09:00', repeat: 'weekdays' });
    const sum = (await jo('GET', '/api/apps-summary?today=2026-12-03&now=2026-12-03T08:00')).body;
    assert.equal(sum.calendar.today, 2); // the monthly dentist and the weekday standup
    assert.deepEqual(sum.calendar.next, { title: 'Standup', at: '09:00' });
    assert.equal((await jo('GET', '/api/apps-summary?today=2026-12-05')).body.calendar.today, 0); // a Saturday
    // the subscription address works without signing in, and stops working once replaced
    const { url } = (await jo('GET', '/api/calendar/feed')).body;
    const feed = new URL(url).pathname;
    assert.match(feed, /^\/cal\/[A-Za-z0-9_-]+\.ics$/);
    const cal = await app.device()('GET', feed);
    assert.match(cal.headers.get('content-type'), /text\/calendar/);
    assert.match(cal.body, /SUMMARY:Dentist/);
    assert.match(cal.body, /RRULE:FREQ=MONTHLY/);
    assert.match(cal.body, /DTSTART;VALUE=DATE:20261224/);
    assert.match(cal.body, /DTEND;VALUE=DATE:20261227/);
    assert.equal((await jo('GET', '/api/calendar/feed')).body.url, url); // stays the same until you ask for a new one
    const fresh = (await jo('POST', '/api/calendar/feed', {})).body.url;
    assert.notEqual(fresh, url);
    assert.equal((await app.device()('GET', feed)).status, 404);
    assert.equal((await app.device()('GET', new URL(fresh).pathname)).status, 200);
    assert.equal((await app.device()('GET', '/cal/' + 'A'.repeat(40) + '.ics')).status, 404);
    app.close();
});

test('Files: upload, folders, room per person, safe downloads, share links', async () => {
    const app = await start({ FILES_QUOTA_MB: '10', FILES_MAX_MB: '2' });
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const up = (name, bytes, q = '') => jo('POST', `/api/files?name=${encodeURIComponent(name)}${q}`, Buffer.from(bytes));
    assert.equal((await app.device()('GET', '/api/files')).status, 401);
    assert.match((await jo('GET', '/files/')).body, /js\/files\.js/);
    const empty = (await jo('GET', '/api/files')).body;
    assert.deepEqual([empty.items, empty.used, empty.quota, empty.maxFile], [[], 0, 10 * 1048576, 2 * 1048576]);
    // folders, and uploads into them
    const docsF = (await jo('POST', '/api/files/folders', { name: 'Documents' })).body;
    assert.equal((await jo('POST', '/api/files/folders', { name: 'Documents' })).body.name, 'Documents (2)');
    assert.equal((await jo('POST', '/api/files/folders', { name: '  ' })).status, 400);
    const note = (await up('notes/../te\u0000st.txt', 'hello there', `&folder=${docsF.id}&type=text/plain`)).body;
    assert.equal(note.name, 'notes..test.txt'); // no slashes or control characters in names
    assert.equal(note.folder, docsF.id);
    assert.equal(note.size, 11);
    assert.equal((await up('a.txt', 'x', '&folder=nope123')).status, 400);
    const json = (await up('data.json', '{"a":1}', '&type=application/json')).body; // not parsed as JSON on the way in
    assert.equal(json.size, 7);
    const page = (await up('evil.html', '<script>alert(1)</script>', '&type=text/html')).body;
    // too big, or no room left
    assert.equal((await up('big.bin', new Uint8Array(2 * 1048576 + 1))).status, 413);
    // downloads: a text file can be looked at; HTML is always a download, never a page
    const t = await jo('GET', `/api/files/${note.id}/content?inline=1`);
    assert.equal(t.body, 'hello there');
    assert.match(t.headers.get('content-type'), /^text\/plain/);
    assert.match(t.headers.get('content-security-policy'), /sandbox/);
    assert.match(t.headers.get('content-disposition'), /^inline; filename="notes..test.txt"/);
    const h = await jo('GET', `/api/files/${page.id}/content?inline=1`);
    assert.equal(h.headers.get('content-type'), 'application/octet-stream');
    assert.match(h.headers.get('content-disposition'), /^attachment/);
    assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
    // rename, move, and a folder can't go inside itself
    assert.equal((await jo('PATCH', `/api/files/${note.id}`, { name: 'hello.txt', folder: '' })).body.folder, '');
    assert.equal((await jo('PATCH', `/api/files/${json.id}`, { name: 'hello.txt' })).body.name, 'hello (2).txt');
    const sub = (await jo('POST', '/api/files/folders', { name: 'Sub', folder: docsF.id })).body;
    assert.match((await jo('PATCH', `/api/files/${docsF.id}`, { folder: sub.id })).body.error, /inside itself/);
    // share links work without signing in, until switched off
    const share = (await jo('POST', `/api/files/${note.id}/share`, { on: true })).body;
    assert.match(share.url, /\/s\/[A-Za-z0-9_-]{22}$/);
    const guest = app.device();
    const path1 = new URL(share.url).pathname;
    assert.equal((await guest('GET', path1)).body, 'hello there');
    assert.match((await guest('GET', path1)).headers.get('content-disposition'), /^attachment/); // text is downloaded, not shown
    assert.equal((await jo('GET', '/api/files')).body.items.find(f => f.id === note.id).shared, true);
    await jo('POST', `/api/files/${note.id}/share`, { on: false });
    assert.equal((await guest('GET', path1)).status, 404);
    assert.equal((await guest('GET', '/s/' + 'a'.repeat(22))).status, 404);
    // someone else can't reach them
    const ava = app.device();
    app.mail.verifyLogin = async () => true;
    await ava('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' });
    await ava('POST', '/api/username', { username: 'ava' });
    assert.equal((await ava('GET', `/api/files/${note.id}/content`)).status, 404);
    assert.equal((await ava('DELETE', `/api/files/${note.id}`)).status, 404);
    // deleting a folder takes everything in it
    await up('in-sub.txt', 'deep', `&folder=${sub.id}`);
    assert.equal((await jo('DELETE', `/api/files/${docsF.id}`)).body.removed, 3); // Documents, Sub, in-sub.txt
    const after = (await jo('GET', '/api/files')).body;
    assert.deepEqual(after.items.map(f => f.name).sort(), ['Documents (2)', 'evil.html', 'hello (2).txt', 'hello.txt']);
    assert.equal(after.used, 11 + 7 + 25);
    // the room per person holds
    let last;
    for (let i = 0; i < 6; i++) last = await up(`chunk${i}.bin`, new Uint8Array(2 * 1048576 - 10));
    assert.equal(last.status, 413);
    assert.match(last.body.error, /doesn’t fit/);
    // the hub sees them
    assert.equal((await jo('GET', '/api/apps-summary')).body.files.count, 3 + 5); // five 2 MB files fit in 10 MB
    app.close();
});

test('Admin: roles, blocking, the activity log, news on the dashboard, switching apps off', async () => {
    const app = await start({ ADMIN_EMAILS: USER });
    app.mail.verifyLogin = async (email, pw) => pw === 'x' || (email === USER && pw === PASS);
    const boss = app.device();
    await boss('POST', '/mail/api/login', { email: USER, password: PASS });
    await boss('POST', '/api/username', { username: 'boss' });
    const ava = app.device();
    await ava('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' });
    await ava('POST', '/api/username', { username: 'ava' });
    await app.device()('POST', '/mail/api/login', { email: 'ava@example.com', password: 'wrong' });
    // roles
    assert.equal((await ava('GET', '/api/admin/people')).status, 403);
    const people = (await boss('GET', '/api/admin/people')).body;
    assert.deepEqual(people.map(p => [p.email, p.role, p.you]).sort(), [['ava@example.com', 'member', false], [USER, 'owner', true]]);
    assert.equal((await boss('POST', `/api/admin/people/${encodeURIComponent(USER)}/role`, { admin: false })).status, 409);
    assert.equal((await boss('POST', '/api/admin/people/ava%40example.com/role', { admin: true })).body.role, 'admin');
    assert.equal((await ava('GET', '/api/admin/people')).status, 200); // now she's an admin too
    assert.equal((await ava('POST', `/api/admin/people/${encodeURIComponent(USER)}/block`, { blocked: true })).status, 409); // the owner can't be blocked
    // blocking: signed out, can't sign in again, no longer admin
    assert.equal((await boss('POST', '/api/admin/people/ava%40example.com/block', { blocked: true })).body.blocked, true);
    assert.equal((await ava('GET', '/mail/api/me')).status, 401);
    const again = await app.device()('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' });
    assert.equal(again.status, 403);
    assert.match(again.body.error, /switched off/);
    const blockedAva = (await boss('GET', '/api/admin/people')).body.find(p => p.email === 'ava@example.com');
    assert.deepEqual([blockedAva.blocked, blockedAva.role], [true, 'member']);
    await boss('POST', '/api/admin/people/ava%40example.com/block', { blocked: false });
    assert.equal((await app.device()('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' })).status, 200);
    // the activity log has sign-ins (good and bad) and admin changes, newest first
    const log = (await boss('GET', '/api/admin/activity')).body;
    assert.ok(log.some(e => e.kind === 'signin' && e.email === 'ava@example.com' && !e.ok && e.reason === 'wrong-password'));
    assert.ok(log.some(e => e.kind === 'signin' && e.reason === 'blocked'));
    assert.ok(log.some(e => e.kind === 'admin' && e.text === 'Blocked ava@example.com' && e.by === USER));
    assert.ok((await boss('GET', '/api/admin/activity?kind=failed')).body.every(e => e.kind === 'signin' && !e.ok));
    assert.ok((await boss('GET', '/api/admin/activity?kind=admin')).body.every(e => e.kind === 'admin'));
    // news shows on everyone's dashboard until it's taken down
    assert.equal((await boss('POST', '/api/admin/news', { title: '' })).status, 400);
    const post = (await boss('POST', '/api/admin/news', { title: 'Server maintenance\nSaturday', body: 'Mail is down 9–10.', days: 7 })).body;
    assert.equal(post.title, 'Server maintenance Saturday');
    const ava2 = app.device();
    await ava2('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' });
    assert.deepEqual((await ava2('GET', '/api/apps-summary')).body.news.map(n => n.title), ['Server maintenance Saturday']);
    await boss('DELETE', `/api/admin/news/${post.id}`);
    assert.deepEqual((await ava2('GET', '/api/apps-summary')).body.news, []);
    // switching an app off hides it for everyone
    assert.ok((await ava2('GET', '/api/apps-summary')).body.pages.includes('notes'));
    await boss('PUT', '/api/admin/apps', { off: ['notes', 'nonsense'] });
    assert.deepEqual((await boss('GET', '/api/admin/apps')).body.off, ['notes']);
    assert.equal((await ava2('GET', '/notes/')).status, 404);
    assert.equal((await ava2('GET', '/api/apps-summary')).body.pages.includes('notes'), false);
    await boss('PUT', '/api/admin/apps', { off: [] });
    assert.equal((await ava2('GET', '/notes/')).status, 200);
    app.close();
});

test('Files on disk: big uploads in resumable parts, ranges for video, previews, nothing readable on disk', async () => {
    const app = await start();
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const PIECE = 4 * 1024 * 1024;
    const data = require('crypto').randomBytes(2 * PIECE + 1000);
    data.write('SECRET-HOLIDAY-VIDEO', 100);
    const up = (await jo('POST', '/api/files/uploads', { name: 'holiday.mp4', size: data.length, type: 'video/mp4', taken: Date.parse('2026-07-14T10:00:00Z') })).body;
    assert.equal(up.piece, PIECE);
    // a part that isn't whole pieces is refused (it couldn't be resumed)
    assert.equal((await jo('PUT', `/api/files/uploads/${up.id}?offset=0`, data.subarray(0, 1000))).status, 400);
    assert.equal((await jo('PUT', `/api/files/uploads/${up.id}?offset=0`, data.subarray(0, PIECE))).body.offset, PIECE);
    // out of step: told where to carry on
    const wrong = await jo('PUT', `/api/files/uploads/${up.id}?offset=0`, data.subarray(0, PIECE));
    assert.deepEqual([wrong.status, wrong.body.offset], [409, PIECE]);
    assert.equal((await jo('GET', `/api/files/uploads/${up.id}`)).body.offset, PIECE);
    const done = (await jo('PUT', `/api/files/uploads/${up.id}?offset=${PIECE}`, data.subarray(PIECE))).body;
    assert.equal(done.done, true);
    assert.equal(done.file.size, data.length);
    assert.equal(done.file.taken, Date.parse('2026-07-14T10:00:00Z'));
    assert.equal((await jo('GET', `/api/files/uploads/${up.id}`)).status, 404);
    // ranges, as a video player asks for them
    const get = range => fetch(`${app.base}/api/files/${done.file.id}/content?inline=1`, { headers: { Range: range, Cookie: jo.cookies() } });
    const part = await get(`bytes=${PIECE - 5}-${PIECE + 4}`);
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), `bytes ${PIECE - 5}-${PIECE + 4}/${data.length}`);
    assert.equal(Buffer.compare(Buffer.from(await part.arrayBuffer()), data.subarray(PIECE - 5, PIECE + 5)), 0);
    assert.equal(Buffer.compare(Buffer.from(await (await get('bytes=-10')).arrayBuffer()), data.subarray(-10)), 0);
    assert.equal((await get(`bytes=${data.length}-`)).status, 416);
    const whole = await get('');
    assert.equal(whole.headers.get('accept-ranges'), 'bytes');
    assert.equal(Buffer.compare(Buffer.from(await whole.arrayBuffer()), data), 0);
    // nothing readable in the files folder
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));
    assert.equal(walk(path.join(app.dataDir, 'files')).some(f => fs.readFileSync(f).includes(Buffer.from('SECRET-HOLIDAY-VIDEO'))), false);
    // previews: JPEG only, then served
    assert.equal((await jo('PUT', `/api/files/${done.file.id}/thumb`, Buffer.from('<svg onload=alert(1)>'.padEnd(200)))).status, 400);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 7)]);
    assert.equal((await jo('PUT', `/api/files/${done.file.id}/thumb`, jpeg)).body.ok, true);
    const t = await fetch(`${app.base}/api/files/${done.file.id}/thumb`, { headers: { Cookie: jo.cookies() } });
    assert.equal(t.headers.get('content-type'), 'image/jpeg');
    assert.equal(Buffer.compare(Buffer.from(await t.arrayBuffer()), jpeg), 0);
    assert.equal((await jo('GET', '/api/files')).body.items[0].thumb, true);
    // giving up on an upload removes what was sent
    const gone = (await jo('POST', '/api/files/uploads', { name: 'x.bin', size: PIECE * 2 })).body;
    await jo('PUT', `/api/files/uploads/${gone.id}?offset=0`, data.subarray(0, PIECE));
    assert.equal((await jo('DELETE', `/api/files/uploads/${gone.id}`)).body.ok, true);
    // deleting the file removes its contents and its preview from disk
    const before = walk(path.join(app.dataDir, 'files')).length;
    await jo('DELETE', `/api/files/${done.file.id}`);
    assert.equal(walk(path.join(app.dataDir, 'files')).length, before - 2);
    app.close();
});

test('WebDAV: Files as a network drive, signed in with an app password', async () => {
    const app = await start();
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const info = (await jo('GET', '/api/app-passwords')).body;
    assert.match(info.url, /\/dav\/$/);
    assert.equal(info.username, 'jo.smith');
    const made = (await jo('POST', '/api/app-passwords', { name: 'Laptop' })).body;
    assert.match(made.password, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    assert.equal(JSON.stringify((await jo('GET', '/api/app-passwords')).body).includes(made.password), false);
    const auth = (user, pw) => 'Basic ' + Buffer.from(`${user}:${pw}`).toString('base64');
    const dav = (method, p, { body, headers = {}, user = 'jo.smith', pw = made.password } = {}) =>
        fetch(app.base + p, { method, body, headers: { Authorization: auth(user, pw), ...headers } });
    // signing in
    assert.equal((await fetch(app.base + '/dav/', { method: 'PROPFIND' })).status, 401);
    assert.equal((await dav('PROPFIND', '/dav/', { pw: 'wrong-wrong-wrong-wrong' })).status, 401);
    assert.equal((await dav('PROPFIND', '/dav/', { pw: PASS })).status, 401); // never the mail password
    assert.equal((await dav('PROPFIND', '/dav/', { user: USER, pw: made.password.toUpperCase().replace(/-/g, ' ') })).status, 207); // email works too; dashes and case don't matter
    const opts = await dav('OPTIONS', '/dav/');
    assert.match(opts.headers.get('dav'), /1, 2/);
    // a folder, a photo with its date, a text file
    assert.equal((await dav('MKCOL', '/dav/Camera%20Roll/')).status, 201);
    assert.equal((await dav('MKCOL', '/dav/Camera%20Roll/')).status, 405);
    assert.equal((await dav('MKCOL', '/dav/missing/inner/')).status, 409);
    // a tiny JPEG with EXIF: taken 2026-07-14 10:12:00 +02:00
    const exif = Buffer.concat([
        Buffer.from('Exif\0\0', 'latin1'),
        Buffer.from('4d4d002a00000008', 'hex'), // big-endian TIFF, IFD0 at 8
        Buffer.from('0001' + '8769' + '0004' + '00000001' + '0000001a' + '00000000', 'hex'), // IFD0: ExifIFD -> 26
        Buffer.from('0002' + '9003' + '0002' + '00000014' + '00000038' + '9011' + '0002' + '00000007' + '0000004c' + '00000000', 'hex'),
        Buffer.from('2026:07:14 10:12:00\0+02:00\0', 'latin1')
    ]);
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([(exif.length + 2) >> 8, (exif.length + 2) & 255]), exif]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xd9])]);
    assert.equal((await dav('PUT', '/dav/Camera%20Roll/IMG_0001.JPG', { body: jpeg })).status, 201);
    assert.equal((await dav('PUT', '/dav/nowhere/x.txt', { body: 'x' })).status, 409);
    assert.equal((await dav('PUT', '/dav/notes.txt', { body: 'first' })).status, 201);
    assert.equal((await dav('PUT', '/dav/notes.txt', { body: 'second version' })).status, 204); // replaced in place
    const files = (await jo('GET', '/api/files')).body.items;
    const photo = files.find(f => f.name === 'IMG_0001.JPG');
    assert.equal(photo.type, 'image/jpeg');
    assert.equal(photo.taken, Date.parse('2026-07-14T10:12:00+02:00'));
    assert.equal(files.filter(f => f.name === 'notes.txt').length, 1);
    // listing
    const list = await (await dav('PROPFIND', '/dav/', { headers: { Depth: '1' } })).text();
    assert.match(list, /<D:href>\/dav\/<\/D:href>/);
    assert.match(list, /<D:href>\/dav\/Camera%20Roll\/<\/D:href>[\s\S]*?<D:collection\/>/);
    assert.match(list, /<D:href>\/dav\/notes\.txt<\/D:href>[\s\S]*?<D:getcontentlength>14<\/D:getcontentlength>/);
    assert.match(list, /<D:quota-available-bytes>\d+<\/D:quota-available-bytes>/);
    assert.equal((await (await dav('PROPFIND', '/dav/notes.txt', { headers: { Depth: '0' } })).text()).match(/<D:response>/g).length, 1);
    assert.equal((await dav('PROPFIND', '/dav/nope.txt')).status, 404);
    // reading, also in part
    assert.equal(await (await dav('GET', '/dav/notes.txt')).text(), 'second version');
    assert.equal(await (await dav('GET', '/dav/notes.txt', { headers: { Range: 'bytes=7-13' } })).text(), 'version');
    // move, rename, copy, delete
    assert.equal((await dav('MOVE', '/dav/notes.txt', { headers: { Destination: `${app.base}/dav/Camera%20Roll/renamed.txt` } })).status, 201);
    assert.equal((await dav('GET', '/dav/Camera%20Roll/renamed.txt')).status, 200);
    assert.equal((await dav('COPY', '/dav/Camera%20Roll/', { headers: { Destination: '/dav/Backup/' } })).status, 201);
    assert.equal(await (await dav('GET', '/dav/Backup/renamed.txt')).text(), 'second version');
    assert.equal((await dav('MOVE', '/dav/Backup/', { headers: { Destination: '/dav/Backup/Inside/' } })).status, 403); // not into itself
    assert.equal((await dav('COPY', '/dav/Camera%20Roll/renamed.txt', { headers: { Destination: '/dav/Backup/renamed.txt', Overwrite: 'F' } })).status, 412);
    // locks and properties, as Macs and Windows ask for them
    const lock = await dav('LOCK', '/dav/Backup/renamed.txt', { body: '<?xml version="1.0"?><D:lockinfo xmlns:D="DAV:"/>' });
    assert.match(lock.headers.get('lock-token'), /^<opaquelocktoken:/);
    assert.equal((await dav('UNLOCK', '/dav/Backup/renamed.txt')).status, 204);
    const pp = await dav('PROPPATCH', '/dav/Backup/renamed.txt', { body: '<?xml version="1.0"?><D:propertyupdate xmlns:D="DAV:" xmlns:Z="urn:schemas-microsoft-com:"><D:set><D:prop><Z:Win32LastModifiedTime>Wed, 01 Jul 2026 10:00:00 GMT</Z:Win32LastModifiedTime></D:prop></D:set></D:propertyupdate>' });
    assert.equal(pp.status, 207);
    assert.match(await pp.text(), /xmlns:Z="urn:schemas-microsoft-com:"[\s\S]*<Z:Win32LastModifiedTime\/>/);
    assert.equal((await dav('DELETE', '/dav/Backup/')).status, 204);
    assert.equal((await dav('PROPFIND', '/dav/Backup/')).status, 404);
    assert.equal((await dav('DELETE', '/dav/')).status, 403);
    // someone else's password doesn't open these files
    const ava = app.device();
    app.mail.verifyLogin = async () => true;
    await ava('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' });
    await ava('POST', '/api/username', { username: 'ava' });
    const avaPw = (await ava('POST', '/api/app-passwords', { name: 'Phone' })).body.password;
    assert.equal((await dav('PROPFIND', '/dav/', { user: 'jo.smith', pw: avaPw })).status, 401);
    assert.equal((await dav('GET', '/dav/Camera%20Roll/renamed.txt', { user: 'ava', pw: avaPw })).status, 404);
    // revoking stops it straight away; it's noted when it was last used
    const mine = (await jo('GET', '/api/app-passwords')).body.items[0];
    assert.ok(mine.lastUsed);
    await jo('DELETE', `/api/app-passwords/${made.id}`);
    assert.equal((await dav('PROPFIND', '/dav/')).status, 401);
    app.close();
});

test('Docs and Slides: private or shared, cleaned on save, safe from overwriting each other', async () => {
    const app = await start({ ADMIN_EMAILS: '' });
    app.mail.verifyLogin = async () => true;
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const ava = app.device();
    await ava('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' });
    await ava('POST', '/api/username', { username: 'ava' });
    assert.match((await jo('GET', '/docs/')).body, /js\/docs\.js/);
    const d = (await jo('POST', '/api/docs', { kind: 'doc', title: 'How we back up' })).body;
    assert.equal(d.share, 'private');
    // cleaned on the way in
    const saved = (await jo('PUT', `/api/docs/${d.id}`, { title: 'How we back up', version: d.version, body: { html: '<h2 style="position:fixed">Steps</h2><p onclick="x()">Run it<script>alert(1)</script></p><img src="https://tracker.example/x.gif"><ul data-checklist><li data-checked="true">Disk</li></ul>' } })).body;
    assert.equal(saved.version, 2);
    const back = (await jo('GET', `/api/docs/${d.id}`)).body;
    assert.equal(back.body.html, '<h2>Steps</h2><p>Run it</p><ul data-checklist><li data-checked="true">Disk</li></ul>');
    // private: Ava can't see it
    assert.equal((await ava('GET', '/api/docs?kind=doc')).body.length, 0);
    assert.equal((await ava('GET', `/api/docs/${d.id}`)).status, 404);
    // shared to read: she can read, not change, but can make her own copy
    assert.equal((await ava('PATCH', `/api/docs/${d.id}`, { share: 'edit' })).status, 404);
    await jo('PATCH', `/api/docs/${d.id}`, { share: 'view' });
    const seen = (await ava('GET', '/api/docs?kind=doc')).body;
    assert.deepEqual(seen.map(x => [x.title, x.mine, x.canEdit, x.ownerName]), [['How we back up', false, false, '@jo.smith']]);
    assert.equal((await ava('PUT', `/api/docs/${d.id}`, { title: 'hacked', version: 2, body: { html: '' } })).status, 403);
    const copy = (await ava('POST', `/api/docs/${d.id}/copy`, {})).body;
    assert.deepEqual([copy.title, copy.mine, copy.share], ['How we back up (copy)', true, 'private']);
    // shared to edit: her save counts; Jo's stale save is stopped instead of wiping hers
    await jo('PATCH', `/api/docs/${d.id}`, { share: 'edit' });
    assert.equal((await ava('PUT', `/api/docs/${d.id}`, { title: 'How we back up', version: 2, body: { html: '<p>Ava’s version</p>' } })).body.version, 3);
    const stale = await jo('PUT', `/api/docs/${d.id}`, { title: 'How we back up', version: 2, body: { html: '<p>old</p>' } });
    assert.equal(stale.status, 409);
    assert.match(stale.body.error, /@ava changed this/);
    assert.equal((await jo('GET', `/api/docs/${d.id}`)).body.body.html, '<p>Ava’s version</p>');
    // only the owner deletes
    assert.equal((await ava('DELETE', `/api/docs/${d.id}`)).status, 403);
    // Slides: text only, known layouts and themes, pictures only as embedded images
    const deck = (await jo('POST', '/api/docs', { kind: 'deck', title: 'Plans' })).body;
    assert.equal(deck.body.slides.length, 1);
    const ds = (await jo('PUT', `/api/docs/${deck.id}`, { title: 'Plans', version: 1, body: { theme: 'nonsense', slides: [{ layout: 'title', title: 'Plans <b>2027</b>' }, { layout: 'weird', title: 'Next', body: 'One\nTwo', image: 'javascript:alert(1)' }, { layout: 'image', image: 'data:image/png;base64,iVBORw0KGgo=' }] } })).body;
    const deckBack = (await jo('GET', `/api/docs/${deck.id}`)).body.body;
    assert.equal(deckBack.theme, 'midnight');
    assert.deepEqual(deckBack.slides.map(s => s.layout), ['title', 'bullets', 'image']);
    assert.equal(deckBack.slides[0].title, 'Plans <b>2027</b>'); // kept as text; shown escaped
    assert.equal(deckBack.slides[1].image, '');
    assert.equal(deckBack.slides[2].image, 'data:image/png;base64,iVBORw0KGgo=');
    assert.equal(ds.cover, 'midnight|Plans <b>2027</b>');
    // the dashboard counts what you can see
    const sum = (await ava('GET', '/api/apps-summary')).body;
    assert.deepEqual([sum.docs, sum.slides], [2, 0]);
    assert.equal((await jo('DELETE', `/api/docs/${d.id}`)).body.ok, true);
    assert.equal((await ava('GET', `/api/docs/${d.id}`)).status, 404);
    app.close();
});

test('Calendar: shared calendars by link (Magister, Google): read, shown, refreshed, safe', async () => {
    const http = require('http');
    const zlib = require('zlib');
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Rooster 4B', 'BEGIN:VEVENT', `DTSTART:${day}T073000Z`, `DTEND:${day}T082000Z`, 'UID:les-1', 'SUMMARY:ne - Nederlands', 'LOCATION:B204', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const srv = http.createServer((req, res) => {
        if (req.url === '/rooster.ics') {
            res.writeHead(200, { 'Content-Type': 'text/calendar', 'Content-Encoding': 'gzip' });
            res.end(zlib.gzipSync(ics));
        } else if (req.url === '/moved') {
            res.writeHead(302, { Location: '/rooster.ics' });
            res.end();
        } else if (req.url === '/page') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html>Sign in</html>');
        } else {
            res.writeHead(404);
            res.end();
        }
    });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    // a normal server refuses addresses on its own network
    const plain = await start();
    const p = plain.device();
    await p('POST', '/mail/api/login', { email: USER, password: PASS });
    await p('POST', '/api/username', { username: 'jo.smith' });
    assert.match((await p('POST', '/api/calendar/subscriptions', { url: `${base}/rooster.ics` })).body.error, /private network/);
    plain.close();
    // (tests may read from this machine)
    const app = await start({ ALLOW_PRIVATE_MAIL_HOSTS: '1' });
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    assert.equal((await app.device()('GET', '/api/calendar/external')).status, 401);
    assert.match((await jo('POST', '/api/calendar/subscriptions', { url: 'nonsense' })).body.error, /link/);
    assert.match((await jo('POST', '/api/calendar/subscriptions', { url: `${base}/page` })).body.error, /isn’t a calendar/);
    assert.match((await jo('POST', '/api/calendar/subscriptions', { url: `${base}/nope.ics` })).body.error, /answered 404/);
    assert.deepEqual((await jo('GET', '/api/calendar/subscriptions')).body, []); // wrong links aren't kept
    const sub = (await jo('POST', '/api/calendar/subscriptions', { url: `${base}/moved` })).body;
    assert.deepEqual([sub.name, sub.count, sub.error, sub.hidden, sub.host], ['Rooster 4B', 1, '', false, '127.0.0.1']);
    assert.ok(sub.color);
    assert.equal((await jo('POST', '/api/calendar/subscriptions', { url: `${base}/moved` })).status, 409);
    assert.equal(JSON.stringify((await jo('GET', '/api/calendar/subscriptions')).body).includes('/moved'), false); // the secret link isn't sent back
    const ext = (await jo('GET', '/api/calendar/external')).body;
    assert.deepEqual(ext.events.map(e => [e.title, e.location, e.cal, e.start.slice(11, 16)]), [['ne - Nederlands', 'B204', sub.id, '07:30']]);
    // the dashboard shows it today, in your time zone
    const today = new Date().toISOString().slice(0, 10);
    const sum = (await jo('GET', `/api/apps-summary?today=${today}&now=${today}T00:00&tz=Europe/Amsterdam`)).body;
    assert.equal(sum.calendar.today, 1);
    assert.equal(sum.calendar.items[0].title, 'ne - Nederlands');
    assert.match(sum.calendar.items[0].at, /^0[89]:30$/); // 08:30 in winter, 09:30 in summer
    // hide, rename, recolour
    await jo('PATCH', `/api/calendar/subscriptions/${sub.id}`, { hidden: true, name: 'School', color: 'purple' });
    assert.equal((await jo('GET', '/api/calendar/external')).body.events.length, 0);
    assert.equal((await jo('GET', `/api/apps-summary?today=${today}&tz=Europe/Amsterdam`)).body.calendar.today, 0);
    await jo('PATCH', `/api/calendar/subscriptions/${sub.id}`, { hidden: false });
    // the calendar changes at the source; refreshing picks it up
    ics = ics.replace('END:VCALENDAR', ['BEGIN:VEVENT', `DTSTART;VALUE=DATE:${day}`, 'UID:trip', 'SUMMARY:School trip', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
    const again = (await jo('POST', `/api/calendar/subscriptions/${sub.id}/refresh`, {})).body;
    assert.deepEqual([again.name, again.color, again.count], ['School', 'purple', 2]);
    // someone else doesn't see it
    const ava = app.device();
    app.mail.verifyLogin = async () => true;
    await ava('POST', '/mail/api/login', { email: 'ava@example.com', password: 'x' });
    await ava('POST', '/api/username', { username: 'ava' });
    assert.equal((await ava('GET', '/api/calendar/external')).body.events.length, 0);
    assert.equal((await ava('DELETE', `/api/calendar/subscriptions/${sub.id}`)).status, 404);
    // removing it removes its events
    assert.equal((await jo('DELETE', `/api/calendar/subscriptions/${sub.id}`)).body.ok, true);
    assert.equal((await jo('GET', '/api/calendar/external')).body.events.length, 0);
    app.close();
    srv.close();
});

test('Spreadsheets: saved safely, downloaded as .xlsx, .csv and PDF, Excel and CSV files opened', async () => {
    const app = await start();
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    assert.match((await jo('GET', '/sheets/')).body, /js\/sheets\.js/);
    const wb = (await jo('POST', '/api/docs', { kind: 'sheet', title: 'Budget 2027' })).body;
    assert.equal(wb.body.sheets[0].name, 'Sheet1');
    const book = { active: 0, sheets: [
        { name: 'Budget', cols: { A: 160, Z9: 50, B: 5000 }, cells: {
            A1: { v: 'Item', s: { b: true, fill: '#ddebf7', evil: 'x' } }, B1: { v: 'Cost', s: { b: true, align: 'right' } },
            A2: { v: 'Rent' }, B2: { v: '950', s: { fmt: 'currency' } }, A3: { v: 'Food' }, B3: { v: '320,5', s: { fmt: 'currency' } },
            A4: { v: 'Total', s: { b: true } }, B4: { v: '=SOM(B2:B3)', s: { fmt: 'currency', color: '#c00000', b: true } },
            B5: { v: '=B4/0' }, 'ZZZZ1': { v: 'out of range' }, A6: { v: 'Share', s: { fmt: 'percent', dec: 1 } }, B6: { v: '=B2/B4' }
        } },
        { name: 'Notes', cells: { A1: { v: '=Budget!B4*12' } } }
    ] };
    const saved = (await jo('PUT', `/api/docs/${wb.id}`, { title: 'Budget 2027', version: wb.version, body: book })).body;
    assert.equal(saved.version, 2);
    const back = (await jo('GET', `/api/docs/${wb.id}`)).body.body;
    assert.deepEqual(back.sheets[0].cells.A1, { v: 'Item', s: { b: true, fill: '#ddebf7' } });
    assert.equal(back.sheets[0].cells.ZZZZ1, undefined);
    assert.deepEqual(back.sheets[0].cols, { A: 160 });
    // .xlsx, read back with an Excel library
    const res = await fetch(`${app.base}/api/docs/${wb.id}/export?format=xlsx`, { headers: { Cookie: jo.cookies() } });
    assert.match(res.headers.get('content-type'), /spreadsheetml/);
    assert.match(res.headers.get('content-disposition'), /filename="Budget 2027\.xlsx"/);
    const ExcelJS = require('exceljs');
    const x = new ExcelJS.Workbook();
    await x.xlsx.load(Buffer.from(await res.arrayBuffer()));
    const ws = x.getWorksheet('Budget');
    assert.equal(ws.getCell('B2').value, 950);
    assert.equal(ws.getCell('B3').value, 320.5);
    assert.deepEqual(ws.getCell('B4').value, { formula: 'SUM(B2:B3)', result: 1270.5 });
    assert.equal(ws.getCell('B4').numFmt, '"€" #,##0.00');
    assert.equal(ws.getCell('B4').font.color.argb, 'FFC00000');
    assert.equal(ws.getCell('A1').fill.fgColor.argb, 'FFDDEBF7');
    assert.deepEqual(ws.getCell('B5').value, { formula: 'B4/0', result: { error: '#DIV/0!' } });
    assert.equal(ws.getCell('B6').numFmt, undefined);
    assert.equal(ws.getCell('A6').numFmt, '0.0%');
    assert.equal(ws.getColumn('A').width, 23);
    assert.deepEqual(x.getWorksheet('Notes').getCell('A1').value, { formula: 'Budget!B4*12', result: 15246 });
    // .csv of a sheet, and PDF
    const csvBytes = Buffer.from(await (await fetch(`${app.base}/api/docs/${wb.id}/export?format=csv&sheet=0`, { headers: { Cookie: jo.cookies() } })).arrayBuffer());
    assert.deepEqual([...csvBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]); // so Excel reads it as UTF-8
    assert.equal(csvBytes.subarray(3).toString(), 'Item,Cost\r\nRent,950\r\nFood,320.5\r\nTotal,1270.5\r\n,#DIV/0!\r\nShare,0.7477371114\r\n');
    const pdf = Buffer.from(await (await fetch(`${app.base}/api/docs/${wb.id}/export?format=pdf`, { headers: { Cookie: jo.cookies() } })).arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal((await jo('GET', `/api/docs/${wb.id}/export?format=docx`)).status, 400);
    // open the .xlsx we made as a new spreadsheet, and a CSV with ; and decimal commas
    const xlsxBytes = Buffer.from(await (await fetch(`${app.base}/api/docs/${wb.id}/export?format=xlsx`, { headers: { Cookie: jo.cookies() } })).arrayBuffer());
    const imported = (await jo('POST', '/api/docs/import?name=Budget.xlsx', xlsxBytes)).body;
    assert.equal(imported.title, 'Budget');
    const ib = (await jo('GET', `/api/docs/${imported.id}`)).body.body;
    assert.deepEqual(ib.sheets.map(s => s.name), ['Budget', 'Notes']);
    assert.equal(ib.sheets[0].cells.B4.v, '=SUM(B2:B3)');
    assert.equal(ib.sheets[0].cells.B4.s.fmt, 'currency');
    assert.equal(ib.sheets[0].cells.A1.s.b, true);
    const fromCsv = (await jo('POST', '/api/docs/import?name=list.csv', Buffer.from('Name;Age\n"Smith; Jo";41\nAva;29\n'))).body;
    const cb = (await jo('GET', `/api/docs/${fromCsv.id}`)).body.body.sheets[0].cells;
    assert.deepEqual([cb.A2.v, cb.B2.v, cb.A3.v], ['Smith; Jo', '41', 'Ava']);
    assert.equal((await jo('POST', '/api/docs/import?name=virus.exe', Buffer.from('MZ'))).status, 400);
    // the dashboard counts them
    assert.equal((await jo('GET', '/api/apps-summary')).body.sheets, 3);
    app.close();
});

test('Docs: downloaded as Word (.docx) and PDF, Word files opened, page settings kept', async () => {
    const app = await start();
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const d = (await jo('POST', '/api/docs', { kind: 'doc', title: 'Plan' })).body;
    const html = '<h1>Steps</h1><p style="text-align:justify">Do <b>this</b> and <span style="color:#c00000;font-size:14pt">that</span>, see <a href="https://example.com">here</a>.</p><ol><li>One</li><li>Two</li></ol><hr data-page-break=""><table><tr><th>A</th></tr><tr><td>1</td></tr></table>';
    await jo('PUT', `/api/docs/${d.id}`, { title: 'Plan', version: d.version, body: { html, page: { size: 'Letter', orient: 'landscape', margins: 'narrow', evil: 1 } } });
    const back = (await jo('GET', `/api/docs/${d.id}`)).body.body;
    assert.deepEqual(back.page, { size: 'Letter', orient: 'landscape', margins: 'narrow' });
    const get = f => fetch(`${app.base}/api/docs/${d.id}/export?format=${f}`, { headers: { Cookie: jo.cookies() } });
    const docx = await get('docx');
    assert.match(docx.headers.get('content-type'), /wordprocessingml/);
    assert.match(docx.headers.get('content-disposition'), /filename="Plan\.docx"/);
    const buf = Buffer.from(await docx.arrayBuffer());
    const mammoth = require('mammoth');
    const read = (await mammoth.convertToHtml({ buffer: buf })).value;
    assert.match(read, /<h1>Steps<\/h1>/);
    assert.match(read, /<strong>this<\/strong>/);
    assert.match(read, /<a href="https:\/\/example.com">here<\/a>/);
    assert.match(read, /<ol><li>One<\/li><li>Two<\/li><\/ol>/);
    assert.match(read, /<table>/);
    assert.ok(buf.length > 4000);
    const pdf = Buffer.from(await (await get('pdf')).arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal((await jo('GET', `/api/docs/${d.id}/export?format=xlsx`)).status, 400);
    // a Word file opens as a new doc (pictures kept, everything cleaned)
    const opened = (await jo('POST', '/api/docs/import?name=Letter.docx', buf)).body;
    assert.deepEqual([opened.kind, opened.title, opened.mine], ['doc', 'Letter', true]);
    const ob = (await jo('GET', `/api/docs/${opened.id}`)).body.body;
    assert.match(ob.html, /<h1>Steps<\/h1>/);
    assert.match(ob.html, /<ol><li>One<\/li><li>Two<\/li><\/ol>/);
    assert.equal((await jo('POST', '/api/docs/import?name=bad.docx', Buffer.from('not a zip'))).status, 400);
    app.close();
});

test('Slides: text boxes, shapes and pictures saved cleanly; downloaded as PowerPoint and PDF; PowerPoint files opened', async () => {
    const app = await start();
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const office = require('../../lib/office');
    const pic = `data:image/png;base64,${office.backgroundPng({ kind: 'linear', angle: 90, stops: [[0, '#336699'], [100, '#ffcc00']] }).toString('base64')}`;
    const d = (await jo('POST', '/api/docs', { kind: 'deck', title: '', body: { theme: 'ocean', slides: [{ layout: 'title', title: 'Hello' }] } })).body;
    assert.equal(d.body.theme, 'ocean');
    assert.equal(d.cover, 'ocean|Hello');
    const body = {
        theme: 'sunset',
        slides: [
            { layout: 'title', title: 'Quarterly plan', body: 'November', transition: 'fade', fmt: { title: { b: true, color: '#C00000', font: 'Comic Sans MS', size: 60, evil: 'x' }, body: { font: 'Wingdings' } } },
            { layout: 'bullets', title: 'Points', body: 'One\n\tOne and a half\nTwo', notes: 'Say hello first', transition: 'teleport' },
            { layout: 'columns', title: 'Before / after', body: 'Slow', body2: 'Fast' },
            {
                layout: 'titleonly',
                title: 'Shapes',
                objs: [
                    { t: 'round', x: 10, y: 30, w: 20, h: 30, text: 'Plan', fill: '#2e7d32', line: 'red' },
                    { t: 'text', x: 40, y: 30, w: 30, h: 10, text: 'A note', size: 999, align: 'sideways' },
                    { t: 'img', x: 70, y: 30, w: 20, h: 30, src: pic },
                    { t: 'img', x: 70, y: 30, w: 20, h: 30, src: 'javascript:alert(1)' },
                    { t: 'hexagon', x: 'a', y: null, text: 'odd one' }
                ]
            },
            { layout: 'image', title: 'The lake', image: pic, bg: '#fde68a' }
        ]
    };
    const put = await jo('PUT', `/api/docs/${d.id}`, { title: 'Plan', version: d.version, body });
    assert.equal(put.status, 200);
    const back = (await jo('GET', `/api/docs/${d.id}`)).body.body;
    assert.equal(back.theme, 'sunset');
    assert.deepEqual(back.slides[0].fmt, { title: { font: 'Comic Sans MS', size: 60, b: true, color: '#c00000' } });
    assert.deepEqual([back.slides[0].transition, back.slides[1].transition], ['fade', 'none']);
    assert.equal(back.slides[1].body, 'One\n\tOne and a half\nTwo');
    const objs = back.slides[3].objs;
    assert.deepEqual(objs.map(o => o.t), ['round', 'text', 'img', 'text']); // the bad picture is dropped, the unknown shape becomes a text box
    assert.equal(objs[0].fill, '#2e7d32');
    assert.equal(objs[0].line, undefined);
    assert.equal(objs[1].size, 200);
    assert.equal(objs[1].align, undefined);
    assert.deepEqual([objs[3].x, objs[3].y], [30, 30]);
    assert.equal(back.slides[4].bg, '#fde68a');
    // PowerPoint: a real .pptx, one slide each, notes, transitions, pictures
    const get = f => fetch(`${app.base}/api/docs/${d.id}/export?format=${f}`, { headers: { Cookie: jo.cookies() } });
    const res = await get('pptx');
    assert.match(res.headers.get('content-type'), /presentationml/);
    assert.match(res.headers.get('content-disposition'), /filename="Plan\.pptx"/);
    const buf = Buffer.from(await res.arrayBuffer());
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    assert.equal(slides.length, 5);
    const s1 = await zip.file('ppt/slides/slide1.xml').async('string');
    assert.match(s1, /Quarterly plan/);
    assert.match(s1, /<p:transition spd="med"><p:fade\/><\/p:transition>/);
    assert.match(s1, /typeface="Comic Sans MS"/);
    const s4 = await zip.file('ppt/slides/slide4.xml').async('string');
    assert.match(s4, /prst="roundRect"/);
    assert.match(s4, /2E7D32/);
    const notes = Object.keys(zip.files).filter(f => /notesSlide\d+\.xml$/.test(f));
    const allNotes = (await Promise.all(notes.map(f => zip.file(f).async('string')))).join('');
    assert.match(allNotes, /Say hello first/);
    assert.ok(Object.keys(zip.files).some(f => /^ppt\/media\//.test(f)));
    // PDF: one page per slide
    const pdf = Buffer.from(await (await get('pdf')).arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 5);
    assert.equal((await jo('GET', `/api/docs/${d.id}/export?format=docx`)).status, 400);
    // and back again: our own PowerPoint file opens with its layouts, theme and notes
    const opened = (await jo('POST', '/api/docs/import?name=Plan%20copy.pptx', buf)).body;
    assert.deepEqual([opened.kind, opened.title], ['deck', 'Plan copy']);
    const ob = (await jo('GET', `/api/docs/${opened.id}`)).body.body;
    assert.equal(ob.theme, 'sunset');
    assert.deepEqual(ob.slides.map(s => s.layout), ['title', 'bullets', 'columns', 'titleonly', 'image']);
    assert.deepEqual([ob.slides[0].title, ob.slides[1].body, ob.slides[2].body2, ob.slides[1].notes], ['Quarterly plan', 'One\n\tOne and a half\nTwo', 'Fast', 'Say hello first']);
    assert.equal(ob.slides[0].fmt.title.b, true);
    assert.ok(ob.slides[4].image.startsWith('data:image/png;base64,'));
    assert.deepEqual(ob.slides[3].objs.map(o => o.t), ['round', 'text', 'img', 'text']);
    assert.equal((await jo('POST', '/api/docs/import?name=bad.pptx', Buffer.from('not a zip'))).status, 400);
    // a PowerPoint file from elsewhere: real placeholders become the layout's text
    const PptxGen = require('pptxgenjs');
    const p = new PptxGen();
    p.defineSlideMaster({ title: 'M', objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.3, w: 9, h: 1 }, text: '' } }, { placeholder: { options: { name: 'body', type: 'body', x: 0.5, y: 1.5, w: 9, h: 4 }, text: '' } }] });
    const sl = p.addSlide({ masterName: 'M' });
    sl.addText('From elsewhere', { placeholder: 'title' });
    sl.addText('First point', { placeholder: 'body' });
    sl.addShape(p.ShapeType.ellipse, { x: 7, y: 4, w: 1, h: 1, fill: { color: 'FF0000' } });
    const foreign = await p.write({ outputType: 'nodebuffer' });
    const fo = (await jo('POST', '/api/docs/import?name=Other.pptx', foreign)).body;
    const fb = (await jo('GET', `/api/docs/${fo.id}`)).body.body;
    assert.equal(fb.theme, 'office');
    assert.deepEqual([fb.slides[0].layout, fb.slides[0].title, fb.slides[0].body], ['bullets', 'From elsewhere', 'First point']);
    assert.deepEqual(fb.slides[0].objs.map(o => [o.t, o.fill]), [['ellipse', '#ff0000']]);
    app.close();
});

test('Forms: a link anyone can fill in, answers checked, responses as charts data, Excel, CSV and a spreadsheet', async () => {
    const app = await start();
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const f = (await jo('POST', '/api/docs', { kind: 'form', title: 'BBQ', body: { questions: [{ type: 'short', title: 'Name', required: true }] } })).body;
    assert.equal(f.kind, 'form');
    assert.match(f.token, /^[A-Za-z0-9_-]{16}$/);
    const body = {
        desc: 'Saturday at 6',
        color: '#C2185B',
        questions: [
            { id: 'name1', type: 'short', title: 'Name', required: true },
            { id: 'come1', type: 'choice', title: 'Coming?', options: ['Yes', 'No', 'Yes', ''], required: true },
            { id: 'food1', type: 'checks', title: 'Food', options: ['Meat', 'Veggie'], other: true },
            { id: 'rate1', type: 'rating', title: 'Last time?', high: 5 },
            { id: 'scl01', type: 'scale', title: 'Hungry?', low: 0, high: 99 },
            { id: 'mail1', type: 'email', title: 'Email' },
            { id: 'when1', type: 'date', title: 'Best day' },
            { id: 'sect1', type: 'section', title: 'Extra', required: true },
            { id: 'many1', type: 'number', title: 'Guests' },
            { type: 'teleport', title: 'Odd one' }
        ],
        settings: { open: true, who: 'anyone', thanks: 'See you there!' }
    };
    assert.equal((await jo('PUT', `/api/docs/${f.id}`, { title: 'BBQ', version: f.version, body })).status, 200);
    const saved = (await jo('GET', `/api/docs/${f.id}`)).body;
    assert.equal(saved.body.color, '#c2185b');
    assert.deepEqual(saved.body.questions[1].options, ['Yes', 'No']);
    assert.equal(saved.body.questions[4].high, 10);
    assert.equal(saved.body.questions[7].required, undefined);
    assert.equal(saved.body.questions[9].type, 'short');
    // the public page and the questions, without signing in
    const guest = app.device();
    assert.equal((await guest('GET', `/r/${f.token}`)).status, 200);
    assert.equal((await guest('GET', '/r/short')).status, 404);
    assert.equal((await guest('GET', '/api/respond/AAAAAAAAAAAAAAAA')).status, 404);
    const pub = (await guest('GET', `/api/respond/${f.token}`)).body;
    assert.equal(pub.title, 'BBQ');
    assert.equal(pub.questions.length, 10);
    assert.equal(pub.token, undefined);
    assert.equal((await guest('GET', '/api/respond/nope')).status, 404);
    // answers are checked
    const send = (who, answers, extra = {}) => who('POST', `/api/respond/${f.token}`, { answers, ...extra });
    assert.match((await send(guest, { come1: 'Yes' })).body.error, /Name/);
    assert.equal((await send(guest, { name1: 'Ann', come1: 'Perhaps' })).status, 400);
    assert.match((await send(guest, { name1: 'Ann', come1: 'Yes', mail1: 'not-an-email' })).body.error, /email/);
    assert.equal((await send(guest, { name1: 'Ann', come1: 'Yes', rate1: 9 })).status, 400);
    const ok = await send(guest, { name1: 'Ann', come1: 'Yes', food1: ['Veggie', 'Fish'], rate1: 4, scl01: 7, mail1: 'ann@example.com', when1: '2026-11-07', many1: '2,5', nope: 'x' });
    assert.deepEqual(ok.body, { ok: true, thanks: 'See you there!' });
    assert.equal((await send(app.device(), { name1: '=HYPERLINK("http://evil")', come1: 'No', food1: ['Meat'] })).status, 200);
    // a robot filling in the hidden field is thanked, and nothing is kept
    assert.equal((await send(app.device(), { name1: 'Bot', come1: 'Yes' }, { website: 'http://spam' })).body.ok, true);
    const rs = (await jo('GET', `/api/forms/${f.id}/responses`)).body;
    assert.equal(rs.length, 2);
    assert.deepEqual(rs[0].a, { name1: 'Ann', come1: 'Yes', food1: ['Veggie', 'Fish'], rate1: 4, scl01: 7, mail1: 'ann@example.com', when1: '2026-11-07', many1: 2.5 });
    assert.equal(rs[0].by, '');
    assert.equal((await jo('GET', `/api/docs/${f.id}`)).body.responses, 2);
    assert.equal((await guest('GET', `/api/forms/${f.id}/responses`)).status, 401);
    // Excel: values, never formulas; CSV: a ' in front of anything a spreadsheet would run
    const xl = await fetch(`${app.base}/api/forms/${f.id}/responses/export?format=xlsx`, { headers: { Cookie: jo.cookies() } });
    assert.match(xl.headers.get('content-disposition'), /BBQ \(responses\)\.xlsx/);
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await xl.arrayBuffer()));
    const ws = wb.getWorksheet('Responses');
    assert.equal(ws.getCell('C1').value, 'Name');
    assert.equal(ws.getCell('C2').value, 'Ann');
    assert.equal(ws.getCell('E2').value, 'Veggie; Fish');
    assert.equal(ws.getCell('C3').value, '=HYPERLINK("http://evil")');
    assert.equal(ws.getCell('C3').formula, undefined);
    const csv = await (await fetch(`${app.base}/api/forms/${f.id}/responses/export?format=csv`, { headers: { Cookie: jo.cookies() } })).text();
    assert.match(csv, /"'=HYPERLINK\(""http:\/\/evil""\)"/);
    // the responses as a spreadsheet of your own
    const sheet = (await jo('POST', `/api/forms/${f.id}/sheet`, {})).body;
    assert.equal(sheet.kind, 'sheet');
    const book = (await jo('GET', `/api/docs/${sheet.id}`)).body.body;
    assert.equal(book.sheets[0].cells.C2.v, 'Ann');
    assert.equal(book.sheets[0].cells.C3.v, '\'=HYPERLINK("http://evil")');
    // one response deleted, then all
    assert.equal((await jo('DELETE', `/api/forms/${f.id}/responses/${rs[1].id}`)).body.responses, 1);
    // closed: the link says so and refuses answers
    body.settings.open = false;
    await jo('PUT', `/api/docs/${f.id}`, { title: 'BBQ', version: saved.version, body });
    assert.equal((await guest('GET', `/api/respond/${f.token}`)).body.closed, true);
    assert.equal((await send(guest, { name1: 'Late', come1: 'No' })).status, 403);
    // only people with an account, once each: they sign in, and their name comes with it
    body.settings = { open: true, who: 'members', once: true };
    await jo('PUT', `/api/docs/${f.id}`, { title: 'BBQ', version: saved.version + 1, body });
    assert.equal((await guest('GET', `/api/respond/${f.token}`)).body.signIn, true);
    assert.equal((await send(guest, { name1: 'Ann', come1: 'Yes' })).status, 401);
    assert.equal((await send(jo, { name1: 'Jo', come1: 'Yes' })).status, 200);
    assert.equal((await jo('GET', `/api/respond/${f.token}`)).body.answered, true);
    assert.equal((await send(jo, { name1: 'Jo', come1: 'No' })).status, 409);
    assert.equal((await jo('GET', `/api/forms/${f.id}/responses`)).body.pop().by, USER);
    // too many from one address
    body.settings = { open: true, who: 'anyone' };
    await jo('PUT', `/api/docs/${f.id}`, { title: 'BBQ', version: saved.version + 2, body });
    const spam = app.device();
    let last = 0;
    for (let i = 0; i < 14; i++) last = (await send(spam, { name1: `S${i}`, come1: 'No' })).status;
    assert.equal(last, 429);
    // a copy has its own link and no responses; deleting the form removes its responses
    const copy = (await jo('POST', `/api/docs/${f.id}/copy`, {})).body;
    assert.notEqual(copy.token, f.token);
    assert.equal(copy.responses, 0);
    assert.equal((await jo('DELETE', `/api/forms/${f.id}/responses`)).body.responses, 0);
    await jo('DELETE', `/api/docs/${f.id}`);
    assert.equal((await guest('GET', `/api/respond/${f.token}`)).status, 404);
    // the dashboard counts forms
    const sum = (await jo('GET', '/api/apps-summary')).body;
    assert.deepEqual([sum.forms, sum.formResponses], [1, 0]);
    app.close();
});

test('Chat: one-to-one and groups, live, with pictures, reactions, replies, edits and unread counts', async () => {
    const app = await start();
    const jo = app.device();
    const ann = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    // nobody to chat with yet: Ann has no username
    assert.deepEqual((await jo('GET', '/api/chat/people')).body, []);
    await ann('POST', '/mail/api/login', { email: USER2, password: PASS });
    await ann('POST', '/api/username', { username: 'ann' });
    const people = (await jo('GET', '/api/chat/people')).body;
    assert.deepEqual(people.map(p => p.username), ['ann']);
    assert.equal((await jo('POST', '/api/chat', { with: ['nobody@example.com'] })).status, 400);
    // a one-to-one chat is made once
    const c = (await jo('POST', '/api/chat', { with: [USER2] })).body;
    assert.equal(c.direct, true);
    assert.equal((await ann('POST', '/api/chat', { with: [USER] })).body.id, c.id);
    // Ann listens live
    const live = await fetch(`${app.base}/api/chat/stream`, { headers: { Cookie: ann.cookies() } });
    assert.match(live.headers.get('content-type'), /event-stream/);
    const reader = live.body.getReader();
    const got = [];
    const pump = (async () => {
        const dec = new TextDecoder();
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            got.push(dec.decode(value));
        }
    })();
    const m1 = (await jo('POST', `/api/chat/${c.id}`, { text: 'Hi Ann! See https://example.com <b>' })).body;
    assert.equal(m1.text, 'Hi Ann! See https://example.com <b>');
    const pic = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
    const m2 = (await jo('POST', `/api/chat/${c.id}`, { img: pic })).body;
    assert.match(m2.img, new RegExp(`^/api/chat/${c.id}/img/`));
    assert.equal((await jo('POST', `/api/chat/${c.id}`, { text: '   ' })).status, 400);
    await new Promise(r => setTimeout(r, 100));
    assert.match(got.join(''), /event: msg[\s\S]*Hi Ann/);
    // unread for Ann, on the dashboard too
    const annList = (await ann('GET', '/api/chat')).body;
    assert.equal(annList[0].unread, 2);
    assert.equal((await ann('GET', '/api/apps-summary')).body.chat, 2);
    const img = await fetch(`${app.base}${m2.img}`, { headers: { Cookie: ann.cookies() } });
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.equal((await app.device()('GET', m2.img)).status, 401);
    // Ann replies, reacts, reads
    const r1 = (await ann('POST', `/api/chat/${c.id}`, { text: 'Hey!', reply: m1.id })).body;
    assert.equal(r1.reply.text, 'Hi Ann! See https://example.com <b>');
    assert.deepEqual((await ann('PATCH', `/api/chat/${c.id}/m/${m1.id}`, { react: '👍' })).body.re, { '👍': [USER2] });
    assert.equal((await ann('PATCH', `/api/chat/${c.id}/m/${m1.id}`, { react: '💩' })).status, 400);
    assert.equal((await ann('GET', '/api/chat')).body[0].unread, 0); // sending reads
    assert.equal((await jo('GET', '/api/chat')).body[0].unread, 1);
    await jo('POST', `/api/chat/${c.id}/read`, {});
    assert.equal((await jo('GET', '/api/chat')).body[0].unread, 0);
    // only your own messages can be changed or deleted
    assert.equal((await ann('PATCH', `/api/chat/${c.id}/m/${m1.id}`, { text: 'hacked' })).status, 403);
    assert.equal((await jo('PATCH', `/api/chat/${c.id}/m/${m1.id}`, { text: 'Hi Ann!' })).body.edited > 0, true);
    assert.equal((await ann('DELETE', `/api/chat/${c.id}/m/${m2.id}`)).status, 403);
    const del = (await jo('DELETE', `/api/chat/${c.id}/m/${m2.id}`)).body;
    assert.equal(del.deleted, true);
    assert.equal((await jo('GET', m2.img)).status, 404);
    const thread = (await ann('GET', `/api/chat/${c.id}`)).body;
    assert.deepEqual(thread.msgs.map(m => m.text), ['Hi Ann!', '', 'Hey!']);
    assert.ok(thread.read[USER2] > 0);
    // a group: named, people added, someone leaves
    const g = (await jo('POST', '/api/chat', { with: [USER2], name: 'Family' })).body;
    assert.deepEqual([g.direct, g.name, g.members.length], [false, 'Family', 2]);
    await jo('PATCH', `/api/chat/${g.id}`, { name: 'The Smiths' });
    assert.equal((await ann('GET', `/api/chat/${g.id}`)).body.msgs[0].system, true);
    await ann('POST', `/api/chat/${g.id}/leave`, {});
    assert.equal((await ann('GET', `/api/chat/${g.id}`)).status, 404);
    assert.equal((await jo('GET', `/api/chat/${g.id}`)).body.conv.members.length, 1);
    // strangers see nothing
    const eve = app.device();
    assert.equal((await eve('GET', `/api/chat/${c.id}`)).status, 401);
    reader.cancel();
    await pump.catch(() => {});
    app.close();
});

test('Planner: boards of columns and cards, cleaned on save, with what’s due on the dashboard', async () => {
    const app = await start();
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const b = (await jo('POST', '/api/docs', { kind: 'board', title: 'Move house' })).body;
    assert.deepEqual(b.body.cols.map(c => c.name), ['To do', 'Doing', 'Done']);
    assert.equal(b.cover, 'aurora');
    const soon = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    const body = {
        bg: 'ocean',
        labels: { red: 'Urgent', pink: 'nope' },
        cols: [
            { id: 'col1', name: 'To pack', cards: [
                { id: 'card1', title: 'Books', due: soon, labels: ['red', 'pink'], who: [USER, 'not-an-email'], check: [{ t: 'Boxes' }, { t: '' }], desc: 'Fragile <b>' },
                { id: 'card2', title: '', due: 'tomorrow' },
                { id: 'card3', title: 'Done already', due: soon, done: true }
            ] },
            { name: '' }
        ]
    };
    assert.equal((await jo('PUT', `/api/docs/${b.id}`, { title: 'Move house', version: b.version, body })).status, 200);
    const back = (await jo('GET', `/api/docs/${b.id}`)).body;
    assert.equal(back.cover, 'ocean');
    assert.equal(back.body.labels.red, 'Urgent');
    assert.equal(back.body.labels.pink, undefined);
    const [c1, c2] = back.body.cols[0].cards;
    assert.deepEqual([c1.labels, c1.who, c1.check.length, c1.desc], [['red'], [USER], 1, 'Fragile <b>']);
    assert.deepEqual([c2.title, c2.due], ['Untitled card', '']);
    assert.equal(back.body.cols[1].name, 'Untitled');
    const sum = (await jo('GET', '/api/apps-summary')).body;
    assert.deepEqual([sum.boards, sum.boardDue], [1, 1]);
    // a whiteboard keeps only what it can draw
    const w = (await jo('POST', '/api/docs', { kind: 'wb', title: 'Ideas', body: { bg: 'grid', items: [{ t: 'pen', p: [0, 0, 10, 10, 20], c: '#FF0000', w: 4 }, { t: 'note', x: 5, y: 5, w: 200, h: 200, text: 'Hello' }, { t: 'script', x: 1 }, { t: 'text', x: 0, y: 0, text: '  ' }, { t: 'rect', x: 'a', y: 2, w: 30, h: 40, f: 'red' }] } })).body;
    assert.equal(w.body.bg, 'grid');
    assert.deepEqual(w.body.items.map(i => i.t), ['pen', 'note', 'rect']);
    assert.deepEqual(w.body.items[0].p, [0, 0, 10, 10]);
    assert.equal(w.body.items[0].c, '#ff0000');
    assert.deepEqual([w.body.items[2].x, w.body.items[2].f], [0, '']);
    app.close();
});

test('Video Editor: a project keeps only footage it knows, times and looks in range, and shows on the dashboard', async () => {
    const app = await start();
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const v = (await jo('POST', '/api/docs', { kind: 'video', title: 'Trip', body: { aspect: '9:16', bg: 'blur' } })).body;
    assert.deepEqual([v.body.aspect, v.body.clips, v.cover], ['9:16', [], '9:16||0']);
    const body = {
        aspect: '21:9',
        bg: 'rainbow',
        media: [{ id: 'med1', file: 'abcdefgh12', name: 'beach.mp4', kind: 'video', dur: 12.3456, w: 1920, h: 1080 }, { id: 'med2', file: '../etc/passwd', name: 'song.mp3', kind: 'audio', dur: 200 }, { id: 'med3', kind: 'script' }],
        clips: [
            { id: 'clp1', m: 'med1', in: 2, out: 6, speed: 9, vol: 500, filter: 'cinematic', strength: 70, adjust: { exposure: 300, nope: 5, saturation: -20 }, effect: 'zoom_in', fit: 'contain', tr: { type: 'fade', dur: 9 } },
            { id: 'clp2', m: 'ghost', in: 0, out: 3 },
            { id: 'clp3', m: 'med1', in: 8, out: 1, speed: 1, filter: '<b>', effect: 'boom', tr: { type: 'teleport' } }
        ],
        texts: [{ id: 'txt1', text: 'Hello <script>', start: -4, dur: 2, x: 3, y: 0.2, size: 99, color: 'red', font: 'Comic', style: 'title', anim: 'pop' }, 'junk'],
        audio: [{ id: 'aud1', m: 'med2', start: 1, in: 5, out: 65, vol: 80, fadeIn: 1, fadeOut: 99 }, { id: 'aud2', m: 'nope', start: 0, in: 0, out: 5 }]
    };
    const saved = await jo('PUT', `/api/docs/${v.id}`, { title: 'Trip', body, version: v.version });
    assert.equal(saved.status, 200);
    const back = (await jo('GET', `/api/docs/${v.id}`)).body;
    const p = back.body;
    assert.deepEqual([p.aspect, p.bg], ['16:9', 'blur']);
    assert.deepEqual(p.media.map(m => [m.id, m.file, m.kind]), [['med1', 'abcdefgh12', 'video'], ['med2', '', 'audio'], ['med3', '', 'video']]);
    assert.deepEqual(p.clips.map(c => c.id), ['clp1', 'clp3']);
    const [c1, c3] = p.clips;
    assert.deepEqual([c1.speed, c1.vol, c1.filter, c1.strength, c1.effect, c1.fit, c1.tr.type, c1.tr.dur], [4, 200, 'cinematic', 70, 'zoom_in', 'contain', 'fade', 3]);
    assert.deepEqual(c1.adjust, { exposure: 100, saturation: -20 });
    assert.ok(c3.out > c3.in);
    assert.deepEqual([c3.filter, c3.effect, c3.tr.type, c3.fit], ['none', 'none', 'none', 'cover']);
    assert.equal(p.texts.length, 1);
    const t1 = p.texts[0];
    assert.deepEqual([t1.start, t1.x, t1.size, t1.color, t1.font, t1.style, t1.anim], [0, 1, 40, '#ffffff', 'Geist', 'title', 'pop']);
    assert.equal(t1.text, 'Hello <script>'); // drawn on a canvas, never put in the page
    assert.deepEqual(p.audio.map(a => [a.id, a.fadeOut]), [['aud1', 10]]);
    // position, rotation, fades, freeze frames, colour backgrounds and the newer effects are kept, in range
    const more = JSON.parse(JSON.stringify(back.body));
    Object.assign(more.clips[0], { effect: 'vhs', tr: { type: 'circle', dur: 0.8 }, fadeIn: 1.5, fadeOut: 99, freeze: 'yes', tf: { scale: 999, x: -50, y: 300, rot: 45, quarter: 7, flipH: true, flipV: 'no' } });
    Object.assign(more.clips[1], { freeze: true, effect: 'spin_in', tr: { type: 'teleport' } });
    more.texts[0].style = 'neon';
    more.texts[0].anim = 'wave';
    more.bg = '#9B5DE5';
    const s2 = await jo('PUT', `/api/docs/${v.id}`, { title: 'Trip', body: more, version: saved.body.version });
    assert.equal(s2.status, 200);
    const q = (await jo('GET', `/api/docs/${v.id}`)).body.body;
    assert.deepEqual([q.clips[0].effect, q.clips[0].tr.type, q.clips[0].fadeIn, q.clips[0].fadeOut, q.clips[0].freeze], ['vhs', 'circle', 1.5, 10, undefined]);
    assert.deepEqual(q.clips[0].tf, { scale: 400, x: -50, y: 100, rot: 45, quarter: 3, flipH: true, flipV: false });
    assert.deepEqual([q.clips[1].freeze, q.clips[1].effect, q.clips[1].tr.type, q.clips[1].tf], [true, 'spin_in', 'none', undefined]);
    assert.deepEqual([q.texts[0].style, q.texts[0].anim, q.bg], ['neon', 'wave', '#9b5de5']);
    // the gallery card: shape, the first footage's picture, the length
    const listed = (await jo('GET', '/api/docs?kind=video')).body.find(d => d.id === v.id);
    assert.match(listed.cover, /^16:9\|abcdefgh12\|\d+$/);
    assert.equal((await jo('GET', '/api/apps-summary')).body.videos, 1);
    // deleting the project
    assert.equal((await jo('DELETE', `/api/docs/${v.id}`)).status, 200);
    assert.equal((await jo('GET', `/api/docs/${v.id}`)).status, 404);
    assert.equal((await jo('GET', '/api/apps-summary')).body.videos, 0);
    app.close();
});

test('Auto editing with Claude: admins only, key sealed, the answer checked before the editors use it', async () => {
    // a stand-in for the Anthropic API that records what it was asked
    const http = require('http');
    const asked = [];
    let answer = null;
    const fake = http.createServer((req, res) => {
        let body = '';
        req.on('data', c => (body += c));
        req.on('end', () => {
            const b = JSON.parse(body || '{}');
            const key = req.headers['x-api-key'] || String(req.headers.authorization || '').replace(/^Bearer /, '');
            asked.push({ url: req.url, key, beta: req.headers['anthropic-beta'] || '', body: b });
            if (key === 'sk-ant-bad-key-0000000000000000000000') return res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
            const text = typeof answer === 'function' ? answer(b) : JSON.stringify(answer || 'ready');
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: b.model, content: [{ type: 'text', text: typeof answer === 'string' ? answer : text }], stop_reason: 'end_turn', usage: { input_tokens: 1200, output_tokens: 300 } }));
        });
    });
    await new Promise(r => fake.listen(0, r));
    fake.unref();
    const app = await start({ ADMIN_EMAILS: USER, ANTHROPIC_BASE_URL: `http://127.0.0.1:${fake.address().port}` });
    const jo = app.device();
    const ann = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    await ann('POST', '/mail/api/login', { email: USER2, password: PASS });
    await ann('POST', '/api/username', { username: 'ann' });
    // off until a key is added; never for people who aren't admins
    assert.deepEqual((await jo('GET', '/api/ai/status')).body.on, false);
    assert.equal((await jo('POST', '/api/ai/photo', { photo: 'data:image/png;base64,AAAA' })).status, 409);
    assert.equal((await ann('GET', '/api/admin/ai')).status, 403);
    assert.equal((await ann('POST', '/api/ai/video', {})).status, 403);
    assert.equal((await jo('PUT', '/api/admin/ai', { apiKey: 'hello' })).status, 400);
    const set = (await jo('PUT', '/api/admin/ai', { apiKey: 'sk-ant-test-key-1234567890abcdefghij' })).body;
    assert.deepEqual([set.configured, set.source, set.hint, set.model], [true, 'saved', 'ghij', 'claude-opus-5-5']);
    assert.equal(JSON.stringify(set).includes('sk-ant-test'), false); // never sent back
    assert.equal((await jo('GET', '/api/ai/status')).body.on, true);
    assert.equal((await ann('GET', '/api/ai/status')).body.on, false);
    // the key is sealed on disk
    const registry = JSON.stringify(app.store.servers.getSignin('claude'));
    assert.equal(registry.includes('sk-ant-test'), false);
    // a test request
    answer = 'ready';
    const t = (await jo('POST', '/api/admin/ai/test', {})).body;
    assert.deepEqual([t.ok, t.reply], [true, 'ready']);
    assert.equal(asked[0].key, 'sk-ant-test-key-1234567890abcdefghij');
    // a photo: Claude's answer comes back checked and clamped
    answer = { adjust: { exposure: 250, contrast: 12, highlights: -20, shadows: 30, saturation: 8, vibrance: 10, temperature: 6, tint: 0, fade: -5, vignette: 12, sharpen: 15, grain: 0 }, filter: 'golden', filter_strength: 60, crop: { aspect: '4:5', x: 0.1, y: 0, w: 0.8, h: 1 }, straighten: 40, note: 'Lifted the shadows and warmed it up.' };
    const pic = 'data:image/jpeg;base64,' + Buffer.from('ffd8ffe000104a464946', 'hex').toString('base64');
    const ph = (await jo('POST', '/api/ai/photo', { photo: pic, wish: 'make it warm', size: { w: 4000, h: 3000 } })).body;
    assert.equal(ph.edit.adjust.exposure, 100);
    assert.equal(ph.edit.adjust.fade, 0);
    assert.deepEqual([ph.edit.filter, ph.edit.strength, ph.edit.straighten, ph.edit.crop.aspect], ['golden', 60, 15, '4:5']);
    const req1 = asked[asked.length - 1];
    assert.equal(req1.body.model, 'claude-opus-5-5');
    assert.equal(req1.body.output_config.format.type, 'json_schema');
    assert.equal(req1.body.fallbacks, 'default');
    assert.match(req1.beta, /server-side-fallback-2026-07-01/);
    assert.equal(req1.body.messages[0].content[0].type, 'image');
    assert.match(req1.body.messages[0].content[1].text, /make it warm/);
    assert.equal((await jo('POST', '/api/ai/photo', { photo: 'javascript:alert(1)' })).status, 400);
    // a video: only known clips, times inside each clip, enums kept to the list
    answer = {
        title: 'Summer',
        aspect: '9:16',
        clips: [
            { media: 'c1', in: 2, out: 5.5, speed: 1, filter: 'warm', effect: 'zoom_in', transition: 'fade' },
            { media: 'c2', in: 9, out: 99, speed: 9, filter: 'nope', effect: 'zoom_in', transition: 'none' },
            { media: 'ghost', in: 0, out: 3, speed: 1, filter: 'none', effect: 'none', transition: 'none' }
        ],
        texts: [{ text: 'Summer 2026', start: 0, duration: 2.5, position: 'center', style: 'title', animation: 'pop' }],
        music: { media: 'm1', offset: 12, volume: 70 },
        clip_volume: 30,
        summary: 'A quick summer recap.'
    };
    const frames = [0, 2, 4].map(t => ({ t, data: pic }));
    const v = await jo('POST', '/api/ai/video', { brief: 'Fast summer recap for TikTok', length: 15, aspect: '9:16', captions: true, media: [{ id: 'c1', name: 'beach.mp4', kind: 'video', dur: 12, w: 1920, h: 1080, frames, loud: [1, 2, 9, 4] }, { id: 'c2', name: 'pier.mp4', kind: 'video', dur: 10, frames }], music: [{ id: 'm1', name: 'song.mp3', dur: 120, bpm: 120, beats: [0.5, 1, 1.5] }] });
    assert.equal(v.status, 200);
    const plan = v.body.plan;
    assert.deepEqual(plan.clips.map(c => c.media), ['c1', 'c2']);
    assert.deepEqual([plan.clips[1].out, plan.clips[1].speed, plan.clips[1].filter], [10, 4, 'none']);
    assert.deepEqual([plan.aspect, plan.music.media, plan.clipVolume, plan.texts[0].style], ['9:16', 'm1', 30, 'title']);
    const req2 = asked[asked.length - 1];
    assert.equal(req2.body.output_config.effort, 'high');
    assert.equal(req2.body.messages[0].content.filter(c => c.type === 'image').length, 6);
    assert.match(JSON.stringify(req2.body.messages[0].content), /Loudness per second \(0 quiet – 9 loud\): 1294/);
    assert.match(JSON.stringify(req2.body.messages[0].content), /about 120 BPM/);
    assert.equal(v.body.model, 'Claude Opus 5.5');
    // a cheaper model when the admin picks one (no fallback beta needed for Haiku)
    await jo('PUT', '/api/admin/ai', { model: 'claude-haiku-5-5' });
    await jo('POST', '/api/ai/photo', { photo: pic });
    assert.equal(asked[asked.length - 1].body.model, 'claude-haiku-5-5');
    assert.equal(asked[asked.length - 1].body.fallbacks, undefined);
    assert.equal((await jo('PUT', '/api/admin/ai', { model: 'gpt-4' })).status, 400);
    // usage this month, and the activity log
    const after = (await jo('GET', '/api/admin/ai')).body;
    assert.equal(after.usage.requests, 4);
    assert.equal(after.usage.output, 1200);
    const log = (await jo('GET', '/api/admin/activity')).body;
    assert.ok(log.some(e => /Auto-edited a video/.test(e.text)));
    // a key Anthropic doesn't accept is reported plainly
    await jo('PUT', '/api/admin/ai', { apiKey: 'sk-ant-bad-key-0000000000000000000000' });
    const bad = await jo('POST', '/api/ai/photo', { photo: pic });
    assert.equal(bad.status, 502);
    assert.match(bad.body.error, /isn’t accepted/);
    await jo('DELETE', '/api/admin/ai');
    assert.equal((await jo('GET', '/api/ai/status')).body.on, false);
    fake.closeAllConnections();
    fake.close();
    app.close();
});

test('Auto editing with other AI services: any OpenAI-compatible one, chosen in Admin → AI', async () => {
    // a stand-in for an OpenAI-style service (Gemini, Groq, OpenAI, Ollama… all speak this)
    const http = require('http');
    const asked = [];
    let answer = null;
    let refuseFormat = false;
    const fake = http.createServer((req, res) => {
        let body = '';
        req.on('data', c => (body += c));
        req.on('end', () => {
            const b = JSON.parse(body || '{}');
            const key = String(req.headers.authorization || '').replace(/^Bearer /, '');
            asked.push({ url: req.url, key, body: b });
            const send = (status, data) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
            if (key === 'bad-key-123456') return send(401, { error: { message: 'Invalid API Key' } });
            if (req.url === '/v1/models') return send(200, { data: [{ id: 'vision-large' }, { id: 'models/vision-small' }, { id: 'bad model!' }] });
            if (refuseFormat && b.response_format) {
                refuseFormat = false;
                return send(400, { error: { message: 'response_format is not supported by this model' } });
            }
            const text = typeof answer === 'string' ? answer : '```json\n' + JSON.stringify(answer) + '\n```';
            send(200, { id: 'c1', model: b.model, choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: text } }], usage: { prompt_tokens: 900, completion_tokens: 120 } });
        });
    });
    await new Promise(r => fake.listen(0, '127.0.0.1', r));
    fake.unref();
    const base = `http://127.0.0.1:${fake.address().port}/v1`;
    const app = await start({ ADMIN_EMAILS: USER });
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const all = (await jo('GET', '/api/admin/ai')).body;
    assert.deepEqual(all.providers.map(p => p.id), ['gemini', 'groq', 'mistral', 'openrouter', 'sambanova', 'cohere', 'nvidia', 'huggingface', 'zai', 'cerebras', 'alibaba', 'fireworks', 'claude', 'openai', 'deepseek', 'xai', 'together', 'custom']);
    // every service says what's free about it, free ones first
    assert.ok(all.providers.every(p => p.tier && p.free));
    assert.deepEqual([...new Set(all.providers.map(p => p.tier))], ['free', 'trial', 'paid', 'own']);
    assert.ok(all.providers.filter(p => p.tier !== 'own').every(p => /^https:\/\//.test(p.keysUrl)));
    assert.equal(all.active, 'claude');
    // an address: https anywhere, http only on this machine or the local network
    assert.equal((await jo('PUT', '/api/admin/ai', { provider: 'custom', baseUrl: 'http://example.com/v1' })).status, 400);
    assert.equal((await jo('PUT', '/api/admin/ai', { provider: 'gemini', baseUrl: base })).status, 400);
    assert.equal((await jo('PUT', '/api/admin/ai', { provider: 'custom', baseUrl: base })).status, 200);
    // a key: the first service with one is the one used
    const set = (await jo('PUT', '/api/admin/ai', { provider: 'custom', apiKey: 'local-key-abcdef' })).body;
    assert.deepEqual([set.active, set.configured, set.hint], ['custom', true, 'cdef']);
    assert.equal(JSON.stringify(set).includes('local-key-abcdef'), false);
    assert.equal(JSON.stringify(app.store.servers.getSignin('claude')).includes('local-key-abcdef'), false);
    // the models it offers, cleaned up
    const models = (await jo('GET', '/api/admin/ai/models?provider=custom')).body.models;
    assert.deepEqual(models, ['vision-large', 'vision-small']);
    assert.equal((await jo('PUT', '/api/admin/ai', { provider: 'custom', model: 'no spaces allowed' })).status, 400);
    await jo('PUT', '/api/admin/ai', { provider: 'custom', model: 'vision-large', maxImages: 4 });
    // a test request
    answer = 'ready';
    const t = (await jo('POST', '/api/admin/ai/test', { provider: 'custom' })).body;
    assert.deepEqual([t.ok, t.reply, t.model], [true, 'ready', 'vision-large']);
    assert.equal(asked[asked.length - 1].key, 'local-key-abcdef');
    const st = (await jo('GET', '/api/ai/status')).body;
    assert.deepEqual([st.on, st.provider, st.name, st.model], [true, 'custom', 'AI', 'vision-large']);
    // a photo, with the service refusing "JSON mode" the first time: asked again without it
    refuseFormat = true;
    answer = { adjust: { exposure: 300, contrast: 10 }, filter: 'warm', filter_strength: 50, crop: { aspect: 'none', x: 0, y: 0, w: 1, h: 1 }, straighten: 0, note: 'Warmer.' };
    const pic = 'data:image/jpeg;base64,' + Buffer.from('ffd8ffe000104a464946', 'hex').toString('base64');
    const ph = await jo('POST', '/api/ai/photo', { photo: pic });
    assert.equal(ph.status, 200);
    assert.deepEqual([ph.body.edit.adjust.exposure, ph.body.edit.filter, ph.body.edit.crop, ph.body.model], [100, 'warm', null, 'vision-large']);
    const req = asked[asked.length - 1];
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.body.response_format, undefined);
    assert.equal(asked[asked.length - 2].body.response_format.type, 'json_object');
    assert.equal(req.body.messages[0].role, 'system');
    assert.match(req.body.messages[0].content, /JSON Schema/);
    assert.equal(req.body.messages[1].content[0].type, 'image_url');
    assert.match(req.body.messages[1].content[0].image_url.url, /^data:image\/jpeg;base64,/);
    // a video: only as many frames as the service takes, spread over the clips
    answer = { title: 'Trip', aspect: '16:9', clips: [{ media: 'c1', in: 0, out: 3, speed: 1, filter: 'none', effect: 'pan_left', transition: 'circle' }, { media: 'c2', in: 1, out: 2, speed: 1, filter: 'none', effect: 'none', transition: 'none' }], texts: [], music: null, clip_volume: 80, summary: 'Short.' };
    const frames = [0, 1, 2, 3, 4, 5].map(t => ({ t, data: pic }));
    const v = await jo('POST', '/api/ai/video', { brief: 'quick', media: [{ id: 'c1', name: 'a.mp4', kind: 'video', dur: 10, frames }, { id: 'c2', name: 'b.mp4', kind: 'video', dur: 6, frames }] });
    assert.equal(v.status, 200);
    assert.deepEqual(v.body.plan.clips.map(c => [c.media, c.effect, c.transition]), [['c1', 'pan_left', 'circle'], ['c2', 'none', 'none']]);
    const parts = asked[asked.length - 1].body.messages[1].content;
    assert.equal(parts.filter(x => x.type === 'image_url').length, 4);
    // problems are said plainly
    answer = 'Sorry, I can only chat.';
    const bad = await jo('POST', '/api/ai/photo', { photo: pic });
    assert.equal(bad.status, 502);
    assert.match(bad.body.error, /couldn’t be read/);
    await jo('PUT', '/api/admin/ai', { provider: 'custom', apiKey: 'bad-key-123456' });
    const no = await jo('POST', '/api/admin/ai/test', { provider: 'custom' });
    assert.match(no.body.error, /doesn’t accept this API key/);
    // switching back to Claude needs a Claude key; removing a key
    assert.equal((await jo('PUT', '/api/admin/ai', { active: 'claude' })).status, 409);
    const gone = (await jo('DELETE', '/api/admin/ai?provider=custom')).body;
    assert.equal(gone.providers.find(p => p.id === 'custom').configured, false);
    assert.equal((await jo('GET', '/api/ai/status')).body.on, false);
    app.close();
});

test('Widgets: a private feed for iPhone widgets, the Scriptable script, a new link stops the old one', async () => {
    const app = await start({ ADMIN_EMAILS: USER });
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    await jo('PUT', '/api/apps/calendar/event-w1', { title: 'Dentist', start: `${day(1)}T09:00`, end: `${day(1)}T09:30`, color: 'pink' });
    await jo('PUT', '/api/apps/calendar/event-w2', { title: 'Party', allDay: true, start: `${day(2)}T00:00`, end: `${day(2)}T23:59` });
    await jo('PUT', '/api/apps/calendar/event-w3', { title: 'Next month', start: `${day(40)}T10:00`, end: `${day(40)}T11:00` });
    await jo('PUT', '/api/apps/tasks/task-w1', { text: 'Pay the bill', due: day(-1) });
    await jo('PUT', '/api/apps/tasks/task-w2', { text: 'Someday', due: day(9) });
    await jo('PUT', '/api/apps/tasks/task-w3', { text: 'Starred thing', starred: true });
    // the inbox count is remembered when Mail lists the folders (the widget has no password to ask with)
    await jo('GET', '/mail/api/folders');
    const w = (await jo('GET', '/api/widget?tz=UTC')).body;
    const path = new URL(w.feed).pathname;
    assert.match(path, /^\/w\/[A-Za-z0-9_-]+\.json$/);
    assert.equal((await jo('GET', '/api/widget')).body.feed, w.feed); // kept until you ask for a new one
    // the feed works without signing in
    const f = await app.device()('GET', `${path}?tz=UTC`);
    assert.equal(f.status, 200);
    assert.match(f.headers.get('cache-control'), /no-store/);
    const d = f.body;
    assert.equal(d.date, day(0));
    assert.deepEqual(d.events.map(e => [e.title, e.day, e.at, e.allDay]), [['Dentist', day(1), '09:00', false], ['Party', day(2), null, true]]);
    assert.equal(d.events[0].color, '#f472b6');
    assert.deepEqual(d.tasks.list.map(t => [t.text, t.late]), [['Pay the bill', true], ['Starred thing', false]]);
    assert.deepEqual([d.tasks.open, d.tasks.overdue], [3, 1]);
    assert.equal(d.mail.unread, 1);
    assert.equal(d.name, 'jo.smith');
    assert.match(d.links.calendar, /\/calendar\/$/);
    // the Scriptable script carries this person's feed
    const s = await jo('GET', '/api/widget/script?download=1');
    assert.match(s.headers.get('content-disposition'), /EderveenGroup\.js/);
    assert.ok(s.body.includes(`const FEED = '${w.feed}';`));
    assert.ok(!s.body.includes('__FEED__'));
    new (Object.getPrototypeOf(async function () {}).constructor)(s.body); // it parses (Scriptable runs it with top-level await)
    // a new link: the old one stops
    const fresh = (await jo('POST', '/api/widget', {})).body.feed;
    assert.notEqual(fresh, w.feed);
    const gone = await app.device()('GET', path);
    assert.equal(gone.status, 404);
    assert.match(gone.body.error, /no longer works/);
    assert.equal((await app.device()('GET', new URL(fresh).pathname)).status, 200);
    assert.equal((await app.device()('GET', '/w/' + 'A'.repeat(40) + '.json')).status, 404);
    assert.equal((await app.device()('GET', '/api/widget')).status, 401);
    // switched off in Admin → Apps: no feed
    await jo('PUT', '/api/admin/apps', { off: ['widgets'] });
    assert.equal((await app.device()('GET', new URL(fresh).pathname)).status, 404);
    assert.equal((await jo('GET', '/api/widget')).status, 404);
    await jo('PUT', '/api/admin/apps', { off: [] });
    app.close();
});

test('Widget gallery: every widget’s Scriptable script runs in every size, and each feed gives only its part', async () => {
    const { runScript, textOf } = require('./scriptable-mock');
    const { GLOBALS, WIDGET_KINDS } = require('../../lib/widget');
    const app = await start({ ADMIN_EMAILS: USER });
    const jo = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    await jo('PUT', '/api/apps/calendar/event-g1', { title: 'Dentist', start: `${day(1)}T09:00`, end: `${day(1)}T09:30`, color: 'pink' });
    await jo('PUT', '/api/apps/calendar/event-g2', { title: 'Holiday', allDay: true, start: `${day(20)}T00:00`, end: `${day(20)}T23:59` });
    await jo('PUT', '/api/apps/tasks/task-g1', { text: 'Pay the bill', due: day(-1) });
    await jo('PUT', '/api/apps/tasks/task-g2', { text: 'Done thing', done: true });
    await jo('PUT', '/api/apps/notes/note-g1', { title: 'Trip', body: '<p>Pack the <b>camera</b></p>', color: 'blue', pinned: true });
    await jo('PUT', '/api/apps/notes/note-g2', { title: 'Ideas', body: 'A shared list' });
    const { feed, kinds } = (await jo('GET', '/api/widget')).body;
    assert.deepEqual(kinds.map(k => k.id).slice(0, 3), ['calendar', 'tasks', 'notes']);
    const path = new URL(feed).pathname;
    const part = async kind => (await app.device()('GET', `${path}?tz=UTC&kind=${kind}`)).body;
    // each widget gets what it shows, and no more
    const cal = await part('calendar');
    assert.ok(cal.events.length && cal.month && !cal.notes && !cal.tasks);
    assert.equal(cal.month.first, `${day(0).slice(0, 8)}01`);
    assert.ok(cal.events[0].ts > Date.now());
    const notes = await part('notes');
    assert.deepEqual(notes.notes.map(n => [n.title, n.text, n.pinned]), [['Trip', 'Pack the camera', true], ['Ideas', 'A shared list', false]]);
    assert.equal(notes.notes[0].color, '#bfdbfe');
    assert.ok(!notes.events && !notes.mail);
    const tasks = await part('tasks');
    assert.equal(tasks.tasks.week.length, 7);
    assert.equal(tasks.tasks.doneToday, 1);
    const count = await part('countdown');
    assert.ok(count.events.some(e => e.title === 'Holiday'));
    const st = await part('storage');
    assert.equal(st.storage.files, 0);
    // every script, every size, in a strict stand-in for Scriptable (properties it doesn't have throw)
    const weather = { current: { temperature_2m: 11, apparent_temperature: 9, weather_code: 61, is_day: 1, wind_speed_10m: 12 }, daily: { time: [day(0), day(1), day(2), day(3), day(4), day(5), day(6)], weather_code: [61, 3, 0, 2, 71, 95, 45], temperature_2m_max: [12, 10, 11, 13, 9, 4, 8], temperature_2m_min: [6, 5, 4, 3, 2, -1, 1], precipitation_probability_max: [80, 20, 0, 10, 40, 70, 5] } };
    const fetchJSON = async url => {
        if (url.startsWith('https://api.open-meteo.com/')) return { status: 200, body: weather };
        const r = await app.device()('GET', new URL(url).pathname + new URL(url).search);
        return { status: r.status, body: r.body };
    };
    const seen = {};
    for (const k of WIDGET_KINDS) {
        const src = (await jo('GET', `/api/widget/script?kind=${k.id}`)).body;
        assert.ok(src.includes(`const KIND = '${k.id}';`));
        assert.ok(src.includes(`const FEED = '${feed}';`));
        // only its own part
        for (const other of WIDGET_KINDS) if (other.id !== k.id) assert.ok(!src.includes(`MAKERS.${other.id} = {`), `${k.id} has ${other.id} in it`);
        const files = new Map();
        for (const family of ['small', 'medium', 'large', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline']) {
            const r = await runScript(src, GLOBALS, { family, param: '', fetchJSON, files });
            assert.equal(r.shown, 'widget', `${k.id} ${family}`);
            seen[`${k.id}:${family}`] = textOf(r.tree);
        }
        // opened in Scriptable itself, it shows a preview
        assert.equal((await runScript(src, GLOBALS, { family: null, runsInWidget: false, fetchJSON })).shown, 'medium');
    }
    assert.match(seen['calendar:large'], /Dentist/);
    assert.match(seen['notes:small'], /Trip/);
    assert.match(seen['tasks:medium'], /Pay the bill/);
    assert.match(seen['countdown:small'], /Holiday|Dentist/);
    assert.match(seen['weather:medium'], /Rain/);
    assert.match(seen['quote:small'], /\w/);
    // a revoked link says so, in every widget
    await jo('POST', '/api/widget', {});
    const old = (await jo('GET', '/api/widget/script?kind=calendar')).body.replace(/const FEED = '[^']+';/, `const FEED = '${feed}';`);
    const r = await runScript(old, GLOBALS, { family: 'medium', param: '', fetchJSON });
    assert.match(textOf(r.tree), /no longer works/);
    app.close();
});

test('Jarvis: admins only, talks with tools, remembers on the server, and switches to a backup AI service when one stops', async () => {
    // a stand-in AI that calls tools: Anthropic (/v1/messages) and OpenAI-style (/v1/chat/completions)
    const http = require('http');
    const ai = require('../../lib/ai');
    const asked = [];
    let script = []; // what to answer, one per request
    const fake = http.createServer((req, res) => {
        let body = '';
        req.on('data', c => (body += c));
        req.on('end', () => {
            const b = JSON.parse(body || '{}');
            asked.push({ url: req.url, body: b });
            const next = script.shift() || {};
            const send = (status, data) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
            if (next.status) return send(next.status, next.body);
            if (req.url.startsWith('/v1/messages')) {
                const content = [...(next.text ? [{ type: 'text', text: next.text }] : []), ...(next.calls || []).map(([name, input], i) => ({ type: 'tool_use', id: `toolu_${asked.length}_${i}`, name, input }))];
                return send(200, { id: 'msg', type: 'message', role: 'assistant', model: b.model, content, stop_reason: next.calls ? 'tool_use' : 'end_turn', usage: { input_tokens: 100, output_tokens: 20 } });
            }
            const message = { role: 'assistant', content: next.calls ? null : next.text, ...(next.calls ? { tool_calls: next.calls.map(([name, input], i) => ({ id: `call_${asked.length}_${i}`, type: 'function', function: { name, arguments: JSON.stringify(input) } })) } : {}) };
            send(200, { id: 'c', model: b.model, choices: [{ index: 0, finish_reason: next.calls ? 'tool_calls' : 'stop', message }], usage: { prompt_tokens: 100, completion_tokens: 20 } });
        });
    });
    await new Promise(r => fake.listen(0, '127.0.0.1', r));
    fake.unref();
    const port = fake.address().port;
    const app = await start({ ADMIN_EMAILS: USER, ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}` });
    const jo = app.device();
    const ann = app.device();
    await jo('POST', '/mail/api/login', { email: USER, password: PASS });
    await jo('POST', '/api/username', { username: 'jo.smith' });
    await ann('POST', '/mail/api/login', { email: USER2, password: PASS });
    await ann('POST', '/api/username', { username: 'ann' });
    const talk = (who, message, extra = {}) => who('POST', '/api/jarvis/chat', { message, tz: 'Europe/Amsterdam', ...extra });
    const status = async () => (await jo('GET', '/api/jarvis/status')).body;

    // only for admins: everyone else gets "not found" for the page and "no" from the api
    assert.equal((await ann('GET', '/jarvis/')).status, 404);
    assert.equal((await ann('GET', '/api/jarvis/status')).status, 403);
    assert.equal((await talk(ann, 'hi')).status, 403);
    const pageRes = await jo('GET', '/jarvis/');
    assert.equal(pageRes.status, 200);
    assert.match(pageRes.body, /js\/jarvis\.js/);
    assert.match(pageRes.headers.get('permissions-policy'), /microphone=\(self\)/);
    assert.ok((await jo('GET', '/api/apps-summary')).body.pages.includes('jarvis'));

    // without an AI service he says what to do
    let st = await status();
    assert.deepEqual([st.on, st.name, st.address, st.history, st.memories], [false, 'Jo', 'name', [], []]);
    const none = await talk(jo, 'hi');
    assert.equal(none.status, 409);
    assert.match(none.body.error, /Admin → AI/);
    assert.equal((await talk(jo, '   ')).status, 409); // (no service is checked first)

    // with Claude: he calls tools, then answers in words
    await jo('PUT', '/api/admin/ai', { apiKey: 'sk-ant-test-key-1234567890abcdefghij' });
    st = await status();
    assert.deepEqual([st.on, st.service, st.backups], [true, 'Claude', []]);
    assert.equal((await talk(jo, '   ')).status, 400);
    const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
    script = [{ text: 'On it.', calls: [['add_task', { text: 'Buy milk', due: tomorrow, starred: true }], ['get_tasks', {}], ['delete_everything', {}]] }, { text: 'Added, Jo. Milk tomorrow.' }];
    const r1 = await talk(jo, 'Remind me to buy milk tomorrow', { where: { lat: 52.07, lon: 5.62 } });
    assert.equal(r1.status, 200);
    assert.deepEqual([r1.body.reply, r1.body.service, r1.body.switched], ['Added, Jo. Milk tomorrow.', 'Claude', []]);
    assert.deepEqual(r1.body.used, ['add_task', 'get_tasks', 'delete_everything']);
    assert.deepEqual(r1.body.actions, [{ kind: 'task', text: 'Added task “Buy milk” (due tomorrow)', href: '/tasks/' }]);
    assert.ok((await jo('GET', '/api/apps/tasks')).body.items.some(t => t.text === 'Buy milk' && t.due === tomorrow && t.starred));
    // what Claude was sent: the tools, the persona, then the tool results for the right calls
    const first = asked[asked.length - 2].body;
    assert.equal(asked[asked.length - 2].url, '/v1/messages');
    assert.ok(first.tools.some(t => t.name === 'add_event' && t.input_schema.required.includes('date')));
    assert.ok(first.tools.some(t => t.name === 'remember'));
    assert.match(first.system, /Jarvis/);
    assert.match(first.system, /"Jo"/);
    assert.match(first.system, /Europe\/Amsterdam/);
    const second = asked[asked.length - 1].body;
    const back = second.messages[second.messages.length - 1].content;
    assert.equal(second.messages[second.messages.length - 2].role, 'assistant');
    assert.deepEqual(back.map(b => b.type), ['tool_result', 'tool_result', 'tool_result']);
    assert.equal(back[0].tool_use_id, second.messages[second.messages.length - 2].content.find(b => b.type === 'tool_use').id);
    assert.match(back[1].content, /Buy milk/);
    assert.equal(back[2].is_error, true); // there is no such tool
    assert.match(back[2].content, /No tool called delete_everything/);

    // his memory of the conversation is on the server (the same on every device)
    st = await status();
    assert.deepEqual(st.history.map(m => [m.role, m.content]), [['user', 'Remind me to buy milk tomorrow'], ['assistant', 'Added, Jo. Milk tomorrow.']]);
    assert.equal(st.history[1].via, 'Claude');
    assert.equal(st.history[1].actions[0].kind, 'task');

    // the way he addresses you (and that doesn't wipe his memory)
    assert.equal((await jo('PUT', '/api/jarvis/prefs', { address: 'your majesty' })).status, 400);
    assert.equal((await jo('PUT', '/api/jarvis/prefs', { address: 'sir' })).body.address, 'sir');
    st = await status();
    assert.deepEqual([st.address, st.history.length], ['sir', 2]);

    // remembering for later: kept, shown, in his instructions next time; forgotten when asked
    script = [{ calls: [['remember', { fact: 'Jo’s sister Ava has her birthday on 12 March' }]] }, { text: 'I’ll remember that, sir.' }];
    const r2 = await talk(jo, 'Remember that Ava’s birthday is on 12 March');
    assert.deepEqual(r2.body.actions, [{ kind: 'memory', text: 'Remembered: Jo’s sister Ava has her birthday on 12 March' }]);
    assert.equal(r2.body.memories.length, 1);
    script = [{ text: 'Very good, sir.' }];
    await talk(jo, 'Thanks');
    const sent = asked[asked.length - 1].body;
    assert.match(sent.system, /What you remember about them[\s\S]*Ava has her birthday on 12 March/);
    assert.match(sent.system, /"sir"/);
    // the conversation he's sent: from his memory, alternating, ending with what was just said
    assert.deepEqual(sent.messages.map(m => m.role), ['user', 'assistant', 'user', 'assistant', 'user']);
    assert.deepEqual([sent.messages[0].content, sent.messages[4].content], ['Remind me to buy milk tomorrow', 'Thanks']);
    script = [{ calls: [['forget', { about: 'ava birthday' }]] }, { text: 'Forgotten.' }];
    const r3 = await talk(jo, 'Forget Ava’s birthday');
    assert.deepEqual([r3.body.actions[0].kind, r3.body.memories], ['forget', []]);
    script = [{ calls: [['remember', { fact: 'Jo takes their coffee black' }], ['remember', { fact: 'Jo takes their coffee black' }]] }, { text: 'Noted.' }];
    const r4 = await talk(jo, 'I take my coffee black, remember that');
    assert.equal(r4.body.memories.length, 1); // the same thing only once
    const fact = (await status()).memories[0];
    assert.equal((await jo('DELETE', '/api/jarvis/memory/nope')).status, 404);
    assert.deepEqual((await jo('DELETE', `/api/jarvis/memory/${fact.id}`)).body.memories, []);

    // an event and ticking off a task
    script = [{ calls: [['add_event', { title: 'Dentist', date: tomorrow, time: '09:30', minutes: 45 }], ['complete_task', { text: 'milk' }]] }, { text: 'Done.' }];
    const r5 = await talk(jo, 'Dentist tomorrow at half nine, and I bought the milk');
    assert.deepEqual(r5.body.actions.map(a => a.kind), ['event', 'done']);
    const ev = (await jo('GET', '/api/apps/calendar')).body.items.find(e => e.title === 'Dentist');
    assert.deepEqual([ev.start, ev.end], [`${tomorrow}T09:30`, `${tomorrow}T10:15`]);
    assert.equal((await jo('GET', '/api/apps/tasks')).body.items.find(t => t.text === 'Buy milk').done, true);

    // over an OpenAI-style service (Gemini, Groq…): function calls, the same tools; Claude is now the backup
    await jo('PUT', '/api/admin/ai', { provider: 'custom', baseUrl: `http://127.0.0.1:${port}/v1` });
    await jo('PUT', '/api/admin/ai', { provider: 'custom', apiKey: 'local-key-abcdef', model: 'tool-model' });
    await jo('PUT', '/api/admin/ai', { provider: 'custom', active: true });
    st = await status();
    assert.deepEqual([st.service, st.backups], ['tool-model', ['Claude']]);
    assert.deepEqual([(await jo('GET', '/api/admin/ai')).body.fallback, (await jo('GET', '/api/admin/ai')).body.backups], [true, ['Claude']]);
    script = [{ calls: [['add_note', { title: 'Suit ideas', text: 'Make it red and gold.' }], ['check_mail', {}]] }, { text: 'Noted, sir. One unread email.' }];
    const r6 = await talk(jo, 'Note: make it red and gold. Any mail?');
    assert.deepEqual([r6.body.reply, r6.body.service], ['Noted, sir. One unread email.', 'tool-model']);
    assert.deepEqual(r6.body.actions.map(a => a.kind), ['note']);
    const o1 = asked[asked.length - 2];
    assert.equal(o1.url, '/v1/chat/completions');
    assert.deepEqual([o1.body.tool_choice, o1.body.messages[0].role, o1.body.tools[0].type], ['auto', 'system', 'function']);
    const o2 = asked[asked.length - 1].body.messages;
    assert.deepEqual(o2.slice(-3).map(m => m.role), ['assistant', 'tool', 'tool']);
    assert.equal(o2[o2.length - 2].tool_call_id, o2[o2.length - 3].tool_calls[0].id);
    assert.match(o2[o2.length - 1].content, /"unread":1/);
    assert.ok((await jo('GET', '/api/apps/notes')).body.items.some(n => n.title === 'Suit ideas'));

    // the service in use stops (free limit reached): the backup answers, with the whole conversation
    script = [{ status: 429, body: { error: { message: 'Rate limit reached' } } }, { text: 'Claude here, sir. Nothing lost.' }];
    const f1 = await talk(jo, 'Still there?');
    assert.equal(f1.status, 200);
    assert.deepEqual([f1.body.reply, f1.body.service, f1.body.switched.map(x => x.name)], ['Claude here, sir. Nothing lost.', 'Claude', ['tool-model']]);
    assert.match(f1.body.switched[0].error, /busy|limit/i);
    const c1 = asked[asked.length - 1];
    assert.equal(c1.url, '/v1/messages');
    assert.ok(c1.body.messages.some(m => m.content === 'Note: make it red and gold. Any mail?'));
    assert.equal(c1.body.messages[c1.body.messages.length - 1].content, 'Still there?');
    // while it rests, the backup goes first
    script = [{ text: 'Still me.' }];
    const f2 = await talk(jo, 'And now?');
    assert.deepEqual([f2.body.service, f2.body.switched, asked[asked.length - 1].url], ['Claude', [], '/v1/messages']);
    // stopping halfway (the key refused after a tool ran): the next one carries on, without doing it again
    script = [{ calls: [['add_task', { text: 'Water the plants' }]] }, { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }, { text: 'The plants are on your list, sir.' }];
    const f3 = await talk(jo, 'Remind me to water the plants');
    assert.deepEqual([f3.body.reply, f3.body.service, f3.body.switched.map(x => x.name)], ['The plants are on your list, sir.', 'tool-model', ['Claude']]);
    assert.match(f3.body.switched[0].error, /isn’t accepted/);
    assert.deepEqual(f3.body.actions.map(a => a.text), ['Added task “Water the plants”']);
    assert.equal((await jo('GET', '/api/apps/tasks')).body.items.filter(t => t.text === 'Water the plants').length, 1);
    const handed = asked[asked.length - 1].body.messages[0].content;
    assert.match(handed, /started on another AI service[\s\S]*add_task\(\{"text":"Water the plants"\}\)/);
    assert.equal((await status()).history.slice(-1)[0].via, 'tool-model');
    // every service down: a clear message, and nothing half-said is kept
    const kept = (await status()).history.length;
    script = [{ status: 503, body: { error: { message: 'down' } } }, { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } }];
    const f4 = await talk(jo, 'Hello?');
    assert.equal(f4.status, 502);
    assert.match(f4.body.error, /None of the AI services answered\. tool-model: .*Claude: /);
    assert.equal((await status()).history.length, kept);
    // backups off: only the service in use
    await jo('PUT', '/api/admin/ai', { fallback: false });
    assert.deepEqual([(await status()).backups, (await jo('GET', '/api/admin/ai')).body.fallback], [[], false]);

    // Gemini: tools without parameters go without; Groq: a broken tool call is asked again once
    const run = async name => ({ ok: name });
    const tools = require('../../src/routes/jarvis').TOOLS;
    script = [{ text: 'Hi.' }];
    await ai.converse({ provider: 'gemini', apiKey: 'k', baseURL: `http://127.0.0.1:${port}/v1`, model: 'gemini-x', system: 's', messages: [{ role: 'user', content: 'hi' }], tools, run });
    const gem = asked[asked.length - 1].body.tools;
    assert.equal(gem.find(t => t.function.name === 'get_time').function.parameters, undefined);
    assert.ok(gem.find(t => t.function.name === 'add_task').function.parameters);
    script = [{ status: 400, body: { error: { message: 'Failed to call a function', code: 'tool_use_failed' } } }, { calls: [['get_time', {}]] }, { text: 'It is late.' }];
    const g = await ai.converse({ provider: 'groq', apiKey: 'k', baseURL: `http://127.0.0.1:${port}/v1`, model: 'llama', system: 's', messages: [{ role: 'user', content: 'time?' }], tools, run });
    assert.deepEqual([g.text, g.used.map(u => u.name)], ['It is late.', ['get_time']]);

    // forgetting the conversation keeps what he was asked to remember
    script = [{ calls: [['remember', { fact: 'Jo likes jazz' }]] }, { text: 'Noted.' }];
    await talk(jo, 'I like jazz, remember it');
    await jo('DELETE', '/api/jarvis/history');
    st = await status();
    assert.deepEqual([st.history, st.memories.map(f => f.text)], [[], ['Jo likes jazz']]);

    // switched off in Admin → Apps: gone
    await jo('PUT', '/api/admin/apps', { off: ['jarvis'] });
    assert.equal((await jo('GET', '/api/jarvis/status')).status, 404);
    assert.equal((await jo('GET', '/jarvis/')).status, 404);
    app.close();
});
