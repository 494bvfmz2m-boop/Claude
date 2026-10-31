// EderveenGroup client: reader
import { addFlag, archive, moveTo, pickFolder, remove, setSeen, toggleStar } from './actions.js';
import { openComposer } from './composer.js';
import { openFolder, renderFolders } from './folders.js';
import { greetingFor, threadOf } from './list.js';
import { showMenu } from './menus.js';
import { onKey } from './palette.js';
import { snoozeMenu } from './snooze.js';
import { folderInfo, isDrafts, specialPath, state } from './state.js';
import { $, $$, api, avatar, calm, esc, fmtAddrList, fmtDate, fmtSize, h, personName, qs, toast } from './util.js';

const TIPS = [
    ['B', 'snoozes a conversation until you actually need it.'],
    ['E', 'archives. Swipe right does the same on your phone.'],
    ['Ctrl K', 'opens the command palette from anywhere.'],
    ['J K', 'fly through conversations without the mouse.'],
    ['Shift', '+ click selects a whole range of messages.'],
    ['Ctrl Enter', 'sends. You still get a few seconds to undo.']
];
let tip = TIPS[Math.floor(Math.random() * TIPS.length)];

function showEmptyReader() {
    state.openUid = null;
    state.current = null;
    $$('.msg.selected').forEach(x => x.classList.remove('selected'));
    renderWelcome();
}

function renderWelcome() {
    if (state.openUid || !state.me) return;
    const now = new Date();
    const count = use => {
        const f = state.folders.find(x => x.specialUse === use);
        return f ? (use === '\\Inbox' ? f.unseen : f.messages) : 0;
    };
    const stats = [
        ['\\Inbox', 'Unread', 'inbox'],
        ['\\Snoozed', 'Snoozed', 'clock'],
        ['\\Drafts', 'Drafts', 'draft']
    ];
    const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const digits = t => [...t].map(ch => `<span class="dg">${esc(ch)}</span>`).join('');
    const existing = $('.welcome');
    if (existing) {
        // refresh in place so the entrance animation doesn't replay; changed digits roll over
        const clock = $('.w-time', existing);
        const spans = $$('.dg', clock);
        if (spans.length !== time.length) clock.innerHTML = digits(time);
        else [...time].forEach((ch, i) => {
            if (spans[i].textContent === ch) return;
            const d = h(`<span class="dg roll">${esc(ch)}</span>`);
            spans[i].replaceWith(d);
        });
        $$('.w-stats button', existing).forEach((btn, i) => {
            const path = stats[i][0] === '\\Inbox' ? 'INBOX' : specialPath(stats[i][0]);
            btn.dataset.go = path || '';
            btn.disabled = !path;
            const b = $('b', btn), n = String(count(stats[i][0]));
            if (b.textContent !== n) {
                b.textContent = n;
                b.classList.remove('roll');
                void b.offsetWidth;
                b.classList.add('roll');
            }
        });
        return;
    }
    $('#reader').innerHTML = `<div class="welcome"><div class="welcome-inner">
        <div class="w-time">${digits(time)}</div>
        <div class="w-date">${esc(now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
        <h3 class="w-hi">${esc(greetingFor())}.</h3>
        <div class="w-stats">${stats
            .map(([use, label, ic]) => {
                const path = use === '\\Inbox' ? 'INBOX' : specialPath(use);
                return `<button data-go="${esc(path || '')}" ${path ? '' : 'disabled'}>${icon(ic)}<b>${count(use)}</b><span>${label}</span></button>`;
            })
            .join('')}</div>
        <div class="w-tip">${tip[0].split(' ').map(k => `<kbd>${k}</kbd>`).join(' ')} ${esc(tip[1])}</div>
    </div></div>`;
}
setInterval(() => !state.openUid && $('.welcome') && renderWelcome(), 15000);

