'use strict';

// Forms: the responses (for whoever may change the form), and the form itself for anyone with
// its link at /r/<token> — no account needed unless the form asks for one.
//   GET    /api/forms/:id/responses                  all responses
//   DELETE /api/forms/:id/responses[/:rid]           remove one, or all
//   GET    /api/forms/:id/responses/export?format=   xlsx or csv
//   POST   /api/forms/:id/sheet                      the responses as a new spreadsheet
//   GET    /api/forms/:id/qr                         the link as a QR code (SVG)
//   GET    /api/respond/:token                       the questions, to fill in
//   POST   /api/respond/:token                       send answers

const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');
const { wrap, httpError, requireAuth } = require('../http');
const { createLimiter } = require('../security');
const forms = require('../../lib/forms');

const MAX_RESPONSES = 10000;
const TOKEN = /^[A-Za-z0-9_-]{16}$/;
const originOf = req => `${req.protocol}://${String(req.get('host') || 'localhost').replace(/[^a-z0-9.:\-[\]]/gi, '')}`;

module.exports = function formRoutes(ctx) {
    const { docs } = ctx;
    const api = () => ctx.docsApi;
    const r = express.Router();
    const responsesOf = id => docs.get(`fr:${id}`, () => ({ items: [] }));
    // sending: a few per minute from one address, and a ceiling per form per hour
    const perIp = createLimiter({ max: 12, windowMs: 10 * 60 * 1000 });
    const perForm = createLimiter({ max: 600, windowMs: 60 * 60 * 1000 });
    const reads = createLimiter({ max: 120, windowMs: 60 * 1000 });

    async function mine(req) {
        const { m } = await api().meta(req);
        if (m.kind !== 'form') throw httpError(404, 'That one isn’t here any more');
        if (!api().canEdit(m, req.session.email)) throw httpError(403, 'Only the people who can change this form see its responses');
        return m;
    }

    r.get('/forms/:id/responses', requireAuth, wrap(async (req, res) => {
        await mine(req);
        res.json((await responsesOf(req.params.id)).items);
    }));

    r.delete('/forms/:id/responses/:rid', requireAuth, wrap(async (req, res) => {
        const m = await mine(req);
        const rs = await responsesOf(req.params.id);
        const before = rs.items.length;
        rs.items = rs.items.filter(x => x.id !== req.params.rid);
        if (rs.items.length === before) throw httpError(404, 'That response isn’t here any more');
        m.responses = rs.items.length;
        docs.save(`fr:${req.params.id}`);
        docs.save('docs-index');
        res.json({ ok: true, responses: m.responses });
    }));

    r.delete('/forms/:id/responses', requireAuth, wrap(async (req, res) => {
        const m = await mine(req);
        const rs = await responsesOf(req.params.id);
        rs.items = [];
        m.responses = 0;
        docs.save(`fr:${req.params.id}`);
        docs.save('docs-index');
        res.json({ ok: true, responses: 0 });
    }));

    r.get('/forms/:id/responses/export', requireAuth, wrap(async (req, res) => {
        const m = await mine(req);
        const form = forms.cleanForm(await docs.get(`d:${req.params.id}`, () => ({})));
        const items = (await responsesOf(req.params.id)).items;
        const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
        const name = `${(m.title || 'Form').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim().slice(0, 100) || 'Form'} (responses)`;
        const file = format === 'csv' ? forms.responsesToCsv(form, items) : await forms.responsesToXlsx(m.title, form, items);
        res.set({
            'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}.${format}"; filename*=UTF-8''${encodeURIComponent(name)}.${format}`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(file);
    }));

    r.post('/forms/:id/sheet', requireAuth, wrap(async (req, res) => {
        const m = await mine(req);
        const form = forms.cleanForm(await docs.get(`d:${req.params.id}`, () => ({})));
        const items = (await responsesOf(req.params.id)).items;
        res.json(await api().add(req.session.email, 'sheet', `${m.title || 'Form'} (responses)`, forms.responsesToBook(form, items)));
    }));

    r.get('/forms/:id/qr', requireAuth, wrap(async (req, res) => {
        const m = await mine(req);
        const svg = await QRCode.toString(`${originOf(req)}/r/${m.token}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b0d18', light: '#ffffff' } });
        res.type('image/svg+xml').set('Cache-Control', 'private, no-store').send(svg);
    }));

    /* ---------- filling in a form, from its link ---------- */
    async function byToken(token) {
        if (!TOKEN.test(String(token || '')) || !ctx.appOn('forms')) return null;
        const all = await api().index();
        const hit = Object.entries(all.items).find(([, m]) => m.kind === 'form' && m.token === token);
        if (!hit) return null;
        const [id, m] = hit;
        return { id, m, form: forms.cleanForm(await docs.get(`d:${id}`, () => ({}))) };
    }
    const gone = () => httpError(404, 'This form doesn’t exist any more, or its link was changed.');
    const answeredBy = async (id, email) => !!email && (await responsesOf(id)).items.some(x => x.by === email);

    r.get('/respond/:token', wrap(async (req, res) => {
        if (reads.blocked(req.ip)) throw httpError(429, 'Slow down a little');
        reads.hit(req.ip);
        const f = await byToken(req.params.token);
        if (!f) throw gone();
        const email = req.session && req.session.email;
        res.set('Cache-Control', 'private, no-store');
        if (!f.form.settings.open) return res.json({ title: f.m.title, color: f.form.color, closed: true });
        if (f.form.settings.who === 'members' && !email) return res.json({ title: f.m.title, color: f.form.color, signIn: true });
        if (f.form.settings.once && (await answeredBy(f.id, email))) return res.json({ title: f.m.title, color: f.form.color, answered: true });
        res.json({ ...forms.publicForm(f.m.title, f.form), signedInAs: email ? api().nameOf(email) : null });
    }));

    r.post('/respond/:token', wrap(async (req, res) => {
        const key = `${req.ip}|${req.params.token}`;
        if (perIp.blocked(key)) throw httpError(429, 'That’s a lot of responses from here. Try again in a few minutes.');
        const f = await byToken(req.params.token);
        if (!f) throw gone();
        if (!f.form.settings.open) throw httpError(403, 'This form isn’t taking responses any more.');
        if (perForm.blocked(f.id)) throw httpError(429, 'This form is very busy. Try again later.');
        const email = req.session && req.session.email;
        if (f.form.settings.who === 'members' && !email) throw httpError(401, 'Sign in to fill in this form.');
        if (f.form.settings.once && (await answeredBy(f.id, email))) throw httpError(409, 'You’ve already filled in this form.');
        perIp.hit(key);
        // a field only robots fill in: thank them and keep nothing
        if (req.body && req.body.website) return res.json({ ok: true, thanks: f.form.settings.thanks });
        let a;
        try {
            a = forms.checkAnswers(f.form, req.body && req.body.answers);
        } catch (e) {
            throw httpError(400, e.message);
        }
        if (!Object.keys(a).length) throw httpError(400, 'Answer at least one question.');
        const rs = await responsesOf(f.id);
        if (rs.items.length >= MAX_RESPONSES) throw httpError(413, 'This form has all the responses it can hold.');
        perForm.hit(f.id);
        rs.items.push({ id: crypto.randomBytes(6).toString('base64url'), at: Date.now(), by: f.form.settings.who === 'members' ? email : '', a });
        f.m.responses = rs.items.length;
        f.m.lastResponse = Date.now();
        docs.save(`fr:${f.id}`);
        docs.save('docs-index');
        res.json({ ok: true, thanks: f.form.settings.thanks });
    }));

    return r;
};
