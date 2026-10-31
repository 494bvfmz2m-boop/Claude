'use strict';

// IMAP (Purelymail) connection pool + mailbox helpers, and SMTP sending.

const crypto = require('crypto');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const MailComposer = require('nodemailer/lib/mail-composer');
const { simpleParser } = require('mailparser');
const libqp = require('libqp');
const iconv = require('iconv-lite');
const { sanitizeEmailHtml } = require('./sanitize');
const { parseQuery } = require('./query');

const IMAP = { host: process.env.IMAP_HOST || 'imap.purelymail.com', port: Number(process.env.IMAP_PORT) || 993, secure: true };
const SMTP = { host: process.env.SMTP_HOST || 'smtp.purelymail.com', port: Number(process.env.SMTP_PORT) || 465, secure: true };
const IDLE_CLOSE_MS = 5 * 60 * 1000;
const PAGE_SIZE = 50;

const pool = new Map();

function poolKey(email, password) {
    return crypto.createHash('sha256').update(email.toLowerCase() + '\0' + password).digest('hex');
}

function newClient(email, password) {
    return new ImapFlow({ ...IMAP, auth: { user: email, pass: password }, logger: false, emitLogs: false });
}

// Verify credentials by opening (and closing) a throwaway IMAP connection.
function addToPool(key, client, ready) {
    const entry = { client, ready, timer: null };
    client.on('error', () => pool.get(key) === entry && pool.delete(key));
    client.on('close', () => pool.get(key) === entry && pool.delete(key));
    pool.set(key, entry);
    return entry;
}

// Checks credentials with a real IMAP login and keeps that connection for the
// session that follows, so the first page load doesn't connect a second time.
async function verifyLogin(email, password) {
    const client = newClient(email, password);
    try {
        await client.connect();
    } catch (err) {
        if (err.authenticationFailed) return false;
        throw err;
    }
    const key = poolKey(email, password);
    const existing = pool.get(key);
    if (existing && existing.client.usable) {
        client.logout().catch(() => {});
    } else {
        const entry = addToPool(key, client, Promise.resolve());
        entry.timer = setTimeout(() => {
            pool.delete(key);
            client.logout().catch(() => {});
        }, IDLE_CLOSE_MS);
    }
    return true;
}

async function getClient({ email, password }) {
    const key = poolKey(email, password);
    let entry = pool.get(key);
    if (entry && !entry.client.usable) {
        pool.delete(key);
        entry = null;
    }
    if (!entry) {
        const client = newClient(email, password);
        entry = addToPool(key, client, client.connect());
    }
    try {
        await entry.ready;
    } catch (err) {
        pool.delete(key);
        throw err;
    }
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
        pool.delete(key);
        entry.client.logout().catch(() => {});
    }, IDLE_CLOSE_MS);
    return entry.client;
}

async function closeClient({ email, password }) {
    const key = poolKey(email, password);
    const entry = pool.get(key);
    if (!entry) return;
    pool.delete(key);
    clearTimeout(entry.timer);
    await entry.client.logout().catch(() => {});
}