// stat cards tilt towards the cursor in 3D
let tiltRaf = 0, tiltEvent = null;
$('#reader').addEventListener('pointermove', e => {
    tiltEvent = e;
    if (tiltRaf || calm) return;
    tiltRaf = requestAnimationFrame(() => {
        tiltRaf = 0;
        const card = tiltEvent.target.closest && tiltEvent.target.closest('.w-stats button');
        $$('.w-stats button.tilt').forEach(b => b !== card && b.classList.remove('tilt'));
        if (!card) return;
        const r = card.getBoundingClientRect();
        const x = (tiltEvent.clientX - r.left) / r.width, y = (tiltEvent.clientY - r.top) / r.height;
        card.classList.add('tilt');
        card.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
        card.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
        card.style.setProperty('--gx', `${x * 100}%`);
        card.style.setProperty('--gy', `${y * 100}%`);
    });
}, { passive: true });
$('#reader').addEventListener('pointerleave', () => $$('.w-stats button.tilt').forEach(b => b.classList.remove('tilt')));
$('#reader').addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go && go.dataset.go) openFolder(go.dataset.go);
});

// Full messages are fetched with peek=1 (never marks read) so hovering can prefetch them.
const msgCache = new Map();
function fetchMessage(folder, uid) {
    const key = `${folder}\u0000${uid}`;
    if (!msgCache.has(key)) {
        const p = api('api/message?' + qs({ folder, uid, peek: 1 }));
        p.catch(() => msgCache.delete(key));
        msgCache.set(key, p);
        if (msgCache.size > 80) msgCache.delete(msgCache.keys().next().value);
    }
    return msgCache.get(key);
}
let hoverTimer;
$('#messages').addEventListener('mouseover', e => {
    const row = e.target.closest('.msg');
    clearTimeout(hoverTimer);
    if (row && !isDrafts()) hoverTimer = setTimeout(() => fetchMessage(state.folder, Number(row.dataset.uid)), 90);
});

async function withMessage(uid, fn) {
    try {
        fn(state.current && state.current.uid === uid ? state.current : await fetchMessage(state.folder, uid));
    } catch (e) {
        toast(e.message, { error: true });
    }
}

/* ---------------- conversations ---------------- */

// The open conversation: every message in it (summaries, oldest first) and which are expanded.
// state.current is the message actions such as reply apply to (the newest one).
const convo = { messages: [], open: new Set(), full: new Map(), folder: null, showAll: false };
const keyOf = m => `${m.folder}:${m.uid}`;
const threadCache = new Map();
const stripPrefix = s => String(s || '').replace(/^\s*((re|fwd?|aw|wg|antw)\s*:\s*)+/i, '');

function fetchThread(folder, uid) {
    const key = `${folder}\u0000${uid}`;
    if (!threadCache.has(key)) {
        const p = api('api/thread?' + qs({ folder, uid }));
        p.catch(() => threadCache.delete(key));
        threadCache.set(key, p);
        if (threadCache.size > 40) threadCache.delete(threadCache.keys().next().value);
    }
    return threadCache.get(key);
}

// uids of the open conversation that live in the current folder (what folder actions apply to)
function convoUids() {
    const here = convo.messages.filter(m => m.folder === state.folder).map(m => m.uid);
    return here.length ? here : state.current ? [state.current.uid] : [];
}

