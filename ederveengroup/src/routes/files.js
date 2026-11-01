'use strict';

// Files (and Photos): your documents, photos and videos, in folders, with share links.
// What a file is (name, folder, size, when a photo was taken…) is kept with your account; its
// contents live in the vault (lib/vault.js): on disk, encrypted, read in any range.
//
//   GET    /api/files                         everything, plus room used and free
//   POST   /api/files?name=&folder=&type=     upload in one go (the body is the file)
//   POST   /api/files/uploads                 { name, size, type, folder, taken } start a big upload
//   GET    /api/files/uploads/:id             how far it got (to resume)
//   PUT    /api/files/uploads/:id?offset=     the next part (whole 4 MB pieces, except the last)
//   DELETE /api/files/uploads/:id             give up
//   POST   /api/files/folders                 { name, folder } a new folder
//   PATCH  /api/files/:id                     { name?, folder? } rename or move
//   DELETE /api/files/:id                     a file, or a folder with everything in it
//   GET    /api/files/:id/content             download; ?inline=1 to view; HTTP Range for video
//   GET    /api/files/:id/thumb               a small preview picture (PUT one: made by the browser)
//   POST   /api/files/:id/share               { on } a public link, or none
//   GET    /s/<token>                         that public link (mounted on the site by src/app.js)

const crypto = require('crypto');
const express = require('express');
const { wrap, httpError, requireAuth } = require('../http');

const ID = /^[A-Za-z0-9_-]{6,40}$/;
const MAX_ITEMS = 50000;
// these are safe to show in the browser; everything else is a download
const VIEWABLE = /^(image\/(png|jpeg|gif|webp|avif|bmp|heic|heif)|application\/pdf|text\/plain|audio\/[\w.+-]+|video\/(mp4|webm|ogg|quicktime))$/;
const MEDIA = /^(image|video)\//;

const cleanName = v => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f/\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
const cleanType = v => (/^[\w.+-]+\/[\w.+-]+$/.test(String(v || '').split(';')[0].trim()) ? String(v).split(';')[0].trim().toLowerCase() : 'application/octet-stream');
const newId = () => crypto.randomBytes(12).toString('base64url');
const mb = n => `${Math.round(n / 1048576)} MB`;

