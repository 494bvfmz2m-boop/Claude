'use strict';

// Chat: conversations between people on EderveenGroup (one to one, or a group), live.
//   GET    /api/chat                    your conversations, newest first, with unread counts
//   POST   /api/chat                    start one { with: [email…], name? } (a 1:1 that exists is reused)
//   GET    /api/chat/people?q=          people you can chat with
//   GET    /api/chat/stream             live updates (Server-Sent Events)
//   GET    /api/chat/:cid?before=       messages: the newest 80, or the 80 before a time
//   POST   /api/chat/:cid               send { text, img?, reply? }
//   PATCH  /api/chat/:cid               rename, add people { name?, add? }
//   POST   /api/chat/:cid/leave         leave a group
//   POST   /api/chat/:cid/read          read up to now
//   POST   /api/chat/:cid/typing        "… is typing" for the others
//   PATCH  /api/chat/:cid/m/:mid        edit { text }, or react { react: '👍' }
//   DELETE /api/chat/:cid/m/:mid        delete your own message
//   GET    /api/chat/:cid/img/:mid      a picture in a message

const crypto = require('crypto');
const express = require('express');
const { wrap, httpError, requireAuth } = require('../http');
const { createLimiter } = require('../security');

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
const MAX_KEEP = 5000; // messages kept per conversation
const PAGE = 80;
const id = n => crypto.randomBytes(n).toString('base64url');
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\s+$/, '').slice(0, max);
const picture = v => (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(v || '')) && String(v).length < 2.2 * 1024 * 1024 ? String(v) : '');

