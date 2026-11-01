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

test('after signing in you only ever continue to our own pages', () => {
    const { safeNext } = require('../../src/routes-app');
    for (const ok of ['/', '/welcome', '/profile/', '/admin/', '/mail/inbox', '/mail/inbox/x7Kq2pW9aZc', '/mail/settings/devices']) assert.equal(safeNext(ok), ok, ok);
    for (const bad of ['', '//evil.com', 'https://evil.com', '/mail/../api', '/admin/../api', '/mail/inbox/short', 'javascript:alert(1)']) assert.equal(safeNext(bad), '/', bad);
});

test('username rules, reserved names and suggestions', async () => {
    const u = require('../../lib/usernames');
    for (const ok of ['ava', 'ava.chen', 'ava_chen-2', 'a12']) assert.equal(u.problem(ok), null, ok);
    for (const [bad, why] of [['ab', /3 characters/], ['1ava', /letter/], ['ava chen', /Only letters/], ['ava..chen', /double dots/], ['ava.', /dot at the end/], ['admin', /reserved/], ['mail', /reserved/], ['a'.repeat(31), /30/]])
        assert.match(u.problem(bad), why, bad);
    assert.equal(u.clean(' @Ava.Chen '), 'ava.chen');
    assert.equal(u.fromEmail('Ava.Chen+news@x.com'), 'ava.chen');
    assert.equal(u.fromEmail('42@x.com'), 'user');
    const alts = await u.alternatives('ava', async n => n !== 'ava.eg');
    assert.equal(alts.length, 3);
    assert.ok(alts.every(a => /^ava\d+$/.test(a)));
});

test('vault: files stored encrypted in pieces; any range reads back; uploads resume', async () => {
    const crypto = require('crypto');
    const { createVault, PIECE } = require('../../lib/vault');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eg-vault-'));
    const v = createVault({ dir, key: crypto.randomBytes(32) });
    const read = async (id, r) => Buffer.concat(await (await v.read(id, r)).toArray());
    for (const n of [0, 1, PIECE - 1, PIECE, PIECE + 1, 2 * PIECE + 12345]) {
        const data = crypto.randomBytes(n);
        const id = 'file-' + n + '-abcdefghijk';
        // arriving in odd-sized bits
        const w = await v.writer(id);
        for (let at = 0; at < n; at += 777777) await w.write(data.subarray(at, at + 777777));
        assert.equal(await w.end(), n);
        assert.equal(await v.size(id), n);
        assert.equal(Buffer.compare(await read(id), data), 0, `whole file of ${n}`);
        if (n > 10) {
            for (const [s, e] of [[0, 0], [5, 9], [n - 3, n - 1], [PIECE - 2, PIECE + 2], [1, n - 2]]) {
                if (s > e || e >= n) continue;
                assert.equal(Buffer.compare(await read(id, { start: s, end: e }), data.subarray(s, e + 1)), 0, `range ${s}-${e} of ${n}`);
            }
        }
    }
    // nothing readable on disk
    const marker = Buffer.from('VISIBLE-MARKER-'.repeat(100));
    await v.put('marker-abcdefghijklmn', marker);
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));
    assert.equal(walk(dir).some(f => fs.readFileSync(f).includes(Buffer.from('VISIBLE-MARKER'))), false);
    // an upload in two goes (whole pieces first), picked up by a new writer
    const big = crypto.randomBytes(2 * PIECE + 500);
    const w1 = await v.writer('resume-abcdefghijklmn');
    await w1.write(big.subarray(0, PIECE));
    assert.equal(await w1.pause(), PIECE);
    assert.equal(await v.partial('resume-abcdefghijklmn'), PIECE);
    const w2 = await v.writer('resume-abcdefghijklmn', { resume: true });
    assert.equal(w2.written, PIECE);
    await w2.write(big.subarray(PIECE));
    assert.equal(await w2.end(), big.length);
    assert.equal(Buffer.compare(await v.readAll('resume-abcdefghijklmn'), big), 0);
    // a changed byte is caught, not passed on
    const f = walk(dir).find(x => x.endsWith('resume-abcdefghijklmn'));
    const buf = fs.readFileSync(f);
    buf[40] ^= 1;
    fs.writeFileSync(f, buf);
    await assert.rejects(() => v.readAll('resume-abcdefghijklmn'), /damaged/);
    await v.remove('resume-abcdefghijklmn');
    assert.equal(await v.size('resume-abcdefghijklmn'), null);
    await assert.rejects(() => v.writer('../../etc/passwd'), /bad file id/);
    assert.ok((await v.disk()).free > 0);
});

