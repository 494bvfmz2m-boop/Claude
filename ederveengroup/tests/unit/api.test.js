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

function fakeMail() {
    return {
        sent: [],
        verifyLogin: async (email, pw) => email === USER && pw === PASS,
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
