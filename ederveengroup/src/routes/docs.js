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

const KINDS = ['doc', 'deck', 'sheet', 'form', 'board', 'wb', 'video'];
const forms = require('../../lib/forms');
const F = require('../../public/js/formula');
const office = require('../../lib/office');
const AI = require('../../lib/ai'); // the Video Editor's effect, transition and title lists
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
const KIT = require('../../public/js/slidekit');
const MAX_BODY = 6 * 1024 * 1024;
const line = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, max);
const picture = v => (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(v || '')) && String(v).length < 2.5 * 1024 * 1024 ? String(v) : '');

function cleanBody(kind, b) {
    if (kind === 'sheet') return cleanBook(b);
    if (kind === 'form') return forms.cleanForm(b);
    if (kind === 'board') return cleanBoard(b);
    if (kind === 'wb') return cleanWhiteboard(b);
    if (kind === 'video') return cleanVideo(b);
    if (kind === 'doc') {
        const p = (b && b.page) || {};
        return {
            html: sanitizeDocHtml(String((b && b.html) || '')).slice(0, MAX_BODY),
            page: { size: p.size === 'Letter' ? 'Letter' : 'A4', orient: p.orient === 'landscape' ? 'landscape' : 'portrait', margins: ['narrow', 'wide'].includes(p.margins) ? p.margins : 'normal' }
        };
    }
    const slides = [].concat((b && b.slides) || []).slice(0, 200).map(cleanSlide);
    return { theme: KIT.THEMES[b && b.theme] ? b.theme : 'midnight', slides: slides.length ? slides : [cleanSlide({ layout: 'title' })] };
}

/* ---------- Planner: a board of columns with cards ---------- */
const LABELS = ['green', 'yellow', 'orange', 'red', 'purple', 'blue'];
const BOARD_BGS = ['aurora', 'ocean', 'sunset', 'forest', 'berry', 'slate', 'plain'];
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/;
const shortId = v => (/^[A-Za-z0-9_-]{4,24}$/.test(String(v || '')) ? String(v) : crypto.randomBytes(5).toString('base64url'));
function cleanBoard(b) {
    b = b && typeof b === 'object' ? b : {};
    let cards = 0;
    const labels = {};
    for (const l of LABELS) labels[l] = line(b.labels && b.labels[l], 40);
    const cols = [].concat(b.cols || []).slice(0, 30).map(c => ({
        id: shortId(c && c.id),
        name: line(c && c.name, 80) || 'Untitled',
        cards: [].concat((c && c.cards) || [])
            .filter(x => x && typeof x === 'object' && cards++ < 1000)
            .map(x => ({
                id: shortId(x.id),
                title: line(x.title, 300) || 'Untitled card',
                desc: text(x.desc, 8000),
                due: /^\d{4}-\d{2}-\d{2}$/.test(String(x.due || '')) ? x.due : '',
                labels: [...new Set([].concat(x.labels || []).filter(l => LABELS.includes(l)))],
                check: [].concat(x.check || []).slice(0, 100).map(i => ({ id: shortId(i && i.id), t: line(i && i.t, 300), done: !!(i && i.done) })).filter(i => i.t),
                who: [...new Set([].concat(x.who || []).map(e => String(e).trim().toLowerCase()).filter(e => EMAIL.test(e)))].slice(0, 20),
                done: !!x.done,
                created: Number(x.created) > 0 ? Math.round(Number(x.created)) : Date.now()
            }))
    }));
    return { bg: BOARD_BGS.includes(b.bg) ? b.bg : 'aurora', labels, cols: cols.length ? cols : ['To do', 'Doing', 'Done'].map(name => ({ id: shortId(), name, cards: [] })) };
}