test('shared calendars: Google and Magister style .ics, repeats, exceptions, time zones, links', () => {
    const { eventsBetween, normalizeUrl } = require('../../lib/ical');
    const ics = [
        'BEGIN:VCALENDAR', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN', 'VERSION:2.0', 'X-WR-CALNAME:Family', 'X-WR-TIMEZONE:Europe/Amsterdam',
        'BEGIN:VTIMEZONE', 'TZID:Europe/Amsterdam', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'DTSTART:19700329T020000', 'END:DAYLIGHT', 'END:VTIMEZONE',
        // weekly on Mondays at 19:00 Amsterdam time, across the clock change on 25 October
        'BEGIN:VEVENT', 'DTSTART;TZID=Europe/Amsterdam:20261005T190000', 'DTEND;TZID=Europe/Amsterdam:20261005T200000', 'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'EXDATE;TZID=Europe/Amsterdam:20261019T190000', 'UID:train@google.com', 'SUMMARY:Football training', 'LOCATION:Sportpark\\, Ede',
        'DESCRIPTION:Bring\\nboots', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'SUMMARY:Alarm, not an event', 'END:VALARM', 'END:VEVENT',
        // one occurrence moved to Tuesday 20:00
        'BEGIN:VEVENT', 'DTSTART;TZID=Europe/Amsterdam:20261027T200000', 'DTEND;TZID=Europe/Amsterdam:20261027T210000', 'RECURRENCE-ID;TZID=Europe/Amsterdam:20261026T190000', 'UID:train@google.com', 'SUMMARY:Football training (moved)', 'END:VEVENT',
        // all day, three days (DTEND is the day after)
        'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261224', 'DTEND;VALUE=DATE:20261227', 'UID:xmas', 'SUMMARY:Christmas at grandma’s', 'END:VEVENT',
        // second Tuesday of the month, until March
        'BEGIN:VEVENT', 'DTSTART;TZID=Europe/Amsterdam:20261013T090000', 'DURATION:PT1H30M', 'RRULE:FREQ=MONTHLY;BYDAY=2TU;UNTIL=20270301T000000Z', 'UID:club', 'SUMMARY:Book club', 'END:VEVENT',
        // yearly birthday, all day, from long ago
        'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:19900105', 'RRULE:FREQ=YEARLY', 'UID:bday', 'SUMMARY:Ava’s birthday', 'END:VEVENT',
        // cancelled
        'BEGIN:VEVENT', 'DTSTART:20261110T130000Z', 'DTEND:20261110T140000Z', 'STATUS:CANCELLED', 'UID:gone', 'SUMMARY:Called off', 'END:VEVENT',
        // Magister style: a lesson in UTC, long folded line
        'BEGIN:VEVENT', 'DTSTART:20261103T073000Z', 'DTEND:20261103T082000Z', 'UID:magister-1', 'SUMMARY:ne - Nederlands - ', ' DEV', 'LOCATION:B204', 'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    const { name, events } = eventsBetween(ics, Date.parse('2026-10-01T00:00:00Z'), Date.parse('2027-03-31T00:00:00Z'));
    assert.equal(name, 'Family');
    const by = t => events.filter(e => e.title === t);
    const training = by('Football training');
    // Oct 5 and 12 in summer time (17:00 UTC); Oct 19 skipped; Oct 26 moved; Nov 2 in winter time (18:00 UTC)
    assert.deepEqual(training.slice(0, 3).map(e => e.start), ['2026-10-05T17:00:00.000Z', '2026-10-12T17:00:00.000Z', '2026-11-02T18:00:00.000Z']);
    assert.equal(training[0].end, '2026-10-05T18:00:00.000Z');
    assert.equal(training[0].location, 'Sportpark, Ede');
    assert.equal(training[0].note, 'Bring\nboots');
    assert.deepEqual(by('Football training (moved)').map(e => e.start), ['2026-10-27T19:00:00.000Z']);
    assert.equal(by('Alarm, not an event').length, 0);
    assert.deepEqual(by('Christmas at grandma’s').map(e => [e.allDay, e.start, e.end]), [[true, '2026-12-24', '2026-12-26']]);
    assert.deepEqual(by('Book club').map(e => e.start.slice(0, 10)), ['2026-10-13', '2026-11-10', '2026-12-08', '2027-01-12', '2027-02-09']);
    assert.equal(by('Book club')[1].start, '2026-11-10T08:00:00.000Z'); // 09:00 winter time
    assert.equal(by('Book club')[0].end, '2026-10-13T08:30:00.000Z'); // 1 h 30 m
    assert.deepEqual(by('Ava’s birthday').map(e => e.start), ['2027-01-05']);
    assert.equal(by('Called off').length, 0);
    assert.deepEqual(by('ne - Nederlands - DEV').map(e => [e.start, e.end]), [['2026-11-03T07:30:00.000Z', '2026-11-03T08:20:00.000Z']]);
    // links people paste
    assert.equal(normalizeUrl('webcal://calendar.magister.net/ical/abc123.ics'), 'https://calendar.magister.net/ical/abc123.ics');
    assert.equal(normalizeUrl('https://calendar.google.com/calendar/embed?src=family%40group.calendar.google.com&ctz=Europe%2FAmsterdam'), 'https://calendar.google.com/calendar/ical/family%40group.calendar.google.com/public/basic.ics');
    assert.equal(normalizeUrl('https://calendar.google.com/calendar/u/0?cid=' + Buffer.from('jo@gmail.com').toString('base64')), 'https://calendar.google.com/calendar/ical/jo%40gmail.com/public/basic.ics');
    const secret = 'https://calendar.google.com/calendar/ical/jo%40gmail.com/private-abc/basic.ics';
    assert.equal(normalizeUrl(secret), secret);
    assert.throws(() => normalizeUrl('ftp://x/y.ics'), /https/);
    assert.throws(() => normalizeUrl('not a link'), /link/);
});

test('spreadsheet formulas: arithmetic, ranges, functions (also Dutch), errors, other sheets, copying', () => {
    const F = require('../../public/js/formula');
    const book = {
        sheets: [
            { name: 'Budget', cells: {
                A1: { v: 'Item' }, B1: { v: 'Cost' }, A2: { v: 'Rent' }, B2: { v: '950' }, A3: { v: 'Food' }, B3: { v: '320,50' }, A4: { v: 'Fun' }, B4: { v: '80' },
                B5: { v: '=SUM(B2:B4)' }, B6: { v: '=SOM(B2:B4)' }, B7: { v: '=AVERAGE(B2:B4)' }, B8: { v: '=ALS(B5>1000;"over";"ok")' }, B9: { v: '=B5/0' },
                B10: { v: '=IFERROR(B9,"none")' }, B11: { v: '=COUNTIF(B2:B4,">100")' }, B12: { v: '=SUMIF(A2:A4,"F*",B2:B4)' }, B13: { v: '=Totals!A1*2' },
                B14: { v: '=VLOOKUP("food",A2:B4,2,FALSE)' }, B15: { v: '=ROUND(2.5,0)' }, B16: { v: '=AFRONDEN(2,5;0)' }, B17: { v: '="Total: "&B5' },
                B18: { v: '=B19' }, B19: { v: '=B18' }, B20: { v: '=NOPE(1)' }, B21: { v: '=2^3+-1*4%' }, B22: { v: '=MAX(B2:B4)-MIN(B2:B4)' },
                B23: { v: '=IF(TRUE,1)' }, B24: { v: '=LEN(A2)&UPPER(A3)' }, B25: { v: "='Totals'!B1" }, B26: { v: '=DATE(2026,11,1)' }, B27: { v: '=YEAR(B26)' }
            } },
            { name: 'Totals', cells: { A1: { v: '=Budget!B5' }, B1: { v: 'yes' } } }
        ]
    };
    const e = F.evaluator(book);
    const g = a => e.get(0, a);
    assert.equal(g('B2'), 950);
    assert.equal(g('B3'), 320.5); // a decimal comma, as typed in the Netherlands
    assert.equal(g('B5'), 1350.5);
    assert.equal(g('B6'), 1350.5);
    assert.equal(Math.round(g('B7') * 100) / 100, 450.17);
    assert.equal(g('B8'), 'over');
    assert.equal(g('B9'), '#DIV/0!');
    assert.equal(g('B10'), 'none');
    assert.equal(g('B11'), 2);
    assert.equal(g('B12'), 400.5); // Food + Fun
    assert.equal(g('B13'), 2701);
    assert.equal(g('B14'), 320.5);
    assert.equal(g('B15'), 3);
    assert.equal(g('B16'), 3);
    assert.equal(g('B17'), 'Total: 1350.5');
    assert.equal(g('B18'), '#CIRC!');
    assert.equal(g('B20'), '#NAME?');
    assert.equal(g('B21'), 7.96);
    assert.equal(g('B22'), 870);
    assert.equal(g('B23'), 1);
    assert.equal(g('B24'), '4FOOD');
    assert.equal(g('B25'), 'yes');
    assert.equal(F.format(g('B26'), { fmt: 'date' }), '01-11-2026');
    assert.equal(g('B27'), 2026);
    assert.equal(F.format(1350.5, { fmt: 'currency', locale: 'en-US' }), '€ 1,350.50');
    assert.equal(F.format(0.256, { fmt: 'percent' }), '26%');
    // copying a formula moves its references, except the $ ones
    assert.equal(F.shift('=SUM(B2:B4)+$C$1+"A1"', 1, 1), '=SUM(C3:C5)+$C$1+"A1"');
    assert.equal(F.colName(28), 'AB');
    assert.equal(F.colNum('AB'), 28);
});