let readToken = 0;
let activeMorph = null;
async function openMessage(uid) {
    const token = ++readToken;
    state.openUid = uid;
    $$('.msg').forEach(x => x.classList.toggle('selected', Number(x.dataset.uid) === uid));
    const row = $(`.msg[data-uid="${uid}"]`);
    if (row) row.scrollIntoView({ block: 'nearest' });
    if (isDrafts()) {
        try {
            const msg = await api('api/message?' + qs({ folder: state.folder, uid, peek: 1 }));
            openComposer('draft', msg);
        } catch (e) {
            toast(e.message, { error: true });
        }
        return;
    }
    // the subject and avatar fly from the list into the reader (View Transitions, where supported)
    const morph = !!(row && document.startViewTransition && !calm && !document.hidden);
    if (!morph) $('#app').dataset.view = 'reader';
    else row.classList.add('opening');
    const folder = state.folder;
    const slow = setTimeout(() => token === readToken && ($('#reader').innerHTML = `<div class="empty"><div class="spinner"></div></div>`), 160);
    const wantThread = state.settings.conversations !== false;
    const threadP = wantThread ? fetchThread(folder, uid).catch(() => null) : null;
    try {
        const msg = await fetchMessage(folder, uid);
        clearTimeout(slow);
        if (token !== readToken) return;
        msg.folder = folder;
        const listed = state.messages.find(m => m.uid === uid);
        if (listed) msg.flags = [...listed.flags];
        state.current = msg;
        // start with what the list already knows about the conversation; the full thread
        // (including your replies in Sent) is merged in when it arrives
        const known = (wantThread && threadOf(uid)) || [listed || msg];
        Object.assign(convo, { messages: known.map(m => ({ ...m, folder: m.folder || folder })).sort(byDate), open: new Set([keyOf(msg)]), full: new Map([[keyOf(msg), msg]]), folder, showAll: false });
        markConversationRead();
        row?.classList.remove('opening');
        const show = () => {
            $('#app').dataset.view = 'reader';
            renderReader({ morph });
        };
        const subj = morph && row.isConnected ? row.querySelector('.msg-subject') : null;
        if (subj) {
            // only one morph at a time: finish the previous one and drop its names
            if (activeMorph) activeMorph.skipTransition();
            $$('[style*="view-transition-name"]').forEach(x => (x.style.viewTransitionName = ''));
            const av = row.querySelector('.sel-toggle .avatar');
            subj.style.viewTransitionName = 'eg-subject';
            if (av) av.style.viewTransitionName = 'eg-avatar';
            const t = (activeMorph = document.startViewTransition(() => {
                subj.style.viewTransitionName = '';
                if (av) av.style.viewTransitionName = '';
                show();
            }));
            t.ready.catch(() => {});
            t.finished
                .catch(() => {})
                .then(() => {
                    if (activeMorph === t) activeMorph = null;
                    $$('.reader-content [style*="view-transition-name"]').forEach(x => (x.style.viewTransitionName = ''));
                });
        } else show();
        if (threadP) mergeThread(await threadP, token);
    } catch (e) {
        row?.classList.remove('opening');
        if (morph) $('#app').dataset.view = 'reader';
        clearTimeout(slow);
        if (token !== readToken) return;
        $('#reader').innerHTML = `<div class="empty"><div><div class="big">${icon('junk')}</div><h3>Couldn’t open that one</h3><p>${esc(e.message)}</p></div></div>`;
    }
}

const byDate = (a, b) => new Date(a.date) - new Date(b.date);

function mergeThread(thread, token) {
    if (!thread || token !== readToken || !thread.messages || thread.messages.length < 2) return;
    const before = new Set(convo.messages.map(keyOf));
    const merged = new Map(convo.messages.map(m => [keyOf(m), m]));
    for (const m of thread.messages) if (!merged.has(keyOf(m))) merged.set(keyOf(m), m);
    convo.messages = [...merged.values()].sort(byDate);
    const added = convo.messages.filter(m => !before.has(keyOf(m)));
    if (!added.length) return;
    markConversationRead();
    renderConversation({ fresh: new Set(added.map(keyOf)) });
}

// Opening a conversation reads all of it (in this folder), like other mail apps.
function markConversationRead() {
    const unread = convo.messages.filter(m => m.folder === state.folder && m.flags && !m.flags.includes('\\Seen'));
    const listedUnread = convo.messages
        .filter(m => m.folder === state.folder)
        .map(m => state.messages.find(x => x.uid === m.uid))
        .filter(m => m && !m.flags.includes('\\Seen'));
    const uids = [...new Set([...unread.map(m => m.uid), ...listedUnread.map(m => m.uid)])];
    if (!uids.length) return;
    unread.forEach(m => addFlag(m, '\\Seen'));
    if (state.current && uids.includes(state.current.uid)) addFlag(state.current, '\\Seen');
    api('api/messages/flags', { method: 'POST', body: { folder: state.folder, uids, add: ['\\Seen'] } }).catch(() => {});
    let changed = 0;
    for (const m of listedUnread) {
        addFlag(m, '\\Seen');
        changed++;
    }
    const r = $(`.msg[data-uid="${state.openUid}"]`);
    if (r && r.classList.contains('unread')) {
        r.classList.add('reading');
        setTimeout(() => r.classList.remove('unread', 'reading'), 380);
    }
    const f = folderInfo(state.folder);
    if (changed && f.unseen) {
        f.unseen = Math.max(0, f.unseen - changed);
        renderFolders();
    }
}

