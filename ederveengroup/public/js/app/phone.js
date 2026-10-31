// EderveenGroup client: phone
// The Apple-style phone app: a tab bar, screens that slide over each other with a swipe from
// the left edge to go back, a navigation bar whose title appears as the large one scrolls
// away, pull to refresh, a reply action sheet, and sheets you drag down to close.
// Everything here is inert on computers (it checks the layout each time).
import { composer, openComposer } from './composer.js';
import { loadFolders } from './folders.js';
import { loadMessages } from './list.js';
import { isPhone } from './look.js';
import { showMenu } from './menus.js';
import { closeReader, startReply } from './reader.js';
import { openSettings } from './settings.js';
import { folderInfo, state } from './state.js';
import { $, $$, calm, h } from './util.js';

const app = $('#app');
const pane = $('.list-pane');
const view = () => app.dataset.view || 'list';
const setView = v => {
    app.dataset.view = v;
    syncTabs();
};

/* ---------- tab bar ---------- */
const tabbar = $('#tabbar');
function syncTabs() {
    const which = $('.modal .settings') ? 'settings' : document.activeElement === $('#search') || state.query ? 'search' : 'mail';
    $$('button', tabbar).forEach(b => b.classList.toggle('on', b.dataset.tab === which));
    const dot = $('[data-tab=settings] .tab-dot', tabbar);
    const n = state.me && state.me.pendingRequests;
    if (n && !dot) $('[data-tab=settings]', tabbar).append(h(`<span class="tab-dot">${n}</span>`));
    else if (dot) n ? (dot.textContent = n) : dot.remove();
}
tabbar.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    const tab = b.dataset.tab;
    if (tab === 'write') return openComposer('new');
    if (tab === 'settings') return openSettings('index');
    if ($('.modal .settings')) $('.modal [data-close]').click();
    if (tab === 'search') {
        if (view() === 'reader') closeReader();
        setView('list');
        pane.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
        setTimeout(() => $('#search').focus(), calm ? 0 : 250);
        return;
    }
    // Mail: back to the mailbox; tapping it again scrolls to the top
    if (view() === 'reader') return closeReader();
    if (view() === 'folders') return setView('list');
    pane.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
});
$('#search').addEventListener('focus', syncTabs);
$('#search').addEventListener('blur', () => setTimeout(syncTabs, 50));
new MutationObserver(syncTabs).observe(document.body, { childList: true });

/* ---------- navigation bar on the mailbox screen ---------- */
const navbar = h(`<div class="navbar"><button class="nav-back" aria-label="Mailboxes">${icon('left')}<span>Mailboxes</span></button><div class="nav-title" aria-hidden="true"></div><div class="nav-act"><button class="icon-btn" data-nav="refresh" aria-label="Refresh">${icon('refresh')}</button></div></div>`);
pane.prepend(navbar);
$('.nav-back', navbar).onclick = () => setView('folders');
$('[data-nav=refresh]', navbar).onclick = () => refresh();
const title = $('#folder-title');
new MutationObserver(() => ($('.nav-title', navbar).textContent = title.textContent)).observe(title, { childList: true, characterData: true, subtree: true });

let ticking = false;
pane.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
        ticking = false;
        pane.classList.toggle('scrolled', pane.scrollTop > 46);
    });
}, { passive: true });

/* ---------- pull to refresh ---------- */
const ptr = h('<div class="ptr" aria-hidden="true"><i></i></div>');
pane.append(ptr);
const moving = () => [$('.list-head', pane), $('#messages')];
let pull = null;
async function refresh() {
    ptr.classList.add('spin');
    try {
        await Promise.all([loadFolders(), loadMessages({ quiet: true })]);
    } finally {
        ptr.classList.remove('spin', 'ready');
    }
}
pane.addEventListener('touchstart', e => {
    if (!isPhone() || pane.scrollTop > 0 || e.touches[0].clientX < 24) return;
    pull = { y0: e.touches[0].clientY, x0: e.touches[0].clientX, d: 0, on: false };
}, { passive: true });
pane.addEventListener('touchmove', e => {
    if (!pull) return;
    const dy = e.touches[0].clientY - pull.y0;
    if (!pull.on) {
        if (dy < 8 || Math.abs(e.touches[0].clientX - pull.x0) > dy || pane.scrollTop > 0) return dy < 0 && (pull = null);
        pull.on = true;
        pane.classList.add('pulling');
    }
    pull.d = Math.max(0, dy * 0.45); // the further you pull, the heavier it gets
    moving().forEach(el => (el.style.transform = `translate3d(0, ${pull.d}px, 0)`));
    ptr.style.setProperty('--p', Math.min(pull.d / 70, 1));
    ptr.querySelector('i').style.opacity = Math.min(pull.d / 40, 1);
    ptr.style.height = `${pull.d}px`;
    ptr.classList.toggle('ready', pull.d >= 70);
}, { passive: true });
pane.addEventListener('touchend', async () => {
    if (!pull) return;
    const go = pull.on && pull.d >= 70;
    pull = null;
    pane.classList.remove('pulling');
    const settle = px => {
        moving().forEach(el => (el.style.transform = px ? `translate3d(0, ${px}px, 0)` : ''));
        ptr.style.height = `${px}px`;
    };
    if (!go) {
        settle(0);
        ptr.querySelector('i').style.opacity = 0;
        return;
    }
    settle(52);
    await refresh();
    settle(0);
    ptr.querySelector('i').style.opacity = 0;
});