// A pooled connection can be closed by the server at any moment (idle timeouts, restarts).
// Reads and flag changes are safe to repeat, so those retry once on a fresh connection;
// moves and appends never retry, because the first attempt may already have happened.
const isDeadConnection = err => !!err && (['NoConnection', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(err.code) || /connection not available|connection closed/i.test(err.message || ''));
const dropClient = session => pool.delete(poolKey(session.email, session.password));

async function withClient(session, fn, { retry = false } = {}) {
    try {
        return await fn(await getClient(session));
    } catch (err) {
        if (!retry || !isDeadConnection(err)) throw err;
        dropClient(session);
        return fn(await getClient(session));
    }
}

async function withMailbox(session, folder, fn, opts) {
    return withClient(
        session,
        async client => {
            const lock = await client.getMailboxLock(folder);
            try {
                return await fn(client);
            } finally {
                lock.release();
            }
        },
        opts
    );
}
const READ = { retry: true };
const readMailbox = (session, folder, fn) => withMailbox(session, folder, fn, READ);

/* ---------- folders ---------- */

const SPECIAL_ORDER = ['\\Inbox', '\\Flagged', '\\Snoozed', '\\Drafts', '\\Sent', '\\Archive', '\\Junk', '\\Trash'];
const SNOOZED = 'Snoozed';

async function listFolders(session) {
    const list = await withClient(session, c => c.list({ statusQuery: { messages: true, unseen: true } }), READ);
    return list
        .filter(f => !f.flags.has('\\Noselect') && !f.flags.has('\\NonExistent'))
        .map(f => ({
            path: f.path,
            name: f.path === 'INBOX' ? 'Inbox' : f.name,
            delimiter: f.delimiter,
            specialUse: f.specialUse || (f.path === 'INBOX' ? '\\Inbox' : f.path === SNOOZED ? '\\Snoozed' : null),
            messages: f.status ? f.status.messages : 0,
            unseen: f.status ? f.status.unseen : 0
        }))
        .sort((a, b) => {
            const ia = SPECIAL_ORDER.indexOf(a.specialUse);
            const ib = SPECIAL_ORDER.indexOf(b.specialUse);
            if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            return a.path.localeCompare(b.path);
        });
}

async function findSpecial(session, use, fallbackNames) {
    const list = await withClient(session, c => c.list(), READ);
    const hit = list.find(f => f.specialUse === use) || list.find(f => fallbackNames.includes(f.path.toLowerCase()));
    return hit ? hit.path : null;
}

async function ensureSpecial(session, use, name) {
    const found = await findSpecial(session, use, [name.toLowerCase()]);
    if (found) return found;
    const client = await getClient(session);
    await client.mailboxCreate(name).catch(() => {});
    return name;
}

/* ---------- message list ---------- */

function addr(list) {
    return (list || []).map(a => ({ name: a.name || '', address: a.address || '' }));
}

// Walk the BODYSTRUCTURE to find a text part for the preview and detect attachments.
function inspectStructure(node, acc = { text: null, html: null, attachments: false }) {
    if (!node) return acc;
    if (node.childNodes) {
        node.childNodes.forEach(c => inspectStructure(c, acc));
        return acc;
    }
    if (node.disposition === 'attachment' || (node.dispositionParameters && node.dispositionParameters.filename && !/^text\//.test(node.type))) {
        acc.attachments = true;
    } else if (node.type === 'text/plain' && !acc.text) {
        acc.text = node;
    } else if (node.type === 'text/html' && !acc.html) {
        acc.html = node;
    }
    return acc;
}

function decodePart(buf, node) {
    let data = buf;
    const enc = (node.encoding || '').toLowerCase();
    if (enc === 'base64') {
        const s = buf.toString('ascii').replace(/[^A-Za-z0-9+/=]/g, '');
        data = Buffer.from(s.slice(0, s.length - (s.length % 4)), 'base64');
    } else if (enc === 'quoted-printable') {
        data = libqp.decode(buf.toString('ascii'));
    }
    const charset = (node.parameters && node.parameters.charset) || 'utf-8';
    try {
        return iconv.decode(data, charset);
    } catch {
        return data.toString('utf8');
    }
}

function toPreview(text, isHtml) {
    if (isHtml) {
        text = text
            .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<[^>]*>?/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;|&apos;/g, "'")
            .replace(/&quot;/g, '"');
    }
    return text
        .split(/\r?\n/)
        .filter(l => !/^\s*>/.test(l))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180);
}

function summarize(msg) {
    const env = msg.envelope || {};
    return {
        uid: msg.uid,
        seq: msg.seq,
        subject: env.subject || '',
        from: addr(env.from),
        to: addr(env.to),
        date: (env.date || msg.internalDate || new Date()).toISOString(),
        flags: [...(msg.flags || [])],
        size: msg.size,
        hasAttachments: false,
        messageId: env.messageId || null,
        inReplyTo: env.inReplyTo || null,
        references: parseReferences(msg.headers),
        preview: ''
    };
}

