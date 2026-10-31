// EderveenGroup client: util
import { state } from './state.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const debounce = (fn, ms) => {
    let t;
    return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
    };
};
const h = html => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
};

async function api(path, opts = {}) {
    const init = { method: opts.method || 'GET', headers: { 'X-EG': '1' } };
    if (opts.form) init.body = opts.form;
    else if (opts.body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, init);
    if (res.status === 401) {
        location.replace('login');
        throw new Error('Signed out');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}
const qs = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();

function toast(text, { error = false, action, onAction, duration = 4000 } = {}) {
    const el = h(`<div class="toast${error ? ' error' : ''}"><span>${esc(text)}</span>${action ? `<button>${esc(action)}</button>` : ''}${duration ? `<i class="bar" style="animation-duration:${duration}ms"></i>` : ''}</div>`);
    const close = () => {
        el.style.transition = '.2s';
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => el.remove(), 200);
    };
    if (action) {
        $('button', el).onclick = () => {
            close();
            onAction && onAction();
        };
    }
    $('#toasts').append(el);
    if (duration) setTimeout(close, duration);
    return { el, close };
}

function fmtDate(iso, long) {
    const d = new Date(iso);
    const now = new Date();
    if (long) return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    if (now - d < 6 * 864e5) return d.toLocaleDateString(undefined, { weekday: 'short' });
    if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return d.toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' });
}
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

// A highlight pill that slides to the active item instead of jumping. The container keeps
// the last position in a dataset, so it still glides after the items are re-rendered.
function glide(container, active) {
    if (!container) return;
    let g = container.querySelector(':scope > .glider');
    if (!g) {
        g = document.createElement('span');
        g.className = 'glider';
        container.prepend(g);
    }
    if (!active || !active.offsetParent) {
        g.style.opacity = '0';
        return;
    }
    const to = { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight };
    const from = container.dataset.glide ? JSON.parse(container.dataset.glide) : null;
    container.dataset.glide = JSON.stringify(to);
    const place = r => {
        g.style.width = r.w + 'px';
        g.style.height = r.h + 'px';
        g.style.transform = `translate(${r.x}px, ${r.y}px)`;
    };
    if (from && !calm && !g.dataset.placed) {
        // fresh element after a re-render: start where the old one was
        g.style.transition = 'none';
        place(from);
        void g.offsetWidth;
        g.style.transition = '';
    } else if (!from) g.style.transition = 'none';
    g.dataset.placed = '1';
    place(to);
    g.style.opacity = '1';
    if (!from) requestAnimationFrame(() => (g.style.transition = ''));
}

// the button that was pressed last, so things like the composer can grow out of it
let lastPress = null;
document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('button, .btn, [data-act]');
    if (b) lastPress = { rect: b.getBoundingClientRect(), t: performance.now() };
}, { capture: true, passive: true });
const recentPress = () => (lastPress && performance.now() - lastPress.t < 1200 ? lastPress.rect : null);
const visibleRect = el => {
    if (!el || !el.offsetParent) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight ? r : null;
};

// grow an element out of a rectangle (or shrink it into one); transform/opacity only
function morphFrom(el, from, { duration = 480 } = {}) {
    if (calm || !from) return null;
    const to = el.getBoundingClientRect();
    el.style.animation = 'none';
    return el.animate(
        [
            { transformOrigin: '0 0', transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: 0.15 },
            { transformOrigin: '0 0', transform: 'none', opacity: 1 }
        ],
        { duration, easing: 'cubic-bezier(.2, .9, .22, 1)' }
    );
}
function morphTo(el, target, { duration = 420 } = {}) {
    const from = el.getBoundingClientRect();
    el.style.pointerEvents = 'none';
    const frames = calm
        ? [{ opacity: 1 }, { opacity: 0 }]
        : target
          ? [
                { transformOrigin: '0 0', transform: 'none', opacity: 1 },
                { transformOrigin: '0 0', transform: `translate(${target.left - from.left}px, ${target.top - from.top}px) scale(${target.width / from.width}, ${target.height / from.height})`, opacity: 0 }
            ]
          : [{ transform: 'none', opacity: 1 }, { transform: 'translateY(16px) scale(.94)', opacity: 0 }];
    return el.animate(frames, { duration, easing: 'cubic-bezier(.55, 0, .25, 1)', fill: 'forwards' }).finished.catch(() => {});
}
let caught = null; // { path, t }: re-applied if the sidebar re-renders mid-animation
function catchIn(btn) {
    if (!btn) return;
    caught = { path: btn.dataset.path, t: performance.now() };
    btn.classList.remove('catch');
    void btn.offsetWidth;
    btn.classList.add('catch');
}