/* ---------- Whiteboard: strokes, shapes, text and sticky notes on an endless canvas ---------- */
const WB_KINDS = ['pen', 'marker', 'line', 'arrow', 'rect', 'ellipse', 'text', 'note'];
function cleanWhiteboard(b) {
    b = b && typeof b === 'object' ? b : {};
    const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.max(-1e6, Math.min(1e6, Math.round(Number(v) * 10) / 10)) : d);
    let points = 0;
    const items = [].concat(b.items || []).slice(0, 5000).map(it => {
        if (!it || typeof it !== 'object' || !WB_KINDS.includes(it.t)) return null;
        const o = { id: shortId(it.id), t: it.t, c: colour(it.c) || '#1f1f1f' };
        if (it.t === 'pen' || it.t === 'marker') {
            const pts = [].concat(it.p || []).slice(0, 20000);
            points += pts.length;
            if (points > 300000 || pts.length < 2) return null;
            o.p = pts.map(v => n(v));
            if (o.p.length % 2) o.p.pop();
            o.w = Math.max(1, Math.min(60, n(it.w, 3)));
            return o;
        }
        Object.assign(o, { x: n(it.x), y: n(it.y), w: n(it.w), h: n(it.h) });
        if (it.t === 'line' || it.t === 'arrow' || it.t === 'rect' || it.t === 'ellipse') o.s = Math.max(1, Math.min(30, n(it.s, 3)));
        if (it.t === 'rect' || it.t === 'ellipse') o.f = colour(it.f);
        if (it.t === 'text' || it.t === 'note') {
            o.text = text(it.text, 4000);
            o.size = Math.max(8, Math.min(200, n(it.size, it.t === 'note' ? 18 : 24)));
            if (!o.text.trim() && it.t === 'text') return null;
        }
        return o;
    }).filter(Boolean);
    return { bg: ['dots', 'grid', 'plain'].includes(b.bg) ? b.bg : 'dots', items };
}

