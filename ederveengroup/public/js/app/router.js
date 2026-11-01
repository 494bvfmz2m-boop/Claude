// EderveenGroup client: router
// Every screen has its own address, so back/forward, refresh and bookmarks work:
//   inbox · sent · drafts · archive · junk · trash · snoozed · starred   built-in folders
//   f/<id>                  your own folders (an opaque id, never the folder's name)
//   <folder>/<link>         a conversation (an opaque 11-character link from the server)
//   search/<code>[/<link>]  a search (the words stay on this device, the address only has a code)
//   settings/<tab>          a settings page
import { state } from './state.js';

const BASE = new URL(document.baseURI).pathname; // "/mail/"
const SLUGS = { inbox: '\\Inbox', sent: '\\Sent', drafts: '\\Drafts', archive: '\\Archive', junk: '\\Junk', trash: '\\Trash', snoozed: '\\Snoozed', starred: '\\Flagged' };
const USE_TO_SLUG = Object.fromEntries(Object.entries(SLUGS).map(([k, v]) => [v, k]));
const TABS = ['profile', 'general', 'look', 'sigs', 'templates', 'keys', 'security', 'devices', 'account'];

let handlers = null; // { folder(path), message(link), closeMessage(), settings(tab), closeSettings(), search(query, folder) }
let applying = false;
let depth = 0; // how many entries we pushed this session (so "back" can really go back)

/* ---------- searches: the words stay on this device ---------- */
const SEARCH_KEY = 'eg.searches';
function searches() {
    try {
        return JSON.parse(localStorage.getItem(SEARCH_KEY) || '{}');
    } catch {
        return {};
    }
}
function codeForSearch(q, folder) {
    const all = searches();
    let code = Object.keys(all).find(c => all[c].q === q && all[c].folder === folder);
    if (!code) {
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    all[code] = { q, folder, t: Date.now() };
    const keep = Object.entries(all).sort((a, b) => b[1].t - a[1].t).slice(0, 50);
    try {
        localStorage.setItem(SEARCH_KEY, JSON.stringify(Object.fromEntries(keep)));
    } catch {
        // storage full or blocked: the search still works, the address just won't survive a reload
    }
    return code;
}

/* ---------- address <-> screen ---------- */
function folderSlug(path) {
    const f = state.folders.find(x => x.path === path);
    if (path === 'INBOX' || (f && f.specialUse === '\\Inbox')) return 'inbox';
    if (f && USE_TO_SLUG[f.specialUse]) return USE_TO_SLUG[f.specialUse];
    return f && f.id ? `f/${f.id}` : 'inbox';
}

function parse(pathname = location.pathname) {
    const parts = (pathname.startsWith(BASE) ? pathname.slice(BASE.length) : '').split('/').filter(Boolean);
    const route = { slug: 'inbox', folderId: null, link: null, search: null, settings: null };
    if (!parts.length) return route;
    if (parts[0] === 'settings') return { ...route, settings: !parts[1] ? 'index' : TABS.includes(parts[1]) ? parts[1] : 'general' };
    if (parts[0] === 'search') return { ...route, slug: null, search: parts[1] || null, link: parts[2] || null };
    if (parts[0] === 'f') return { ...route, slug: null, folderId: parts[1] || null, link: parts[2] || null };
    return { ...route, slug: SLUGS[parts[0]] ? parts[0] : 'inbox', link: parts[1] || null };
}

/** folder path a route points at, once the folder list is known (null: not found) */
function folderOf(route) {
    if (route.search) {
        const s = searches()[route.search];
        return s ? s.folder : null;
    }
    if (route.folderId) return (state.folders.find(f => f.id === route.folderId) || {}).path || null;
    if (!route.slug || route.slug === 'inbox') return 'INBOX';
    return (state.folders.find(f => f.specialUse === SLUGS[route.slug]) || {}).path || null;
}
const queryOf = route => (route.search ? (searches()[route.search] || {}).q || null : null);

const extraLinks = new Map(); // messages opened from an address that aren't in the loaded list
const remember = (uid, link) => extraLinks.set(uid, link);
const linkFor = uid => (state.messages.find(m => m.uid === uid) || {}).link || extraLinks.get(uid) || null;

/** the address for what's on screen right now */
function currentUrl({ settings = null } = {}) {
    if (settings) return settings === 'index' ? `${BASE}settings` : `${BASE}settings/${settings}`;
    const base = state.query ? `search/${codeForSearch(state.query, state.folder)}` : folderSlug(state.folder);
    const link = state.openUid ? linkFor(state.openUid) : null;
    return BASE + base + (link ? `/${link}` : '');
}

/* ---------- history ---------- */
function write(url, { replace = false, title } = {}) {
    if (!handlers || applying || url === location.pathname) return;
    if (replace) history.replaceState({ eg: true, depth }, '', url);
    else history.pushState({ eg: true, depth: ++depth }, '', url);
    if (title) document.title = title;
}

/** call after the screen changed; updates the address (a new history entry unless replace) */
function sync({ replace = false, settings = null } = {}) {
    write(currentUrl({ settings }), { replace });
    document.title = titleFor();
}

/** leave the current screen: really go back when we came from inside the app */
function back(fallback = () => sync({ replace: true })) {
    if (history.state && history.state.eg && history.state.depth > 0) history.back();
    else fallback();
}

function titleFor() {
    const f = state.folders.find(x => x.path === state.folder);
    const where = state.query ? 'Search' : f ? f.name : 'Inbox';
    const unread = (state.folders.find(x => x.specialUse === '\\Inbox') || {}).unseen;
    return `${unread ? `(${unread}) ` : ''}${where} · EderveenGroup`;
}

async function apply(route) {
    if (!handlers) return;
    applying = true;
    try {
        if (route.settings) return handlers.settings(route.settings);
        handlers.closeSettings();
        const folder = folderOf(route) || 'INBOX';
        const query = queryOf(route) || '';
        if (folder !== state.folder || query !== state.query) await handlers.folder(folder, query);
        if (route.link) await handlers.message(route.link);
        else if (state.openUid) handlers.closeMessage();
    } finally {
        applying = false;
        document.title = titleFor();
    }
}

function start(h) {
    handlers = h;
    history.replaceState({ eg: true, depth: 0 }, '', location.pathname);
    addEventListener('popstate', e => {
        depth = (e.state && e.state.depth) || 0;
        apply(parse());
    });
}

const isApplying = () => applying;

export { BASE, apply, back, currentUrl, folderOf, isApplying, parse, queryOf, remember, start, sync, titleFor };
