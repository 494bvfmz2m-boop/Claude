'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const totp = require('../../lib/totp');
const { sanitizeEmailHtml, sanitizeComposeHtml } = require('../../lib/sanitize');
const { brandDomain } = require('../../lib/avatars');
const { createStore } = require('../../lib/store');
const { createSessions, parseCookies } = require('../../lib/session');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eg-test-'));

test('totp matches the RFC 6238 test vectors', () => {
    const secret = totp.base32Encode(Buffer.from('12345678901234567890'));
    assert.equal(totp.hotp(secret, 1), '287082');
    assert.equal(totp.hotp(secret, Math.floor(1111111109 / 30)), '081804');
    assert.equal(totp.hotp(secret, Math.floor(1234567890 / 30)), '005924');
});

test('totp verifies the current code, tolerates one step of drift, rejects junk', () => {
    const s = totp.generateSecret();
    const now = Date.now();
    const step = Math.floor(now / 30000);
    assert.equal(totp.verify(s, totp.hotp(s, step), now), step);
    assert.equal(totp.verify(s, totp.hotp(s, step - 1), now), step - 1);
    assert.equal(totp.verify(s, totp.hotp(s, step - 3), now), null);
    assert.equal(totp.verify(s, 'abc123', now), null);
    assert.equal(totp.base32Decode(totp.base32Encode(Buffer.from('hello'))).toString(), 'hello');
});

test('incoming mail html loses scripts, handlers and javascript: links', () => {
    const out = sanitizeEmailHtml('<p onclick="x()">hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)><a href="https://a.com">a</a>');
    assert.doesNotMatch(out, /script|onclick|onerror|javascript:/i);
    assert.match(out, /target="_blank"/);
    assert.match(out, /rel="noopener noreferrer"/);
});

test('composed html drops <style> but keeps formatting', () => {
    const out = sanitizeComposeHtml('<style>body{}</style><b>bold</b><span style="color:red">x</span>');
    assert.doesNotMatch(out, /<style/);
    assert.match(out, /<b>bold<\/b>/);
    assert.match(out, /color:red/);
});

test('brandDomain finds a company domain and skips personal mailboxes', () => {
    assert.equal(brandDomain('noreply@github.com'), 'github.com');
    assert.equal(brandDomain('a@mail.stripe.com'), 'stripe.com');
    assert.equal(brandDomain('x@shop.co.uk'), 'shop.co.uk');
    assert.equal(brandDomain('me@gmail.com'), null);
    assert.equal(brandDomain('me@hotmail.nl'), null);
});

test('store: settings defaults, unknown keys ignored, persisted to disk', () => {
    const dir = tmp();
    const store = createStore(dir);
    assert.equal(store.getSettings('A@x.com').conversations, true);
    store.updateSettings('a@x.com', { theme: 'light', evil: 1 });
    const again = createStore(dir);
    assert.equal(again.getSettings('a@x.com').theme, 'light');
    assert.equal(again.getSettings('a@x.com').evil, undefined);
});

test('store: device sessions can be listed and revoked one by one', () => {
    const store = createStore(tmp());
    store.sessions.add('a@x.com', 's1', { ip: '1.1.1.1', ua: 'one' });
    store.sessions.add('a@x.com', 's2', { ip: '2.2.2.2', ua: 'two' });
    assert.equal(store.sessions.list('a@x.com').length, 2);
    assert.ok(store.sessions.revoke('a@x.com', 's1'));
    assert.equal(store.sessions.isActive('a@x.com', 's1'), false);
    assert.equal(store.sessions.isActive('a@x.com', 's2'), true);
    store.sessions.add('a@x.com', 's3', {});
    store.sessions.revokeAll('a@x.com', 's3');
    assert.deepEqual(store.sessions.list('a@x.com').map(s => s.sid), ['s3']);
});

test('store: failed sign-ins for unknown accounts are not recorded', () => {
    const dir = tmp();
    const store = createStore(dir);
    store.logActivity('ghost@x.com', { ok: false, method: 'password' });
    assert.equal(fs.readdirSync(path.join(dir, 'users')).length, 0);
    store.logActivity('real@x.com', { ok: true, method: 'password' });
    store.logActivity('real@x.com', { ok: false, method: 'password' });
    assert.equal(store.listActivity('real@x.com').length, 2);
});