/* ---------- Video Editor: a project (the footage stays in Files; this is the edit) ---------- */
const V = {
    aspects: ['16:9', '9:16', '1:1', '4:5'],
    bgs: ['blur', 'black', 'white'],
    filters: ['none', 'vivid', 'warm', 'cool', 'golden', 'mono', 'noir', 'sepia', 'vintage', 'fade', 'dramatic', 'cinematic', 'pastel', 'teal'],
    effects: AI.EFFECTS,
    transitions: AI.TRANSITIONS,
    styles: AI.TEXT_STYLES,
    anims: AI.TEXT_ANIMS,
    fonts: ['Geist', 'Serif', 'Impact', 'Rounded', 'Mono', 'Script'],
    adjust: ['exposure', 'contrast', 'highlights', 'shadows', 'saturation', 'vibrance', 'temperature', 'tint', 'fade', 'vignette', 'sharpen', 'blur', 'grain', 'glitch', 'pixelate', 'sepia', 'teal', 'invert']
};
// how long a project plays: its clips one after another, less the transitions' overlaps
function videoLength(b) {
    let end = 0;
    let at = 0;
    b.clips.forEach((c, i) => {
        const d = (c.out - c.in) / c.speed;
        end = at + d;
        const next = b.clips[i + 1];
        const tr = next && c.tr.type !== 'none' ? Math.min(c.tr.dur, d / 2, (next.out - next.in) / next.speed / 2) : 0;
        at = end - tr;
    });
    return end;
}
function cleanVideo(b) {
    b = b && typeof b === 'object' ? b : {};
    const t = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.round(Math.max(lo, Math.min(hi, Number(v))) * 1000) / 1000 : d);
    const pick = (v, list, d) => (list.includes(v) ? v : d);
    const media = [].concat(b.media || []).slice(0, 300).filter(m => m && typeof m === 'object').map(m => ({
        id: shortId(m.id),
        file: /^[A-Za-z0-9_-]{6,40}$/.test(String(m.file || '')) ? m.file : '',
        name: line(m.name, 160),
        kind: ['video', 'image', 'audio'].includes(m.kind) ? m.kind : 'video',
        dur: t(m.dur, 0, 6 * 3600, 0),
        w: Math.round(t(m.w, 0, 20000, 0)),
        h: Math.round(t(m.h, 0, 20000, 0))
    }));
    const ids = new Set(media.map(m => m.id));
    const adjust = a => {
        const o = {};
        for (const k of V.adjust) if (a && Number(a[k])) o[k] = t(a[k], -100, 100, 0);
        return o;
    };
    const clips = [].concat(b.clips || []).slice(0, 500).filter(c => c && ids.has(c.m)).map(c => {
        const inn = t(c.in, 0, 6 * 3600, 0);
        return {
            id: shortId(c.id),
            m: c.m,
            in: inn,
            out: t(c.out, inn + 0.05, 6 * 3600, inn + 3),
            speed: t(c.speed, 0.25, 4, 1),
            vol: t(c.vol, 0, 200, 100),
            filter: pick(c.filter, V.filters, 'none'),
            strength: t(c.strength, 0, 100, 100),
            adjust: adjust(c.adjust),
            effect: pick(c.effect, V.effects, 'none'),
            fit: c.fit === 'contain' ? 'contain' : 'cover',
            tr: { type: pick(c.tr && c.tr.type, V.transitions, 'none'), dur: t(c.tr && c.tr.dur, 0.1, 3, 0.5) },
            ...(t(c.fadeIn, 0, 10, 0) ? { fadeIn: t(c.fadeIn, 0, 10, 0) } : {}),
            ...(t(c.fadeOut, 0, 10, 0) ? { fadeOut: t(c.fadeOut, 0, 10, 0) } : {}),
            ...(c.freeze === true ? { freeze: true } : {}),
            ...(c.tf && typeof c.tf === 'object'
                ? { tf: { scale: t(c.tf.scale, 10, 400, 100), x: t(c.tf.x, -100, 100, 0), y: t(c.tf.y, -100, 100, 0), rot: t(c.tf.rot, -180, 180, 0), quarter: Math.round(t(c.tf.quarter, 0, 3, 0)), flipH: c.tf.flipH === true, flipV: c.tf.flipV === true } }
                : {})
        };
    });
    const texts = [].concat(b.texts || []).slice(0, 300).filter(x => x && typeof x === 'object').map(x => ({
        id: shortId(x.id),
        text: text(x.text, 400).trim() || 'Text',
        start: t(x.start, 0, 6 * 3600, 0),
        dur: t(x.dur, 0.2, 3600, 3),
        x: t(x.x, 0, 1, 0.5),
        y: t(x.y, 0, 1, 0.8),
        size: t(x.size, 1, 40, 6),
        color: colour(x.color) || '#ffffff',
        font: pick(x.font, V.fonts, 'Geist'),
        style: pick(x.style, V.styles, 'shadow'),
        anim: pick(x.anim, V.anims, 'fade')
    }));
    const audio = [].concat(b.audio || []).slice(0, 50).filter(a => a && ids.has(a.m)).map(a => {
        const inn = t(a.in, 0, 6 * 3600, 0);
        return { id: shortId(a.id), m: a.m, start: t(a.start, 0, 6 * 3600, 0), in: inn, out: t(a.out, inn + 0.1, 6 * 3600, inn + 10), vol: t(a.vol, 0, 200, 100), fadeIn: t(a.fadeIn, 0, 10, 0), fadeOut: t(a.fadeOut, 0, 10, 0) };
    });
    return { aspect: pick(b.aspect, V.aspects, '16:9'), bg: colour(b.bg) || pick(b.bg, V.bgs, 'blur'), media, clips, texts, audio };
}

// a project's card in the gallery: its shape, the first footage's picture and its length
const videoCover = body => `${body.aspect}|${(body.media.find(x => x.kind !== 'audio' && x.file) || {}).file || ''}|${Math.round(videoLength(body))}`;

