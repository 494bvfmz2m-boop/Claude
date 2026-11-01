'use strict';

// Sign in with Microsoft / Google, against a stand-in provider (OAUTH_DEV_ISSUER) that checks
// PKCE and issues tokens the way the real ones do. Mail is faked; the mailbox check records
// the token it was given.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const totp = require('../../lib/totp');
const { loadConfig } = require('../../src/config');
const { createApp } = require('../../src/app');
const { MSA_TENANT } = require('../../lib/oauth');

const b64url = s => Buffer.from(s).toString('base64url');
const jwt = claims => `${b64url(JSON.stringify({ alg: 'none' }))}.${b64url(JSON.stringify(claims))}.sig`;

// the stand-in for accounts.google.com / login.microsoftonline.com
async function fakeProvider() {
    const codes = new Map();
    const fake = { people: {}, refreshed: 0, revoked: false };
    const server = http.createServer(async (req, res) => {
        const u = new URL(req.url, 'http://x');
        const [, provider, step] = u.pathname.split('/');
        let body = '';
        for await (const chunk of req) body += chunk;
        const form = new URLSearchParams(body);
        const json = (status, data) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
        if (step !== 'token') return json(404, {});
        if (form.get('grant_type') === 'refresh_token') {
            if (fake.revoked) return json(400, { error: 'invalid_grant', error_description: 'revoked' });
            fake.refreshed++;
            return json(200, { access_token: `fresh-${fake.refreshed}`, expires_in: 3600 });
        }
        const c = codes.get(form.get('code'));
        if (!c) return json(400, { error: 'invalid_grant' });
        codes.delete(form.get('code'));
        const challenge = crypto.createHash('sha256').update(form.get('code_verifier') || '').digest('base64url');
        if (challenge !== c.challenge) return json(400, { error: 'invalid_grant', error_description: 'PKCE check failed' });
        if (form.get('client_secret') !== 'secret-' + provider) return json(401, { error: 'invalid_client' });
        const who = c.person;
        const claims = { iss: `${fake.base}/${provider}`, aud: 'client-' + provider, exp: Math.floor(Date.now() / 1000) + 600, nonce: c.nonce, name: who.name, ...who.claims };
        json(200, { access_token: `access-${who.email}`, refresh_token: `refresh-${who.email}`, expires_in: 3600, id_token: jwt(claims) });
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    fake.base = `http://127.0.0.1:${server.address().port}`;
    // what the provider's sign-in page does: the person approves, a code goes back to us
    fake.approve = (authUrl, person) => {
        const u = new URL(authUrl);
        const code = crypto.randomBytes(8).toString('hex');
        codes.set(code, { challenge: u.searchParams.get('code_challenge'), nonce: u.searchParams.get('nonce'), person });
        return { code, state: u.searchParams.get('state'), redirect: u.searchParams.get('redirect_uri'), scope: u.searchParams.get('scope'), method: u.searchParams.get('code_challenge_method') };
    };
    fake.close = () => server.close();
    return fake;
}

async function start(env = {}) {
    const provider = await fakeProvider();
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eg-oauth-'));
    const checked = [];
    const mail = {
        sent: [],
        verifyLogin: async a => (typeof a === 'object' && a.provider ? (checked.push(a), !provider.noImap) : false),
        closeClient: async () => {},
        listFolders: async () => [],
        async sendMessage(session, input) {
            this.sent.push({ session, input });
            return {};
        },
        wakeSnoozes: async () => 0,
        useServers() {},
        useOAuth(o) {
            this.oauth = o;
        },
        watchInbox: async () => () => {}
    };
    const app = createApp(
        loadConfig({
            DATA_DIR: dataDir,
            GOOGLE_CLIENT_ID: 'client-google', GOOGLE_CLIENT_SECRET: 'secret-google',
            MICROSOFT_CLIENT_ID: 'client-microsoft', MICROSOFT_CLIENT_SECRET: 'secret-microsoft',
            OAUTH_DEV_ISSUER: provider.base,
            ...env
        }),
        { mail }
    );
    await app.ready;
    const server = await new Promise(r => {
        const s = app.site.listen(0, () => r(s));
        s.unref();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = () => {
        const jar = new Map();
        return async (method, url, body) => {
            const headers = { 'X-EG': '1' };
            if (body !== undefined) headers['Content-Type'] = 'application/json';
            if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
            const res = await fetch(url.startsWith('http') ? url : base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
            for (const c of res.headers.getSetCookie()) {
                const [kv] = c.split(';');
                const i = kv.indexOf('=');
                if (/Max-Age=0/.test(c)) jar.delete(kv.slice(0, i));
                else jar.set(kv.slice(0, i), kv.slice(i + 1));
            }
            const type = res.headers.get('content-type') || '';
            return { status: res.status, location: res.headers.get('location'), body: type.includes('json') ? await res.json() : await res.text() };
        };
    };
    // a whole "Sign in with …": our redirect, the provider's page, back to our callback
    const signIn = async (b, id, person, next = '/') => {
        const go = await b('GET', `/auth/${id}?next=${encodeURIComponent(next)}`);
        assert.equal(go.status, 302);
        const a = provider.approve(go.location, person);
        assert.equal(a.method, 'S256');
        assert.equal(a.redirect, `${base}/auth/${id}/callback`);
        return { ...(await b('GET', `/auth/${id}/callback?code=${a.code}&state=${a.state}`)), scope: a.scope };
    };
    return { app, mail, provider, base, browser, signIn, checked, close: () => (server.close(), provider.close()) };
}

const ava = { email: 'ava@gmail.com', name: 'Ava Chen', claims: { email: 'Ava@gmail.com', email_verified: true } };

test('sign-in buttons only appear for providers that are set up', async () => {
    const t = await start({ MICROSOFT_CLIENT_ID: '' });
    assert.deepEqual((await t.browser()('GET', '/api/auth/providers')).body, [{ id: 'google', name: 'Google' }]);
    assert.match((await t.browser()('GET', '/auth/microsoft')).location, /oauth=off/);
    t.close();
});

test('Google: unknown accounts become a request; once approved they sign in without a password', async () => {
    const t = await start({ ADMIN_EMAILS: 'boss@gmail.com' });
    const b = t.browser();
    const first = await t.signIn(b, 'google', ava);
    assert.match(first.scope, /https:\/\/mail\.google\.com\//);
    assert.equal(first.location, '/login?oauth=pending&provider=google');
    assert.equal((await b('GET', '/api/username/check?u=x')).status, 401); // not signed in
    // the admin (signing in with Google too) approves
    const admin = t.browser();
    assert.equal((await t.signIn(admin, 'google', { email: 'boss@gmail.com', name: 'Boss', claims: { email: 'boss@gmail.com', email_verified: true } })).location, '/');
    const reqs = (await admin('GET', '/api/admin/requests')).body;
    assert.equal(reqs[0].email, 'ava@gmail.com');
    assert.equal(reqs[0].provider, 'google');
    const decided = (await admin('POST', `/api/admin/requests/${reqs[0].id}/accept`, { scope: 'address' })).body;
    assert.equal(decided.emailed, true);
    assert.match(t.mail.sent[0].input.html, /Sign in with Google/);
    assert.equal(t.mail.sent[0].session.provider, 'google'); // sent from the admin's own Gmail
    // now Ava gets in, straight to where she was going
    const again = await t.signIn(b, 'google', ava, '/mail/inbox');
    assert.equal(again.location, '/mail/inbox');
    const me = (await b('GET', '/mail/api/me')).body;
    assert.equal(me.email, 'ava@gmail.com');
    assert.equal(me.settings.displayName, 'Ava Chen');
    assert.equal(t.checked.at(-1).provider, 'google'); // the mailbox was checked with the token
    const tokens = t.app.store.getOAuth('ava@gmail.com');
    assert.equal(tokens.refreshToken, 'refresh-ava@gmail.com');
    t.close();
});

test('Microsoft: personal and work accounts get the right mail servers; anyone may sign in when allowed', async () => {
    const t = await start();
    const b = t.browser();
    await b; // (silence lint)
    // the admin opens sign-ins to everyone
    t.app.store.servers.updateSettings({ oauthPolicy: 'anyone' });
    const personal = await t.signIn(b, 'microsoft', { email: 'jo@outlook.com', name: 'Jo', claims: { preferred_username: 'Jo@Outlook.com', tid: MSA_TENANT } });
    assert.equal(personal.location, '/');
    assert.match(personal.scope, /outlook\.office\.com\/IMAP\.AccessAsUser\.All/);
    assert.match(personal.scope, /offline_access/);
    assert.equal(t.checked.at(-1).provider, 'microsoft');
    const work = await t.signIn(t.browser(), 'microsoft', { email: 'sam@contoso.com', name: 'Sam', claims: { email: 'sam@contoso.com', tid: '72f988bf-86f1-41af-91ab-2d7cd011db47' } });
    assert.equal(work.location, '/');
    assert.equal(t.checked.at(-1).provider, 'microsoft-work');
    const servers = t.app.ctx.oauth;
    assert.equal(servers.servers('microsoft').smtp.host, 'smtp-mail.outlook.com');
    assert.equal(servers.servers('microsoft-work').smtp.host, 'smtp.office365.com');
    assert.equal(servers.servers('google').imap.host, 'imap.gmail.com');
    t.close();
});

test('tampered or replayed sign-ins are refused', async () => {
    const t = await start({ ADMIN_EMAILS: 'ava@gmail.com' });
    const b = t.browser();
    const go = await b('GET', '/auth/google');
    const a = t.provider.approve(go.location, ava);
    // wrong state
    assert.match((await b('GET', `/auth/google/callback?code=${a.code}&state=nope`)).location, /oauth=expired/);
    // the cookie is single-use: even the right state is now refused
    assert.match((await b('GET', `/auth/google/callback?code=${a.code}&state=${a.state}`)).location, /oauth=expired/);
    // a callback without having started here (someone else's link)
    assert.match((await t.browser()('GET', `/auth/google/callback?code=x&state=y`)).location, /oauth=expired/);
    // the person cancelled at Google
    const go2 = await b('GET', '/auth/google');
    const s2 = new URL(go2.location).searchParams.get('state');
    assert.match((await b('GET', `/auth/google/callback?error=access_denied&state=${s2}`)).location, /oauth=cancelled/);
    // a next= that points elsewhere is ignored
    const res = await t.signIn(b, 'google', ava, 'https://evil.example');
    assert.equal(res.location, '/');
    // unverified Google addresses are refused
    assert.match((await t.signIn(t.browser(), 'google', { email: 'x@y.com', claims: { email: 'x@y.com', email_verified: false } })).location, /oauth=failed/);
    t.close();
});

test('mailboxes without IMAP get a clear explanation', async () => {
    const t = await start({ ADMIN_EMAILS: 'jo@outlook.com' });
    t.provider.noImap = true;
    const r = await t.signIn(t.browser(), 'microsoft', { email: 'jo@outlook.com', claims: { preferred_username: 'jo@outlook.com', tid: MSA_TENANT } });
    assert.equal(r.location, '/login?oauth=imap_off_personal&provider=microsoft');
    t.close();
});

test('two-step verification still applies after Microsoft / Google', async () => {
    const t = await start({ ADMIN_EMAILS: 'ava@gmail.com' });
    const b = t.browser();
    await t.signIn(b, 'google', ava);
    const setup = (await b('POST', '/mail/api/2fa/setup', {})).body;
    const secret = setup.secret.replace(/\s/g, '');
    await b('POST', '/mail/api/2fa/enable', { code: totp.hotp(secret, Math.floor(Date.now() / 30000)) });
    await b('POST', '/mail/api/logout', {});
    const r = await t.signIn(b, 'google', ava, '/profile/');
    assert.match(r.location, /^\/login\?next=%2Fprofile%2F#twofa=.+&email=ava%40gmail\.com$/);
    assert.equal((await b('GET', '/mail/api/me')).status, 401); // not in yet
    const ticket = decodeURIComponent(/#twofa=([^&]+)/.exec(r.location)[1]);
    // a code from the next 30-second window (the one used to turn 2FA on can't be replayed)
    const code = totp.hotp(secret, Math.floor(Date.now() / 30000) + 1);
    assert.equal((await b('POST', '/mail/api/login/2fa', { ticket, code })).status, 200);
    assert.equal((await b('GET', '/mail/api/me')).body.email, 'ava@gmail.com');
    t.close();
});

test('access tokens renew themselves; a revoked sign-in sends people back to sign in', async () => {
    const t = await start({ ADMIN_EMAILS: 'ava@gmail.com' });
    await t.signIn(t.browser(), 'google', ava);
    const cred = { email: 'ava@gmail.com', provider: 'google' };
    assert.equal(await t.mail.oauth.token(cred), 'access-ava@gmail.com'); // still fresh
    const store = t.app.store;
    store.setOAuth('ava@gmail.com', { ...store.getOAuth('ava@gmail.com'), expiresAt: Date.now() - 1000 });
    const [x, y] = await Promise.all([t.mail.oauth.token(cred), t.mail.oauth.token(cred)]);
    assert.equal(x, 'fresh-1');
    assert.equal(y, 'fresh-1'); // one renewal for both
    assert.equal(t.provider.refreshed, 1);
    assert.equal(store.getOAuth('ava@gmail.com').refreshToken, 'refresh-ava@gmail.com'); // kept
    store.setOAuth('ava@gmail.com', { ...store.getOAuth('ava@gmail.com'), expiresAt: 0 });
    t.provider.revoked = true;
    await assert.rejects(t.mail.oauth.token(cred), err => err.authenticationFailed === true);
    t.close();
});