module.exports = function chatRoutes(ctx) {
    const { store, docs } = ctx;
    const r = express.Router();
    r.use('/chat', requireAuth);
    const index = () => docs.get('chat-index', () => ({ convs: {} }));
    const msgsOf = cid => docs.get(`chat:${cid}`, () => ({ msgs: [] }));
    const sending = createLimiter({ max: 40, windowMs: 60 * 1000 });
    const readOf = email => store.getApp(email, 'chatread') || { items: {} };
    const nameOf = email => store.getSettings(email).displayName || (store.getProfile(email) || {}).name || (store.usernameOf(email) ? `@${store.usernameOf(email)}` : email);
    const person = email => ({ email, name: nameOf(email), username: store.usernameOf(email) || '' });

    /* ---------- live: every open Chat tab gets what concerns its person ---------- */
    const listeners = new Map(); // email → Set of responses
    function tell(emails, event, data) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const e of new Set(emails)) for (const res of listeners.get(e) || []) res.write(payload);
    }
    r.get('/chat/stream', (req, res) => {
        res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.flushHeaders();
        const email = req.session.email;
        if (!listeners.has(email)) listeners.set(email, new Set());
        listeners.get(email).add(res);
        res.write('event: ready\ndata: {}\n\n');
        const ping = setInterval(() => res.write(': ping\n\n'), 25000);
        req.on('close', () => {
            clearInterval(ping);
            const set = listeners.get(email);
            if (set) {
                set.delete(res);
                if (!set.size) listeners.delete(email);
            }
        });
    });

    /* ---------- conversations ---------- */
    async function unreadIn(cid, email) {
        const since = readOf(email).items[cid] || 0;
        const { msgs } = await msgsOf(cid);
        let n = 0;
        for (let i = msgs.length - 1; i >= 0 && msgs[i].at > since; i--) if (msgs[i].by !== email && !msgs[i].deleted) n++;
        return n;
    }
    async function view(cid, c, email) {
        return {
            id: cid,
            name: c.name,
            direct: !!c.direct,
            members: c.members.map(person),
            lastAt: c.lastAt,
            last: c.last || null,
            unread: await unreadIn(cid, email),
            createdBy: c.createdBy
        };
    }
    async function conv(req) {
        const all = await index();
        const c = all.convs[req.params.cid];
        if (!c || !c.members.includes(req.session.email)) throw httpError(404, 'That conversation isn’t here any more');
        return { all, c, cid: req.params.cid };
    }
    const canChat = email => !!store.usernameOf(email) && !(ctx.isBlocked && ctx.isBlocked(email));

    r.get('/chat', wrap(async (req, res) => {
        const email = req.session.email;
        const all = await index();
        const mine = Object.entries(all.convs).filter(([, c]) => c.members.includes(email));
        const out = [];
        for (const [cid, c] of mine) out.push(await view(cid, c, email));
        res.json(out.sort((a, b) => b.lastAt - a.lastAt));
    }));

    r.get('/chat/people', wrap(async (req, res) => {
        const q = String(req.query.q || '').toLowerCase().replace(/^@/, '').slice(0, 60);
        const me = req.session.email;
        const people = (await store.listPeople()).filter(p => p.email !== me && p.username && canChat(p.email));
        res.json(
            people
                .map(p => ({ email: p.email, name: p.name || '', username: p.username }))
                .filter(p => !q || `${p.name} ${p.username} ${p.email}`.toLowerCase().includes(q))
                .sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username))
                .slice(0, 100)
        );
    }));

    r.post('/chat', wrap(async (req, res) => {
        const me = req.session.email;
        const others = [...new Set([].concat(req.body.with || []).map(e => String(e).trim().toLowerCase()))].filter(e => e && e !== me).slice(0, 50);
        if (!others.length) throw httpError(400, 'Pick at least one person');
        for (const e of others) if (!canChat(e)) throw httpError(400, `${e} isn’t on EderveenGroup`);
        const all = await index();
        const members = [me, ...others];
        const direct = others.length === 1 && !String(req.body.name || '').trim();
        if (direct) {
            const hit = Object.entries(all.convs).find(([, c]) => c.direct && c.members.length === 2 && c.members.includes(me) && c.members.includes(others[0]));
            if (hit) return res.json(await view(hit[0], hit[1], me));
        }
        const cid = id(9);
        all.convs[cid] = { members, name: direct ? '' : clean(req.body.name, 80).trim(), direct, createdBy: me, createdAt: Date.now(), lastAt: Date.now(), last: null };
        docs.save('chat-index');
        const v = await view(cid, all.convs[cid], me);
        tell(members, 'conv', { id: cid });
        res.json(v);
    }));

    r.patch('/chat/:cid', wrap(async (req, res) => {
        const me = req.session.email;
        const { c, cid } = await conv(req);
        if (c.direct) throw httpError(400, 'Start a group to add people or give it a name');
        const notes = [];
        if (typeof req.body.name === 'string') {
            c.name = clean(req.body.name, 80).trim();
            notes.push(c.name ? `named the group “${c.name}”` : 'removed the group name');
        }
        for (const e of [].concat(req.body.add || []).map(x => String(x).trim().toLowerCase())) {
            if (c.members.includes(e) || !canChat(e) || c.members.length >= 50) continue;
            c.members.push(e);
            notes.push(`added ${nameOf(e)}`);
        }
        docs.save('chat-index');
        for (const n of notes) await post(cid, c, me, { text: n, system: true });
        tell(c.members, 'conv', { id: cid });
        res.json(await view(cid, c, me));
    }));

    r.post('/chat/:cid/leave', wrap(async (req, res) => {
        const me = req.session.email;
        const { all, c, cid } = await conv(req);
        if (c.direct) throw httpError(400, 'You can’t leave a one-to-one chat; it simply stays quiet');
        c.members = c.members.filter(e => e !== me);
        if (!c.members.length) {
            delete all.convs[cid];
            for (const m of (await msgsOf(cid)).msgs) if (m.img) await docs.remove(`chatimg:${cid}:${m.id}`);
            await docs.remove(`chat:${cid}`);
        } else await post(cid, c, me, { text: 'left the group', system: true });
        docs.save('chat-index');
        tell([...c.members, me], 'conv', { id: cid });
        res.json({ ok: true });
    }));

    /* ---------- messages ---------- */
    const show = (cid, m) => ({ id: m.id, by: m.by, at: m.at, text: m.deleted ? '' : m.text, ...(m.img && !m.deleted ? { img: `/api/chat/${cid}/img/${m.id}` } : {}), ...(m.edited ? { edited: m.edited } : {}), ...(m.deleted ? { deleted: true } : {}), ...(m.system ? { system: true } : {}), ...(m.reply ? { reply: m.reply } : {}), ...(m.re && Object.keys(m.re).length ? { re: m.re } : {}) });
    async function post(cid, c, by, { text, img, reply, system }) {
        const box = await msgsOf(cid);
        const m = { id: id(6), by, at: Date.now(), text: clean(text, 4000) };
        if (system) m.system = true;
        if (img) {
            m.img = true;
            const d = await docs.get(`chatimg:${cid}:${m.id}`, () => ({}));
            d.src = img;
            docs.save(`chatimg:${cid}:${m.id}`);
        }
        if (reply) {
            const to = box.msgs.find(x => x.id === reply && !x.deleted);
            if (to) m.reply = { id: to.id, by: to.by, text: to.text.slice(0, 140) || (to.img ? '📷 Picture' : '') };
        }
        box.msgs.push(m);
        // very long conversations keep their newest messages
        if (box.msgs.length > MAX_KEEP) for (const old of box.msgs.splice(0, box.msgs.length - MAX_KEEP)) if (old.img) await docs.remove(`chatimg:${cid}:${old.id}`);
        docs.save(`chat:${cid}`);
        c.lastAt = m.at;
        c.last = { by, text: system ? `${nameOf(by)} ${m.text}` : m.text || (m.img ? '📷 Picture' : ''), at: m.at };
        docs.save('chat-index');
        tell(c.members, 'msg', { cid, msg: show(cid, m) });
        return m;
    }

    r.get('/chat/:cid', wrap(async (req, res) => {
        const { c, cid } = await conv(req);
        const { msgs } = await msgsOf(cid);
        const before = Number(req.query.before) || Infinity;
        const older = msgs.filter(m => m.at < before);
        const page = older.slice(-PAGE);
        res.json({ conv: await view(cid, c, req.session.email), msgs: page.map(m => show(cid, m)), more: older.length > page.length, read: Object.fromEntries(c.members.map(e => [e, readOf(e).items[cid] || 0])) });
    }));

    r.post('/chat/:cid', wrap(async (req, res) => {
        const me = req.session.email;
        const { c, cid } = await conv(req);
        if (sending.blocked(me)) throw httpError(429, 'Slow down a little');
        const text = clean(req.body.text, 4000);
        const img = picture(req.body.img);
        if (!text.trim() && !img) throw httpError(400, 'Type a message first');
        sending.hit(me);
        const m = await post(cid, c, me, { text, img, reply: String(req.body.reply || '') });
        // what you send, you've read
        const read = readOf(me);
        read.items[cid] = m.at;
        store.setApp(me, 'chatread', read);
        res.json(show(cid, m));
    }));

    r.post('/chat/:cid/read', wrap(async (req, res) => {
        const me = req.session.email;
        const { c, cid } = await conv(req);
        const read = readOf(me);
        read.items[cid] = Date.now();
        store.setApp(me, 'chatread', read);
        tell(c.members, 'read', { cid, by: me, at: read.items[cid] });
        res.json({ ok: true });
    }));

    r.post('/chat/:cid/typing', wrap(async (req, res) => {
        const me = req.session.email;
        const { c, cid } = await conv(req);
        tell(c.members.filter(e => e !== me), 'typing', { cid, by: me, name: nameOf(me) });
        res.json({ ok: true });
    }));

    async function message(req) {
        const { c, cid } = await conv(req);
        const box = await msgsOf(cid);
        const m = box.msgs.find(x => x.id === req.params.mid);
        if (!m || m.system) throw httpError(404, 'That message isn’t here any more');
        return { c, cid, m };
    }
    r.patch('/chat/:cid/m/:mid', wrap(async (req, res) => {
        const me = req.session.email;
        const { c, cid, m } = await message(req);
        if (m.deleted) throw httpError(409, 'That message was deleted');
        if (req.body.react !== undefined) {
            const e = String(req.body.react);
            if (!REACTIONS.includes(e)) throw httpError(400, 'Pick one of the reactions');
            m.re = m.re || {};
            const list = new Set(m.re[e] || []);
            list.has(me) ? list.delete(me) : list.add(me);
            if (list.size) m.re[e] = [...list];
            else delete m.re[e];
        } else {
            if (m.by !== me) throw httpError(403, 'You can only change your own messages');
            const text = clean(req.body.text, 4000);
            if (!text.trim() && !m.img) throw httpError(400, 'A message can’t be empty; delete it instead');
            m.text = text;
            m.edited = Date.now();
        }
        docs.save(`chat:${cid}`);
        tell(c.members, 'edit', { cid, msg: show(cid, m) });
        res.json(show(cid, m));
    }));

    r.delete('/chat/:cid/m/:mid', wrap(async (req, res) => {
        const me = req.session.email;
        const { c, cid, m } = await message(req);
        if (m.by !== me) throw httpError(403, 'You can only delete your own messages');
        if (m.img) await docs.remove(`chatimg:${cid}:${m.id}`);
        Object.assign(m, { deleted: true, text: '', img: false, re: {} });
        delete m.reply;
        docs.save(`chat:${cid}`);
        tell(c.members, 'edit', { cid, msg: show(cid, m) });
        res.json(show(cid, m));
    }));

    r.get('/chat/:cid/img/:mid', wrap(async (req, res) => {
        const { cid } = await conv(req);
        if (!/^[A-Za-z0-9_-]{8}$/.test(req.params.mid)) throw httpError(404, 'Not found');
        const d = await docs.get(`chatimg:${cid}:${req.params.mid}`, () => ({}));
        const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(d.src || '');
        if (!m) throw httpError(404, 'That picture isn’t here any more');
        res.set({ 'Content-Type': m[1], 'Cache-Control': 'private, max-age=31536000, immutable', 'Content-Security-Policy': "default-src 'none'", 'X-Content-Type-Options': 'nosniff' }).send(Buffer.from(m[2], 'base64'));
    }));

    // the dashboard: how many unread messages
    const before = ctx.summaryExtras;
    ctx.summaryExtras = async email => {
        const all = await index();
        let unread = 0;
        for (const [cid, c] of Object.entries(all.convs)) if (c.members.includes(email)) unread += await unreadIn(cid, email);
        return { ...(before ? await before(email) : {}), chat: unread };
    };
    return r;
};

module.exports.REACTIONS = REACTIONS;
