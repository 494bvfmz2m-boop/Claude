'use strict';

// Database storage, against a real MySQL / MariaDB. Runs when TEST_MYSQL is set, e.g.
//   TEST_MYSQL=mysql://user:pass@127.0.0.1:3306/eg_test npm test
// (the tables in that database are dropped and recreated).

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = process.env.TEST_MYSQL;
const skip = !url && 'set TEST_MYSQL to run the database tests';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eg-db-'));

function dbConfig() {
    const u = new URL(url);
    return { host: u.hostname, port: Number(u.port) || 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.slice(1) };
}
async function freshTables() {
    const mysql = require('mysql2/promise');
    const c = await mysql.createConnection(dbConfig());
    await c.query('DROP TABLE IF EXISTS eg_users, eg_photos, eg_registry, eg_blobs');
    await c.end();
}
async function raw(sql, args) {
    const mysql = require('mysql2/promise');
    const c = await mysql.createConnection(dbConfig());
    const [rows] = await c.execute(sql, args);
    await c.end();
    return rows;
}

test('accounts live in the database, private data encrypted at rest', { skip }, async () => {
    await freshTables();
    const { createMysqlBackend } = require('../../lib/db');
    const { createStore } = require('../../lib/store');
    const key = crypto.randomBytes(32);
    const backend = createMysqlBackend(dbConfig(), { key });
    await backend.init();
    const store = createStore(tmp(), { backend });
    await store.init();
    assert.equal(await store.ready('Jo@Example.com'), false);
    assert.throws(() => store.getSettings('nobody@example.com'), /before it was loaded/);
    store.updateSettings('jo@example.com', { theme: 'light' });
    store.setTwofa('jo@example.com', { secret: 'JBSWY3DPEHPK3PXP', since: 1 });
    await store.flush();
    const [row] = await raw('SELECT data FROM eg_users WHERE email = ?', ['jo@example.com']);
    assert.match(row.data, /^v1\./);
    assert.doesNotMatch(row.data, /JBSWY3DPEHPK3PXP|light/);
    // a fresh process reads it back
    const again = createStore(tmp(), { backend });
    assert.equal(await again.ready('jo@example.com'), true);
    assert.equal(again.getSettings('jo@example.com').theme, 'light');
    assert.equal(again.getTwofa('jo@example.com').secret, 'JBSWY3DPEHPK3PXP');
    // the wrong key can't read it
    const otherKey = createMysqlBackend(dbConfig(), { key: crypto.randomBytes(32) });
    await assert.rejects(createStore(tmp(), { backend: otherKey }).ready('jo@example.com'));
    await otherKey.close();
    await backend.close();
});

test('usernames are unique, even when two people grab one at the same moment', { skip }, async () => {
    await freshTables();
    const { createMysqlBackend } = require('../../lib/db');
    const { createStore } = require('../../lib/store');
    const backend = createMysqlBackend(dbConfig(), { key: crypto.randomBytes(32) });
    await backend.init();
    const store = createStore(tmp(), { backend });
    await Promise.all([store.ready('a@x.com'), store.ready('b@x.com')]);
    const [a, b] = await Promise.all([store.claimUsername('a@x.com', 'ava'), store.claimUsername('b@x.com', 'ava')]);
    assert.equal(a !== b, true);
    const winner = a ? 'a@x.com' : 'b@x.com';
    assert.equal(await store.emailForUsername('ava'), winner);
    assert.equal(await store.isUsernameFree('ava'), false);
    assert.equal(await store.isUsernameFree('ava', winner), true); // it's yours
    // renaming frees the old name
    assert.equal(await store.claimUsername(winner, 'ava.chen'), true);
    assert.equal(await store.isUsernameFree('ava'), true);
    store.setProfile(winner, { name: 'Ava', visible: true });
    await store.flush();
    const [row] = await raw('SELECT username, profile FROM eg_users WHERE email = ?', [winner]);
    assert.equal(row.username, 'ava.chen');
    assert.equal(JSON.parse(row.profile).name, 'Ava');
    await backend.close();
});