// "References: <a@x> <b@y>" from a raw header buffer (the reply chain, oldest first)
function parseReferences(headers) {
    if (!headers) return [];
    const raw = headers.toString('utf8').replace(/\r?\n[ \t]+/g, ' ');
    const m = /^references:\s*(.*)$/im.exec(raw);
    return m ? (m[1].match(/<[^<>\s]+>/g) || []).slice(-20) : [];
}
const LIST_FIELDS = { uid: true, envelope: true, flags: true, internalDate: true, size: true, bodyStructure: true, headers: ['references'] };

async function listMessages(session, folder, { page = 0, query = '', filter = '' }) {
    return readMailbox(session, folder, async client => {
        const total = client.mailbox.exists;
        let range;
        let count = total;
        let uids = null;

        const criteria = query ? parseQuery(query).criteria : {};
        if (filter === 'unread') criteria.seen = false;
        if (filter === 'flagged') criteria.flagged = true;
        if (filter === 'attachments') criteria.header = { 'content-type': 'multipart/mixed' };

        if (Object.keys(criteria).length) {
            uids = ((await client.search(criteria, { uid: true })) || []).sort((a, b) => b - a);
            count = uids.length;
            const slice = uids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
            if (!slice.length) return { total: count, page, pageSize: PAGE_SIZE, messages: [] };
            range = slice.join(',');
        } else {
            if (!total) return { total: 0, page, pageSize: PAGE_SIZE, messages: [] };
            const end = total - page * PAGE_SIZE;
            if (end < 1) return { total, page, pageSize: PAGE_SIZE, messages: [] };
            range = `${Math.max(1, end - PAGE_SIZE + 1)}:${end}`;
        }

        const items = [];
        for await (const msg of client.fetch(range, LIST_FIELDS, { uid: !!uids })) {
            const item = summarize(msg);
            const s = inspectStructure(msg.bodyStructure);
            item.hasAttachments = s.attachments;
            item._part = s.text || s.html;
            item._isHtml = !s.text && !!s.html;
            items.push(item);
        }

        // Second pass: grab the first few KB of the text part for snippets.
        const byPart = new Map();
        for (const it of items) {
            if (!it._part) continue;
            const key = it._part.part || '1';
            if (!byPart.has(key)) byPart.set(key, []);
            byPart.get(key).push(it);
        }
        for (const [part, group] of byPart) {
            const byUid = new Map(group.map(it => [it.uid, it]));
            try {
                for await (const msg of client.fetch(
                    group.map(it => it.uid).join(','),
                    { uid: true, bodyParts: [{ key: part, start: 0, maxLength: 3072 }] },
                    { uid: true }
                )) {
                    const it = byUid.get(msg.uid);
                    const buf = msg.bodyParts && [...msg.bodyParts.values()][0];
                    if (it && buf) it.preview = toPreview(decodePart(buf, it._part), it._isHtml);
                }
            } catch {
                // previews are best effort
            }
        }

        items.forEach(it => {
            delete it._part;
            delete it._isHtml;
        });
        items.sort((a, b) => (uids ? b.uid - a.uid : b.seq - a.seq));
        return { total: count, page, pageSize: PAGE_SIZE, messages: items };
    });
}

/* ---------- conversations ---------- */

