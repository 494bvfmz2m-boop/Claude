'use strict';

// Files as a network drive (WebDAV, RFC 4918) at /dav/, so computers and phones can use it
// like iCloud Drive:
//   Windows   File Explorer → This PC → Map network drive → https://yourdomain/dav/
//   Mac       Finder → Go → Connect to Server → https://yourdomain/dav/
//   iPhone    an app such as Documents or FE File Explorer; PhotoSync backs up the camera roll
//   Android   FolderSync, Solid Explorer, or PhotoSync
// It signs in with your username (or email) and an app password made in Files, never with your
// mail password, so it works for Microsoft and Google accounts too, and each device can be
// switched off on its own.
//
//   GET/POST/DELETE /api/app-passwords   your app passwords (made, listed, revoked)

const crypto = require('crypto');
const express = require('express');
const { wrap, httpError, requireAuth } = require('../http');
const { createLimiter } = require('../security');
const { takenFromJpeg } = require('../../lib/exif');

const MAX_APP_PASSWORDS = 20;
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', pdf: 'application/pdf', txt: 'text/plain', md: 'text/plain', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', zip: 'application/zip' };
const xmlEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

module.exports = function davRoutes(ctx) {
    const { store, sessions, config } = ctx;
    const key = sessions.deriveKey('app-passwords');
    const hash = pw => crypto.createHmac('sha256', key).update(String(pw).replace(/[\s-]/g, '').toLowerCase()).digest('base64url');
    const passwords = email => store.getApp(email, 'apppw') || { items: {} };

    /* ---------- app passwords (signed-in API) ---------- */
    const api = express.Router();
    api.use('/app-passwords', requireAuth);
    const listView = d => Object.entries(d.items).map(([id, p]) => ({ id, name: p.name, createdAt: p.createdAt, lastUsed: p.lastUsed || null, lastDevice: p.lastDevice || '' })).sort((a, b) => b.createdAt - a.createdAt);
    api.get('/app-passwords', (req, res) => {
        const origin = config.oauth.publicUrl || `${req.protocol}://${req.get('host')}`;
        res.json({ items: listView(passwords(req.session.email)), url: `${origin}/dav/`, username: store.usernameOf(req.session.email) || req.session.email });
    });
    api.post('/app-passwords', (req, res) => {
        const email = req.session.email;
        const name = String(req.body.name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60) || 'A device';
        const d = passwords(email);
        if (Object.keys(d.items).length >= MAX_APP_PASSWORDS) throw httpError(400, `You have ${MAX_APP_PASSWORDS} app passwords. Remove one you no longer use first.`);
        // 16 letters and digits, shown once: xxxx-xxxx-xxxx-xxxx (about 80 bits)
        const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
        const raw = [...crypto.randomBytes(16)].map(b => alphabet[b % alphabet.length]).join('');
        const password = raw.match(/.{4}/g).join('-');
        const id = crypto.randomBytes(8).toString('base64url');
        d.items[id] = { name, hash: hash(password), createdAt: Date.now() };
        store.setApp(email, 'apppw', d);
        ctx.audit && ctx.audit({ kind: 'admin', by: email, text: `Made an app password “${name}”` });
        res.json({ id, name, password });
    });
    api.delete('/app-passwords/:id', (req, res) => {
        const email = req.session.email;
        const d = passwords(email);
        if (!d.items[req.params.id]) throw httpError(404, 'Already removed');
        delete d.items[req.params.id];
        store.setApp(email, 'apppw', d);
        for (const [k, v] of seen) if (v.email === email && v.id === req.params.id) seen.delete(k);
        res.json({ ok: true });
    });

    /* ---------- signing in: Basic auth with an app password ---------- */
    const failures = createLimiter({ max: 20, windowMs: 15 * 60 * 1000 });
    const seen = new Map(); // a short memory of good sign-ins, so a busy sync isn't slowed down
    async function who(req) {
        const m = /^Basic\s+(.+)$/i.exec(req.get('authorization') || '');
        if (!m) return null;
        const text = Buffer.from(m[1], 'base64').toString('utf8');
        const at = text.indexOf(':');
        if (at < 1) return null;
        const user = text.slice(0, at).trim().toLowerCase().replace(/^@/, '');
        const pw = text.slice(at + 1);
        const memo = crypto.createHash('sha256').update(`${user}\0${pw}`).digest('base64url');
        const hit = seen.get(memo);
        if (hit && hit.until > Date.now()) return hit;
        if (failures.blocked(req.ip)) return 'busy';
        const email = user.includes('@') ? user : await store.emailForUsername(user);
        let found = null;
        if (email && (await store.ready(email)) && !(ctx.isBlocked && ctx.isBlocked(email))) {
            const h = Buffer.from(hash(pw));
            const d = passwords(email);
            for (const [id, p] of Object.entries(d.items)) {
                const stored = Buffer.from(p.hash);
                if (stored.length === h.length && crypto.timingSafeEqual(stored, h)) {
                    found = { email, id, until: Date.now() + 5 * 60 * 1000 };
                    // remember when it was last used (at most once a minute)
                    if (!p.lastUsed || Date.now() - p.lastUsed > 60000) {
                        p.lastUsed = Date.now();
                        p.lastDevice = require('../devices').describeDevice(String(req.get('user-agent') || '')).label;
                        store.setApp(email, 'apppw', d);
                    }
                }
            }
        }
        if (!found) {
            failures.hit(req.ip);
            if (email) store.logActivity(email, { ok: false, method: 'app-password', reason: 'wrong-password', ip: req.ip, ua: String(req.get('user-agent') || '') });
            return null;
        }
        if (seen.size > 2000) seen.clear();
        seen.set(memo, found);
        return found;
    }

    /* ---------- the drive ---------- */
    const F = () => ctx.files;
    const segmentsOf = p =>
        String(p)
            .split('/')
            .filter(Boolean)
            .map(s => {
                try {
                    return decodeURIComponent(s);
                } catch {
                    return s;
                }
            });
    // walk a path to an item: { id: '' } is the top (My files)
    function resolve(d, segs) {
        let id = '';
        for (const name of segs) {
            const lower = name.toLowerCase();
            const next = Object.entries(d.items).find(([, f]) => f.folder === id && f.name.toLowerCase() === lower);
            if (!next) return null;
            if (next[1].kind !== 'folder' && segs[segs.length - 1] !== name) return null;
            id = next[0];
        }
        return { id, item: id ? d.items[id] : { kind: 'folder', name: '', createdAt: 0, updatedAt: 0 } };
    }
    const hrefOf = (d, id) => {
        const parts = [];
        for (let p = id; p; p = d.items[p].folder) parts.unshift(encodeURIComponent(d.items[p].name));
        return '/dav/' + parts.join('/') + (id && d.items[id].kind !== 'folder' ? '' : parts.length ? '/' : '');
    };
    const typeFor = (name, given) => {
        const ext = (name.split('.').pop() || '').toLowerCase();
        if (TYPES[ext]) return TYPES[ext];
        const t = F().cleanType(given);
        return t;
    };
    async function room(email) {
        const disk = await ctx.vault.disk();
        const used = Object.values(F().load(email).items).reduce((n, f) => n + (f.size || 0), 0);
        const quota = config.files.quota;
        return { used, free: quota ? Math.max(0, quota - used) : disk ? disk.free : 0 };
    }
    function propXml(d, id, f, extra = '') {
        const folder = f.kind === 'folder';
        const modified = new Date(f.updatedAt || f.createdAt || Date.now()).toUTCString();
        return `<D:response><D:href>${xmlEsc(hrefOf(d, id))}</D:href><D:propstat><D:prop>
<D:displayname>${xmlEsc(f.name || 'My files')}</D:displayname>
<D:resourcetype>${folder ? '<D:collection/>' : ''}</D:resourcetype>
<D:creationdate>${new Date(f.createdAt || Date.now()).toISOString()}</D:creationdate>
<D:getlastmodified>${modified}</D:getlastmodified>
${folder ? '' : `<D:getcontentlength>${f.size || 0}</D:getcontentlength><D:getcontenttype>${xmlEsc(f.type || 'application/octet-stream')}</D:getcontenttype><D:getetag>"${xmlEsc((f.blob || id).slice(0, 24))}-${f.size || 0}"</D:getetag>`}
<D:supportedlock><D:lockentry><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype></D:lockentry></D:supportedlock>${extra}
</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`;
    }
    const multistatus = (res, body) => res.status(207).type('application/xml; charset=utf-8').send(`<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">${body}</D:multistatus>`);
    const destinationOf = req => {
        const dest = req.get('destination');
        if (!dest) return null;
        let p;
        try {
            p = new URL(dest, `${req.protocol}://${req.get('host')}`).pathname;
        } catch {
            return null;
        }
        return p.startsWith('/dav') ? segmentsOf(p.slice(4)) : null;
    };

    const handler = wrap(async (req, res) => {
        res.set({ DAV: '1, 2', 'MS-Author-Via': 'DAV' });
        if (req.method === 'OPTIONS') return res.set('Allow', 'OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK').status(200).end();
        const user = await who(req);
        if (user === 'busy') return res.status(429).set('Retry-After', '900').end();
        if (!user) return res.status(401).set('WWW-Authenticate', 'Basic realm="EderveenGroup Files", charset="UTF-8"').type('text/plain').send('Sign in with your EderveenGroup username and an app password (made in Files → Connect a device).');
        const email = user.email;
        const segs = segmentsOf(req.path);
        let d = F().load(email);
        const found = resolve(d, segs);

        switch (req.method) {
            case 'PROPFIND': {
                if (!found) return res.status(404).end();
                const depth = req.get('depth') === '0' ? 0 : 1;
                const { used, free } = await room(email);
                const quota = `<D:quota-used-bytes>${used}</D:quota-used-bytes><D:quota-available-bytes>${free}</D:quota-available-bytes>`;
                let out = propXml(d, found.id, found.item, found.id ? '' : quota);
                if (depth && found.item.kind === 'folder') for (const [id, f] of Object.entries(d.items)) if (f.folder === found.id) out += propXml(d, id, f);
                return multistatus(res, out);
            }
            case 'PROPPATCH': {
                // times and attributes clients like to set: accepted (a phone's "date taken" is kept)
                if (!found) return res.status(404).end();
                const body = await text(req);
                const m = /<[^>]*(?:getlastmodified|Win32LastModifiedTime)[^>]*>([^<]+)</i.exec(body);
                if (m && found.item.kind === 'file' && !found.item.taken && /^(image|video)\//.test(found.item.type)) {
                    const t = Date.parse(m[1]);
                    if (Number.isFinite(t)) {
                        found.item.taken = F().takenAt(t);
                        F().save(email, d);
                    }
                }
                // answer "done" for each property, named the way the client named it
                const ns = Object.fromEntries([...body.matchAll(/xmlns:(\w+)="([^"]*)"/g)].map(x => [x[1], x[2]]));
                const inside = [...body.matchAll(/<(?:\w+:)?prop>([\s\S]*?)<\/(?:\w+:)?prop>/gi)].map(x => x[1]).join('');
                const names = [...new Set([...inside.matchAll(/<((?:\w+:)?[\w-]+)[\s/>]/g)].map(x => x[1]))].filter(n => !n.includes(':') || ns[n.split(':')[0]]);
                const decl = Object.entries(ns).filter(([p]) => p !== 'D').map(([p, uri]) => ` xmlns:${p}="${xmlEsc(uri)}"`).join('');
                const items = names.map(n => (n.includes(':') ? `<${n}/>` : `<D:${n}/>`)).join('');
                return res.status(207).type('application/xml; charset=utf-8').send(`<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:"${decl}><D:response><D:href>${xmlEsc(hrefOf(d, found.id))}</D:href><D:propstat><D:prop>${items}</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>`);
            }
            case 'GET':
            case 'HEAD': {
                if (!found) return res.status(404).end();
                if (found.item.kind === 'folder') {
                    return res.type('text/plain').send('This is your EderveenGroup Files drive. Open it from Finder, File Explorer or a WebDAV app rather than a browser.');
                }
                return F().send(req, res, found.item, false);
            }
            case 'PUT': {
                const name = F().cleanName(segs[segs.length - 1] || '');
                const parent = resolve(d, segs.slice(0, -1));
                if (!name) return res.status(403).end();
                if (!parent || parent.item.kind !== 'folder') return res.status(409).type('text/plain').send('The folder isn’t there');
                if (found && found.item.kind === 'folder') return res.status(405).end();
                const announced = Number(req.get('content-length')) || 0;
                try {
                    await F().roomFor(email, announced);
                } catch (err) {
                    return res.status(err.status === 507 ? 507 : 413).type('text/plain').send(err.message);
                }
                const blob = F().newId() + F().newId();
                const w = await ctx.vault.writer(blob);
                let head = Buffer.alloc(0);
                try {
                    for await (const chunk of req) {
                        if (head.length < 256 * 1024) head = Buffer.concat([head, chunk.subarray(0, 256 * 1024 - head.length)]);
                        await w.write(chunk);
                    }
                    const size = await w.end();
                    const type = typeFor(name, req.get('content-type'));
                    d = F().load(email);
                    const now = resolve(d, segs);
                    if (now && now.item.kind === 'file') {
                        // replacing a file keeps its place (and share link); the old contents go
                        const old = { ...now.item };
                        Object.assign(now.item, { size, type, blob, store: 'vault', thumb: null, updatedAt: Date.now() });
                        F().save(email, d);
                        await F().dropContents(old);
                        return res.status(204).end();
                    }
                    F().addFile(email, { name, folder: parent.id, size, type, blob, taken: type === 'image/jpeg' ? takenFromJpeg(head) : null });
                    return res.status(201).end();
                } catch (err) {
                    await w.abort().catch(() => {});
                    throw err;
                }
            }
            case 'MKCOL': {
                if (found) return res.status(405).end();
                const parent = resolve(d, segs.slice(0, -1));
                const name = F().cleanName(segs[segs.length - 1] || '');
                if (!parent || parent.item.kind !== 'folder' || !name) return res.status(409).end();
                const id = F().newId();
                d.items[id] = { kind: 'folder', name, folder: parent.id, createdAt: Date.now(), updatedAt: Date.now() };
                F().save(email, d);
                return res.status(201).end();
            }
            case 'DELETE': {
                if (!found || !found.id) return res.status(found ? 403 : 404).end();
                await F().removeTree(email, found.id);
                return res.status(204).end();
            }
            case 'MOVE':
            case 'COPY': {
                if (!found || !found.id) return res.status(found ? 403 : 404).end();
                const to = destinationOf(req);
                if (!to || !to.length) return res.status(400).end();
                const parent = resolve(d, to.slice(0, -1));
                const name = F().cleanName(to[to.length - 1]);
                if (!parent || parent.item.kind !== 'folder' || !name) return res.status(409).end();
                for (let p = parent.id; p; p = d.items[p].folder) if (p === found.id) return res.status(403).end(); // not into itself
                const existing = resolve(d, to);
                if (existing && existing.id === found.id && req.method === 'MOVE') {
                    found.item.name = name; // only the letters' case changed
                    F().save(email, d);
                    return res.status(201).end();
                }
                if (existing) {
                    if (req.get('overwrite') === 'F') return res.status(412).end();
                    await F().removeTree(email, existing.id);
                    d = F().load(email);
                }
                if (req.method === 'MOVE') {
                    const item = d.items[found.id];
                    Object.assign(item, { name, folder: parent.id, updatedAt: Date.now() });
                    F().save(email, d);
                    return res.status(existing ? 204 : 201).end();
                }
                await copy(email, found.id, parent.id, name);
                return res.status(existing ? 204 : 201).end();
            }
            case 'LOCK': {
                // locks aren't enforced (one person's own files), but Macs and Office ask for them
                await text(req);
                const token = `opaquelocktoken:${crypto.randomUUID()}`;
                res.set('Lock-Token', `<${token}>`);
                return res.status(found ? 200 : 201).type('application/xml; charset=utf-8').send(`<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:"><D:lockdiscovery><D:activelock><D:locktype><D:write/></D:locktype><D:lockscope><D:exclusive/></D:lockscope><D:depth>0</D:depth><D:timeout>Second-3600</D:timeout><D:locktoken><D:href>${token}</D:href></D:locktoken></D:activelock></D:lockdiscovery></D:prop>`);
            }
            case 'UNLOCK':
                return res.status(204).end();
            default:
                return res.status(405).set('Allow', 'OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK').end();
        }
    });

    async function text(req) {
        let s = '';
        for await (const c of req) {
            s += c;
            if (s.length > 100000) break;
        }
        return s;
    }

    // a copy of a file (new contents) or a folder with everything in it
    async function copy(email, id, folder, name) {
        const d = F().load(email);
        const f = d.items[id];
        if (f.kind === 'folder') {
            const nid = F().newId();
            d.items[nid] = { kind: 'folder', name, folder, createdAt: Date.now(), updatedAt: Date.now() };
            F().save(email, d);
            for (const [cid, c] of Object.entries(d.items)) if (c.folder === id && cid !== nid) await copy(email, cid, nid, c.name);
            return;
        }
        await F().roomFor(email, f.size || 0);
        const blob = F().newId() + F().newId();
        const w = await ctx.vault.writer(blob);
        for await (const chunk of await F().bytes(f)) await w.write(chunk);
        const size = await w.end();
        F().addFile(email, { name, folder, size, type: f.type, blob, taken: f.taken });
    }

    return { api, handler };
};