function renderReaderBar() {
    const m = state.current;
    const bar = $('.reader-bar');
    if (!bar || !m) return;
    const starred = convo.messages.some(x => x.folder === state.folder && (x.flags || []).includes('\\Flagged')) || m.flags.includes('\\Flagged');
    $('[data-act=star]', bar).classList.toggle('active', starred);
    $('[data-act=star]', bar).innerHTML = icon('star').replace('fill="none"', starred ? 'fill="currentColor"' : 'fill="none"');
}

const remoteOkFor = m => state.settings.loadRemoteImages || state.allowImagesFor.has(((m.from[0] || {}).address || '').toLowerCase()) || state.allowImagesFor.has(keyOf(m));
const recipientsLine = m =>
    [...(m.to || []), ...(m.cc || [])].map(p => (p.address.toLowerCase() === state.me.email ? 'me' : personName(p))).join(', ') || 'undisclosed recipients';

function cardHtml(m, { morph = false, fresh = false } = {}) {
    const key = keyOf(m);
    const full = convo.full.get(key);
    const open = convo.open.has(key) && full;
    const from = m.from[0] || { address: '' };
    const mine = (from.address || '').toLowerCase() === state.me.email;
    const av = avatar(from, open ? 'lg' : '');
    const cls = `mcard${open ? ' open' : ''}${fresh ? ' fresh' : ''}${mine ? ' mine' : ''}`;
    if (!open) {
        return `<article class="${cls}" data-key="${esc(key)}">
            <header class="mc-head" data-act="toggle">${av}
                <div class="mc-who"><b>${esc(mine ? 'me' : from.name || from.address)}</b><span class="mc-snip">${esc(m.preview || '')}</span></div>
                <span class="mc-meta">${m.hasAttachments ? icon('clip') : ''}${m.folder !== convo.folder ? `<span class="mc-folder">${esc(folderInfo(m.folder).name || m.folder)}</span>` : ''}<span class="mc-date">${esc(fmtDate(m.date))}</span></span>
            </header></article>`;
    }
    const f = full;
    const remoteOk = remoteOkFor(f);
    return `<article class="${cls}" data-key="${esc(key)}">
        <header class="mc-head${convo.messages.length > 1 ? '' : ' solo'}" data-act="${convo.messages.length > 1 ? 'toggle' : ''}">
            ${morph ? av.replace('style="', 'style="view-transition-name:eg-avatar;') : av}
            <div class="info">
                <div><span class="name">${esc(from.name || from.address)}</span>${from.name ? `<span class="addr">&lt;${esc(from.address)}&gt;</span>` : ''}</div>
                <div class="to" data-act="details">to ${esc(recipientsLine(f))} ${icon('down')}</div>
            </div>
            <div class="mc-side"><span class="when">${esc(fmtDate(f.date, true))}</span>
                <span class="mc-actions"><button class="icon-btn" data-act="reply" title="Reply">${icon('reply')}</button><button class="icon-btn" data-act="more" title="More">${icon('more')}</button></span></div>
        </header>
        <dl class="details hidden">
            <dt>From</dt><dd>${esc(fmtAddrList(f.from))}</dd>
            ${f.replyTo.length ? `<dt>Reply-To</dt><dd>${esc(fmtAddrList(f.replyTo))}</dd>` : ''}
            <dt>To</dt><dd>${esc(fmtAddrList(f.to)) || '—'}</dd>
            ${f.cc.length ? `<dt>Cc</dt><dd>${esc(fmtAddrList(f.cc))}</dd>` : ''}
            ${f.bcc.length ? `<dt>Bcc</dt><dd>${esc(fmtAddrList(f.bcc))}</dd>` : ''}
            <dt>Date</dt><dd>${esc(fmtDate(f.date, true))}</dd>
        </dl>
        ${f.hasRemoteImages && !remoteOk ? `<div class="banner">${icon('image')}<span>Remote images are hidden to protect your privacy.</span><button data-act="images">Show images</button><button data-act="images-always">Always from sender</button></div>` : ''}
        ${f.unsubscribe ? `<div class="banner subtle">${icon('unsubscribe')}<span>This looks like a mailing list.</span><button data-act="unsubscribe">Unsubscribe</button></div>` : ''}
        <div class="body-host"></div>
        ${f.attachments.length ? `<div class="attachments">${f.attachments.map(a => attachmentCard(f, a)).join('')}</div>` : ''}
    </article>`;
}