// Every message in the same conversation as `uid`, from this folder plus Inbox, Sent and
// Archive, oldest first. Matching uses the reply headers (Message-ID / In-Reply-To /
// References), so unrelated mail with the same subject never gets merged.
async function getThread(session, folder, uid) {
    const seed = await readMailbox(session, folder, async c => {
        const msg = await c.fetchOne(String(uid), LIST_FIELDS, { uid: true });
        return msg ? summarize(msg) : null;
    });
    if (!seed) throw Object.assign(new Error('Message not found'), { status: 404 });
    const ids = [...new Set([seed.messageId, seed.inReplyTo, ...seed.references].filter(Boolean))].slice(-12);
    const root = seed.references[0] || seed.inReplyTo || seed.messageId;
    if (!root) return { messages: [{ ...seed, folder }] };

    const list = await withClient(session, c => c.list(), READ);
    const pick = use => (list.find(f => f.specialUse === use) || {}).path;
    const folders = [...new Set([folder, 'INBOX', pick('\\Sent'), pick('\\Archive')].filter(Boolean))];
    const ors = [{ header: { references: root } }, { header: { 'in-reply-to': root } }, ...ids.map(id => ({ header: { 'message-id': id } }))];

    const found = new Map(); // messageId -> summary (the current folder's copy wins)
    for (const path of folders) {
        await readMailbox(session, path, async c => {
            if (!c.mailbox.exists) return;
            const uids = (await c.search({ or: ors }, { uid: true })) || [];
            if (!uids.length) return;
            for await (const msg of c.fetch(uids.slice(-50).join(','), LIST_FIELDS, { uid: true })) {
                const item = { ...summarize(msg), folder: path, hasAttachments: inspectStructure(msg.bodyStructure).attachments };
                const key = item.messageId || `${path}:${item.uid}`;
                if (!found.has(key) || path === folder) found.set(key, item);
            }
        }).catch(() => {}); // a folder we can't open just doesn't contribute
    }
    if (!found.size) found.set(seed.messageId || 'seed', { ...seed, folder });
    const messages = [...found.values()].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-50);
    messages.forEach(m => delete m.seq);
    return { messages };
}

// How many results a search would find in each other folder ("also in Archive: 4").
async function searchCounts(session, query, exceptFolder) {
    const { criteria } = parseQuery(query);
    if (!Object.keys(criteria).length) return [];
    const list = await withClient(session, c => c.list(), READ);
    const out = [];
    for (const f of list) {
        if (f.path === exceptFolder || f.flags.has('\\Noselect') || ['\\Junk', '\\Trash'].includes(f.specialUse)) continue;
        await readMailbox(session, f.path, async c => {
            if (!c.mailbox.exists) return;
            const uids = (await c.search(criteria, { uid: true })) || [];
            if (uids.length) out.push({ path: f.path, name: f.path === 'INBOX' ? 'Inbox' : f.name, count: uids.length });
        }).catch(() => {});
    }
    return out;
}

/* ---------- single message ---------- */

async function fetchParsed(session, folder, uid) {
    return readMailbox(session, folder, async client => {
        const msg = await client.fetchOne(String(uid), { uid: true, source: true, flags: true }, { uid: true });
        if (!msg || !msg.source) {
            const err = new Error('Message not found');
            err.status = 404;
            throw err;
        }
        const parsed = await simpleParser(msg.source, { skipImageLinks: true });
        return { parsed, flags: [...(msg.flags || [])], source: msg.source };
    });
}

function inlineCids(html, attachments) {
    if (!html) return html;
    for (const att of attachments) {
        if (!att.contentId || !att.content || att.size > 3 * 1024 * 1024 || !/^image\//.test(att.contentType)) continue;
        const cid = att.contentId.replace(/^<|>$/g, '');
        const dataUrl = `data:${att.contentType};base64,${att.content.toString('base64')}`;
        html = html.split(`cid:${cid}`).join(dataUrl);
    }
    return html;
}

function parsedAddr(field) {
    if (!field) return [];
    return [].concat(field).flatMap(f => f.value || []).map(a => ({ name: a.name || '', address: a.address || '' }));
}

function unsubscribeLink(parsed) {
    const list = parsed.headers && parsed.headers.get('list');
    if (!list || !list.unsubscribe) return null;
    const opts = [].concat(list.unsubscribe).map(u => u.url || (u.mail ? `mailto:${u.mail}` : null)).filter(Boolean);
    return opts.find(u => /^https:/i.test(u)) || opts[0] || null;
}

async function getMessage(session, folder, uid, { markSeen = true } = {}) {
    const { parsed, flags } = await fetchParsed(session, folder, uid);
    if (markSeen && !flags.includes('\\Seen')) {
        await withMailbox(session, folder, c => c.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })).catch(() => {});
        flags.push('\\Seen');
    }
    const attachments = parsed.attachments || [];
    let html = parsed.html ? inlineCids(parsed.html, attachments) : null;
    const hasRemoteImages = !!html && /<img[^>]+src\s*=\s*["']?\s*https?:/i.test(html);
    html = html ? sanitizeEmailHtml(html) : null;

    return {
        uid: Number(uid),
        folder,
        subject: parsed.subject || '',
        from: parsedAddr(parsed.from),
        to: parsedAddr(parsed.to),
        cc: parsedAddr(parsed.cc),
        bcc: parsedAddr(parsed.bcc),
        replyTo: parsedAddr(parsed.replyTo),
        date: (parsed.date || new Date()).toISOString(),
        messageId: parsed.messageId || null,
        references: [].concat(parsed.references || []),
        flags,
        html,
        text: parsed.text || '',
        hasRemoteImages,
        unsubscribe: unsubscribeLink(parsed),
        attachments: attachments
            .map((a, idx) => ({ idx, filename: a.filename || `attachment-${idx + 1}`, contentType: a.contentType, size: a.size, inline: !!(a.contentId && a.related) }))
            .filter(a => !a.inline)
    };
}

