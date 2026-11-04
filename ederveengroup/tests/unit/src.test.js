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
    assert.equal(loadConfig({ BASE_PATH: '/' }).baseUrl, '/mail/'); // the hub owns "/"
    assert.equal(loadConfig({}).db, null); // files unless a database is configured
    assert.equal(loadConfig({ DB_HOST: 'db.example', DB_NAME: 'eg', DB_USER: 'u', DB_PASSWORD: 'p!?' }).db.password, 'p!?');
    // one URL (Coolify's Internal URL), even with awkward characters in the password
    assert.deepEqual(loadConfig({ DATABASE_URL: 'mysql://eg_user:Pa55?w@rd!@k8x2q:3306/default' }).db, { host: 'k8x2q', port: 3306, database: 'default', user: 'eg_user', password: 'Pa55?w@rd!', ssl: '' });
    assert.throws(() => loadConfig({ DATABASE_URL: 'postgres://x@y/z' }), /mysql:\/\//);
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

// Ad blockers (EasyList, Fanboy) hide elements by name: a page part called "ad-main" or "ad-card"
// simply disappears for everyone using uBlock Origin, AdBlock or Edge's blocker. Admin did, once.
test('no page part has a name ad blockers hide', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', '..');
    const files = [];
    const walk = dir => {
        for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, f.name);
            if (f.isDirectory()) walk(p);
            else if (/\.(css|js|html)$/.test(f.name)) files.push(p);
        }
    };
    ['public/css', 'public/js', 'views', 'src'].forEach(d => walk(path.join(root, d)));
    // names that start like an advert, and a few exact names the common lists hide
    const risky = /(?<![\w-])(ad|ads|advert|advertisement|sponsor|sponsored|adbox|adbanner|banner-ad)[-_](?=[a-z0-9])/i;
    const exact = ['sharelink', 'share-buttons', 'social-share', 'cookie-banner', 'newsletter-popup', 'ad', 'ads', 'advert'];
    const bad = [];
    for (const f of files) {
        const src = fs.readFileSync(f, 'utf8');
        for (const m of src.matchAll(/(?:class(?:Name)?\s*=\s*["'`]|classList\.(?:add|toggle|remove)\(\s*['"]|id\s*=\s*["'`]|[.#])([\w -]+)/g)) {
            for (const name of m[1].split(/\s+/)) {
                if (risky.test(name) || exact.includes(name)) bad.push(`${path.relative(root, f)}: ${name}`);
            }
        }
    }
    assert.deepEqual([...new Set(bad)], []);
});

test('the Jarvis button is on every signed-in app page, and not on the sign-in, error or Jarvis pages', () => {
    const fs = require('fs');
    const path = require('path');
    const views = path.join(__dirname, '..', '..', 'views');
    const without = ['jarvis.html', 'login.html', 'notfound.html', 'request.html', 'respond.html', 'welcome.html'];
    for (const f of fs.readdirSync(views).filter(f => f.endsWith('.html'))) {
        const has = fs.readFileSync(path.join(views, f), 'utf8').includes('js/jarvis-dock.js');
        assert.equal(has, !without.includes(f), `${f} ${has ? 'shouldn’t' : 'should'} load the Jarvis button`);
    }
});

test('the sign-in headline letters have a class of their own (not the Chat app’s .ch layout)', () => {
    const fs = require('fs');
    const path = require('path');
    const fx = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'fx.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'app.css'), 'utf8');
    assert.match(fx, /s\.className = 'fx-ch'/);
    // the letters are only ever styled as part of an animated headline (.stagger, or one of its variants)
    const rules = [...css.matchAll(/^([^{}\n]*\.fx-ch\b[^{]*)\{/gm)].map(m => m[1].trim());
    assert.ok(rules.includes('.stagger .fx-ch'));
    for (const r of rules) assert.match(r, /^\.stagger(\[data-fx='\w+'\])? \.fx-ch$/, r);
});
