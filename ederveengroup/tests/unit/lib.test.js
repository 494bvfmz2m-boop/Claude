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

test('sessions: sealed cookie round-trips, tampering and revocation are rejected', () => {
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
    const run = c => {
        const r = { ip: '1.2.3.4', get: () => 'UA', headers: { cookie: c } };
        mw(r, fakeRes(r), () => {});
        return r.session;
    };
    assert.equal(run(cookie).email, 'a@x.com');
    assert.equal(run(cookie.slice(0, -3) + 'AAA'), null);
    store.sessions.revoke('a@x.com', s.sid);
    assert.equal(run(cookie), null);
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
