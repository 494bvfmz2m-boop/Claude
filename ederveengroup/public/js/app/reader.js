// EderveenGroup client: reader
import { archive, moveTo, pickFolder, remove, setSeen, toggleStar } from './actions.js';
import { openComposer } from './composer.js';
import { openFolder, renderFolders } from './folders.js';
import { greetingFor } from './list.js';
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
    try {
        const msg = await fetchMessage(folder, uid);
        clearTimeout(slow);
        if (token !== readToken) return;
        state.current = msg;
        const listed = state.messages.find(m => m.uid === uid);
        if (listed) msg.flags = [...listed.flags];
        if (!msg.flags.includes('\\Seen')) {
            msg.flags.push('\\Seen');
            api('api/messages/flags', { method: 'POST', body: { folder, uids: [uid], add: ['\\Seen'] } }).catch(() => {});
        }
        if (listed && !listed.flags.includes('\\Seen')) {
            listed.flags.push('\\Seen');
            const r = $(`.msg[data-uid="${uid}"]`);
            if (r) {
                r.classList.add('reading');
                setTimeout(() => r.classList.remove('unread', 'reading'), 380);
            }
            const f = folderInfo(state.folder);
            if (f.unseen) {
                f.unseen--;
                renderFolders();
            }
        }
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
    } catch (e) {
        row?.classList.remove('opening');
        if (morph) $('#app').dataset.view = 'reader';
        clearTimeout(slow);
        if (token !== readToken) return;
        $('#reader').innerHTML = `<div class="empty"><div><div class="big">${icon('junk')}</div><h3>Couldn’t open that one</h3><p>${esc(e.message)}</p></div></div>`;
    }
}

function renderReaderBar() {
    const m = state.current;
    const bar = $('.reader-bar');
    if (!bar || !m) return;
    const starred = m.flags.includes('\\Flagged');
    $('[data-act=star]', bar).classList.toggle('active', starred);
    $('[data-act=star]', bar).innerHTML = icon('star').replace('fill="none"', starred ? 'fill="currentColor"' : 'fill="none"');
}