function renderConversation({ morph = false, fresh = new Set() } = {}) {
    const host = $('#convo');
    if (!host) return;
    const list = convo.messages;
    // long conversations: first message, "N more", then the last two (expanded ones always show)
    let items = list.map(m => ({ m }));
    if (!convo.showAll && list.length > 4) {
        const keep = new Set([0, list.length - 2, list.length - 1]);
        list.forEach((m, i) => convo.open.has(keyOf(m)) && keep.add(i));
        items = [];
        let hidden = 0;
        list.forEach((m, i) => {
            if (keep.has(i)) {
                if (hidden) items.push({ more: hidden });
                hidden = 0;
                items.push({ m });
            } else hidden++;
        });
    }
    host.innerHTML = items.map(it => (it.more ? `<button class="mc-more" data-act="show-all"><span>${it.more} more message${it.more > 1 ? 's' : ''}</span></button>` : cardHtml(it.m, { morph: morph && it.m === state.current, fresh: fresh.has(keyOf(it.m)) }))).join('');
    const count = $('.reader-content .convo-count');
    if (count) count.textContent = list.length > 1 ? `${list.length} messages` : '';
    for (const m of list) {
        const full = convo.full.get(keyOf(m));
        if (convo.open.has(keyOf(m)) && full) renderBody(full, remoteOkFor(full), $(`.mcard[data-key="${CSS.escape(keyOf(m))}"] .body-host`, host));
    }
    renderReaderBar();
}

function renderReader({ morph = false } = {}) {
    const m = state.current;
    if (!m) return;
    const subject = stripPrefix(convo.messages[0]?.subject || m.subject) || m.subject;
    const people = [...new Set(convo.messages.flatMap(x => [...(x.to || []), ...(x.cc || []), ...x.from]).map(p => p.address.toLowerCase()))];
    $('#reader').innerHTML = `
        <div class="reader-bar">
            <button class="icon-btn back-btn" data-act="back" data-tip="Back">${icon('left')}</button>
            <button class="icon-btn" data-act="archive" data-tip="Archive (E)">${icon('archive')}</button>
            <button class="icon-btn" data-act="junk" data-tip="Spam">${icon('junk')}</button>
            <button class="icon-btn" data-act="delete" data-tip="Delete (#)">${icon('trash')}</button>
            <span class="sep"></span>
            <button class="icon-btn" data-act="unread" data-tip="Mark unread (U)">${icon('mail')}</button>
            <button class="icon-btn" data-act="snooze" data-tip="Snooze (B)">${icon('clock')}</button>
            <button class="icon-btn" data-act="star" data-tip="Star (S)">${icon('star')}</button>
            <button class="icon-btn" data-act="move" data-tip="Move to…">${icon('folder')}</button>
            <span class="spacer"></span>
            <button class="icon-btn" data-act="reply" data-tip="Reply (R)">${icon('reply')}</button>
            <button class="icon-btn" data-act="replyAll" data-tip="Reply all (A)">${icon('replyAll')}</button>
            <button class="icon-btn" data-act="forward" data-tip="Forward (F)">${icon('forward')}</button>
        </div>
        <div class="reader-scroll"><div class="reader-content${morph ? ' vt' : ''}">
            <div class="convo-head"><h1${morph ? ' style="view-transition-name:eg-subject"' : ''}>${esc(subject || '(no subject)')}</h1><span class="convo-count"></span></div>
            <div class="convo" id="convo"></div>
            <div class="inline-reply" id="inline-reply">
                ${avatar({ address: state.me.email, name: state.settings.displayName }, 'sm')}
                <button class="ir-box" data-act="reply">Reply to ${esc(personName((latestIncoming() || m).from[0]) || 'sender')}…</button>
                ${people.length > 2 ? `<button class="btn" data-act="replyAll">${icon('replyAll')} Reply all</button>` : ''}
                <button class="btn" data-act="forward">${icon('forward')} Forward</button>
            </div>
        </div></div>`;
    renderConversation({ morph });
}

