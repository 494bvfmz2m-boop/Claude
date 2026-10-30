// Ambient motion shared by the login and landing pages. Everything here only moves
// things with transform/opacity or draws on one low-resolution canvas, so it stays smooth.
(function () {
    'use strict';
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

    // shared pointer position, read once per animation frame by whoever needs it
    const pointer = { x: innerWidth / 2, y: innerHeight / 2, moved: false };
    addEventListener('pointermove', e => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.moved = true;
    }, { passive: true });

    // artwork drifts gently against the cursor
    function parallax(el) {
        if (!el || calm || !finePointer) return;
        let raf = 0;
        addEventListener('pointermove', () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                el.style.setProperty('--px', `${(pointer.x / innerWidth - 0.5) * -28}px`);
                el.style.setProperty('--py', `${(pointer.y / innerHeight - 0.5) * -28}px`);
            });
        }, { passive: true });
    }

    // drifting stars that link up with each other and with the cursor
    function starfield(cv) {
        if (!cv || calm) return;
        const ctx = cv.getContext('2d');
        let w = 0, h = 0, pts = [], rgb = '76,141,255', visible = true, raf = 0;
        const LINK = 100, LINK2 = LINK * LINK, REACH = 150, REACH2 = REACH * REACH;

        const readAccent = () => {
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4c8dff';
            const hex = ctx.fillStyle.replace('#', '');
            if (hex.length === 6) rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
        };
        const resize = () => {
            const r = cv.getBoundingClientRect();
            w = Math.round(r.width);
            h = Math.round(r.height);
            // 1x resolution: tiny dots and hairlines don't need retina pixels, and it's 4x less work
            cv.width = w;
            cv.height = h;
            const n = Math.min(80, Math.round((w * h) / 11000));
            while (pts.length < n) {
                pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: 0.7 + Math.random() * 1.1, p: Math.random() * 6.28 });
            }
            pts.length = n;
            readAccent();
        };
        new ResizeObserver(resize).observe(cv);
        new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible && !raf) raf = requestAnimationFrame(frame);
        }).observe(cv);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !raf) raf = requestAnimationFrame(frame);
        });

        const links = [[], [], [], []];
        const dots = [[], [], [], []];
        function frame(t) {
            raf = 0;
            if (document.hidden || !visible || !w) return;
            const r = cv.getBoundingClientRect();
            const mx = pointer.x - r.left, my = pointer.y - r.top;
            ctx.clearRect(0, 0, w, h);
            for (const b of links) b.length = 0;
            for (const b of dots) b.length = 0;

            for (const p of pts) {
                const dx = mx - p.x, dy = my - p.y, d2 = dx * dx + dy * dy;
                if (d2 < REACH2 * 1.15) {
                    const d = Math.sqrt(d2) || 1;
                    p.vx += (dx / d) * 0.006;
                    p.vy += (dy / d) * 0.006;
                }
                p.vx *= 0.995;
                p.vy *= 0.995;
                p.x = (p.x + p.vx + w) % w;
                p.y = (p.y + p.vy + h) % h;
                p.near = d2 < REACH2;
            }
            // bucket every line and dot by brightness so each bucket is a single stroke/fill call
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i];
                for (let j = i + 1; j < pts.length; j++) {
                    const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
                    if (d2 < LINK2) links[Math.min(3, ((1 - Math.sqrt(d2) / LINK) * 4) | 0)].push(a.x, a.y, b.x, b.y);
                }
                const tw = 0.5 + 0.5 * Math.sin(t / 900 + a.p);
                dots[a.near ? 3 : Math.min(2, (tw * 3) | 0)].push(a);
            }
            ctx.lineWidth = 0.6;
            links.forEach((segs, k) => {
                if (!segs.length) return;
                ctx.strokeStyle = `rgba(${rgb},${((k + 0.5) / 4) * 0.17})`;
                ctx.beginPath();
                for (let i = 0; i < segs.length; i += 4) {
                    ctx.moveTo(segs[i], segs[i + 1]);
                    ctx.lineTo(segs[i + 2], segs[i + 3]);
                }
                ctx.stroke();
            });
            ctx.strokeStyle = `rgba(${rgb},.3)`;
            ctx.beginPath();
            for (const p of pts) {
                if (!p.near) continue;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(mx, my);
            }
            ctx.stroke();
            dots.forEach((list, k) => {
                if (!list.length) return;
                ctx.fillStyle = `rgba(${rgb},${[0.3, 0.5, 0.7, 0.95][k]})`;
                ctx.beginPath();
                for (const p of list) {
                    const rad = p.r + (k === 3 ? 0.6 : 0);
                    ctx.moveTo(p.x + rad, p.y);
                    ctx.arc(p.x, p.y, rad, 0, 6.283);
                }
                ctx.fill();
            });
            raf = requestAnimationFrame(frame);
        }
        resize();
        raf = requestAnimationFrame(frame);
    }

    // buttons that lean towards the cursor
    function magnetic(els) {
        if (calm || !finePointer) return;
        els.forEach(el => {
            const strength = Number(el.dataset.magnetic) || 0.3;
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                const x = (e.clientX - r.left - r.width / 2) * strength;
                const y = (e.clientY - r.top - r.height / 2) * strength;
                el.style.translate = `${Math.max(-12, Math.min(12, x))}px ${Math.max(-10, Math.min(10, y))}px`;
            });
            el.addEventListener('pointerleave', () => (el.style.translate = ''));
        });
    }

    // a soft light that trails the cursor (eased, one transform per frame)
    function cursorGlow() {
        if (calm || !finePointer) return;
        const glow = document.createElement('div');
        glow.className = 'cursor-glow';
        document.body.append(glow);
        let x = pointer.x, y = pointer.y;
        (function follow() {
            const dx = pointer.x - x, dy = pointer.y - y;
            if (Math.abs(dx) + Math.abs(dy) > 0.1) {
                x += dx * 0.12;
                y += dy * 0.12;
                glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
            if (pointer.moved) glow.classList.add('on');
            requestAnimationFrame(follow);
        })();
    }

    // wrap each character so headlines can reveal letter by letter
    function splitChars(el, startIndex = 0) {
        if (!el) return startIndex;
        let i = startIndex;
        const text = el.textContent;
        el.textContent = '';
        el.setAttribute('aria-label', text);
        for (const ch of text) {
            const s = document.createElement('span');
            s.className = 'ch';
            s.setAttribute('aria-hidden', 'true');
            s.textContent = ch;
            s.style.setProperty('--i', i++);
            el.append(s);
        }
        return i;
    }

    window.egFx = { parallax, starfield, magnetic, cursorGlow, splitChars, calm };
})();