/* ---------- a slide: its layout's text, and the boxes, shapes and pictures put on it ---------- */
const colour = v => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : '');
const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.max(lo, Math.min(hi, Math.round(Number(v) * 100) / 100)) : d);
const ALIGN = ['left', 'center', 'right'];
const VALIGN = ['top', 'middle', 'bottom'];
function cleanLook(f) {
    const o = {};
    if (!f || typeof f !== 'object') return o;
    if (KIT.FONTS.includes(f.font)) o.font = f.font;
    if (f.size != null && f.size !== '') o.size = num(f.size, 6, 200, 18);
    for (const k of ['b', 'i', 'u', 'nob']) if (f[k]) o[k] = true;
    if (colour(f.color)) o.color = colour(f.color);
    if (ALIGN.includes(f.align)) o.align = f.align;
    return o;
}
function cleanObject(o) {
    const t = o.t === 'text' || o.t === 'img' || KIT.SHAPES[o.t] ? o.t : 'text';
    const out = {
        id: /^[A-Za-z0-9_-]{4,24}$/.test(String(o.id || '')) ? o.id : crypto.randomBytes(5).toString('base64url'),
        t,
        x: num(o.x, -100, 200, 30),
        y: num(o.y, -100, 200, 30),
        w: num(o.w, 0.5, 300, 40),
        h: num(o.h, 0.5, 300, 20),
        ...cleanLook(o)
    };
    if (t === 'img') {
        out.src = picture(o.src);
        return out.src ? out : null;
    }
    out.text = text(o.text, 4000);
    if (VALIGN.includes(o.v)) out.v = o.v;
    const fill = o.fill === 'none' ? 'none' : colour(o.fill);
    const ln = o.line === 'none' ? 'none' : colour(o.line);
    if (fill) out.fill = fill;
    if (ln) out.line = ln;
    return out;
}
function cleanSlide(s) {
    s = s && typeof s === 'object' ? s : {};
    const fmt = {};
    for (const f of ['title', 'body', 'body2']) {
        const l = cleanLook(s.fmt && s.fmt[f]);
        if (Object.keys(l).length) fmt[f] = l;
    }
    return {
        id: /^[A-Za-z0-9_-]{4,24}$/.test(String(s.id || '')) ? s.id : crypto.randomBytes(6).toString('base64url'),
        layout: KIT.LAYOUTS[s.layout] ? s.layout : 'bullets',
        title: text(s.title, 600),
        body: text(s.body, 6000),
        body2: text(s.body2, 6000),
        image: picture(s.image),
        notes: text(s.notes, 8000),
        fmt,
        objs: [].concat(s.objs || []).slice(0, 60).filter(o => o && typeof o === 'object').map(cleanObject).filter(Boolean),
        bg: colour(s.bg),
        transition: KIT.TRANSITIONS[s.transition] ? s.transition : 'none'
    };
}