// the newest message that isn't from you (what "Reply" answers), else the newest
const latestIncoming = () => [...convo.messages].reverse().find(x => (x.from[0]?.address || '').toLowerCase() !== state.me.email);
async function replyTarget() {
    const last = convo.messages[convo.messages.length - 1];
    if (!last || keyOf(last) === keyOf(state.current)) return state.current;
    return convo.full.get(keyOf(last)) || Object.assign(await fetchMessage(last.folder, last.uid), { folder: last.folder });
}

// Reply / forward. From the inline box it opens right inside the conversation.
async function startReply(mode, m, inline) {
    const target = m || (await replyTarget());
    const mount = inline && $('#inline-reply');
    // "Send & archive" files the conversation that was open when you hit reply
    const folder = state.folder, uids = convoUids();
    const onSent = ({ archive: andArchive } = {}) => (andArchive && state.folder === folder && uids.length ? archive(uids) : refreshConversation());
    openComposer(mode, target, {}, mount ? { mount, onClose: () => mount.classList.remove('composing'), onSent } : { onSent });
    if (mount) mount.classList.add('composing');
}

// after sending from the conversation, pick up the reply from Sent
function refreshConversation() {
    const uid = state.openUid, folder = state.folder;
    if (!uid) return;
    threadCache.delete(`${folder}\u0000${uid}`);
    const token = readToken;
    setTimeout(() => fetchThread(folder, uid).then(t => mergeThread(t, token)).catch(() => {}), 1200);
}

async function toggleCard(card) {
    const m = convo.messages.find(x => keyOf(x) === card.dataset.key);
    if (!m) return;
    const key = keyOf(m);
    if (convo.open.has(key) && convo.full.has(key)) {
        if (convo.messages.length < 2) return;
        convo.open.delete(key);
        return renderConversation();
    }
    convo.open.add(key);
    card.classList.add('loading');
    try {
        const full = await fetchMessage(m.folder, m.uid);
        full.folder = m.folder;
        convo.full.set(key, full);
        renderConversation();
        $(`.mcard[data-key="${CSS.escape(key)}"]`)?.classList.add('opened');
    } catch (e) {
        convo.open.delete(key);
        card.classList.remove('loading');
        toast(e.message, { error: true });
    }
}

function attachmentCard(m, a) {
    const ext = (a.filename.split('.').pop() || 'file').slice(0, 4);
    const href = 'api/attachment?' + qs({ folder: m.folder, uid: m.uid, idx: a.idx });
    return `<a class="att" href="${href}" target="_blank" rel="noopener"><span class="ext">${esc(ext)}</span><span class="meta"><b>${esc(a.filename)}</b><small>${fmtSize(a.size)}</small></span>
        <span class="icon-btn" data-download="${esc(href + '&download=1')}" title="Download">${icon('download')}</span></a>`;
}

