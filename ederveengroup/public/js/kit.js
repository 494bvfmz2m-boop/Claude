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
            back.innerHTML = `<div class="pf-crop cp-ask" role="alertdialog" aria-modal="true"><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}
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

    /**
     * Upload a file to Files in 8 MB parts: each part is retried, and a dropped connection carries
     * on where the server says it got to. onProgress(fraction). Resolves to the new file.
     */
    async function upload(file, { folder = '', taken, onProgress = () => {}, signal } = {}) {
        // when a photo was taken: its camera data, else the file's own date
        const when = taken || (await takenAt(file)) || file.lastModified || null;
        const start = await call('/api/files/uploads', { method: 'POST', body: { name: file.name, size: file.size, type: file.type || '', folder, taken: when } });
        const step = start.piece * 2;
        let offset = 0;
        const put = (from, to) =>
            new Promise((resolve, reject) => {
                const x = new XMLHttpRequest();
                x.open('PUT', `/api/files/uploads/${start.id}?offset=${from}`);
                x.setRequestHeader('X-EG', '1');
                x.setRequestHeader('Content-Type', 'application/octet-stream');
                x.upload.onprogress = e => onProgress(file.size ? (from + e.loaded) / file.size : 1);
                x.onload = () => {
                    let r = {};
                    try {
                        r = JSON.parse(x.responseText);
                    } catch {
                        // shown as a generic problem
                    }
                    if (x.status === 200 || x.status === 409) resolve({ status: x.status, ...r });
                    else reject(Object.assign(new Error(r.error || 'Didn’t upload'), { status: x.status }));
                };
                x.onerror = () => reject(Object.assign(new Error('Connection lost'), { retry: true }));
                if (signal) signal.addEventListener('abort', () => x.abort(), { once: true });
                x.send(file.slice(from, to));
            });
        for (let tries = 0; ; ) {
            if (signal && signal.aborted) {
                await call(`/api/files/uploads/${start.id}`, { method: 'DELETE' }).catch(() => {});
                throw new Error('Stopped');
            }
            try {
                const r = await put(offset, Math.min(file.size, offset + step));
                if (r.done) return r.file;
                offset = r.offset; // also where to carry on after "out of step"
                tries = 0;
            } catch (err) {
                // a dropped connection or a busy server: wait a bit, ask where it got to, go on
                if (!(err.retry || err.status >= 500) || ++tries > 6) throw err;
                await new Promise(r => setTimeout(r, 1000 * 2 ** Math.min(tries, 5)));
                offset = (await call(`/api/files/uploads/${start.id}`).catch(() => ({ offset }))).offset;
            }
        }
    }

    /** when a JPEG photo was taken (its EXIF DateTimeOriginal), as a time; null when it doesn't say */
    async function takenAt(file) {
        try {
            if (!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;
            const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
            if (v.getUint16(0) !== 0xffd8) return null;
            for (let o = 2; o < v.byteLength - 4; ) {
                const marker = v.getUint16(o);
                const len = v.getUint16(o + 2);
                if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) {
                    const t = o + 10; // the TIFF header
                    const le = v.getUint16(t) === 0x4949;
                    const u16 = p => v.getUint16(t + p, le);
                    const u32 = p => v.getUint32(t + p, le);
                    const find = (ifd, tag) => {
                        for (let i = 0, n = u16(ifd); i < n; i++) if (u16(ifd + 2 + i * 12) === tag) return ifd + 2 + i * 12;
                        return null;
                    };
                    const exifPtr = find(u32(4), 0x8769);
                    const at = exifPtr && find(u32(exifPtr + 8), 0x9003);
                    if (!at) return null;
                    const s = String.fromCharCode(...new Uint8Array(v.buffer, t + u32(at + 8), 19));
                    const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)$/.exec(s);
                    return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
                }
                if ((marker & 0xff00) !== 0xff00) break;
                o += 2 + len;
            }
        } catch {
            // not readable: the file's own date is used instead
        }
        return null;
    }

    /** a small JPEG preview of a picture or video (from the file in hand, or from the server) */
    async function preview(src, type) {
        const url = typeof src === 'string' ? src : URL.createObjectURL(src);
        try {
            let el;
            if (/^video\//.test(type)) {
                el = document.createElement('video');
                el.muted = true;
                el.playsInline = true;
                el.preload = 'auto';
                el.src = url;
                await new Promise((ok, no) => ((el.onloadeddata = ok), (el.onerror = no), setTimeout(no, 15000)));
                el.currentTime = Math.min(1, (el.duration || 2) / 2);
                await new Promise((ok, no) => ((el.onseeked = ok), setTimeout(no, 10000)));
            } else {
                el = new Image();
                el.decoding = 'async';
                el.src = url;
                await el.decode();
            }
            const w = el.videoWidth || el.naturalWidth;
            const h = el.videoHeight || el.naturalHeight;
            if (!w || !h) return null;
            const scale = Math.min(1, 480 / Math.max(w, h));
            const c = document.createElement('canvas');
            c.width = Math.round(w * scale);
            c.height = Math.round(h * scale);
            c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
            return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
        } catch {
            return null; // a format this browser can't show (e.g. HEIC outside Safari)
        } finally {
            if (typeof src !== 'string') URL.revokeObjectURL(url);
        }
    }
    /** make and store the preview of an uploaded picture or video */
    async function thumbFor(item, file) {
        if (item.thumb) return true; // made already (perhaps by another tab or a moment ago)
        if (!/^(image|video)\//.test(item.type)) return false;
        const jpg = await preview(file || `/api/files/${encodeURIComponent(item.id)}/content?inline=1`, item.type);
        if (!jpg) return false;
        const res = await fetch(`/api/files/${encodeURIComponent(item.id)}/thumb`, { method: 'PUT', headers: { 'X-EG': '1', 'Content-Type': 'application/octet-stream' }, body: jpg });
        if (res.ok) item.thumb = true;
        return res.ok;
    }

    /* ---------- undo and redo ---------- */
    /** typing in a text box? There Ctrl Z undoes the typing, as everywhere; sliders, ticks and menus don't count */
    function typing(e) {
        const t = e.target;
        if (!t || !t.tagName) return false;
        if (t.isContentEditable || t.tagName === 'TEXTAREA') return true;
        return t.tagName === 'INPUT' && !/^(range|checkbox|radio|button|submit|reset|color|file|image)$/i.test(t.type);
    }
    /** Ctrl/⌘ Z → 'undo'; Ctrl/⌘ Shift Z and Ctrl Y → 'redo' */
    function undoKey(e) {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
        const k = (e.key || '').toLowerCase();
        if (k === 'z') return e.shiftKey ? 'redo' : 'undo';
        if (k === 'y' && !e.shiftKey) return 'redo';
        return null;
    }
    /**
     * Undo for an app that calls note() after each change: it keeps snapshots of get(), and set()
     * puts one back. Changes in quick succession (typing a name) count as one step.
     */
    function undoable(get, set, { limit = 100, merge = 600 } = {}) {
        let back = [];
        let ahead = [];
        let last = null;
        let at = 0;
        const now = () => JSON.stringify(get());
        return {
            reset() {
                back = [];
                ahead = [];
                last = now();
                at = 0;
            },
            note() {
                const cur = now();
                if (last === null) return void (last = cur);
                if (cur === last) return;
                const t = Date.now();
                if (!(t - at < merge && back.length)) {
                    back.push(last);
                    if (back.length > limit) back.shift();
                }
                at = t;
                ahead = [];
                last = cur;
            },
            undo() {
                if (!back.length) return false;
                ahead.push(now());
                last = back.pop();
                at = 0;
                set(JSON.parse(last));
                return true;
            },
            redo() {
                if (!ahead.length) return false;
                back.push(now());
                last = ahead.pop();
                at = 0;
                set(JSON.parse(last));
                return true;
            },
            get canUndo() {
                return back.length > 0;
            },
            get canRedo() {
                return ahead.length > 0;
            }
        };
    }

    window.EG = { $, $$, esc, ic: n => window.icon(n), call, toast, ask, id, debounce, ago, hue, initials, phone, upload, takenAt, preview, thumbFor, typing, undoKey, undoable };
})();