function renderReader({ morph = false } = {}) {
    const m = state.current;
    const from = m.from[0] || { address: '' };
    const remoteOk = state.settings.loadRemoteImages || state.allowImagesFor.has(from.address.toLowerCase()) || state.allowImagesFor.has(`${m.folder}:${m.uid}`);
    const recipients = [...m.to, ...m.cc];
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
            <button class="icon-btn" data-act="more" data-tip="More">${icon('more')}</button>
        </div>
        <div class="reader-scroll"><div class="reader-content${morph ? ' vt' : ''}">
            <h1${morph ? ' style="view-transition-name:eg-subject"' : ''}>${esc(m.subject || '(no subject)')}</h1>
            <div class="sender">
                ${morph ? avatar(from, 'lg').replace('style="', 'style="view-transition-name:eg-avatar;') : avatar(from, 'lg')}
                <div class="info">
                    <div><span class="name">${esc(from.name || from.address)}</span>${from.name ? `<span class="addr">&lt;${esc(from.address)}&gt;</span>` : ''}</div>
                    <div class="to" data-act="details">to ${esc(recipients.map(p => (p.address.toLowerCase() === state.me.email ? 'me' : personName(p))).join(', ') || 'undisclosed recipients')} ${icon('down')}</div>
                    <dl class="details hidden">
                        <dt>From</dt><dd>${esc(fmtAddrList(m.from))}</dd>
                        ${m.replyTo.length ? `<dt>Reply-To</dt><dd>${esc(fmtAddrList(m.replyTo))}</dd>` : ''}
                        <dt>To</dt><dd>${esc(fmtAddrList(m.to)) || '—'}</dd>
                        ${m.cc.length ? `<dt>Cc</dt><dd>${esc(fmtAddrList(m.cc))}</dd>` : ''}
                        ${m.bcc.length ? `<dt>Bcc</dt><dd>${esc(fmtAddrList(m.bcc))}</dd>` : ''}
                        <dt>Date</dt><dd>${esc(fmtDate(m.date, true))}</dd>
                    </dl>
                </div>
                <div class="when">${esc(fmtDate(m.date, true))}</div>
            </div>
            ${m.hasRemoteImages && !remoteOk ? `<div class="banner">${icon('image')}<span>Remote images are hidden to protect your privacy.</span><button data-act="images">Show images</button><button data-act="images-always" style="margin-left:4px">Always from sender</button></div>` : ''}
            ${m.unsubscribe ? `<div class="banner" style="background:var(--bg-2);border-color:var(--border)">${icon('unsubscribe')}<span>This looks like a mailing list.</span><button data-act="unsubscribe">Unsubscribe</button></div>` : ''}
            <div id="body-host"></div>
            ${m.attachments.length ? `<div class="attachments">${m.attachments.map(a => attachmentCard(m, a)).join('')}</div>` : ''}
            <div class="quick-reply">
                <button class="btn" data-act="reply">${icon('reply')} Reply</button>
                ${recipients.length + m.from.length > 2 ? `<button class="btn" data-act="replyAll">${icon('replyAll')} Reply all</button>` : ''}
                <button class="btn" data-act="forward">${icon('forward')} Forward</button>
            </div>
        </div></div>`;
    renderReaderBar();
    renderBody(m, remoteOk);
}

function attachmentCard(m, a) {
    const ext = (a.filename.split('.').pop() || 'file').slice(0, 4);
    const href = 'api/attachment?' + qs({ folder: m.folder, uid: m.uid, idx: a.idx });
    return `<a class="att" href="${href}" target="_blank" rel="noopener"><span class="ext">${esc(ext)}</span><span class="meta"><b>${esc(a.filename)}</b><small>${fmtSize(a.size)}</small></span>
        <span class="icon-btn" data-download="${esc(href + '&download=1')}" title="Download">${icon('download')}</span></a>`;
}

function renderBody(m, remoteOk) {
    const host = $('#body-host');
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
    const m = state.current;
    const uid = m.uid;
    switch (b.dataset.act) {
        case 'back':
            $('#app').dataset.view = 'list';
            break;
        case 'archive':
            archive([uid]);
            break;
        case 'junk':
            moveTo([uid], '\\Junk', 'Spam');
            break;
        case 'delete':
            remove([uid]);
            break;
        case 'unread':
            setSeen([uid], false);
            showEmptyReader();
            $('#app').dataset.view = 'list';
            break;
        case 'star':
            toggleStar([uid]);
            break;
        case 'snooze': {
            const r = b.getBoundingClientRect();
            snoozeMenu(r.left, r.bottom + 4, [uid]);
            break;
        }
        case 'move': {
            const r = b.getBoundingClientRect();
            pickFolder(r.left, r.bottom + 4, [uid]);
            break;
        }
        case 'reply':
        case 'replyAll':
        case 'forward':
            openComposer(b.dataset.act, m);
            break;
        case 'details':
            $('.details').classList.toggle('hidden');
            break;
        case 'images':
            state.allowImagesFor.add(`${m.folder}:${m.uid}`);
            renderReader();
            break;
        case 'images-always':
            state.allowImagesFor.add((m.from[0] || {}).address.toLowerCase());
            saveTrustedSenders();
            renderReader();
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
            showMenu(r.left - 160, r.bottom + 4, [
                { icon: 'code', label: 'View original', run: () => window.open('api/message/raw?' + qs({ folder: m.folder, uid }), '_blank', 'noopener') },
                { icon: 'download', label: 'Download .eml', run: () => (location.href = 'api/message/raw?' + qs({ folder: m.folder, uid, download: 1 })) },
                { icon: 'image', label: 'Print', run: () => printMessage(m) }
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

function printMessage(m) {
    const frame = $('.body-frame');
    if (frame && frame.contentWindow) return frame.contentWindow.print();
    window.print();
}

export { TIPS, activeMorph, attachmentCard, fetchMessage, hoverTimer, msgCache, openMessage, printMessage, readToken, renderBody, renderReader, renderReaderBar, renderWelcome, saveTrustedSenders, showEmptyReader, tiltEvent, tiltRaf, tip, withMessage };
