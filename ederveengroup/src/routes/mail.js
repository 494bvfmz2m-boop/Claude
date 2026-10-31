'use strict';

// Folders, messages, attachments, sending and drafts.

const express = require('express');
const { htmlToText } = require('html-to-text');
const { wrap, folderOf, uidList, parseAddresses } = require('../http');
const { sanitizeComposeHtml } = require('../../lib/sanitize');

module.exports = function mailRoutes({ store, mail, upload, wakeDue }) {
    const r = express.Router();

    /* ---------- folders ---------- */

    r.get('/folders', wrap(async (req, res) => {
        await wakeDue(req.session).catch(() => {});
        res.json(await mail.listFolders(req.session));
    }));

    r.post('/folders', wrap(async (req, res) => {
        const name = String(req.body.name || '').trim();
        if (!name || name.length > 100) return res.status(400).json({ error: 'Pick a folder name' });
        await mail.createFolder(req.session, name);
        res.json({ ok: true });
    }));

    r.delete('/folders', wrap(async (req, res) => {
        await mail.deleteFolder(req.session, folderOf(req));
        res.json({ ok: true });
    }));

    r.post('/folders/empty', wrap(async (req, res) => {
        await mail.emptyFolder(req.session, folderOf(req));
        res.json({ ok: true });
    }));

    /* ---------- snooze ---------- */

    r.get('/snoozes', (req, res) => res.json(store.listSnoozes(req.session.email)));

    r.post('/messages/snooze', wrap(async (req, res) => {
        const until = Number(new Date(req.body.until));
        if (!until || until < Date.now() - 60000) return res.status(400).json({ error: 'Pick a time in the future' });
        const from = folderOf(req);
        const ids = await mail.snoozeMessages(req.session, from, uidList(req.body.uids));
        store.addSnoozes(req.session.email, ids.map(messageId => ({ messageId, until, from: from === 'Snoozed' ? 'INBOX' : from })));
        res.json({ ok: true, until });
    }));

    /* ---------- messages ---------- */

    r.get('/messages', wrap(async (req, res) => {
        res.json(
            await mail.listMessages(req.session, folderOf(req), {
                page: Math.max(0, Number(req.query.page) || 0),
                query: String(req.query.q || '').slice(0, 300),
                filter: String(req.query.filter || '')
            })
        );
    }));

    r.get('/thread', wrap(async (req, res) => {
        res.json(await mail.getThread(req.session, folderOf(req), Number(req.query.uid)));
    }));

    r.get('/search/counts', wrap(async (req, res) => {
        res.json(await mail.searchCounts(req.session, String(req.query.q || '').slice(0, 300), folderOf(req)));
    }));

    r.get('/message', wrap(async (req, res) => {
        const msg = await mail.getMessage(req.session, folderOf(req), Number(req.query.uid), { markSeen: !req.query.peek });
        store.rememberContacts(req.session.email, msg.from);
        res.json(msg);
    }));

    r.get('/message/raw', wrap(async (req, res) => {
        const raw = await mail.getRaw(req.session, folderOf(req), Number(req.query.uid));
        res.type('text/plain; charset=utf-8')
            .set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="message-${Number(req.query.uid)}.eml"`)
            .send(raw);
    }));

    r.get('/attachment', wrap(async (req, res) => {
        const att = await mail.getAttachment(req.session, folderOf(req), Number(req.query.uid), Number(req.query.idx));
        const filename = (att.filename || 'attachment').replace(/["\r\n]/g, '');
        const safeInline = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain)$/i.test(att.contentType);
        res.set({
            'Content-Type': safeInline ? att.contentType : 'application/octet-stream',
            'Content-Disposition': `${safeInline && !req.query.download ? 'inline' : 'attachment'}; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
        });
        res.send(att.content);
    }));

    r.post('/messages/flags', wrap(async (req, res) => {
        const allowed = ['\\Seen', '\\Flagged', '\\Answered'];
        const add = [].concat(req.body.add || []).filter(f => allowed.includes(f));
        const remove = [].concat(req.body.remove || []).filter(f => allowed.includes(f));
        await mail.setFlags(req.session, folderOf(req), uidList(req.body.uids), { add, remove });
        res.json({ ok: true });
    }));

    r.post('/messages/move', wrap(async (req, res) => {
        let target = String(req.body.to || '');
        if (target === '\\Archive') target = (await mail.findSpecial(req.session, '\\Archive', ['archive'])) || 'Archive';
        if (target === '\\Junk') target = (await mail.findSpecial(req.session, '\\Junk', ['junk', 'spam'])) || 'Junk';
        if (!target) return res.status(400).json({ error: 'Missing target folder' });
        await mail.moveMessages(req.session, folderOf(req), uidList(req.body.uids), target);
        res.json({ ok: true, movedTo: target });
    }));

    r.post('/messages/delete', wrap(async (req, res) => {
        res.json(await mail.deleteMessages(req.session, folderOf(req), uidList(req.body.uids)));
    }));

    /* ---------- compose ---------- */

    const filesOf = (req, field) => (req.files && req.files[field]) || [];
    // pasted images: only image parts the message body actually points at (cid:...) are kept
    function inlineParts(req, html) {
        return filesOf(req, 'inline')
            .filter(f => /^image\/(png|jpeg|gif|webp)$/.test(f.mimetype) && /^[\w.-]{1,80}@eg$/.test(f.originalname) && html.includes(`cid:${f.originalname}`))
            .map((f, i) => ({ filename: `image-${i + 1}.${f.mimetype.split('/')[1].replace('jpeg', 'jpg')}`, content: f.buffer, contentType: f.mimetype, cid: f.originalname, contentDisposition: 'inline' }));
    }
    const MAX_MESSAGE = 35 * 1024 * 1024;
    function checkSize(req, res, next) {
        const total = Object.values(req.files || {}).flat().reduce((n, f) => n + f.size, 0);
        if (total > MAX_MESSAGE) return res.status(413).json({ error: 'That message is too large. Keep attachments under 35 MB in total.' });
        next();
    }
    const parts = [upload.fields([{ name: 'attachments', maxCount: 20 }, { name: 'inline', maxCount: 30 }]), checkSize];

    function composeInput(req) {
        const b = req.body;
        const html = sanitizeComposeHtml(String(b.html || ''));
        const settings = store.getSettings(req.session.email);
        return {
            fromName: settings.displayName || '',
            to: parseAddresses(b.to),
            cc: parseAddresses(b.cc),
            bcc: parseAddresses(b.bcc),
            subject: String(b.subject || '').slice(0, 998),
            html,
            text: htmlToText(html, { wordwrap: 78, selectors: [{ selector: 'img', format: 'skip' }] }),
            inReplyTo: b.inReplyTo || undefined,
            references: b.references ? String(b.references).split(/\s+/).filter(Boolean) : [],
            attachments: [...filesOf(req, 'attachments').map(f => ({ filename: f.originalname, content: f.buffer, contentType: f.mimetype })), ...inlineParts(req, html)],
            forwardFrom: b.forwardFolder && b.forwardUid ? { folder: String(b.forwardFolder), uid: Number(b.forwardUid) } : null,
            draftUid: Number(b.draftUid) || null,
            answeredUid: Number(b.answeredUid) || null,
            answeredFolder: b.answeredFolder ? String(b.answeredFolder) : null
        };
    }

    r.post('/send', parts, wrap(async (req, res) => {
        const input = composeInput(req);
        const settings = store.getSettings(req.session.email);
        const result = await mail.sendMessage(req.session, input, { saveSentCopy: settings.saveSentCopy });
        store.rememberContacts(req.session.email, [...input.to, ...input.cc, ...input.bcc]);
        res.json({ ok: true, ...result });
    }));

    r.post('/drafts', parts, wrap(async (req, res) => {
        res.json({ ok: true, ...(await mail.saveDraft(req.session, composeInput(req))) });
    }));

    return r;
};