test('store: snoozes come due once', () => {
    const store = createStore(tmp());
    store.addSnoozes('a@x.com', [{ messageId: '<1@x>', until: 1000, from: 'INBOX' }, { messageId: '<2@x>', until: Date.now() + 1e6, from: 'INBOX' }]);
    assert.equal(store.takeDueSnoozes('a@x.com').length, 1);
    assert.equal(store.takeDueSnoozes('a@x.com').length, 0);
    assert.equal(store.listSnoozes('a@x.com').length, 1);
});

test('parseCookies survives malformed values', () => {
    assert.deepEqual(parseCookies('a=1; b=%E0%A4%A; c=hello%20there'), { a: '1', c: 'hello there' });
});

function fakeRes(req) {
    const headers = [];
    return { req, append: (k, v) => headers.push(v), headers };
}

test('sessions: sealed cookie round-trips, tampering and revocation are rejected', async () => {
    const dir = tmp();
    const store = createStore(dir);
    const sessions = createSessions({ dataDir: dir, cookiePath: '/mail/', registry: store.sessions });
    const req = { ip: '1.2.3.4', get: () => 'UA', headers: {} };
    const res = fakeRes(req);
    const s = sessions.start(res, { email: 'a@x.com', password: 'pw', remember: true });
    const cookie = res.headers[0].split(';')[0];
    assert.match(res.headers[0], /HttpOnly/);
    assert.match(res.headers[0], /Path=\/mail\//);

    const mw = sessions.middleware();
    const run = async c => {
        const r = { ip: '1.2.3.4', get: () => 'UA', headers: { cookie: c } };
        await mw(r, fakeRes(r), () => {});
        return r.session;
    };
    assert.equal((await run(cookie)).email, 'a@x.com');
    assert.equal(await run(cookie.slice(0, -3) + 'AAA'), null);
    store.sessions.revoke('a@x.com', s.sid);
    assert.equal(await run(cookie), null);
});

test('sessions: sealed tickets expire and are bound to their purpose', () => {
    const dir = tmp();
    const sessions = createSessions({ dataDir: dir, registry: createStore(dir).sessions });
    const t = sessions.seal({ purpose: '2fa', email: 'a@x.com', exp: Date.now() + 1000 });
    assert.equal(sessions.open(t, '2fa').email, 'a@x.com');
    assert.equal(sessions.open(t, 'trust'), null);
    assert.equal(sessions.open(sessions.seal({ purpose: '2fa', exp: Date.now() - 1 }), '2fa'), null);
});

test('search box operators turn into IMAP criteria', () => {
    const { parseQuery } = require('../../lib/query');
    const q = parseQuery('from:marcus subject:"friday plans" is:unread has:attachment larger:2M before:2026-10-01 tacos');
    assert.equal(q.criteria.from, 'marcus');
    assert.equal(q.criteria.subject, 'friday plans');
    assert.equal(q.criteria.seen, false);
    assert.equal(q.criteria.larger, 2 * 1024 * 1024);
    assert.equal(q.criteria.before.getFullYear(), 2026);
    assert.deepEqual(q.criteria.header, { 'content-type': 'multipart/mixed' });
    assert.equal(q.text, 'tacos');
    assert.deepEqual(q.criteria.or, [{ subject: 'tacos' }, { from: 'tacos' }, { to: 'tacos' }, { body: 'tacos' }]);
    assert.deepEqual(q.used, ['from', 'subject', 'is', 'has', 'larger', 'before']);
});

test('unknown or malformed operators fall back to plain text search', () => {
    const { parseQuery } = require('../../lib/query');
    const q = parseQuery('is:purple after:yesterday http://x.com "exact phrase"');
    assert.equal(q.criteria.seen, undefined);
    assert.equal(q.criteria.since, undefined);
    assert.equal(q.text, 'is:purple after:yesterday http://x.com exact phrase');
    assert.deepEqual(parseQuery('').criteria, {});
    assert.equal(parseQuery('is:starred').criteria.flagged, true);
    assert.equal(parseQuery('smaller:200k').criteria.smaller, 200 * 1024);
});

test('embedded images are not counted as attachments', () => {
    const { inspectStructure } = require('../../lib/mail');
    const related = { childNodes: [{ type: 'text/html' }, { type: 'image/png', id: '<a@eg>', disposition: 'inline', dispositionParameters: { filename: 'image-1.png' } }] };
    assert.equal(inspectStructure(related).attachments, false);
    const mixed = { childNodes: [related, { type: 'application/pdf', disposition: 'attachment', dispositionParameters: { filename: 'a.pdf' } }] };
    assert.equal(inspectStructure(mixed).attachments, true);
    assert.equal(inspectStructure({ childNodes: [{ type: 'image/png', dispositionParameters: { filename: 'photo.png' } }] }).attachments, true);
});

test('conversation links are short, opaque, per account and folder-bound', () => {
    const { createLinks } = require('../../lib/links');
    const links = createLinks(Buffer.alloc(32, 7));
    const t = links.encode('jo@example.com', 'INBOX', 4242);
    assert.match(t, /^[A-Za-z0-9_-]{11}$/);
    assert.equal(links.decode('jo@example.com', 'INBOX', t), 4242);
    assert.equal(links.decode('JO@example.com', 'INBOX', t), 4242); // case-insensitive account
    assert.equal(links.decode('jo@example.com', 'Archive', t), null); // wrong folder
    assert.equal(links.decode('ava@example.com', 'INBOX', t), null); // someone else's link
    assert.notEqual(links.encode('ava@example.com', 'INBOX', 4242), t);
    assert.notEqual(links.encode('jo@example.com', 'INBOX', 4243).slice(0, 4), t.slice(0, 4)); // neighbours look unrelated
    const flipped = (t[0] === 'A' ? 'B' : 'A') + t.slice(1);
    assert.equal(links.decode('jo@example.com', 'INBOX', flipped), null); // tampering breaks it
    assert.equal(links.decode('jo@example.com', 'INBOX', '../../etc'), null);
    assert.match(links.folderId('jo@example.com', 'Projects/2026'), /^[A-Za-z0-9_-]{8}$/);
    // a few thousand uids never collide and always round-trip
    const seen = new Set();
    for (let uid = 1; uid < 3000; uid++) {
        const x = links.encode('jo@example.com', 'INBOX', uid);
        assert.equal(seen.has(x), false);
        seen.add(x);
        assert.equal(links.decode('jo@example.com', 'INBOX', x), uid);
    }
});

test('only real app pages count as in-app addresses', () => {
    const { APP_ROUTE } = require('../../src/routes-app');
    for (const ok of ['/inbox', '/inbox/', '/inbox/x7Kq2pW9aZc', '/f/AbCdEf12', '/f/AbCdEf12/x7Kq2pW9aZc', '/search/k7Qp2Xa9', '/settings', '/settings/devices', '/archive/x7Kq2pW9aZc'])
        assert.equal(APP_ROUTE.test(ok), true, ok);
    for (const bad of ['/', '/api/me', '//evil.com', '/inbox/../api', '/inbox/short', '/f/x', '/login', '/settings/../../x', '/inbox/x7Kq2pW9aZc/more', 'https://evil.com/inbox'])
        assert.equal(APP_ROUTE.test(bad), false, bad);
});

test('server requests only accept encrypted standard ports and real host names', () => {
    const s = require('../../lib/servers');
    const ok = s.cleanRequest({ name: 'Ava <x>', email: 'Ava@Studio.io', imap: { host: 'IMAP.studio.io', port: 993 }, smtp: { host: 'smtp.studio.io', port: '587' }, login: 'local' });
    assert.deepEqual(ok.imap, { host: 'imap.studio.io', port: 993, security: 'tls' });
    assert.deepEqual(ok.smtp, { host: 'smtp.studio.io', port: 587, security: 'starttls' });
    assert.equal(ok.name, 'Ava x');
    assert.equal(ok.email, 'ava@studio.io');
    assert.equal(ok.login, 'local');
    const base = { email: 'a@b.io', imap: { host: 'imap.b.io', port: 993 }, smtp: { host: 'smtp.b.io', port: 465 } };
    assert.throws(() => s.cleanRequest({ ...base, imap: { host: 'imap.b.io', port: 22 } }), /993 \(SSL\/TLS\) or 143/);
    assert.throws(() => s.cleanRequest({ ...base, smtp: { host: 'smtp.b.io', port: 25 } }), /465 \(SSL\/TLS\) or 587/);
    assert.throws(() => s.cleanRequest({ ...base, imap: { host: '10.0.0.5', port: 993 } }), /host name/);
    assert.throws(() => s.cleanRequest({ ...base, imap: { host: 'localhost', port: 993 } }), /host name/);
    assert.throws(() => s.cleanRequest({ ...base, imap: { host: 'imap.b.io', port: 993, security: 'none' } }), /encrypted/);
    assert.throws(() => s.cleanRequest({ ...base, email: 'nope' }), /full email/);
});

test('only public addresses count as mail servers', () => {
    const { isPublicIp } = require('../../lib/servers');
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '224.0.0.1'])
        assert.equal(isPublicIp(ip), false, ip);
    for (const ip of ['1.1.1.1', '142.250.1.1', '2606:4700::1111', '::ffff:8.8.8.8']) assert.equal(isPublicIp(ip), true, ip);
});

