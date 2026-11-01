'use strict';

// Files: your documents, photos and anything else, in folders, with a share link when you want one.
// What a file is (name, folder, size…) is kept with your account; its contents are stored by the
// backend, encrypted in the database.
//
//   GET    /api/files                    everything, plus how much room is used
//   POST   /api/files?name=&folder=&type=   upload one file (the body is the file, sent as application/octet-stream)
//   POST   /api/files/folders            { name, folder } a new folder
//   PATCH  /api/files/:id                { name?, folder? } rename or move
//   DELETE /api/files/:id                a file, or a folder with everything in it
//   GET    /api/files/:id/content        download (?inline=1 to look at pictures, PDFs, text, audio, video)
//   POST   /api/files/:id/share          { on } a public link, or none
//   GET    /s/<token>                    that public link (mounted on the site by src/app.js)

const crypto = require('crypto');
const express = require('express');
const { wrap, httpError, requireAuth } = require('../http');

const ID = /^[A-Za-z0-9_-]{6,40}$/;
const MAX_ITEMS = 5000;
// these are safe to show in the browser; everything else is a download
const VIEWABLE = /^(image\/(png|jpeg|gif|webp|avif|bmp)|application\/pdf|text\/plain|audio\/[\w.+-]+|video\/(mp4|webm|ogg|quicktime))$/;

const cleanName = v => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f/\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);
const cleanType = v => (/^[\w.+-]+\/[\w.+-]+$/.test(String(v || '').split(';')[0].trim()) ? String(v).split(';')[0].trim().toLowerCase() : 'application/octet-stream');
const newId = () => crypto.randomBytes(12).toString('base64url');

function disposition(kind, name) {
    const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

module.exports = function fileRoutes(ctx) {
    const { store, config, docs } = ctx;
    const { quota, maxFile } = config.files;
    const r = express.Router();
    r.use('/files', requireAuth);

    const load = email => store.getApp(email, 'files') || { items: {} };
    const save = (email, d) => store.setApp(email, 'files', d);
    const used = d => Object.values(d.items).reduce((n, f) => n + (f.size || 0), 0);
    const view = (id, f) => ({ id, kind: f.kind, name: f.name, folder: f.folder, size: f.size || 0, type: f.type || '', createdAt: f.createdAt, updatedAt: f.updatedAt, shared: !!f.share });
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
    const sharesDoc = () => docs.get('shares', () => ({ items: {} }));

    r.get('/files', (req, res) => {
        const d = load(req.session.email);
        res.json({ items: Object.entries(d.items).map(([id, f]) => view(id, f)), used: used(d), quota, maxFile });
    });

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

    const raw = express.raw({ type: () => true, limit: maxFile });
    r.post('/files', (req, res, next) => {
        // say "too big" before reading a byte of it
        const len = Number(req.get('content-length'));
        if (len > maxFile) return next(httpError(413, `Files can be up to ${Math.round(maxFile / 1048576)} MB`));
        raw(req, res, err => next(err && err.type === 'entity.too.large' ? httpError(413, `Files can be up to ${Math.round(maxFile / 1048576)} MB`) : err));
    }, wrap(async (req, res) => {
        const email = req.session.email;
        const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const name = cleanName(req.query.name);
        if (!name) throw httpError(400, 'The file needs a name');
        let d = load(email);
        if (Object.keys(d.items).length >= MAX_ITEMS) throw httpError(413, 'That’s a lot of files. Remove some first.');
        if (used(d) + buf.length > quota) throw httpError(413, `That doesn’t fit: you have ${Math.round(quota / 1048576)} MB of room. Remove some files first.`);
        folderOk(d, String(req.query.folder || ''));
        const blob = newId() + newId();
        await store.backend.putBlob(blob, buf);
        // the account may have changed while the file was stored
        d = load(email);
        const folder = folderOk(d, String(req.query.folder || ''));
        const id = newId();
        const now = Date.now();
        d.items[id] = { kind: 'file', name: freeName(d, folder, name), folder, size: buf.length, type: cleanType(req.query.type), blob, createdAt: now, updatedAt: now };
        save(email, d);
        res.json(view(id, d.items[id]));
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

    r.delete('/files/:id', wrap(async (req, res) => {
        const email = req.session.email;
        const d = load(email);
        itemOf(d, req.params.id);
        // the item, and for a folder everything inside it
        const gone = new Set([req.params.id]);
        for (let grew = true; grew; ) {
            grew = false;
            for (const [id, f] of Object.entries(d.items)) if (!gone.has(id) && gone.has(f.folder)) (gone.add(id), (grew = true));
        }
        const blobs = [];
        const shares = await sharesDoc();
        for (const id of gone) {
            const f = d.items[id];
            if (f.blob) blobs.push(f.blob);
            if (f.share) delete shares.items[f.share];
            delete d.items[id];
        }
        save(email, d);
        docs.save('shares');
        await Promise.all(blobs.map(b => store.backend.deleteBlob(b)));
        res.json({ ok: true, removed: gone.size });
    }));

    async function send(res, f, inline) {
        const buf = await store.backend.getBlob(f.blob);
        if (!buf) throw httpError(404, 'That file’s contents are missing');
        const show = inline && VIEWABLE.test(f.type);
        res.set({
            'Content-Type': show ? f.type + (f.type === 'text/plain' ? '; charset=utf-8' : '') : 'application/octet-stream',
            'Content-Disposition': disposition(show ? 'inline' : 'attachment', f.name),
            'Content-Length': buf.length,
            'Cache-Control': 'private, no-cache',
            'X-Content-Type-Options': 'nosniff'
        });
        // shown files can't run anything (PDFs need the browser's own viewer, which a sandbox blocks)
        if (show && f.type !== 'application/pdf') res.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'");
        res.end(buf);
    }

    r.get('/files/:id/content', wrap(async (req, res) => {
        const f = itemOf(load(req.session.email), req.params.id);
        if (f.kind !== 'file') throw httpError(400, 'That’s a folder');
        await send(res, f, req.query.inline === '1');
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
        await send(res, f, /^image\/|^application\/pdf$/.test(f.type) && req.query.download !== '1');
    });

    return r;
};
