'use strict';

// Docs and Slides: documents and presentations, private or shared with everyone on
// EderveenGroup (shared docs are the knowledge base: guides, procedures, how-tos).
//
//   GET    /api/docs?kind=doc|deck   the ones you can see: yours, and shared ones
//   POST   /api/docs                 { kind, title } a new one
//   GET    /api/docs/:id             with its content, and whether you may change it
//   PUT    /api/docs/:id             { title, body, version } save (409 if someone saved in between)
//   PATCH  /api/docs/:id             { share: private | view | edit } (the owner)
//   POST   /api/docs/:id/copy        a copy of your own
//   DELETE /api/docs/:id             (the owner, or an admin)
//
// Kept as shared documents (encrypted in the database): an index, and one per doc.

const crypto = require('crypto');
const express = require('express');
const { wrap, httpError, requireAuth } = require('../http');
const { sanitizeDocHtml } = require('../../lib/sanitize');

const KINDS = ['doc', 'deck', 'sheet'];
const F = require('../../public/js/formula');
const office = require('../../lib/office');
const HEX = /^#[0-9a-f]{6}$/i;
const FMTS = ['general', 'number', 'currency', 'percent', 'date', 'text'];
// one cell's look, checked
function cellStyle(s) {
    if (!s || typeof s !== 'object') return null;
    const o = {};
    for (const k of ['b', 'i', 'u', 'st', 'wrap']) if (s[k]) o[k] = true;
    if (HEX.test(s.color || '')) o.color = s.color.toLowerCase();
    if (HEX.test(s.fill || '')) o.fill = s.fill.toLowerCase();
    if (['left', 'center', 'right'].includes(s.align)) o.align = s.align;
    if (FMTS.includes(s.fmt) && s.fmt !== 'general') o.fmt = s.fmt;
    if (Number.isInteger(s.dec) && s.dec >= 0 && s.dec <= 6) o.dec = s.dec;
    return Object.keys(o).length ? o : null;
}
function cleanBook(b) {
    const names = new Set();
    const sheets = [].concat((b && b.sheets) || []).slice(0, 20).map((sh, i) => {
        let name = String((sh && sh.name) || '').replace(/[\u0000-\u001f\\/?*[\]:]/g, ' ').trim().slice(0, 31) || `Sheet${i + 1}`;
        while (names.has(name.toLowerCase())) name = `${name.slice(0, 27)} (${i + 1})`;
        names.add(name.toLowerCase());
        const cells = {};
        let n = 0;
        for (const [a, c] of Object.entries((sh && sh.cells) || {})) {
            if (++n > 60000) break;
            const p = F.parseAddr(a);
            if (!p || p.r > 10000 || p.c > 200 || !c || typeof c !== 'object') continue;
            const v = String(c.v == null ? '' : c.v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 5000);
            const st = cellStyle(c.s);
            if (v || st) cells[F.addr(p.c, p.r)] = { ...(v ? { v } : {}), ...(st ? { s: st } : {}) };
        }
        const cols = {};
        for (const [col, w] of Object.entries((sh && sh.cols) || {})) if (/^[A-Z]{1,3}$/.test(col) && Number(w) >= 24 && Number(w) <= 800) cols[col] = Math.round(Number(w));
        return { id: /^[A-Za-z0-9_-]{1,24}$/.test(String((sh && sh.id) || '')) ? sh.id : crypto.randomBytes(5).toString('base64url'), name, cells, cols, ...(sh && sh.freeze ? { freeze: true } : {}) };
    });
    if (!sheets.length) sheets.push({ id: 's1', name: 'Sheet1', cells: {}, cols: {} });
    return { sheets, active: Math.max(0, Math.min(sheets.length - 1, Number((b && b.active) || 0) || 0)) };
}
const SHARES = ['private', 'view', 'edit'];
const LAYOUTS = ['title', 'bullets', 'statement', 'image', 'columns'];
const THEMES = ['midnight', 'paper', 'sunset', 'ocean', 'forest'];
const MAX_BODY = 6 * 1024 * 1024;
const line = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, max);
const picture = v => (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(v || '')) && String(v).length < 2.5 * 1024 * 1024 ? String(v) : '');

function cleanBody(kind, b) {
    if (kind === 'sheet') return cleanBook(b);
    if (kind === 'doc') {
        const p = (b && b.page) || {};
        return {
            html: sanitizeDocHtml(String((b && b.html) || '')).slice(0, MAX_BODY),
            page: { size: p.size === 'Letter' ? 'Letter' : 'A4', orient: p.orient === 'landscape' ? 'landscape' : 'portrait', margins: ['narrow', 'wide'].includes(p.margins) ? p.margins : 'normal' }
        };
    }
    const slides = [].concat((b && b.slides) || []).slice(0, 200).map(s => ({
        id: /^[A-Za-z0-9_-]{4,24}$/.test(String(s.id || '')) ? s.id : crypto.randomBytes(6).toString('base64url'),
        layout: LAYOUTS.includes(s.layout) ? s.layout : 'bullets',
        title: text(s.title, 300),
        body: text(s.body, 4000),
        body2: text(s.body2, 4000),
        image: picture(s.image),
        notes: text(s.notes, 4000)
    }));
    return { theme: THEMES.includes(b && b.theme) ? b.theme : 'midnight', slides: slides.length ? slides : [{ id: crypto.randomBytes(6).toString('base64url'), layout: 'title', title: '', body: '', body2: '', image: '', notes: '' }] };
}