test('provider settings are read from Thunderbird autoconfig, preferring SSL/TLS', () => {
    const { parseAutoconfig } = require('../../lib/servers');
    const xml = `<clientConfig><emailProvider id="example.com">
      <incomingServer type="imap"><hostname>imap.example.com</hostname><port>143</port><socketType>STARTTLS</socketType><username>%EMAILADDRESS%</username></incomingServer>
      <incomingServer type="imap"><hostname>imap.example.com</hostname><port>993</port><socketType>SSL</socketType><username>%EMAILADDRESS%</username></incomingServer>
      <incomingServer type="pop3"><hostname>pop.example.com</hostname><port>995</port><socketType>SSL</socketType></incomingServer>
      <outgoingServer type="smtp"><hostname>smtp.example.com</hostname><port>25</port><socketType>plain</socketType></outgoingServer>
      <outgoingServer type="smtp"><hostname>smtp.example.com</hostname><port>587</port><socketType>STARTTLS</socketType><username>%EMAILLOCALPART%</username></outgoingServer>
    </emailProvider></clientConfig>`;
    assert.deepEqual(parseAutoconfig(xml), { imap: { host: 'imap.example.com', port: 993, security: 'tls' }, smtp: { host: 'smtp.example.com', port: 587, security: 'starttls' }, login: 'email' });
    assert.equal(parseAutoconfig('<clientConfig/>'), null);
});