function renderBody(m, remoteOk, host = $('.mcard.open .body-host')) {
    if (!host) return;
    if (!m.html) {
        const linked = esc(m.text).replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        host.innerHTML = `<div class="body-text">${linked || '<span style="color:var(--text-3)">(empty message)</span>'}</div>`;
        return;
    }
    const csp = `default-src 'none'; img-src data: cid:${remoteOk ? ' https: http:' : ''}; style-src 'unsafe-inline'; font-src data:${remoteOk ? ' https:' : ''}`;
    const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
        <style>html,body{margin:0}body{padding:20px;font:14.5px/1.55 -apple-system,'Segoe UI',Roboto,Inter,sans-serif;color:#1d1d2b;background:#fff;word-wrap:break-word;overflow-wrap:anywhere}
        img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}blockquote{border-left:3px solid #ccc;margin:8px 0;padding-left:12px;color:#555}a{color:#2563eb}${remoteOk ? '' : 'img[src^="http:"],img[src^="https:"]{visibility:hidden}'}</style></head><body>${m.html}</body></html>`;
    const frame = h('<iframe class="body-frame" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" title="Message body"></iframe>');
    frame.srcdoc = doc;
    host.replaceChildren(frame);
    frame.addEventListener('load', () => {
        const d = frame.contentDocument;
        if (!d) return;
        const fit = () => (frame.style.height = d.documentElement.scrollHeight + 'px');
        fit();
        new ResizeObserver(fit).observe(d.body);
        $$('img', d).forEach(img => img.addEventListener('load', fit));
        // keyboard shortcuts keep working while the iframe has focus
        d.addEventListener('keydown', e => onKey(e));
    });
}

$('#reader').addEventListener('click', e => {
    const dl = e.target.closest('[data-download]');
    if (dl) {
        e.preventDefault();
        location.href = dl.dataset.download;
        return;
    }
    const b = e.target.closest('[data-act]');
    if (!b || !state.current) return;
    const card = b.closest('.mcard');
    const m = (card && convo.full.get(card.dataset.key)) || state.current;
    const uids = convoUids();
    const act = b.dataset.act;
    if (act === 'toggle') {
        if (e.target.closest('.mc-actions, [data-act="details"]')) return;
        return toggleCard(card);
    }
    switch (act) {
        case 'back':
            $('#app').dataset.view = 'list';
            break;
        case 'archive':
            archive(uids);
            break;
        case 'junk':
            moveTo(uids, '\\Junk', 'Spam');
            break;
        case 'delete':
            remove(uids);
            break;
        case 'unread':
            setSeen(uids, false);
            showEmptyReader();
            $('#app').dataset.view = 'list';
            break;
        case 'star':
            toggleStar(uids);
            break;
        case 'snooze': {
            const r = b.getBoundingClientRect();
            snoozeMenu(r.left, r.bottom + 4, uids);
            break;
        }
        case 'move': {
            const r = b.getBoundingClientRect();
            pickFolder(r.left, r.bottom + 4, uids);
            break;
        }
        case 'reply':
        case 'replyAll':
        case 'forward':
            // a card's own button answers that message; the bar and inline box answer the newest
            startReply(act, card ? m : null, !!b.closest('#inline-reply') || !!card);
            break;
        case 'show-all':
            convo.showAll = true;
            renderConversation();
            break;
        case 'details':
            (card || $('#reader')).querySelector('.details')?.classList.toggle('hidden');
            break;
        case 'images':
            state.allowImagesFor.add(keyOf(m));
            renderConversation();
            break;
        case 'images-always':
            state.allowImagesFor.add((m.from[0] || {}).address.toLowerCase());
            saveTrustedSenders();
            renderConversation();
            break;
        case 'unsubscribe':
            if (/^https?:/i.test(m.unsubscribe)) window.open(m.unsubscribe, '_blank', 'noopener');
            else {
                const addr = m.unsubscribe.replace(/^mailto:/i, '').split('?')[0];
                openComposer('new', null, { to: [{ name: '', address: addr }], subject: 'Unsubscribe' });
            }
            break;
        case 'more': {
            const r = b.getBoundingClientRect();
            showMenu(r.left - 170, r.bottom + 4, [
                { icon: 'replyAll', label: 'Reply all', run: () => startReply('replyAll', m, true) },
                { icon: 'forward', label: 'Forward', run: () => startReply('forward', m, true) },
                '-',
                { icon: 'code', label: 'View original', run: () => window.open('api/message/raw?' + qs({ folder: m.folder, uid: m.uid }), '_blank', 'noopener') },
                { icon: 'download', label: 'Download .eml', run: () => (location.href = 'api/message/raw?' + qs({ folder: m.folder, uid: m.uid, download: 1 })) },
                { icon: 'image', label: 'Print', run: () => printMessage(card) }
            ]);
            break;
        }
    }
});

function saveTrustedSenders() {
    try {
        localStorage.setItem('eg.trusted', JSON.stringify([...state.allowImagesFor].filter(x => x.includes('@'))));
    } catch {
        // ignore
    }
}

function printMessage(card) {
    const frame = (card || document).querySelector('.body-frame');
    if (frame && frame.contentWindow) return frame.contentWindow.print();
    window.print();
}

export { TIPS, attachmentCard, convo, convoUids, fetchMessage, fetchThread, msgCache, openMessage, printMessage, renderBody, renderConversation, renderReader, renderReaderBar, renderWelcome, saveTrustedSenders, showEmptyReader, startReply, threadCache, tip, withMessage };
