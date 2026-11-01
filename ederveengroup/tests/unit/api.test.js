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
    const { site } = createApp(loadConfig({ DATA_DIR: dataDir, ...env }), { mail, ...opts });
    const server = await new Promise(r => {
        const s = site.listen(0, () => r(s));
        s.unref(); // a failed assertion mustn't leave the test run hanging
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    // a tiny browser: keeps cookies per "device"
    const device = (ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36') => {
        const jar = new Map();
        return async (method, url, body, extra = {}) => {
            const headers = { 'User-Agent': ua, 'X-EG': '1', ...extra };
            const form = body instanceof FormData;
            if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
            if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
            const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : form ? body : JSON.stringify(body), redirect: 'manual' });
            for (const c of res.headers.getSetCookie()) {
                const [kv] = c.split(';');
                const i = kv.indexOf('=');
                if (/Max-Age=0/.test(c)) jar.delete(kv.slice(0, i));
                else jar.set(kv.slice(0, i), kv.slice(i + 1));
            }
            const type = res.headers.get('content-type') || '';
            return { status: res.status, headers: res.headers, body: type.includes('json') ? await res.json() : await res.text() };
        };
    };
    return { base, device, mail, dataDir, close: () => server.close() };
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
    assert.deepEqual(manifest.shortcuts.map(x => x.name), ['Mail', 'Profile']);
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