test('accepted addresses connect to their own servers by checked address, others to the default', async () => {
    const mail = require('../../lib/mail');
    const profile = { imap: { host: 'localhost', port: 993, security: 'tls' }, smtp: { host: 'localhost', port: 587, security: 'starttls' }, login: 'local' };
    mail.useServers(email => (email.endsWith('@studio.io') ? profile : null), { allowPrivateHosts: true });
    const own = await mail.imapConfig('ava@studio.io', 'pw');
    assert.match(own.host, /^(127\.0\.0\.1|::1)$/); // connected by address...
    assert.equal(own.servername, 'localhost'); // ...but the certificate must match the name
    assert.deepEqual(own.auth, { user: 'ava', pass: 'pw' });
    const smtp = await mail.smtpConfig('ava@studio.io', 'pw');
    assert.equal(smtp.requireTLS, true);
    assert.equal(smtp.tls.servername, 'localhost');
    const def = await mail.imapConfig('jo@purely.example', 'pw');
    assert.equal(def.auth.user, 'jo@purely.example');
    assert.notEqual(def.host, own.host);
    // without the testing switch, private addresses are refused
    mail.useServers(() => profile);
    await assert.rejects(mail.imapConfig('ava@studio.io', 'pw'), /isn’t a public mail server/);
    mail.useServers(() => null);
});
