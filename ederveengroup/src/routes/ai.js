'use strict';

// Auto editing for admins, on an AI service of the owner's choosing (Claude by default; also Gemini,
// Groq, OpenAI, OpenRouter, Mistral, xAI or any OpenAI-compatible service). It runs on their own key.
//   GET    /api/ai/status            whether this person can use it
//   POST   /api/ai/photo             { photo: data URL, wish?, size? } → an edit for the Photo Editor
//   POST   /api/ai/video             { brief, length, aspect, captions, media[], music[] } → an edit plan
//   GET    /api/admin/ai             the setup of every service (never a key itself)
//   PUT    /api/admin/ai             { provider?, apiKey?, model?, baseUrl?, maxImages?, active? }
//   DELETE /api/admin/ai?provider=   forget that service's key
//   POST   /api/admin/ai/test        { provider? } a tiny request, to check the key works
//   GET    /api/admin/ai/models?provider=   the models that key can use

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
    const P = ai.PROVIDERS;
    const ids = Object.keys(P);

    // keys: from the server's environment, or pasted into Admin (sealed like the sign-in secrets).
    // Everything is kept in one record (named "claude" from when Claude was the only choice).
    const key = ctx.sessions.deriveKey('claude-api');
    const { seal, unseal } = require('../../lib/session');
    const envKey = id => String((id === 'claude' ? config.anthropicApiKey : (config.aiKeys || {})[id]) || '').trim();
    function load() {
        const s = store.servers.getSignin('claude') || {};
        const providers = { ...(s.providers || {}) };
        // the first version kept Claude's key and model at the top
        if (s.key || s.model) providers.claude = { ...(s.key ? { key: s.key, hint: s.hint, savedAt: s.savedAt, savedBy: s.savedBy } : {}), ...(s.model ? { model: s.model } : {}), ...(providers.claude || {}) };
        return { active: P[s.active] ? s.active : 'claude', providers, usage: s.usage || null };
    }
    const keep = st => store.servers.setSignin('claude', { active: st.active, providers: st.providers, usage: st.usage });
    // one service's settings, ready to use
    function service(id, st = load()) {
        const def = P[id];
        const p = st.providers[id] || {};
        const env = envKey(id);
        let apiKey = env;
        if (!apiKey && p.key) {
            try {
                apiKey = unseal(key, p.key).v;
            } catch {
                apiKey = '';
            }
        }
        const model = id === 'claude' ? (ai.MODELS[p.model] ? p.model : ai.DEFAULT_MODEL) : p.model || def.model || '';
        const baseURL = id === 'claude' ? config.anthropicBaseUrl : def.custom ? p.baseUrl || (config.aiBaseUrl ? ai.checkBaseUrl(config.aiBaseUrl) : '') || '' : def.base;
        return { provider: id, apiKey, baseURL, model, maxImages: p.maxImages || def.maxImages, source: env ? 'env' : apiKey ? 'saved' : null, hint: env ? env.slice(-4) : p.hint || '', savedAt: p.savedAt || null, savedBy: p.savedBy || '', baseUrl: def.custom ? p.baseUrl || config.aiBaseUrl || '' : '' };
    }
    // "Claude Opus 5.5", "Gemini · gemini-2.5-flash" (or just the model, for another service), for people
    const named = (id, model) => (id === 'claude' ? (ai.MODELS[model] || String(model || 'Claude')).replace(/ \(.*\)$/, '') : P[id].custom ? String(model || 'AI') : `${P[id].name} · ${model}`);
    const month = () => new Date().toISOString().slice(0, 7);
    function count(usage) {
        const st = load();
        const u = st.usage && st.usage.month === month() ? { ...st.usage } : { month: month(), requests: 0, input: 0, output: 0 };
        u.requests++;
        u.input += (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
        u.output += usage.output_tokens || 0;
        keep({ ...st, usage: u });
    }
    const view = () => {
        const st = load();
        const list = ids.map(id => {
            const s = service(id, st);
            return { id, name: P[id].name, by: P[id].by, configured: !!s.apiKey, source: s.source, hint: s.hint, model: s.model, defaultModel: P[id].model, baseUrl: s.baseUrl, maxImages: s.maxImages, env: P[id].env, keysUrl: P[id].keys, keyHint: P[id].hint, custom: !!P[id].custom, savedAt: s.savedAt, savedBy: s.savedBy };
        });
        const a = list.find(x => x.id === st.active);
        return {
            active: st.active,
            activeName: a.name,
            // the service in use (as before, when there was only Claude)
            configured: a.configured,
            source: a.source,
            hint: a.hint,
            model: a.model,
            savedAt: a.savedAt,
            savedBy: a.savedBy,
            models: Object.entries(ai.MODELS).map(([id, name]) => ({ id, name })),
            providers: list,
            usage: st.usage && st.usage.month === month() ? st.usage : { month: month(), requests: 0, input: 0, output: 0 }
        };
    };

    r.get('/ai/status', (req, res) => {
        const st = load();
        const s = service(st.active, st);
        res.json({ on: ctx.isAdmin(req.session.email) && !!s.apiKey, admin: ctx.isAdmin(req.session.email), configured: !!s.apiKey, provider: st.active, name: P[st.active].custom ? 'AI' : P[st.active].name, model: named(st.active, s.model) });
    });

    function ready(req) {
        if (!ctx.isAdmin(req.session.email)) throw httpError(403, 'Auto editing is for admins');
        const st = load();
        const s = service(st.active, st);
        if (!s.apiKey) throw httpError(409, `Add a ${P[st.active].name} API key in Admin → AI first`);
        if (uses.blocked(req.session.email)) throw httpError(429, 'That’s a lot of auto edits this hour. Try again later.');
        uses.hit(req.session.email);
        return s;
    }
    // the AI's problems are worded for people, so they're shown even when they're 5xx
    const shown = (status, message) => Object.assign(httpError(status, message), { expose: true });
    const fail = e => {
        if (e instanceof ai.AiError) throw shown(e.status, e.message);
        throw e;
    };
    const use = s => ({ provider: s.provider, apiKey: s.apiKey, baseURL: s.baseURL, model: s.model, maxImages: s.maxImages });

    r.post('/ai/photo', wrap(async (req, res) => {
        const s = ready(req);
        const b = req.body || {};
        const r2 = await ai.editPhoto({ ...use(s), photo: b.photo, wish: b.wish, size: b.size && { w: Number(b.size.w) || 0, h: Number(b.size.h) || 0 } }).catch(fail);
        count(r2.usage);
        ctx.audit({ kind: 'admin', by: req.session.email, text: `Auto-edited a photo with ${named(s.provider, r2.model)}` });
        res.json({ edit: r2.edit, model: named(s.provider, r2.model) });
    }));

    r.post('/ai/video', wrap(async (req, res) => {
        const s = ready(req);
        const b = req.body || {};
        const r2 = await ai.editVideo({ ...use(s), brief: b.brief, length: b.length, aspect: b.aspect, captions: !!b.captions, media: b.media, music: b.music }).catch(fail);
        count(r2.usage);
        ctx.audit({ kind: 'admin', by: req.session.email, text: `Auto-edited a video with ${named(s.provider, r2.model)} (${r2.plan.clips.length} cuts from ${r2.frames} frames)` });
        res.json({ plan: r2.plan, model: named(s.provider, r2.model) });
    }));

    /* ---------- Admin → AI ---------- */
    const pickProvider = v => {
        if (v === undefined || v === null || v === '') return null;
        if (!P[v]) throw httpError(400, 'Pick one of the AI services');
        return v;
    };
    r.get('/admin/ai', (req, res) => res.json(view()));
    r.put('/admin/ai', (req, res) => {
        const b = req.body || {};
        const st = load();
        const id = pickProvider(b.provider) || (b.active && P[b.active] ? b.active : st.active);
        const def = P[id];
        const p = { ...(st.providers[id] || {}) };
        const said = [];
        if (b.apiKey !== undefined && String(b.apiKey).trim()) {
            if (envKey(id)) throw httpError(409, `The ${def.name} key is set on the server (${def.env}). Change it there, or remove it to set one here.`);
            const k = String(b.apiKey).trim();
            if (id === 'claude' && !/^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(k)) throw httpError(400, 'That doesn’t look like a Claude API key. It starts with sk-ant- (create one at console.anthropic.com → API keys).');
            if (!/^[\x21-\x7e]{8,400}$/.test(k)) throw httpError(400, `That doesn’t look like a ${def.name} API key. Paste the whole key, without spaces.`);
            Object.assign(p, { key: seal(key, { v: k }), hint: k.slice(-4), savedAt: Date.now(), savedBy: req.session.email });
            said.push(`Set the ${def.name} API key for auto editing`);
            // the first service with a key is the one that's used
            if (!service(st.active, st).apiKey) st.active = id;
        }
        if (b.model !== undefined) {
            if (id === 'claude' ? !ai.MODELS[b.model] : !/^[A-Za-z0-9._:/@+-]{1,120}$/.test(String(b.model))) throw httpError(400, id === 'claude' ? 'Pick one of the models' : 'That isn’t a model name. Use Load models to pick one.');
            p.model = String(b.model);
            said.push(`Chose ${named(id, p.model)} for auto editing`);
        }
        if (b.baseUrl !== undefined) {
            if (!def.custom) throw httpError(400, `${def.name}’s address can’t be changed`);
            const url = ai.checkBaseUrl(b.baseUrl);
            if (!url) throw httpError(400, 'Use the service’s API address, like https://api.example.com/v1 (http:// only for this computer or your own network, like http://localhost:11434/v1 for Ollama).');
            p.baseUrl = url;
            said.push(`Set the address of the other AI service to ${url}`);
        }
        if (b.maxImages !== undefined) {
            const n = Math.round(Number(b.maxImages));
            if (!(n >= 1 && n <= 90)) throw httpError(400, 'Frames per video edit: 1 to 90');
            p.maxImages = n;
        }
        st.providers[id] = p;
        if (b.active !== undefined && b.active !== false) {
            const want = b.active === true ? id : pickProvider(b.active);
            if (!service(want, st).apiKey) throw httpError(409, `Add a ${P[want].name} API key first`);
            st.active = want;
            said.push(`Switched auto editing to ${P[want].name}`);
        }
        keep(st);
        if (said.length) ctx.audit({ kind: 'admin', by: req.session.email, text: said.join('; ') });
        res.json(view());
    });
    r.delete('/admin/ai', (req, res) => {
        const st = load();
        const id = pickProvider(req.query.provider) || st.active;
        const p = { ...(st.providers[id] || {}) };
        delete p.key;
        delete p.hint;
        st.providers[id] = p;
        keep(st);
        ctx.audit({ kind: 'admin', by: req.session.email, text: `Removed the ${P[id].name} API key` });
        res.json(view());
    });
    r.post('/admin/ai/test', wrap(async (req, res) => {
        const st = load();
        const id = pickProvider((req.body || {}).provider) || st.active;
        const s = service(id, st);
        if (!s.apiKey) throw httpError(409, 'Add a key first');
        const t = await ai.ping(use(s)).catch(fail);
        count(t.usage || {});
        res.json({ ok: true, model: id === 'claude' ? t.model : named(id, t.model), reply: t.reply });
    }));
    r.get('/admin/ai/models', wrap(async (req, res) => {
        const st = load();
        const id = pickProvider(req.query.provider) || st.active;
        const s = service(id, st);
        if (!s.apiKey && id !== 'claude') throw httpError(409, 'Add a key first');
        res.json({ provider: id, models: await ai.listModels(use(s)).catch(fail) });
    }));
    return r;
};