/* ---------- swipe from the left edge to go back ---------- */
let edge = null;
document.addEventListener('touchstart', e => {
    if (!isPhone() || e.touches.length !== 1 || e.touches[0].clientX > 22 || view() === 'folders' || $('.modal-back, .composer:not(.inline)')) return;
    const top = view() === 'reader' ? $('.reader') : pane;
    const under = view() === 'reader' ? pane : $('.sidebar');
    edge = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, t0: performance.now(), dx: 0, on: false, top, under, w: innerWidth };
}, { passive: true, capture: true });
document.addEventListener('touchmove', e => {
    if (!edge) return;
    const t = e.touches[0];
    const dx = t.clientX - edge.x0;
    if (!edge.on) {
        if (Math.abs(t.clientY - edge.y0) > Math.abs(dx) && Math.abs(t.clientY - edge.y0) > 10) return (edge = null);
        if (dx < 6) return;
        edge.on = true;
        app.classList.add('dragging');
    }
    edge.dx = Math.max(0, dx);
    const p = Math.min(edge.dx / edge.w, 1);
    edge.top.style.transform = `translate3d(${edge.dx}px, 0, 0)`;
    edge.under.style.transform = `translate3d(${-28 * (1 - p)}%, 0, 0)`;
    edge.under.style.setProperty('--shade', ((1 - p) * 0.5).toFixed(3));
}, { passive: true, capture: true });
document.addEventListener('touchend', () => {
    if (!edge) return;
    const { on, dx, w, t0, top, under } = edge;
    edge = null;
    if (!on) return;
    const fast = dx / Math.max(1, performance.now() - t0) > 0.45;
    const go = dx > w * 0.35 || (fast && dx > 30);
    // let the transitions run from where the finger left off
    app.classList.remove('dragging');
    requestAnimationFrame(() => {
        top.style.transform = '';
        under.style.transform = '';
        under.style.removeProperty('--shade');
        if (!go) return;
        if (top === pane) setView('folders');
        else {
            setView('list');
            closeReader();
        }
    });
}, { capture: true });

/* ---------- sheets you can drag down ---------- */
document.addEventListener('touchstart', e => {
    const head = isPhone() && e.target.closest('.composer:not(.inline) .composer-head');
    if (!head || !composer) return;
    const el = composer.el;
    const start = { y: e.touches[0].clientY, t: performance.now() };
    let dy = 0;
    const move = ev => {
        dy = Math.max(0, ev.touches[0].clientY - start.y);
        el.classList.add('dragging');
        el.style.transform = `translate3d(0, ${dy}px, 0)`;
    };
    const end = () => {
        head.removeEventListener('touchmove', move);
        head.removeEventListener('touchend', end);
        el.classList.remove('dragging');
        const fast = dy / Math.max(1, performance.now() - start.t) > 0.6;
        el.style.transition = 'transform .4s cubic-bezier(.32,.72,0,1)';
        if (dy > 140 || (fast && dy > 40)) {
            el.style.transform = 'translate3d(0, 105%, 0)';
            setTimeout(() => composer && composer.el === el && composer.close({ save: true }), 280);
        } else {
            el.style.transform = '';
            setTimeout(() => (el.style.transition = ''), 400);
        }
    };
    head.addEventListener('touchmove', move, { passive: true });
    head.addEventListener('touchend', end);
}, { passive: true });

/* ---------- the conversation screen ---------- */
// "‹ Inbox": the back button names where it goes
new MutationObserver(() => {
    const backBtn = $('#reader .rn-back');
    if (backBtn) backBtn.dataset.label = state.query ? 'Search' : folderInfo(state.folder).name || 'Back';
}).observe($('#reader'), { childList: true });

// one reply button with the rest in an action sheet, like Mail on iPhone
$('#reader').addEventListener('click', e => {
    const b = isPhone() && e.target.closest('.reader-bar [data-act=reply]');
    if (!b) return;
    e.stopPropagation();
    e.preventDefault();
    const act = name => () => $(`.reader-bar [data-act=${name}]`)?.click();
    showMenu(0, innerHeight, [
        { icon: 'reply', label: 'Reply', run: () => startReply('reply') },
        { icon: 'replyAll', label: 'Reply all', run: () => startReply('replyAll') },
        { icon: 'forward', label: 'Forward', run: () => startReply('forward') },
        '-',
        { icon: 'mail', label: 'Mark as unread', run: act('unread') },
        { icon: 'junk', label: 'Move to Spam', danger: true, run: act('junk') }
    ]);
}, true);

export { refresh, setView, syncTabs };
