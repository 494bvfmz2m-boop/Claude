// Jarvis in every app: a small glowing button (admins only) that opens Jarvis as a pop-up, so you can
// ask him something without leaving what you're doing. Drag the button anywhere along the sides; it
// stays where you put it. Alt+J opens and closes it. The pop-up is the Jarvis page itself in a frame
// (same memory, voice and tools), kept open in the background once loaded so it opens instantly.
(function () {
    if (window.parent !== window || /^\/jarvis\/?$/.test(location.pathname)) return;
    const NO = 'eg-jarvis-dock-no';
    const POS = 'eg-jarvis-dock-pos';
    const store = {
        get(area, k) {
            try {
                return area.getItem(k);
            } catch {
                return null;
            }
        },
        set(area, k, v) {
            try {
                area.setItem(k, v);
            } catch {
                /* private window */
            }
        }
    };
    if (store.get(sessionStorage, NO)) return; // not an admin (asked once per visit)
    fetch('/api/jarvis/status?lite=1', { headers: { 'X-EG': '1' }, credentials: 'same-origin' })
        .then(r => {
            if (r.ok) return mount();
            if (r.status === 403 || r.status === 404) store.set(sessionStorage, NO, '1'); // not for this person, or switched off
        })
        .catch(() => {});

    const phone = () => matchMedia('(max-width: 760px)').matches;
    const CORE = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="jvdCore"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#d9fbff"/><stop offset=".75" stop-color="#3fdcff" stop-opacity=".7"/><stop offset="1" stop-color="#0a84ff" stop-opacity="0"/></radialGradient></defs>
        <circle class="jvd-ring" cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="9 3 2 3" opacity=".8"/>
        <g fill="currentColor" opacity=".85">${Array.from({ length: 8 }, (_, i) => `<rect x="22.6" y="9.5" width="2.8" height="4.6" rx="1" transform="rotate(${i * 45} 24 24)"/>`).join('')}</g>
        <circle cx="24" cy="24" r="9" fill="url(#jvdCore)"/><circle cx="24" cy="24" r="4.2" fill="#effeff"/></svg>`;

    /* ---------- the page behind the pop-up: what's on it, and typing into it ---------- */
    // the field you were last in (so Jarvis can type there even though you're talking to him)
    let field = null;
    let range = null;
    const writable = el =>
        el && el !== document.body && !el.closest('.jvd-panel') &&
        (el.isContentEditable || (el.tagName === 'TEXTAREA' && !el.readOnly && !el.disabled) || (el.tagName === 'INPUT' && /^(text|search|email|url|)$/i.test(el.type) && !el.readOnly && !el.disabled));
    document.addEventListener('focusin', e => {
        const el = e.target.isContentEditable ? e.target.closest('[contenteditable=""], [contenteditable="true"]') || e.target : e.target;
        if (writable(el)) field = el;
    });
    document.addEventListener('selectionchange', () => {
        const sel = getSelection();
        if (field && field.isContentEditable && sel.rangeCount && field.contains(sel.anchorNode)) range = sel.getRangeAt(0).cloneRange();
    });
    const APP_NAMES = { hub: 'dashboard', app: 'Mail', notes: 'Notes', tasks: 'Tasks', contacts: 'Contacts', calendar: 'Calendar', files: 'Files', photos: 'Photos', docs: 'Docs', slides: 'Slides', sheets: 'Spreadsheets', forms: 'Forms', chat: 'Chat', planner: 'Planner', whiteboard: 'Whiteboard', photoedit: 'Photo Editor', videoedit: 'Video Editor', widgets: 'Widgets', admin: 'Admin', profile: 'Profile' };
    function appName() {
        if (/^\/mail\//.test(location.pathname)) return 'Mail';
        // (every app page is also a "hub-body app-body": the app is the other one, like "docs-body")
        const own = [...document.body.classList].map(c => /^([a-z]+)-body$/.exec(c)).filter(m => m && m[1] !== 'hub' && m[1] !== 'app').map(m => m[1])[0];
        if (own) return APP_NAMES[own] || own;
        return location.pathname === '/' ? 'dashboard' : document.title.split(' · ')[0];
    }
    function labelOf(el) {
        const l = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.name || '';
        return l.trim().slice(0, 100);
    }
    function screen() {
        const main = document.querySelector('main') || document.body;
        const copy = main.cloneNode(true);
        copy.querySelectorAll('script, style, svg, .jvd-panel, .jvd-btn, [aria-hidden="true"]').forEach(x => x.remove());
        let selected = '';
        try {
            selected = String(range && field && field.isContentEditable ? range.toString() : getSelection()).trim();
            if (!selected && field && field.selectionEnd > field.selectionStart) selected = field.value.slice(field.selectionStart, field.selectionEnd);
        } catch {
            selected = '';
        }
        const alive = field && document.contains(field);
        return {
            app: appName(),
            title: document.title,
            path: location.pathname,
            focused: alive ? { kind: field.isContentEditable ? 'text editor' : field.tagName === 'TEXTAREA' ? 'text box' : 'text field', label: labelOf(field) } : null,
            selected: selected.slice(0, 4000),
            text: (copy.innerText || copy.textContent || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12000)
        };
    }
    // type text where the cursor was, a few letters at a time (so you see it being written)
    let typing = null;
    function type(text, { onDone } = {}) {
        if (typing) typing.stop();
        const el = field && document.contains(field) ? field : null;
        if (!el) return onDone && onDone(false), null;
        el.focus({ preventScroll: false });
        if (el.isContentEditable && range) {
            const sel = getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        const rich = el.isContentEditable;
        const oneLine = el.tagName === 'INPUT';
        const pieces = String(text).replace(/\r/g, '').split(/(\n+)/).filter(Boolean);
        const per = Math.max(1, Math.ceil(text.length / 650)); // long texts type faster, so it never takes more than ~12 s
        let i = 0;
        let pos = 0;
        let stopped = false;
        const insert = t => {
            if (document.execCommand('insertText', false, t)) return;
            // (a browser that won't: put it in by hand, and tell the app)
            if (!rich) {
                el.setRangeText(t, el.selectionStart, el.selectionEnd, 'end');
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };
        const step = () => {
            if (stopped) return;
            if (i >= pieces.length) return finish(true);
            const piece = pieces[i];
            if (piece[0] === '\n') {
                if (oneLine) insert(' ');
                else if (rich) document.execCommand(piece.length > 1 ? 'insertParagraph' : 'insertLineBreak');
                else insert(piece.length > 1 ? '\n\n' : '\n');
                i++;
            } else {
                insert(piece.slice(pos, pos + per));
                pos += per;
                if (pos >= piece.length) (i++, (pos = 0));
            }
            setTimeout(step, 16);
        };
        const finish = ok => {
            typing = null;
            btn && btn.classList.remove('typing');
            if (!rich) el.dispatchEvent(new Event('change', { bubbles: true }));
            onDone && onDone(ok);
        };
        const btn = document.querySelector('.jvd-btn');
        btn && btn.classList.add('typing');
        typing = { stop: () => ((stopped = true), finish(false)) };
        step();
        return typing;
    }
    const stopTyping = () => typing && typing.stop();
    document.addEventListener('keydown', e => e.key === 'Escape' && typing && stopTyping(), true);

    function mount() {
        const btn = document.createElement('button');
        btn.className = 'jvd-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Jarvis');
        btn.title = 'Jarvis (Alt+J). Drag to move.';
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = CORE;
        document.body.append(btn);
        let panel = null;
        let frame = null;
        let back = null;
        let open = false;

        // where the button sits: a side (left or right) and how far down, remembered on this device
        let pos = { side: 'right', y: phone() ? 0.62 : 0.86 };
        try {
            const saved = JSON.parse(store.get(localStorage, POS) || 'null');
            if (saved && (saved.side === 'left' || saved.side === 'right') && saved.y >= 0 && saved.y <= 1) pos = saved;
        } catch {
            /* the default */
        }
        const size = () => btn.offsetWidth || 52;
        function place() {
            const m = phone() ? 10 : 18;
            const y = Math.round(Math.min(innerHeight - size() - m, Math.max(m, pos.y * innerHeight - size() / 2)));
            btn.style.top = `${y}px`;
            btn.style.left = pos.side === 'left' ? `${m}px` : '';
            btn.style.right = pos.side === 'right' ? `${m}px` : '';
            btn.dataset.side = pos.side;
            if (open && panel && !phone()) placePanel();
        }
        place();
        addEventListener('resize', place);

        // drag along the edge; a tap (no real move) opens Jarvis
        let drag = null;
        btn.addEventListener('pointerdown', e => {
            if (e.button) return;
            drag = { x: e.clientX, y: e.clientY, moved: false };
            btn.setPointerCapture(e.pointerId);
        });
        btn.addEventListener('pointermove', e => {
            if (!drag) return;
            if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7) return;
            drag.moved = true;
            btn.classList.add('dragging');
            btn.style.left = `${e.clientX - size() / 2}px`;
            btn.style.right = '';
            btn.style.top = `${e.clientY - size() / 2}px`;
        });
        const drop = e => {
            if (!drag) return;
            const moved = drag.moved;
            drag = null;
            btn.classList.remove('dragging');
            if (!moved) return;
            pos = { side: e.clientX < innerWidth / 2 ? 'left' : 'right', y: Math.min(1, Math.max(0, e.clientY / innerHeight)) };
            store.set(localStorage, POS, JSON.stringify(pos));
            place();
            btn.dataset.dragged = '1'; // the click that follows a drag isn't a tap
            setTimeout(() => delete btn.dataset.dragged, 400);
        };
        btn.addEventListener('pointerup', drop);
        btn.addEventListener('pointercancel', drop);
        btn.addEventListener('click', () => {
            if (btn.dataset.dragged) return delete btn.dataset.dragged;
            toggle();
        });

        function build() {
            panel = document.createElement('div');
            panel.className = 'jvd-panel';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-label', 'Jarvis');
            frame = document.createElement('iframe');
            frame.src = '/jarvis/?mini=1';
            frame.title = 'Jarvis';
            frame.allow = 'microphone; geolocation; autoplay';
            panel.append(frame);
            back = document.createElement('div');
            back.className = 'jvd-back';
            back.addEventListener('click', close);
            document.body.append(back, panel);
        }
        // beside the button on a computer; a sheet from the bottom on a phone
        function placePanel() {
            const r = btn.getBoundingClientRect();
            const w = Math.min(400, innerWidth - 32);
            const h = Math.min(620, innerHeight - 32);
            const top = Math.min(innerHeight - h - 16, Math.max(16, r.top + r.height / 2 - h / 2));
            panel.style.width = `${w}px`;
            panel.style.height = `${h}px`;
            panel.style.top = `${top}px`;
            const side = r.left + r.width / 2 < innerWidth / 2 ? 'left' : 'right';
            panel.style.left = side === 'left' ? `${Math.min(innerWidth - w - 16, r.right + 12)}px` : '';
            panel.style.right = side === 'right' ? `${Math.min(innerWidth - w - 16, innerWidth - r.left + 12)}px` : '';
            panel.style.transformOrigin = `${side === 'left' ? 'left' : 'right'} ${r.top + r.height / 2 - top}px`;
        }
        function show() {
            if (!panel) build();
            open = true;
            document.documentElement.classList.add('jvd-open');
            btn.setAttribute('aria-expanded', 'true');
            if (phone()) {
                panel.removeAttribute('style');
            } else placePanel();
            panel.classList.add('on');
            back.classList.toggle('on', phone());
            const hello = () => {
                try {
                    frame.contentWindow.jarvisMini.opened(!phone());
                } catch {
                    /* still loading */
                }
            };
            if (frame.dataset.loaded) hello();
            else frame.addEventListener('load', () => ((frame.dataset.loaded = '1'), open && hello()), { once: true });
        }
        function close() {
            if (!open) return;
            open = false;
            document.documentElement.classList.remove('jvd-open');
            btn.setAttribute('aria-expanded', 'false');
            panel.classList.remove('on');
            back.classList.remove('on');
            try {
                frame.contentWindow.jarvisMini.closed();
            } catch {
                /* not loaded */
            }
            btn.focus({ preventScroll: true });
        }
        const toggle = () => (open ? close() : show());
        window.EGJarvisDock = { open: show, close, toggle, screen, type, stopTyping };
        document.addEventListener('keydown', e => {
            if (e.altKey && e.code === 'KeyJ' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                toggle();
            } else if (e.key === 'Escape' && open && !document.querySelector('.pf-crop-back')) close();
        });
    }
})();