async function getAttachment(session, folder, uid, idx) {
    const { parsed } = await fetchParsed(session, folder, uid);
    const att = (parsed.attachments || [])[idx];
    if (!att) {
        const err = new Error('Attachment not found');
        err.status = 404;
        throw err;
    }
    return att;
}

async function getRaw(session, folder, uid) {
    return (await fetchParsed(session, folder, uid)).source;
}

/* ---------- flags / move / delete ---------- */

async function setFlags(session, folder, uids, { add = [], remove = [] }) {
    return readMailbox(session, folder, async client => {
        const range = uids.join(',');
        if (add.length) await client.messageFlagsAdd(range, add, { uid: true });
        if (remove.length) await client.messageFlagsRemove(range, remove, { uid: true });
    });
}

async function moveMessages(session, folder, uids, target) {
    return withMailbox(session, folder, client => client.messageMove(uids.join(','), target, { uid: true }));
}

async function deleteMessages(session, folder, uids) {
    const trash = await findSpecial(session, '\\Trash', ['trash', 'deleted items', 'deleted messages']);
    if (trash && trash !== folder) {
        await moveMessages(session, folder, uids, trash);
        return { movedTo: trash };
    }
    await withMailbox(session, folder, client => client.messageDelete(uids.join(','), { uid: true }));
    return { deleted: true };
}

async function emptyFolder(session, folder) {
    return withMailbox(session, folder, client => (client.mailbox.exists ? client.messageDelete('1:*') : null));
}

async function createFolder(session, name) {
    const client = await getClient(session);
    return client.mailboxCreate(name);
}

async function deleteFolder(session, folderPath) {
    const client = await getClient(session);
    return client.mailboxDelete(folderPath);
}

/* ---------- snooze ---------- */

// Moves messages into the Snoozed folder and returns their Message-IDs so they can be found again.
async function snoozeMessages(session, folder, uids) {
    const client = await getClient(session);
    const list = await client.list();
    if (!list.some(f => f.path === SNOOZED)) await client.mailboxCreate(SNOOZED).catch(() => {});
    return withMailbox(session, folder, async c => {
        const ids = [];
        for await (const msg of c.fetch(uids.join(','), { uid: true, envelope: true }, { uid: true })) {
            if (msg.envelope && msg.envelope.messageId) ids.push(msg.envelope.messageId);
        }
        await c.messageMove(uids.join(','), SNOOZED, { uid: true });
        return ids;
    });
}

// Moves due snoozed messages back where they came from, marked unread so they resurface.
async function wakeSnoozes(session, due) {
    let woke = 0;
    for (const s of due) {
        await withMailbox(session, SNOOZED, async c => {
            const uids = await c.search({ header: { 'message-id': s.messageId } }, { uid: true });
            if (!uids || !uids.length) return;
            await c.messageFlagsRemove(uids.join(','), ['\\Seen'], { uid: true });
            await c.messageMove(uids.join(','), s.from || 'INBOX', { uid: true });
            woke += uids.length;
        }).catch(() => {});
    }
    return woke;
}

/* ---------- compose / send / drafts ---------- */