module.exports = function docRoutes(ctx) {
    const { store, docs } = ctx;
    const r = express.Router();
    r.use('/docs', requireAuth);
    const index = () => docs.get('docs-index', () => ({ items: {} }));
    const nameOf = email => store.getSettings(email).displayName || (store.getProfile(email) || {}).name || (store.usernameOf(email) ? `@${store.usernameOf(email)}` : email);
    const canSee = (m, email) => m.owner === email || m.share !== 'private';
    const canEdit = (m, email) => m.owner === email || m.share === 'edit';
    const view = (id, m, email) => ({ id, kind: m.kind, title: m.title, share: m.share, mine: m.owner === email, ownerName: m.ownerName, updatedAt: m.updatedAt, updatedBy: m.updatedBy, version: m.version, canEdit: canEdit(m, email), size: m.size || 0, cover: m.cover || '' });
    async function meta(req) {
        const all = await index();
        const m = all.items[req.params.id];
        if (!m || !canSee(m, req.session.email)) throw httpError(404, 'That one isn’t here any more');
        return { all, m };
    }

    r.get('/docs', wrap(async (req, res) => {
        const kind = KINDS.includes(req.query.kind) ? req.query.kind : 'doc';
        const email = req.session.email;
        const all = await index();
        res.json(Object.entries(all.items).filter(([, m]) => m.kind === kind && canSee(m, email)).map(([id, m]) => view(id, m, email)).sort((a, b) => b.updatedAt - a.updatedAt));
    }));

    r.post('/docs', wrap(async (req, res) => {
        const email = req.session.email;
        const kind = KINDS.includes(req.body.kind) ? req.body.kind : 'doc';
        const all = await index();
        if (Object.values(all.items).filter(m => m.owner === email).length >= 2000) throw httpError(413, 'That’s a lot of documents. Remove some first.');
        const id = crypto.randomBytes(9).toString('base64url');
        const now = Date.now();
        const body = cleanBody(kind, req.body.body || {});
        all.items[id] = { kind, title: line(req.body.title, 160), owner: email, ownerName: nameOf(email), share: 'private', createdAt: now, updatedAt: now, updatedBy: nameOf(email), version: 1, size: JSON.stringify(body).length };
        const d = await docs.get(`d:${id}`, () => ({}));
        Object.assign(d, body);
        docs.save(`d:${id}`);
        docs.save('docs-index');
        res.json({ ...view(id, all.items[id], email), body });
    }));

    r.get('/docs/:id', wrap(async (req, res) => {
        const { m } = await meta(req);
        const body = await docs.get(`d:${req.params.id}`, () => cleanBody(m.kind, {}));
        res.json({ ...view(req.params.id, m, req.session.email), body });
    }));

    r.put('/docs/:id', wrap(async (req, res) => {
        const email = req.session.email;
        const { m } = await meta(req);
        if (!canEdit(m, email)) throw httpError(403, 'Only the owner can change this one');
        // someone else saved in the meantime: don't overwrite their work
        if (Number(req.body.version) !== m.version && m.updatedBy !== nameOf(email)) return res.status(409).json({ error: `${m.updatedBy} changed this while you were editing. Reload to see their version.`, version: m.version });
        const body = cleanBody(m.kind, req.body.body || {});
        const size = JSON.stringify(body).length;
        if (size > MAX_BODY) throw httpError(413, 'That’s too big to save. Use smaller pictures.');
        const d = await docs.get(`d:${req.params.id}`, () => ({}));
        for (const k of Object.keys(d)) delete d[k];
        Object.assign(d, body);
        Object.assign(m, { title: 'title' in req.body ? line(req.body.title, 160) : m.title, updatedAt: Date.now(), updatedBy: nameOf(email), version: m.version + 1, size });
        // a small cover for the deck grid: the first slide's title and theme
        if (m.kind === 'deck') m.cover = `${body.theme}|${line(body.slides[0].title, 80)}`;
        docs.save(`d:${req.params.id}`);
        docs.save('docs-index');
        res.json(view(req.params.id, m, email));
    }));

    r.patch('/docs/:id', wrap(async (req, res) => {
        const { m } = await meta(req);
        if (m.owner !== req.session.email) throw httpError(403, 'Only the owner can share it');
        if (SHARES.includes(req.body.share)) m.share = req.body.share;
        docs.save('docs-index');
        res.json(view(req.params.id, m, req.session.email));
    }));

    r.post('/docs/:id/copy', wrap(async (req, res) => {
        const email = req.session.email;
        const { all, m } = await meta(req);
        const body = await docs.get(`d:${req.params.id}`, () => cleanBody(m.kind, {}));
        const id = crypto.randomBytes(9).toString('base64url');
        const now = Date.now();
        all.items[id] = { ...m, title: `${m.title || 'Untitled'} (copy)`, owner: email, ownerName: nameOf(email), share: 'private', createdAt: now, updatedAt: now, updatedBy: nameOf(email), version: 1 };
        const d = await docs.get(`d:${id}`, () => ({}));
        Object.assign(d, JSON.parse(JSON.stringify(body)));
        docs.save(`d:${id}`);
        docs.save('docs-index');
        res.json(view(id, all.items[id], email));
    }));

    /* ---------- exports in Microsoft's file types, and PDF ---------- */
    const FORMATS = { sheet: ['xlsx', 'csv', 'pdf'], doc: office.docToDocx ? ['docx', 'pdf'] : [], deck: office.deckToPptx ? ['pptx', 'pdf'] : [] };
    const TYPES = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', pdf: 'application/pdf', csv: 'text/csv; charset=utf-8' };
    r.get('/docs/:id/export', wrap(async (req, res) => {
        const { m } = await meta(req);
        const format = String(req.query.format || '');
        if (!(FORMATS[m.kind] || []).includes(format)) throw httpError(400, `That can be downloaded as ${(FORMATS[m.kind] || []).join(', ')}`);
        const body = await docs.get(`d:${req.params.id}`, () => cleanBody(m.kind, {}));
        const title = m.title || 'Untitled';
        // numbers in PDFs the way the reader writes them (1.457,50 in Dutch)
        let locale = String(req.get('accept-language') || 'en').split(',')[0].split(';')[0].trim();
        try {
            locale = Intl.NumberFormat.supportedLocalesOf([locale])[0] || 'en';
        } catch {
            locale = 'en';
        }
        const out = {
            sheet: { xlsx: () => office.sheetToXlsx(title, body), csv: () => office.sheetToCsv(body, Number(req.query.sheet) || body.active || 0), pdf: () => office.sheetToPdf(title, body, { locale }) },
            doc: { docx: () => office.docToDocx(title, body), pdf: () => office.docToPdf(title, body) },
            deck: { pptx: () => office.deckToPptx(title, body), pdf: () => office.deckToPdf(title, body) }
        }[m.kind][format];
        const file = await out();
        const name = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim().slice(0, 120) || 'Untitled';
        res.set({
            'Content-Type': TYPES[format],
            'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}.${format}"; filename*=UTF-8''${encodeURIComponent(name)}.${format}`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(file);
    }));

    /* ---------- open an Excel, CSV or Word file as a new spreadsheet or doc ---------- */
    r.post('/docs/import', express.raw({ type: () => true, limit: '25mb' }), wrap(async (req, res) => {
        const email = req.session.email;
        const name = String(req.query.name || 'Imported').slice(0, 160);
        if (!/\.(xlsx|csv|docx)$/i.test(name)) throw httpError(400, 'Open an Excel (.xlsx), CSV or Word (.docx) file');
        const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const kind = /\.docx$/i.test(name) ? 'doc' : 'sheet';
        let body;
        try {
            body = kind === 'doc' ? cleanBody('doc', { html: await office.importDocx(buf) }) : cleanBook(await office.importSheet(buf, name));
        } catch {
            throw httpError(400, kind === 'doc' ? 'That file couldn’t be read as a Word document' : 'That file couldn’t be read as a spreadsheet');
        }
        const all = await index();
        const id = crypto.randomBytes(9).toString('base64url');
        const now = Date.now();
        all.items[id] = { kind, title: line(name.replace(/\.(xlsx|csv|docx)$/i, ''), 160), owner: email, ownerName: nameOf(email), share: 'private', createdAt: now, updatedAt: now, updatedBy: nameOf(email), version: 1, size: JSON.stringify(body).length };
        const d = await docs.get(`d:${id}`, () => ({}));
        Object.assign(d, body);
        docs.save(`d:${id}`);
        docs.save('docs-index');
        res.json(view(id, all.items[id], email));
    }));

    r.delete('/docs/:id', wrap(async (req, res) => {
        const { all, m } = await meta(req);
        if (m.owner !== req.session.email && !ctx.isAdmin(req.session.email)) throw httpError(403, 'Only the owner can delete it');
        delete all.items[req.params.id];
        docs.save('docs-index');
        await docs.remove(`d:${req.params.id}`);
        res.json({ ok: true });
    }));

    // the dashboard's counts
    const before = ctx.summaryExtras;
    ctx.summaryExtras = async email => {
        const all = Object.values((await index()).items);
        return { ...(before ? await before(email) : {}), docs: all.filter(m => m.kind === 'doc' && canSee(m, email)).length, slides: all.filter(m => m.kind === 'deck' && canSee(m, email)).length, sheets: all.filter(m => m.kind === 'sheet' && canSee(m, email)).length };
    };
    return r;
};

module.exports.cleanBody = cleanBody;
