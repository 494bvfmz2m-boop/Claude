'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../../src/config');
const { parseAddresses, uidList } = require('../../src/http');
const { csrfGuard, createLimiter } = require('../../src/security');
const { describeDevice } = require('../../src/devices');
const { cleanSettingsPatch } = require('../../src/settings');

test('config normalises the base path', () => {
    assert.equal(loadConfig({}).baseUrl, '/mail/');
    assert.equal(loadConfig({ BASE_PATH: '/' }).baseUrl, '/');
    assert.equal(loadConfig({ BASE_PATH: 'webmail//' }).baseUrl, '/webmail/');
    assert.equal(loadConfig({ TRUST_PROXY: '1' }).trustProxy, 1);
    assert.equal(loadConfig({}).trustProxy, 'loopback');
});

test('address and uid parsing', () => {
    assert.deepEqual(parseAddresses('"Jo" <jo@x.com>, bad, b@y.org'), [{ name: 'Jo', address: 'jo@x.com' }, { name: '', address: 'b@y.org' }]);
    assert.deepEqual(uidList(['3', 'x', -1, 4.5, 7]), [3, 7]);
});

function call(mw, { method = 'POST', headers = {} } = {}) {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    let status = 200, nextCalled = false;
    const req = { method, get: k => lower[k.toLowerCase()] };
    const res = { status(s) { status = s; return this; }, json() { return this; } };
    mw(req, res, () => (nextCalled = true));
    return nextCalled ? 'next' : status;
}

test('csrf guard: needs the X-EG header and a same-host Origin', () => {
    assert.equal(call(csrfGuard, { method: 'GET' }), 'next');
    assert.equal(call(csrfGuard, { headers: { Host: 'mail.x' } }), 403);
    assert.equal(call(csrfGuard, { headers: { Host: 'mail.x', 'X-EG': '1' } }), 'next');
    assert.equal(call(csrfGuard, { headers: { Host: 'mail.x', 'X-EG': '1', Origin: 'https://mail.x' } }), 'next');
    assert.equal(call(csrfGuard, { headers: { Host: 'mail.x', 'X-EG': '1', Origin: 'https://evil.x' } }), 403);
    assert.equal(call(csrfGuard, { headers: { Host: 'mail.x', 'X-EG': '1', Origin: 'not a url' } }), 403);
});

test('limiter blocks after max and resets', () => {
    const l = createLimiter({ max: 2, windowMs: 60000 });
    l.hit('k');
    assert.equal(l.blocked('k'), false);
    l.hit('k');
    assert.equal(l.blocked('k'), true);
    l.reset('k');
    assert.equal(l.blocked('k'), false);
});

test('device names from user agents', () => {
    assert.equal(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1').label, 'Safari on iPhone');
    assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0').label, 'Edge on Windows');
    assert.equal(describeDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36').kind, 'phone');
    assert.equal(describeDevice('').label, 'Unknown device');
});

test('settings patches are validated', () => {
    const p = cleanSettingsPatch({
        theme: 'neon', accent: 'red', undoSendSeconds: 999, readingPane: 'left', conversations: 'yes',
        displayName: 'Jo "<x>"\n', signatures: [{ id: 'a b!', name: 'S', html: '<script>x</script><b>hi</b>' }]
    });
    assert.equal(p.theme, 'dark');
    assert.equal('accent' in p, false);
    assert.equal(p.undoSendSeconds, 30);
    assert.equal(p.readingPane, 'right');
    assert.equal(p.conversations, true);
    assert.equal(p.displayName, 'Jo x');
    assert.equal(p.signatures[0].id, 'ab');
    assert.equal(p.signatures[0].html, '<b>hi</b>');
});
