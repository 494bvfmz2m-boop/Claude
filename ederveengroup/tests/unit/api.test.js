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
        watchInbox: async () => () => {}
    };
}

async function start(env = {}) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eg-api-'));
    const mail = fakeMail();
    const { site } = createApp(loadConfig({ DATA_DIR: dataDir, ...env }), { mail });
    const server = await new Promise(r => {
        const s = site.listen(0, () => r(s));
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
    return { base, device, mail, close: () => server.close() };
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
    assert.match(landing.body, /Work in/);
    assert.match(landing.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(landing.headers.get('x-frame-options'), 'DENY');
    assert.equal((await d('GET', '/mail')).status, 301);
    assert.equal((await d('GET', '/mail/')).headers.get('location'), '/mail/login');
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
    const sw = await d('GET', '/mail/sw.js');
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