// archived / deleted / moved rows fly into their folder in the sidebar
function flyToFolder(rows, path) {
    if (calm || !path || !rows.length) return;
    const btn = $(`#folders .folder[data-path="${CSS.escape(path)}"]`);
    const to = visibleRect(btn);
    if (!to) return;
    rows.slice(0, 3).forEach((row, n) => {
        const r = row.getBoundingClientRect();
        const ghost = document.createElement('div');
        ghost.className = 'ghost';
        ghost.innerHTML = (row.querySelector('.sel-toggle .avatar')?.outerHTML || '') + `<span>${esc(row.querySelector('.msg-subject')?.textContent || '')}</span>`;
        Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        document.body.append(ghost);
        const dx = to.left + 14 - r.left, dy = to.top + to.height / 2 - (r.top + r.height / 2);
        const lift = Math.min(90, Math.abs(dy) * 0.35 + 30);
        ghost.animate(
            [
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - lift}px) scale(.62)`, opacity: 1, offset: 0.42 },
                { transform: `translate(${dx}px, ${dy}px) scale(.06)`, opacity: 0.25 }
            ],
            { duration: 700, delay: n * 70, easing: 'cubic-bezier(.45, 0, .2, 1)', fill: 'both' }
        ).finished.then(() => {
            ghost.remove();
            if (n === 0) catchIn(btn);
        });
    });
}

const fmtSize = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function hue(str) {
    let x = 0;
    for (const c of String(str).toLowerCase()) x = (x * 31 + c.charCodeAt(0)) >>> 0;
    return x % 360;
}
function avatar(person, size = '') {
    const label = (person && (person.name || person.address)) || '?';
    const parts = label.replace(/["'<>]/g, '').split(/[\s._@-]+/).filter(Boolean);
    const initials = ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    const hh = hue((person && person.address) || label);
    const addr = ((person && person.address) || '').trim().toLowerCase();
    const mine = state.me && addr === state.me.email;
    // photos: your own upload, colleagues' uploads, then Gravatar / company logo (if enabled)
    const wantImg = addr.includes('@') && !missingPhotos.has(addr) && (mine ? state.me.photo || state.settings.senderPhotos !== false : state.settings && state.settings.senderPhotos !== false);
    let img = '';
    if (wantImg && (mine && state.me.photo ? true : knownPhotos.has(addr))) img = photoImg(addr, mine ? state.me.photo : knownPhotos.get(addr));
    else if (wantImg) askPhoto(addr);
    return `<div class="avatar ${size}" style="--h:${hh}"${addr ? ` data-av="${esc(addr)}"` : ''}>${esc(initials)}${img}</div>`;
}
const photoImg = (addr, v) => `<img class="av-img" alt="" decoding="async" data-email="${esc(addr)}" src="api/avatar?${qs({ email: addr, v: v || undefined })}">`;

// Photo lookups are batched: one request answers "who has a photo?" for everything on screen,
// then the matching avatars get their image. Addresses without one never hit the network again.
const missingPhotos = new Set();
const knownPhotos = new Map();
const askedPhotos = new Set();
let pendingPhotos = new Set();
let photoTimer = null;
function askPhoto(addr) {
    if (askedPhotos.has(addr)) return;
    askedPhotos.add(addr);
    pendingPhotos.add(addr);
    clearTimeout(photoTimer);
    photoTimer = setTimeout(flushPhotos, 60);
}
async function flushPhotos() {
    const emails = [...pendingPhotos].slice(0, 80);
    if (!emails.length) return;
    emails.forEach(a => pendingPhotos.delete(a));
    let photos = {};
    try {
        photos = (await api('api/avatars', { method: 'POST', body: { emails } })).photos || {};
    } catch {
        emails.forEach(a => askedPhotos.delete(a)); // try again on the next render
        return;
    }
    for (const a of emails) {
        if (photos[a]) knownPhotos.set(a, photos[a]);
        else missingPhotos.add(a);
    }
    for (const el of document.querySelectorAll('.avatar[data-av]')) {
        const a = el.dataset.av;
        if (knownPhotos.has(a) && !el.querySelector('.av-img')) el.insertAdjacentHTML('beforeend', photoImg(a, knownPhotos.get(a)));
    }
    if (pendingPhotos.size) flushPhotos();
}
// forget what we know (sender photos turned on/off, or your own photo changed)
function resetPhotos(addr) {
    for (const set of [missingPhotos, knownPhotos, askedPhotos, pendingPhotos]) addr ? set.delete(addr) : set.clear();
}
document.addEventListener('load', e => e.target.classList && e.target.classList.contains('av-img') && e.target.classList.add('ok'), true);
document.addEventListener('error', e => {
    const t = e.target;
    if (!t.classList || !t.classList.contains('av-img')) return;
    missingPhotos.add(t.dataset.email);
    knownPhotos.delete(t.dataset.email);
    t.remove();
}, true);
const personName = p => (p ? p.name || p.address : '');
const fmtAddr = p => (p.name ? `${p.name} <${p.address}>` : p.address);
const fmtAddrList = list => list.map(fmtAddr).join(', ');

export { $, $$, api, avatar, calm, catchIn, caught, debounce, esc, flyToFolder, fmtAddr, fmtAddrList, fmtDate, fmtSize, glide, h, hue, lastPress, knownPhotos, missingPhotos, morphFrom, resetPhotos, morphTo, nextFrame, personName, qs, recentPress, toast, visibleRect };