function disposition(kind, name) {
    const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** "bytes=a-b" -> { start, end } within size, or null for the whole thing, or false when unsatisfiable */
function parseRange(header, size) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
    if (!m || (m[1] === '' && m[2] === '')) return null;
    let start, end;
    if (m[1] === '') {
        start = Math.max(0, size - Number(m[2]));
        end = size - 1;
    } else {
        start = Number(m[1]);
        end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    return start <= end && start < size ? { start, end } : false;
}

module.exports = function fileRoutes(ctx) {
    const { store, config, docs, vault } = ctx;
    const { quota, maxFile } = config.files;
    const r = express.Router();
    r.use('/files', requireAuth);

    const load = email => store.getApp(email, 'files') || { items: {} };
    const save = (email, d) => store.setApp(email, 'files', d);
    const used = d => Object.values(d.items).reduce((n, f) => n + (f.size || 0), 0);
    const view = (id, f) => ({ id, kind: f.kind, name: f.name, folder: f.folder, size: f.size || 0, type: f.type || '', createdAt: f.createdAt, updatedAt: f.updatedAt, taken: f.taken || null, thumb: !!f.thumb, shared: !!f.share });
    const itemOf = (d, id) => {
        const f = ID.test(String(id)) && d.items[id];
        if (!f) throw httpError(404, 'That file isn’t here any more');
        return f;
    };
    const folderOk = (d, folder) => {
        if (!folder) return '';
        const f = d.items[folder];
        if (!f || f.kind !== 'folder') throw httpError(400, 'That folder isn’t here any more');
        return folder;
    };
    // "Report.pdf" becomes "Report (2).pdf" when the folder already has one
    const freeName = (d, folder, name, except) => {
        const taken = new Set(Object.entries(d.items).filter(([id, f]) => f.folder === folder && id !== except).map(([, f]) => f.name.toLowerCase()));
        if (!taken.has(name.toLowerCase())) return name;
        const dot = name.lastIndexOf('.');
        const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
        for (let i = 2; ; i++) if (!taken.has(`${base} (${i})${ext}`.toLowerCase())) return `${base} (${i})${ext}`;
    };
    const takenAt = v => (Number(v) > 0 && Number(v) < Date.now() + 864e5 ? Math.round(Number(v)) : null);
    const sharesDoc = () => docs.get('shares', () => ({ items: {} }));
    // will this many more bytes fit (the room per person, if set, and the disk)?
    async function roomFor(email, bytes) {
        if (maxFile && bytes > maxFile) throw httpError(413, `Files can be up to ${mb(maxFile)}`);
        if (quota && used(load(email)) + bytes > quota) throw httpError(413, `That doesn’t fit: you have ${mb(quota)} of room. Remove some files first.`);
        const disk = await vault.disk();
        if (disk && bytes > disk.free - 256 * 1048576) throw httpError(507, 'The server’s disk is full. Ask the admin to add room.');
    }
    // a new file in the account, its contents already in the vault
    function addFile(email, { name, folder, size, type, blob, taken }) {
        const d = load(email);
        if (Object.keys(d.items).length >= MAX_ITEMS) throw httpError(413, 'That’s a lot of files. Remove some first.');
        folder = folderOk(d, folder);
        const id = newId();
        const now = Date.now();
        d.items[id] = { kind: 'file', name: freeName(d, folder, name), folder, size, type, blob, store: 'vault', taken: takenAt(taken), createdAt: now, updatedAt: now };
        save(email, d);
        return view(id, d.items[id]);
    }
    // the contents of a file: from the vault, or (files from before) the database
    async function bytes(f, range) {
        if (f.store === 'vault') return vault.read(f.blob, range || {});
        const buf = await store.backend.getBlob(f.blob);
        if (!buf) throw httpError(404, 'That file’s contents are missing');
        const { Readable } = require('stream');
        return Readable.from([range ? buf.subarray(range.start, range.end + 1) : buf]);
    }
    async function dropContents(f) {
        if (f.store === 'vault') await vault.remove(f.blob);
        else if (f.blob) await store.backend.deleteBlob(f.blob).catch(() => {});
        if (f.thumb) await vault.remove(f.thumb);
    }

    r.get('/files', wrap(async (req, res) => {
        const d = load(req.session.email);
        res.json({ items: Object.entries(d.items).map(([id, f]) => view(id, f)), used: used(d), quota, maxFile, disk: await vault.disk(), piece: vault.PIECE });
    }));

    r.post('/files/folders', (req, res) => {
        const d = load(req.session.email);
        const name = cleanName(req.body.name);
        if (!name) throw httpError(400, 'Give the folder a name');
        if (Object.keys(d.items).length >= MAX_ITEMS) throw httpError(413, 'That’s a lot of files. Remove some first.');
        const folder = folderOk(d, String(req.body.folder || ''));
        const id = newId();
        const now = Date.now();
        d.items[id] = { kind: 'folder', name: freeName(d, folder, name), folder, createdAt: now, updatedAt: now };
        save(req.session.email, d);
        res.json(view(id, d.items[id]));
    });

    // pours a request body into a vault writer
    async function pour(req, w, limit) {
        for await (const chunk of req) {
            if (w.written + chunk.length > limit) throw httpError(413, 'That’s more than was announced');
            await w.write(chunk);
        }
    }

    /* ---------- upload in one go (small files, and older clients) ---------- */
    r.post('/files', wrap(async (req, res) => {
        const email = req.session.email;
        const name = cleanName(req.query.name);
        if (!name) throw httpError(400, 'The file needs a name');
        folderOk(load(email), String(req.query.folder || ''));
        const announced = Number(req.get('content-length')) || 0;
        await roomFor(email, announced);
        const blob = newId() + newId();
        const w = await vault.writer(blob);
        try {
            await pour(req, w, announced || maxFile || Infinity);
            const size = await w.end();
            res.json(addFile(email, { name, folder: String(req.query.folder || ''), size, type: cleanType(req.query.type), blob, taken: req.query.taken }));
        } catch (err) {
            await w.abort();
            await vault.remove(blob);
            throw err;
        }
    }));

    /* ---------- big uploads, in parts that can be resumed ---------- */
    const uploads = email => store.getApp(email, 'uploads') || { items: {} };
    const uploadOf = (email, id) => {
        const u = ID.test(String(id)) && uploads(email).items[id];
        if (!u) throw httpError(404, 'That upload isn’t going on any more; start it again');
        return u;
    };
    r.post('/files/uploads', wrap(async (req, res) => {
        const email = req.session.email;
        const name = cleanName(req.body.name);
        const size = Number(req.body.size);
        if (!name) throw httpError(400, 'The file needs a name');
        if (!Number.isSafeInteger(size) || size < 0) throw httpError(400, 'How big is the file?');
        folderOk(load(email), String(req.body.folder || ''));
        await roomFor(email, size);
        const u = uploads(email);
        // forget uploads nobody finished within a week
        for (const [k, x] of Object.entries(u.items)) if (Date.now() - x.at > 7 * 864e5) (delete u.items[k], vault.remove(x.blob));
        const id = newId();
        u.items[id] = { name, size, type: cleanType(req.body.type), folder: String(req.body.folder || ''), taken: takenAt(req.body.taken), blob: newId() + newId(), at: Date.now() };
        store.setApp(email, 'uploads', u);
        res.json({ id, offset: 0, piece: vault.PIECE });
    }));
    r.get('/files/uploads/:id', wrap(async (req, res) => {
        const u = uploadOf(req.session.email, req.params.id);
        res.json({ offset: await vault.partial(u.blob), size: u.size });
    }));
    r.put('/files/uploads/:id', wrap(async (req, res) => {
        const email = req.session.email;
        const u = uploadOf(email, req.params.id);
        const have = await vault.partial(u.blob);
        const offset = Number(req.query.offset);
        if (offset !== have) return res.status(409).json({ error: 'Out of step; carry on from here', offset: have });
        const w = await vault.writer(u.blob, { resume: have > 0 });
        try {
            await pour(req, w, u.size);
        } catch (err) {
            await w.abort().catch(() => {});
            throw err;
        }
        if (w.written < u.size) return res.json({ offset: await w.pause() });
        const size = await w.end();
        const list = uploads(email);
        delete list.items[req.params.id];
        store.setApp(email, 'uploads', list);
        res.json({ done: true, file: addFile(email, { ...u, size }) });
    }));
    r.delete('/files/uploads/:id', wrap(async (req, res) => {
        const email = req.session.email;
        const u = uploadOf(email, req.params.id);
        await vault.remove(u.blob);
        const list = uploads(email);
        delete list.items[req.params.id];
        store.setApp(email, 'uploads', list);
        res.json({ ok: true });
    }));

    r.patch('/files/:id', (req, res) => {
        const d = load(req.session.email);
        const f = itemOf(d, req.params.id);
        if ('folder' in req.body) {
            const to = folderOk(d, String(req.body.folder || ''));
            // a folder can't go inside itself
            for (let p = to; p; p = d.items[p].folder) if (p === req.params.id) throw httpError(400, 'A folder can’t go inside itself');
            f.folder = to;
        }
        const name = 'name' in req.body ? cleanName(req.body.name) : f.name;
        if (!name) throw httpError(400, 'Give it a name');
        f.name = freeName(d, f.folder, name, req.params.id);
        f.updatedAt = Date.now();
        save(req.session.email, d);
        res.json(view(req.params.id, f));
    });

    // a file, or a folder with everything in it; returns how many items went
    async function removeTree(email, rootId) {
        const d = load(email);
        itemOf(d, rootId);
        const gone = new Set([rootId]);
        for (let grew = true; grew; ) {
            grew = false;
            for (const [id, f] of Object.entries(d.items)) if (!gone.has(id) && gone.has(f.folder)) (gone.add(id), (grew = true));
        }
        const dropped = [];
        const shares = await sharesDoc();
        for (const id of gone) {
            const f = d.items[id];
            dropped.push(f);
            if (f.share) delete shares.items[f.share];
            delete d.items[id];
        }
        save(email, d);
        docs.save('shares');
        await Promise.all(dropped.map(dropContents));
        return gone.size;
    }
    r.delete('/files/:id', wrap(async (req, res) => res.json({ ok: true, removed: await removeTree(req.session.email, req.params.id) })));

    async function send(req, res, f, inline) {
        const show = inline && VIEWABLE.test(f.type);
        const size = f.size || 0;
        const range = parseRange(req.get('range'), size);
        if (range === false) return res.status(416).set('Content-Range', `bytes */${size}`).end();
        res.status(range ? 206 : 200).set({
            'Content-Type': show ? f.type + (f.type === 'text/plain' ? '; charset=utf-8' : '') : 'application/octet-stream',
            'Content-Disposition': disposition(show ? 'inline' : 'attachment', f.name),
            'Content-Length': range ? range.end - range.start + 1 : size,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'private, no-cache, no-transform', // never re-compressed on the way (ranges must stay exact)
            'X-Content-Type-Options': 'nosniff',
            ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${size}` } : {})
        });
        // shown files can't run anything (PDFs need the browser's own viewer, which a sandbox blocks)
        if (show && f.type !== 'application/pdf') res.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'");
        if (req.method === 'HEAD' || size === 0) return res.end();
        const stream = await bytes(f, range);
        stream.on('error', err => res.destroy(err));
        stream.pipe(res);
    }

    r.get('/files/:id/content', wrap(async (req, res) => {
        const f = itemOf(load(req.session.email), req.params.id);
        if (f.kind !== 'file') throw httpError(400, 'That’s a folder');
        await send(req, res, f, req.query.inline === '1');
    }));

    /* ---------- small previews for Photos and the grid, drawn by the browser ---------- */
    r.get('/files/:id/thumb', wrap(async (req, res) => {
        const f = itemOf(load(req.session.email), req.params.id);
        if (!f.thumb) throw httpError(404, 'No preview yet');
        res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
        res.end(await vault.readAll(f.thumb));
    }));
    r.put('/files/:id/thumb', express.raw({ type: () => true, limit: '400kb' }), wrap(async (req, res) => {
        const email = req.session.email;
        const d = load(email);
        const f = itemOf(d, req.params.id);
        const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        // a JPEG, nothing else
        if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8) throw httpError(400, 'Previews are JPEG pictures');
        const old = f.thumb;
        f.thumb = newId() + newId();
        await vault.put(f.thumb, buf);
        save(email, d);
        if (old) await vault.remove(old);
        res.json({ ok: true });
    }));

    r.post('/files/:id/share', wrap(async (req, res) => {
        const email = req.session.email;
        const d = load(email);
        const f = itemOf(d, req.params.id);
        if (f.kind !== 'file') throw httpError(400, 'Folders can’t be shared yet; share the files in it');
        const shares = await sharesDoc();
        if (req.body.on && !f.share) {
            f.share = crypto.randomBytes(16).toString('base64url');
            shares.items[f.share] = { email, id: req.params.id };
        } else if (!req.body.on && f.share) {
            delete shares.items[f.share];
            f.share = null;
        }
        save(email, d);
        docs.save('shares');
        res.json({ shared: !!f.share, url: f.share ? `${config.oauth.publicUrl || `${req.protocol}://${req.get('host')}`}/s/${f.share}` : null });
    }));

    // the public side of a share link
    ctx.sharedFile = wrap(async (req, res) => {
        const token = String(req.params.token || '');
        const s = /^[A-Za-z0-9_-]{22}$/.test(token) && (await sharesDoc()).items[token];
        const notThere = () => res.status(404).type('text/plain').send('This link doesn’t work any more. Ask whoever sent it for a new one.');
        if (!s || !(await store.ready(s.email))) return notThere();
        const f = load(s.email).items[s.id];
        if (!f || f.share !== token) return notThere();
        res.set('X-Robots-Tag', 'noindex');
        await send(req, res, f, MEDIA.test(f.type) || f.type === 'application/pdf' ? req.query.download !== '1' : false);
    });

    // for WebDAV and Photos: the same building blocks
    ctx.files = { load, save, view, folderOk, freeName, addFile, bytes, dropContents, removeTree, roomFor, cleanName, cleanType, send, newId, takenAt };
    return r;
};

module.exports.parseRange = parseRange;