test('photos, the server list and old files move into the database', { skip }, async () => {
    await freshTables();
    const { createFileBackend, createMysqlBackend } = require('../../lib/db');
    const dir = tmp();
    // what an existing install has on disk
    const files = createFileBackend(dir);
    await files.saveUser('old@x.com', { data: { settings: { theme: 'light' }, signatures: [] }, username: null, profile: null });
    await files.setPhoto('old@x.com', Buffer.from('89504e470d0a1a0a', 'hex'));
    await files.saveRegistry({ requests: [], accounts: { '@x.com': { imap: { host: 'imap.x.com', port: 993, security: 'tls' } } } });
    const backend = createMysqlBackend(dbConfig(), { key: crypto.randomBytes(32), legacy: files });
    await backend.init();
    const { createStore } = require('../../lib/store');
    const store = createStore(dir, { backend });
    await store.init();
    assert.equal(store.servers.profileFor('jo@x.com').imap.host, 'imap.x.com');
    await store.ready('old@x.com');
    assert.equal(store.getSettings('old@x.com').theme, 'light');
    await store.flush();
    assert.equal((await raw('SELECT COUNT(*) AS n FROM eg_users WHERE email = ?', ['old@x.com']))[0].n, 1);
    const photo = await backend.getPhoto('old@x.com');
    assert.equal(photo.buf.toString('hex'), '89504e470d0a1a0a');
    assert.equal((await raw('SELECT COUNT(*) AS n FROM eg_photos'))[0].n, 1);
    store.servers.removeAccount('@x.com');
    await store.flush();
    const [reg] = await raw("SELECT doc FROM eg_registry WHERE name = 'servers'");
    assert.deepEqual(JSON.parse(reg.doc).accounts, {});
    await backend.close();
});

test('the whole app runs on the database and survives a restart', { skip }, async () => {
    await freshTables();
    const { loadConfig } = require('../../src/config');
    const { createApp } = require('../../src/app');
    const u = new URL(url);
    const env = { DATA_DIR: tmp(), DB_HOST: u.hostname, DB_PORT: u.port, DB_NAME: u.pathname.slice(1), DB_USER: decodeURIComponent(u.username), DB_PASSWORD: decodeURIComponent(u.password) };
    const mail = { verifyLogin: async () => true, closeClient: async () => {}, wakeSnoozes: async () => 0, useServers() {} };
    const boot = async () => {
        const app = createApp(loadConfig(env), { mail });
        await app.ready;
        const server = await new Promise(r => {
            const s = app.site.listen(0, () => r(s));
        });
        return { app, server, base: `http://127.0.0.1:${server.address().port}` };
    };
    const one = await boot();
    const login = await fetch(one.base + '/mail/api/login', { method: 'POST', headers: { 'X-EG': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'jo@example.com', password: 'pw' }) });
    const cookie = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    const h = { 'X-EG': '1', 'Content-Type': 'application/json', Cookie: cookie };
    await fetch(one.base + '/mail/api/settings', { method: 'PUT', headers: h, body: JSON.stringify({ accent: '#22c3ee' }) });
    await one.app.close();
    one.server.close();
    // same data folder (same secret), new process: still signed in, settings kept
    const two = await boot();
    const me = await (await fetch(two.base + '/mail/api/me', { headers: h })).json();
    assert.equal(me.email, 'jo@example.com');
    assert.equal(me.settings.accent, '#22c3ee');
    await two.app.close();
    two.server.close();
});

test('file contents and shared documents are stored encrypted, in pieces any MySQL accepts', { skip }, async () => {
    await freshTables();
    const { createMysqlBackend } = require('../../lib/db');
    const db = createMysqlBackend(dbConfig(), { key: crypto.randomBytes(32) });
    await db.init();
    // 2.5 MB: three pieces of at most 1 MB, none holding the plain bytes
    const marker = Buffer.from('PLAIN-TEXT-MARKER');
    const buf = Buffer.concat([marker, crypto.randomBytes(2.5 * 1024 * 1024)]);
    await db.putBlob('blob-abcdefghijklmnop', buf);
    const rows = await raw('SELECT part, LENGTH(bytes) AS n, bytes FROM eg_blobs WHERE id = ? ORDER BY part', ['blob-abcdefghijklmnop']);
    assert.deepEqual(rows.map(r => r.part), [0, 1, 2]);
    assert.ok(rows.every(r => r.n <= 1024 * 1024 + 28));
    assert.equal(rows.some(r => Buffer.from(r.bytes).includes(marker)), false);
    assert.equal(Buffer.compare(await db.getBlob('blob-abcdefghijklmnop'), buf), 0);
    // writing again replaces it; an empty file is fine too
    await db.putBlob('blob-abcdefghijklmnop', Buffer.from('short'));
    assert.equal((await db.getBlob('blob-abcdefghijklmnop')).toString(), 'short');
    await db.putBlob('blob-empty-0000000000', Buffer.alloc(0));
    assert.equal((await db.getBlob('blob-empty-0000000000')).length, 0);
    await db.deleteBlob('blob-abcdefghijklmnop');
    assert.equal(await db.getBlob('blob-abcdefghijklmnop'), null);
    await assert.rejects(() => db.getBlob('../etc/passwd'));
    // shared documents
    await db.saveDoc('chat:x1', { secret: 'meet at noon' });
    assert.deepEqual(await db.loadDoc('chat:x1'), { secret: 'meet at noon' });
    const [doc] = await raw("SELECT doc FROM eg_registry WHERE name = 'doc:chat:x1'");
    assert.equal(doc.doc.includes('noon'), false);
    await db.deleteDoc('chat:x1');
    assert.equal(await db.loadDoc('chat:x1'), null);
    await db.close();
});
