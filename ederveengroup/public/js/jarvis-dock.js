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
        window.EGJarvisDock = { open: show, close, toggle };
        document.addEventListener('keydown', e => {
            if (e.altKey && e.code === 'KeyJ' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                toggle();
            } else if (e.key === 'Escape' && open && !document.querySelector('.pf-crop-back')) close();
        });
    }
})();
