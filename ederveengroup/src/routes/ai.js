'use strict';

// Auto editing with Claude, for admins only (it runs on the site owner's Anthropic API key).
//   GET    /api/ai/status        whether this person can use it
//   POST   /api/ai/photo         { photo: data URL, wish?, size? } → an edit for the Photo Editor
//   POST   /api/ai/video         { brief, length, aspect, captions, media[], music[] } → an edit plan
//   GET    /api/admin/ai         the setup (never the key itself)
//   PUT    /api/admin/ai         { apiKey?, model? }
//   DELETE /api/admin/ai         forget the key
//   POST   /api/admin/ai/test    a tiny request, to check the key works

const express = require('express');
const { wrap, httpError, requireAuth } = require('../http');
const { createLimiter } = require('../security');
const ai = require('../../lib/ai');

module.exports = function aiRoutes(ctx) {
    const { store, config } = ctx;
    const r = express.Router();
    r.use(['/ai', '/admin/ai'], requireAuth);
    const admin = (req, res, next) => (ctx.isAdmin(req.session.email) ? next() : res.status(403).json({ error: 'Only admins can use auto editing' }));
    r.use('/admin/ai', admin);
    const uses = createLimiter({ max: 40, windowMs: 60 * 60 * 1000 });

    // the key: from the server's environment, or pasted into Admin (sealed like the sign-in secrets)
    const key = ctx.sessions.deriveKey('claude-api');
    const { seal, unseal } = require('../../lib/session');
    const saved = () => store.servers.getSignin('claude') || {};
    function setup() {
        const s = saved();
        const env = config.anthropicApiKey || '';
        let apiKey = env;
        if (!apiKey && s.key) {
            try {
                apiKey = unseal(key, s.key).v;
            } catch {
                apiKey = '';
            }
        }
        return { apiKey, source: env ? 'env' : apiKey ? 'saved' : null, model: ai.MODELS[s.model] ? s.model : ai.DEFAULT_MODEL, hint: env ? env.slice(-4) : s.hint || '', savedAt: s.savedAt || null, savedBy: s.savedBy || '', usage: s.usage || null };
    }
    const month = () => new Date().toISOString().slice(0, 7);
    // "Claude Opus 5.5", for people (a fallback model that isn't in the list keeps its id)
    const named = id => (ai.MODELS[id] || String(id || 'Claude')).replace(/ \(.*\)$/, '');
    function count(usage) {
        const s = { ...saved() };
        const u = s.usage && s.usage.month === month() ? { ...s.usage } : { month: month(), requests: 0, input: 0, output: 0 };
        u.requests++;
        u.input += (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
        u.output += usage.output_tokens || 0;
        store.servers.setSignin('claude', { ...s, usage: u });
    }
    const view = () => {
        const s = setup();
        return { configured: !!s.apiKey, source: s.source, hint: s.hint, model: s.model, models: Object.entries(ai.MODELS).map(([id, name]) => ({ id, name })), savedAt: s.savedAt, savedBy: s.savedBy, usage: s.usage && s.usage.month === month() ? s.usage : { month: month(), requests: 0, input: 0, output: 0 } };
    };

    r.get('/ai/status', (req, res) => {
        const s = setup();
        res.json({ on: ctx.isAdmin(req.session.email) && !!s.apiKey, admin: ctx.isAdmin(req.session.email), configured: !!s.apiKey, model: ai.MODELS[s.model] });
    });

    function ready(req) {
        if (!ctx.isAdmin(req.session.email)) throw httpError(403, 'Auto editing is for admins');
        const s = setup();
        if (!s.apiKey) throw httpError(409, 'Add a Claude API key in Admin → AI first');
        if (uses.blocked(req.session.email)) throw httpError(429, 'That’s a lot of auto edits this hour. Try again later.');
        uses.hit(req.session.email);
        return s;
    }
    // Claude's problems are worded for people, so they're shown even when they're 5xx
    const shown = (status, message) => Object.assign(httpError(status, message), { expose: true });
    const fail = e => {
        if (e instanceof ai.AiError) throw shown(e.status, e.message);
        throw e;
    };

    r.post('/ai/photo', wrap(async (req, res) => {
        const s = ready(req);
        const b = req.body || {};
        const r2 = await ai.editPhoto({ apiKey: s.apiKey, baseURL: config.anthropicBaseUrl, model: s.model, photo: b.photo, wish: b.wish, size: b.size && { w: Number(b.size.w) || 0, h: Number(b.size.h) || 0 } }).catch(fail);
        count(r2.usage);
        ctx.audit({ kind: 'admin', by: req.session.email, text: `Auto-edited a photo with ${named(r2.model)}` });
        res.json({ edit: r2.edit, model: named(r2.model) });
    }));

    r.post('/ai/video', wrap(async (req, res) => {
        const s = ready(req);
        const b = req.body || {};
        const r2 = await ai.editVideo({ apiKey: s.apiKey, baseURL: config.anthropicBaseUrl, model: s.model, brief: b.brief, length: b.length, aspect: b.aspect, captions: !!b.captions, media: b.media, music: b.music }).catch(fail);
        count(r2.usage);
        ctx.audit({ kind: 'admin', by: req.session.email, text: `Auto-edited a video with ${named(r2.model)} (${r2.plan.clips.length} cuts from ${r2.frames} frames)` });
        res.json({ plan: r2.plan, model: named(r2.model) });
    }));

    /* ---------- Admin → AI ---------- */
    r.get('/admin/ai', (req, res) => res.json(view()));
    r.put('/admin/ai', (req, res) => {
        const b = req.body || {};
        const s = { ...saved() };
        if (b.apiKey !== undefined && String(b.apiKey).trim()) {
            if (config.anthropicApiKey) throw httpError(409, 'The key is set on the server (ANTHROPIC_API_KEY). Change it there, or remove it to set one here.');
            const k = String(b.apiKey).trim();
            if (!/^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(k)) throw httpError(400, 'That doesn’t look like a Claude API key. It starts with sk-ant- (create one at console.anthropic.com → API keys).');
            Object.assign(s, { key: seal(key, { v: k }), hint: k.slice(-4), savedAt: Date.now(), savedBy: req.session.email });
        }
        if (b.model !== undefined) {
            if (!ai.MODELS[b.model]) throw httpError(400, 'Pick one of the models');
            s.model = b.model;
        }
        store.servers.setSignin('claude', s);
        ctx.audit({ kind: 'admin', by: req.session.email, text: b.apiKey ? 'Set the Claude API key for auto editing' : `Chose ${ai.MODELS[s.model]} for auto editing` });
        res.json(view());
    });
    r.delete('/admin/ai', (req, res) => {
        const s = { ...saved() };
        delete s.key;
        delete s.hint;
        store.servers.setSignin('claude', s);
        ctx.audit({ kind: 'admin', by: req.session.email, text: 'Removed the Claude API key' });
        res.json(view());
    });
    r.post('/admin/ai/test', wrap(async (req, res) => {
        const s = setup();
        if (!s.apiKey) throw httpError(409, 'Add a key first');
        const Anthropic = require('@anthropic-ai/sdk').default;
        try {
            const c = new Anthropic({ apiKey: s.apiKey, maxRetries: 1, timeout: 60 * 1000, ...(config.anthropicBaseUrl ? { baseURL: config.anthropicBaseUrl } : {}) });
            const msg = await c.messages.create({ model: s.model, max_tokens: 400, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 'Reply with the single word: ready' }] });
            count(msg.usage || {});
            res.json({ ok: true, model: msg.model, reply: msg.content.filter(x => x.type === 'text').map(x => x.text).join('').trim().slice(0, 60) });
        } catch (e) {
            if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw httpError(400, 'Anthropic doesn’t accept this key. Check it and try again.');
            if (e instanceof Anthropic.NotFoundError) throw httpError(400, 'This key can’t use that model. Pick another model.');
            if (e instanceof Anthropic.RateLimitError) throw httpError(429, 'The key works, but it’s rate limited right now.');
            if (e instanceof Anthropic.APIError) throw shown(502, `Anthropic answered with an error (${e.status || 'no answer'}).`);
            throw shown(502, 'Couldn’t reach Anthropic from the server. Check its internet connection.');
        }
    }));
    return r;
};
