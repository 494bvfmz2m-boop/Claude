// EderveenGroup client: list
import { archive, moveTo, pickFolder, remove, setSeen, toggleStar } from './actions.js';
import { openComposer } from './composer.js';
import { loadFolders, openFolder } from './folders.js';
import { showMenu } from './menus.js';
import { openMessage, withMessage } from './reader.js';
import { fmtUntil, loadSnoozeIndex, snoozeIndex, snoozeMenu } from './snooze.js';
import { folderInfo, isDrafts, isSentLike, state } from './state.js';
import { $, $$, api, avatar, debounce, esc, fmtDate, glide, h, personName, qs } from './util.js';
import { inboxZero } from './zero.js';

// Lists are cached per view and shown instantly, then refreshed in the background.
const listCache = new Map();
const listKey = () => [state.folder, state.query, state.filter].join('\u0000');

/* ---------------- conversations ---------------- */

// Messages that reply to each other (Message-ID / In-Reply-To / References) are grouped into
// one row. Union-find over the ids, so long reply chains still land in the same group.
let threads = []; // [{ messages: [newest first], uid: newest uid }]
const threadByUid = new Map();
function buildThreads() {
    threads = [];
    threadByUid.clear();
    const grouping = state.settings.conversations !== false && !isDrafts();
    const parent = new Map();
    const find = x => {
        while (parent.get(x) !== x) {
            parent.set(x, parent.get(parent.get(x)));
            x = parent.get(x);
        }
        return x;
    };
    const add = x => !parent.has(x) && parent.set(x, x);
    const union = (a, b) => {
        if (!a || !b) return;
        add(a);
        add(b);
        parent.set(find(a), find(b));
    };
    const idOf = m => m.messageId || `uid:${m.uid}`;
    for (const m of state.messages) {
        add(idOf(m));
        if (!grouping) continue;
        union(idOf(m), m.inReplyTo);
        (m.references || []).forEach(r => union(idOf(m), r));
    }
    const groups = new Map();
    for (const m of state.messages) {
        const root = find(idOf(m));
        if (!groups.has(root)) {
            const t = { messages: [] };
            groups.set(root, t);
            threads.push(t);
        }
        groups.get(root).messages.push(m);
    }
    for (const t of threads) {
        t.uid = t.messages[0].uid; // the list is newest first
        t.messages.forEach(m => threadByUid.set(m.uid, t));
    }
}
// every message (in this folder) of the conversation a row stands for
const uidsOf = uid => (threadByUid.get(uid) ? threadByUid.get(uid).messages.map(m => m.uid) : [uid]);
const expandUids = uids => [...new Set(uids.flatMap(uidsOf))];
const threadOf = uid => (threadByUid.get(uid) ? [...threadByUid.get(uid).messages] : null);
const stripPrefix = s => String(s || '').replace(/^\s*((re|fwd?|aw|wg|antw)\s*:\s*)+/i, '');

/* ---------------- loading (with endless scrolling) ---------------- */

