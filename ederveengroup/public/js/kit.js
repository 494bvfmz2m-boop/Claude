// Shared helpers for the hub apps (Notes, Tasks, Contacts): window.EG
(function () {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const here = encodeURIComponent(location.pathname);
    async function call(url, opts = {}) {
        const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'X-EG': '1' }, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
        if (res.status === 401) location.replace(`/login?next=${here}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Something went wrong');
        return data;
    }
    function toast(text, { bad = false, action, onAction } = {}) {
        $$('.pf-toast').forEach(t => t.remove());
        const t = document.createElement('div');
        t.className = 'pf-toast' + (bad ? ' bad' : '');
        t.innerHTML = `<span>${esc(text)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
        if (action) $('button', t).onclick = () => (t.remove(), onAction());
        document.body.append(t);
        setTimeout(() => t.classList.add('out'), action ? 5000 : 2400);
        setTimeout(() => t.remove(), action ? 5500 : 2900);
    }
    function ask({ title, text = '', ok = 'OK', danger = false }) {
        return new Promise(resolve => {
            const back = document.createElement('div');
            back.className = 'pf-crop-back';
            back.innerHTML = `<div class="pf-crop ad-ask" role="alertdialog" aria-modal="true"><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}
                <div class="pf-crop-acts"><button class="btn" data-x>Cancel</button><button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-ok>${esc(ok)}</button></div></div>`;
            document.body.append(back);
            const done = v => {
                back.classList.add('out');
                setTimeout(() => back.remove(), 250);
                resolve(v);
            };
            $('[data-x]', back).onclick = () => done(false);
            $('[data-ok]', back).onclick = () => done(true);
            back.addEventListener('click', e => e.target === back && done(false));
            back.addEventListener('keydown', e => e.key === 'Escape' && done(false));
            $('[data-ok]', back).focus();
        });
    }
    const id = () => {
        const b = crypto.getRandomValues(new Uint8Array(12));
        return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    const debounce = (fn, ms) => {
        let t;
        return (...a) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...a), ms);
        };
    };
    const ago = t => {
        const d = Date.now() - t;
        if (d < 60e3) return 'just now';
        if (d < 3600e3) return `${Math.round(d / 60e3)} min ago`;
        if (d < 864e5) return new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        if (d < 6 * 864e5) return new Date(t).toLocaleDateString(undefined, { weekday: 'long' });
        return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
    };
    const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
    const initials = s => (String(s || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2) || '?').toUpperCase();
    const phone = () => matchMedia('(max-width: 760px)').matches;
    window.EG = { $, $$, esc, ic: n => window.icon(n), call, toast, ask, id, debounce, ago, hue, initials, phone };
})();