async function buildMessage(session, input) {
    const mail = {
        from: input.fromName ? { name: input.fromName, address: session.email } : session.email,
        to: input.to,
        cc: input.cc,
        bcc: input.bcc,
        subject: input.subject || '',
        html: input.html,
        text: input.text,
        attachments: input.attachments || [],
        inReplyTo: input.inReplyTo || undefined,
        references: input.references && input.references.length ? input.references : undefined,
        messageId: `<${crypto.randomUUID()}@${session.email.split('@')[1] || 'ederveengroup.local'}>`,
        date: new Date()
    };
    if (input.forwardFrom) {
        const { parsed } = await fetchParsed(session, input.forwardFrom.folder, input.forwardFrom.uid);
        for (const a of parsed.attachments || []) {
            if (a.contentId && a.related) continue;
            mail.attachments.push({ filename: a.filename, content: a.content, contentType: a.contentType });
        }
    }
    const build = keepBcc => {
        const node = new MailComposer(mail).compile();
        node.keepBcc = keepBcc;
        return node.build();
    };
    return { mail, raw: await build(false), rawWithBcc: await build(true) };
}

function recipientsOf(mail) {
    return [].concat(mail.to || [], mail.cc || [], mail.bcc || []).map(a => a.address).filter(Boolean);
}

async function sendMessage(session, input, { saveSentCopy = true } = {}) {
    const { mail, raw, rawWithBcc } = await buildMessage(session, input);
    const recipients = recipientsOf(mail);
    if (!recipients.length) {
        const err = new Error('Add at least one recipient');
        err.status = 400;
        throw err;
    }
    const transport = nodemailer.createTransport({ ...SMTP, auth: { user: session.email, pass: session.password } });
    try {
        await transport.sendMail({ envelope: { from: session.email, to: recipients }, raw });
    } finally {
        transport.close();
    }
    let sentFolder = null;
    if (saveSentCopy) {
        try {
            sentFolder = await ensureSpecial(session, '\\Sent', 'Sent');
            const client = await getClient(session);
            await client.append(sentFolder, rawWithBcc, ['\\Seen']);
        } catch {
            sentFolder = null;
        }
    }
    if (input.draftUid) await removeDraft(session, input.draftUid).catch(() => {});
    if (input.answeredUid && input.answeredFolder) {
        await setFlags(session, input.answeredFolder, [input.answeredUid], { add: ['\\Answered'] }).catch(() => {});
    }
    return { messageId: mail.messageId, sentFolder };
}

async function removeDraft(session, uid) {
    const drafts = await findSpecial(session, '\\Drafts', ['drafts']);
    if (!drafts) return;
    await withMailbox(session, drafts, client => client.messageDelete(String(uid), { uid: true }));
}

async function saveDraft(session, input) {
    const { rawWithBcc } = await buildMessage(session, input);
    const drafts = await ensureSpecial(session, '\\Drafts', 'Drafts');
    const client = await getClient(session);
    const res = await client.append(drafts, rawWithBcc, ['\\Draft', '\\Seen']);
    if (input.draftUid) await removeDraft(session, input.draftUid).catch(() => {});
    return { folder: drafts, uid: res && res.uid ? res.uid : null };
}

/* ---------- live updates ---------- */

// Opens a dedicated IDLE connection on INBOX and calls onChange when mail arrives.
async function watchInbox(session, onChange) {
    const client = newClient(session.email, session.password);
    await client.connect();
    await client.mailboxOpen('INBOX');
    client.on('exists', data => onChange({ type: 'exists', ...data }));
    client.on('flags', () => onChange({ type: 'flags' }));
    client.on('expunge', () => onChange({ type: 'expunge' }));
    client.on('error', () => {});
    client.idle().catch(() => {}); // start IDLE now instead of waiting for auto-idle
    return () => client.logout().catch(() => {});
}

module.exports = {
    verifyLogin,
    closeClient,
    listFolders,
    listMessages,
    getMessage,
    getAttachment,
    getRaw,
    setFlags,
    moveMessages,
    deleteMessages,
    emptyFolder,
    createFolder,
    deleteFolder,
    sendMessage,
    saveDraft,
    removeDraft,
    watchInbox,
    findSpecial,
    snoozeMessages,
    wakeSnoozes,
    getThread,
    searchCounts
};