let listToken = 0;
let loadingMore = false;
async function loadMessages({ quiet = false } = {}) {
    const token = ++listToken;
    const info = folderInfo(state.folder);
    $('#folder-title').innerHTML = esc(state.query ? `Search` : info.name) + (state.query ? `<span class="sub">“${esc(state.query)}”</span>` : '');
    if (info.specialUse === '\\Snoozed') await loadSnoozeIndex();
    const cached = listCache.get(listKey());
    if (cached && !quiet) {
        state.messages = cached.messages;
        state.total = cached.total;
        state.page = cached.page;
        renderList(true);
        quiet = true;
    } else if (!quiet) {
        state.page = 0;
        $('#messages').innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="skeleton" style="opacity:${1 - i * 0.1}"><div class="b" style="width:36px;height:36px;border-radius:50%"></div><div style="flex:1"><div class="b" style="height:11px;width:38%;margin:4px 0 9px"></div><div class="b" style="height:10px;width:82%;margin-bottom:7px"></div><div class="b" style="height:10px;width:58%"></div></div></div>`).join('');
    }
    if (state.query) loadSearchCounts(token);
    else $('#search-elsewhere')?.remove();
    try {
        const r = await api('api/messages?' + qs({ folder: state.folder, page: 0, q: state.query, filter: state.filter }));
        if (token !== listToken) return;
        // background refresh: keep pages loaded further down, and remember new rows so they slide in
        const known = new Set(state.messages.map(m => m.uid));
        state.fresh = quiet && state.messages.length ? new Set(r.messages.filter(m => !known.has(m.uid)).map(m => m.uid)) : new Set();
        const top = new Set(r.messages.map(m => m.uid));
        const older = quiet ? state.messages.filter(m => !top.has(m.uid) && m.uid < Math.min(...top)) : [];
        state.messages = r.messages.concat(older);
        if (!quiet) state.page = 0;
        state.total = r.total;
        state.pageSize = r.pageSize;
        renderList(!quiet);
        state.fresh = new Set();
    } catch (e) {
        if (token !== listToken) return;
        $('#messages').innerHTML = `<div class="empty"><div><div class="big">${icon('junk')}</div><h3>Couldn’t load mail</h3><p>${esc(e.message)}</p><button class="btn" id="retry">Try again</button></div></div>`;
        $('#retry').onclick = () => loadMessages();
    }
}

async function loadMore() {
    if (loadingMore || state.messages.length >= state.total) return;
    loadingMore = true;
    const token = listToken;
    const page = state.page + 1;
    $('#messages .list-end')?.classList.add('loading');
    try {
        const r = await api('api/messages?' + qs({ folder: state.folder, page, q: state.query, filter: state.filter }));
        if (token !== listToken) return;
        const have = new Set(state.messages.map(m => m.uid));
        state.messages = state.messages.concat(r.messages.filter(m => !have.has(m.uid)));
        state.page = page;
        state.total = r.total;
        renderList(false, { appended: true });
    } catch {
        // the sentinel stays; scrolling again retries
    } finally {
        loadingMore = false;
    }
}

// load the next page when the end of the list scrolls into view
const endWatcher = new IntersectionObserver(entries => entries.some(e => e.isIntersecting) && loadMore(), { root: $('#messages'), rootMargin: '600px 0px' });

// searching: how many results other folders have ("also in Archive · 4")
async function loadSearchCounts(token) {
    try {
        const counts = await api('api/search/counts?' + qs({ folder: state.folder, q: state.query }));
        if (token !== listToken || !counts.length) return $('#search-elsewhere')?.remove();
        let bar = $('#search-elsewhere');
        if (!bar) {
            bar = h('<div class="search-elsewhere" id="search-elsewhere"></div>');
            $('.list-head').after(bar);
        }
        bar.innerHTML = `<span>Also found in</span>${counts.map(c => `<button data-folder="${esc(c.path)}">${esc(c.name)} <b>${c.count}</b></button>`).join('')}`;
    } catch {
        // optional
    }
}
document.addEventListener('click', e => {
    const b = e.target.closest('#search-elsewhere [data-folder]');
    if (b) openFolder(b.dataset.folder, { keepSearch: true });
});

function greetingFor() {
    const hr = new Date().getHours();
    const part = hr < 5 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const name = (state.settings.displayName || state.me.email.split('@')[0]).split(/\s+/)[0];
    return `${part}, ${name.charAt(0).toUpperCase() + name.slice(1)}`;
}
function renderGreeting() {
    const el = $('#greet');
    const inbox = state.folder === 'INBOX' && !state.query;
    el.classList.toggle('hidden', !inbox);
    if (!inbox) return;
    const unread = (folderInfo('INBOX') || {}).unseen || 0;
    el.innerHTML = `<span>${esc(greetingFor())}</span><span class="dot"></span><span>${unread ? `<b>${unread}</b> unread` : 'all read'}</span>`;
}

function groupLabel(iso) {
    const d = new Date(iso);
    const now = new Date();
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return 'This week';
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return 'Earlier this month';
    return d.toLocaleDateString(undefined, { month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

// "Ava, me, Marcus" for a conversation
function participants(t) {
    const names = [];
    for (const m of [...t.messages].reverse()) {
        const p = m.from[0];
        if (!p) continue;
        const label = p.address.toLowerCase() === state.me.email ? 'me' : (p.name || p.address).split(/[\s@]/)[0];
        if (!names.includes(label)) names.push(label);
    }
    return names.length > 3 ? `${names.slice(0, 2).join(', ')} … ${names[names.length - 1]}` : names.join(', ');
}

function renderList(animate = false, { appended = false } = {}) {
    const list = $('#messages');
    listCache.set(listKey(), { messages: state.messages, total: state.total, page: state.page });
    buildThreads();
    renderGreeting();
    $('#range').textContent = state.total ? `${state.messages.length < state.total ? `${state.messages.length.toLocaleString()} of ` : ''}${state.total.toLocaleString()} message${state.total === 1 ? '' : 's'}` : '';
    if (!state.messages.length && state.folder === 'INBOX' && !state.query && !state.filter) {
        list.innerHTML = inboxZero();
        updateBulk();
        return;
    }
    if (!state.messages.length) {
        const zero = state.query || state.filter
            ? ['search', 'Nothing matches', 'Try a different search or filter, or check the folders below the search box.']
            : ['sparkle', 'All caught up', 'Nothing here. Enjoy the quiet.'];
        list.innerHTML = `<div class="empty"><div><div class="big">${icon(zero[0])}</div><h3>${zero[1]}</h3><p>${zero[2]}</p></div></div>`;
        updateBulk();
        return;
    }
    const showTo = isSentLike();
    const inSnoozed = folderInfo(state.folder).specialUse === '\\Snoozed';
    const grouped = !state.query && !inSnoozed;
    const scroll = list.scrollTop;
    let lastGroup = null;
    list.innerHTML =
        threads
            .map((t, i) => {
                const m = t.messages[0];
                const n = t.messages.length;
                let header = '';
                if (grouped) {
                    const g = groupLabel(m.date);
                    if (g !== lastGroup) header = `<div class="group-label">${esc(g)}</div>`;
                    lastGroup = g;
                }
                const snooze = inSnoozed && m.messageId ? snoozeIndex.get(m.messageId) : null;
                const unread = t.messages.some(x => !x.flags.includes('\\Seen'));
                const starred = t.messages.some(x => x.flags.includes('\\Flagged'));
                const answered = t.messages.some(x => x.flags.includes('\\Answered'));
                const attach = t.messages.some(x => x.hasAttachments);
                const who = showTo ? m.to[0] : m.from[0];
                const whoText = showTo ? `To: ${m.to.map(personName).join(', ') || '(no recipients)'}` : n > 1 ? participants(t) : personName(who) || '(unknown)';
                const subject = n > 1 ? stripPrefix(t.messages[n - 1].subject) || m.subject : m.subject;
                const checked = state.checked.has(m.uid);
                return `${header}<div class="msg${animate ? ' enter' : ''}${state.fresh && t.messages.some(x => state.fresh.has(x.uid)) ? ' fresh' : ''}${unread ? ' unread' : ''}${m.uid === state.openUid ? ' selected' : ''}${checked ? ' checked' : ''}${m.uid === state.focusUid ? ' focused' : ''}" data-uid="${m.uid}" draggable="true"${animate ? ` style="animation-delay:${Math.min(i, 14) * 22}ms"` : ''}>
                <div class="sel-toggle" title="Select">${checked ? `<div class="avatar check">${icon('check')}</div>` : avatar(who)}</div>
                <div class="msg-body">
                    <div class="msg-top"><span class="msg-from">${esc(whoText)}</span>${n > 1 ? `<span class="thread-count">${n}</span>` : ''}
                        <span class="msg-meta">${answered ? icon('reply') : ''}${attach ? icon('clip') : ''}</span>
                        ${snooze ? `<span class="msg-date until">${icon('clock')}${esc(fmtUntil(snooze.until))}</span>` : `<span class="msg-date">${fmtDate(m.date)}</span>`}
                        <span class="row-actions">
                            <button data-row="archive" title="Archive (E)">${icon('archive')}</button>
                            <button data-row="snooze" title="Snooze (B)">${icon('clock')}</button>
                            <button data-row="read" title="${unread ? 'Mark read' : 'Mark unread'}">${icon(unread ? 'mailOpen' : 'mail')}</button>
                            <button data-row="delete" title="Delete (#)">${icon('trash')}</button>
                        </span></div>
                    <div class="msg-top"><div class="msg-subject" style="flex:1">${esc(subject || '(no subject)')}</div>
                        <button class="star-btn${starred ? ' on' : ''}" title="Star (S)">${icon('star')}</button></div>
                    <div class="msg-preview">${esc(m.preview)}</div>
                </div></div>`;
            })
            .join('') + (state.messages.length < state.total ? `<div class="list-end"><span class="spinner"></span></div>` : state.messages.length > 20 ? `<div class="list-end done">That’s everything</div>` : '');
    if (appended) list.scrollTop = scroll;
    const end = $('.list-end', list);
    endWatcher.disconnect();
    if (end && !end.classList.contains('done')) endWatcher.observe(end);
    updateBulk();
}

$('#messages').addEventListener('click', e => {
    const row = e.target.closest('.msg');
    if (!row) return;
    const uid = Number(row.dataset.uid);
    const uids = uidsOf(uid);
    if (e.target.closest('.star-btn')) return toggleStar(uids);
    const act = e.target.closest('[data-row]');
    if (act) {
        const a = act.dataset.row;
        if (a === 'archive') archive(uids);
        if (a === 'delete') remove(uids);
        if (a === 'read') setSeen(uids, !threadByUid.get(uid)?.messages.some(m => !m.flags.includes('\\Seen')));
        if (a === 'snooze') {
            const r = act.getBoundingClientRect();
            snoozeMenu(r.left - 180, r.bottom + 4, uids);
        }
        return;
    }
    if (e.target.closest('.sel-toggle') || e.metaKey || e.ctrlKey || e.shiftKey) return toggleCheck(uid, e.shiftKey);
    state.focusUid = uid;
    openMessage(uid);
});
$('#messages').addEventListener('dragstart', e => {
    const row = e.target.closest('.msg');
    if (!row) return;
    const uid = Number(row.dataset.uid);
    const uids = expandUids(state.checked.has(uid) ? [...state.checked] : [uid]);
    e.dataTransfer.setData('application/x-eg', JSON.stringify(uids));
    e.dataTransfer.effectAllowed = 'move';
    const ghost = h(`<div class="toast" style="position:fixed;top:-100px">${icon('mail')} Move ${uids.length} message${uids.length > 1 ? 's' : ''}</div>`);
    document.body.append(ghost);
    e.dataTransfer.setDragImage(ghost, 20, 20);
    setTimeout(() => ghost.remove());
});
$('#messages').addEventListener('contextmenu', e => {
    const row = e.target.closest('.msg');
    if (!row) return;
    e.preventDefault();
    const uid = Number(row.dataset.uid);
    const t = threadByUid.get(uid);
    const uids = expandUids(state.checked.has(uid) ? [...state.checked] : [uid]);
    const read = !(t ? t.messages : []).some(m => !m.flags.includes('\\Seen'));
    const starred = (t ? t.messages : []).some(m => m.flags.includes('\\Flagged'));
    showMenu(e.clientX, e.clientY, [
        { icon: 'reply', label: 'Reply', run: () => withMessage(uid, msg => openComposer('reply', msg)) },
        { icon: 'forward', label: 'Forward', run: () => withMessage(uid, msg => openComposer('forward', msg)) },
        '-',
        { icon: read ? 'mail' : 'mailOpen', label: read ? 'Mark unread' : 'Mark read', run: () => setSeen(uids, !read) },
        { icon: 'star', label: starred ? 'Unstar' : 'Star', run: () => toggleStar(uids) },
        { icon: 'archive', label: 'Archive', run: () => archive(uids) },
        { icon: 'clock', label: 'Snooze…', run: () => snoozeMenu(e.clientX, e.clientY, uids) },
        { icon: 'folder', label: 'Move to…', run: () => pickFolder(e.clientX, e.clientY, uids) },
        { icon: 'junk', label: 'Report spam', run: () => moveTo(uids, '\\Junk') },
        '-',
        { icon: 'trash', label: 'Delete', danger: true, run: () => remove(uids) }
    ]);
});

// cursor spotlight on rows
let spotRaf = 0, spotEvent = null;
$('#messages').addEventListener('mousemove', e => {
    spotEvent = e;
    if (spotRaf) return;
    spotRaf = requestAnimationFrame(() => {
        spotRaf = 0;
        const row = spotEvent.target.closest && spotEvent.target.closest('.msg');
        if (!row) return;
        const r = row.getBoundingClientRect();
        row.style.setProperty('--mx', `${spotEvent.clientX - r.left}px`);
        row.style.setProperty('--my', `${spotEvent.clientY - r.top}px`);
    });
}, { passive: true });

// touch: swipe right to archive, left to delete
(function swipe() {
    let row = null, bg = null, x0 = 0, y0 = 0, dx = 0, active = false;
    const list = $('#messages');
    list.addEventListener('touchstart', e => {
        row = e.target.closest('.msg');
        if (!row) return;
        x0 = e.touches[0].clientX;
        y0 = e.touches[0].clientY;
        dx = 0;
        active = false;
    }, { passive: true });
    list.addEventListener('touchmove', e => {
        if (!row) return;
        const t = e.touches[0];
        const mx = t.clientX - x0;
        if (!active) {
            if (Math.abs(mx) < 12 || Math.abs(mx) < Math.abs(t.clientY - y0)) {
                if (Math.abs(t.clientY - y0) > 12) row = null;
                return;
            }
            active = true;
            bg = h(`<div class="swipe-bg"><span class="l">${icon('archive')} Archive</span><span class="r">Delete ${icon('trash')}</span></div>`);
            bg.style.top = row.offsetTop + 'px';
            bg.style.height = row.offsetHeight + 'px';
            list.append(bg);
            row.classList.add('swiping');
        }
        dx = mx;
        row.style.transform = `translateX(${dx}px)`;
        bg.dataset.dir = dx > 0 ? 'right' : 'left';
        bg.classList.toggle('armed', Math.abs(dx) > 90);
    }, { passive: true });
    list.addEventListener('touchend', () => {
        if (!row || !active) return (row = null);
        const r = row, b = bg, uid = Number(r.dataset.uid), go = Math.abs(dx) > 90;
        r.classList.remove('swiping');
        r.style.transition = 'transform .3s cubic-bezier(.22,1,.36,1)';
        r.style.transform = go ? `translateX(${dx > 0 ? '110%' : '-110%'})` : '';
        setTimeout(() => {
            b.remove();
            r.style.transition = '';
            if (go) (dx > 0 ? archive : remove)(uidsOf(uid));
        }, 280);
        row = null;
    });
})();

function toggleCheck(uid, range) {
    if (range && state.lastChecked != null) {
        const ids = threads.map(t => t.uid);
        const [a, b] = [ids.indexOf(state.lastChecked), ids.indexOf(uid)].sort((x, y) => x - y);
        ids.slice(a, b + 1).forEach(id => state.checked.add(id));
    } else if (state.checked.has(uid)) state.checked.delete(uid);
    else state.checked.add(uid);
    state.lastChecked = uid;
    renderList();
    $(`.msg[data-uid="${uid}"] .sel-toggle .avatar`)?.classList.add('flip');
}
function updateBulk() {
    const n = state.checked.size;
    $('#bulk').classList.toggle('hidden', !n);
    $('#bulk-count').textContent = `${n} selected`;
}
const checkedUids = () => expandUids([...state.checked]);
$('#bulk-clear').onclick = () => {
    state.checked.clear();
    renderList();
};
$('#bulk').addEventListener('click', e => {
    const b = e.target.closest('[data-bulk]');
    if (!b) return;
    const uids = checkedUids();
    const act = b.dataset.bulk;
    if (act === 'read') setSeen(uids, true);
    if (act === 'unread') setSeen(uids, false);
    if (act === 'star') toggleStar(uids);
    if (act === 'archive') archive(uids);
    if (act === 'delete') remove(uids);
    if (act === 'move') {
        const r = b.getBoundingClientRect();
        pickFolder(r.left, r.bottom + 4, uids);
    }
});

$('#refresh-btn').onclick = () => {
    loadFolders();
    loadMessages();
};
$('#chips').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    $$('.chip').forEach(x => x.classList.toggle('active', x === c));
    glide($('#chips'), c);
    state.filter = c.dataset.filter;
    loadMessages();
});
const runSearch = debounce(value => {
    state.query = value.trim();
    loadMessages();
}, 350);
$('#search').addEventListener('input', e => {
    runSearch(e.target.value);
    renderHints();
});

// search hints: tap an operator to add it
const HINTS = [
    ['from:', 'Sender'],
    ['to:', 'Recipient'],
    ['subject:', 'Subject'],
    ['has:attachment', 'With attachments'],
    ['is:unread', 'Unread'],
    ['is:starred', 'Starred'],
    ['after:', 'After date (2026-01-31)'],
    ['before:', 'Before date']
];
function renderHints() {
    const input = $('#search');
    let box = $('#search-hints');
    const show = document.activeElement === input && !/\S$/.test(input.value) && input.value.length < 60;
    if (!show) return box?.remove();
    if (!box) {
        box = h('<div class="search-hints" id="search-hints"></div>');
        input.parentElement.append(box);
    }
    box.innerHTML = HINTS.filter(([op]) => !input.value.includes(op)).map(([op, label]) => `<button type="button" data-op="${op}"><code>${op}</code><span>${label}</span></button>`).join('');
}
$('#search').addEventListener('focus', renderHints);
$('#search').addEventListener('blur', () => setTimeout(() => $('#search-hints')?.remove(), 150));
document.addEventListener('mousedown', e => {
    const b = e.target.closest('#search-hints [data-op]');
    if (!b) return;
    e.preventDefault();
    const input = $('#search');
    input.value = (input.value ? input.value.replace(/\s*$/, ' ') : '') + b.dataset.op;
    input.focus();
    if (!b.dataset.op.endsWith(':')) {
        input.value += ' ';
        runSearch(input.value);
    }
    renderHints();
});

export { buildThreads, checkedUids, expandUids, greetingFor, groupLabel, listCache, listKey, loadMessages, loadMore, renderGreeting, renderList, threadOf, threads, toggleCheck, updateBulk, uidsOf };