module.exports = function docRoutes(ctx) {
    const { store, docs } = ctx;
    const r = express.Router();
    r.use('/docs', requireAuth);
    const index = () => docs.get('docs-index', () => ({ items: {} }));
    const nameOf = email => store.getSettings(email).displayName || (store.getProfile(email) || {}).name || (store.usernameOf(email) ? `@${store.usernameOf(email)}` : email);
    const canSee = (m, email) => m.owner === email || m.share !== 'private';
    const canEdit = (m, email) => m.owner === email || m.share === 'edit';
    const view = (id, m, email) => ({
        id, kind: m.kind, title: m.title, share: m.share, mine: m.owner === email, ownerName: m.ownerName, updatedAt: m.updatedAt, updatedBy: m.updatedBy, version: m.version, canEdit: canEdit(m, email), size: m.size || 0, cover: m.cover || '',
        // a form: how many answered, and (for whoever may change it) the link to fill it in
        ...(m.kind === 'form' ? { responses: m.responses || 0, lastResponse: m.lastResponse || 0, open: m.open !== false, ...(canEdit(m, email) ? { token: m.token } : {}) } : {})
    });
    const formToken = () => crypto.randomBytes(12).toString('base64url');
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
        all.items[id] = { kind, title: line(req.body.title, 160), owner: email, ownerName: nameOf(email), share: 'private', createdAt: now, updatedAt: now, updatedBy: nameOf(email), version: 1, size: JSON.stringify(body).length, ...(kind === 'deck' ? { cover: `${body.theme}|${line(body.slides[0].title, 80)}` } : {}), ...(kind === 'form' ? { token: formToken(), open: body.settings.open } : {}), ...(kind === 'board' ? { cover: body.bg } : {}), ...(kind === 'video' ? { cover: videoCover(body) } : {}) };
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
        if (m.kind === 'form') m.open = body.settings.open;
        if (m.kind === 'board') m.cover = body.bg;
        if (m.kind === 'video') m.cover = videoCover(body);
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
        // a copied form gets its own link, and starts without responses
        if (m.kind === 'form') Object.assign(all.items[id], { token: formToken(), responses: 0, lastResponse: 0 });
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
        if (!/\.(xlsx|csv|docx|pptx)$/i.test(name)) throw httpError(400, 'Open an Excel (.xlsx), CSV, Word (.docx) or PowerPoint (.pptx) file');
        const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const kind = /\.docx$/i.test(name) ? 'doc' : /\.pptx$/i.test(name) ? 'deck' : 'sheet';
        let body;
        try {
            if (kind === 'doc') body = cleanBody('doc', { html: await office.importDocx(buf) });
            else if (kind === 'deck') body = cleanBody('deck', await office.importPptx(buf));
            else body = cleanBook(await office.importSheet(buf, name));
        } catch {
            throw httpError(400, { doc: 'That file couldn’t be read as a Word document', deck: 'That file couldn’t be read as a PowerPoint presentation', sheet: 'That file couldn’t be read as a spreadsheet' }[kind]);
        }
        if (JSON.stringify(body).length > MAX_BODY) throw httpError(413, 'That presentation is too big to open here. Use smaller pictures.');
        const all = await index();
        const id = crypto.randomBytes(9).toString('base64url');
        const now = Date.now();
        all.items[id] = { kind, title: line(name.replace(/\.(xlsx|csv|docx|pptx)$/i, ''), 160), owner: email, ownerName: nameOf(email), share: 'private', createdAt: now, updatedAt: now, updatedBy: nameOf(email), version: 1, size: JSON.stringify(body).length, ...(kind === 'deck' ? { cover: `${body.theme}|${line(body.slides[0].title, 80)}` } : {}) };
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
        if (m.kind === 'form') await docs.remove(`fr:${req.params.id}`);
        res.json({ ok: true });
    }));

    // the dashboard's counts
    const before = ctx.summaryExtras;
    ctx.summaryExtras = async email => {
        const all = Object.values((await index()).items);
        const myForms = all.filter(m => m.kind === 'form' && canEdit(m, email));
        // Planner: open cards for you (yours, or on your own boards with nobody on them) due within a week
        const m0 = { boardDue: 0 };
        const soon = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
        for (const [id, m] of Object.entries((await index()).items)) {
            if (m.kind !== 'board' || !canSee(m, email)) continue;
            const b = await docs.get(`d:${id}`, () => ({ cols: [] }));
            for (const c of b.cols || []) for (const card of c.cards || []) if (!card.done && card.due && card.due <= soon && ((card.who || []).includes(email) || (!(card.who || []).length && m.owner === email))) m0.boardDue++;
        }
        return {
            ...(before ? await before(email) : {}),
            docs: all.filter(m => m.kind === 'doc' && canSee(m, email)).length,
            slides: all.filter(m => m.kind === 'deck' && canSee(m, email)).length,
            sheets: all.filter(m => m.kind === 'sheet' && canSee(m, email)).length,
            forms: myForms.length,
            formResponses: myForms.reduce((n, m) => n + (m.responses || 0), 0),
            boards: all.filter(m => m.kind === 'board' && canSee(m, email)).length,
            boardDue: m0.boardDue || 0,
            whiteboards: all.filter(m => m.kind === 'wb' && canSee(m, email)).length,
            videos: all.filter(m => m.kind === 'video' && canSee(m, email)).length
        };
    };
    // for Forms (src/routes/forms.js): the same list, rules and a way to add a document
    ctx.docsApi = {
        index,
        meta,
        canEdit,
        view,
        nameOf,
        async add(email, kind, title, body) {
            const all = await index();
            const id = crypto.randomBytes(9).toString('base64url');
            const now = Date.now();
            all.items[id] = { kind, title: line(title, 160), owner: email, ownerName: nameOf(email), share: 'private', createdAt: now, updatedAt: now, updatedBy: nameOf(email), version: 1, size: JSON.stringify(body).length };
            const d = await docs.get(`d:${id}`, () => ({}));
            Object.assign(d, body);
            docs.save(`d:${id}`);
            docs.save('docs-index');
            return view(id, all.items[id], email);
        }
    };
    return r;
};

module.exports.cleanBody = cleanBody;
