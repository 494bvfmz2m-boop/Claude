// Ambient motion shared by the login and landing pages.
(function () {
    'use strict';
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // parallax on the artwork
    function parallax(rings) {
        if (!rings || calm) return;
        let raf = 0;
        addEventListener('mousemove', e => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const x = e.clientX / innerWidth - 0.5;
                const y = e.clientY / innerHeight - 0.5;
                rings.style.setProperty('--px', `${x * -28}px`);
                rings.style.setProperty('--py', `${y * -28}px`);
            });
        });
    }

    // drifting stars that link up with each other and with the cursor
    function starfield(cv) {
        if (!cv || calm) return;
        const ctx = cv.getContext('2d');
        let w = 0, h = 0, pts = [], rgb = '76,141,255', running = true;
        const mouse = { x: -1e4, y: -1e4 };

        const readAccent = () => {
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4c8dff';
            const hex = ctx.fillStyle.replace('#', '');
            if (hex.length === 6) rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
        };
        const resize = () => {
            const r = cv.getBoundingClientRect();
            const dpr = Math.min(devicePixelRatio || 1, 2);
            w = r.width;
            h = r.height;
            cv.width = w * dpr;
            cv.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = Math.min(90, Math.round((w * h) / 9000));
            while (pts.length < n) {
                pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: 0.6 + Math.random() * 1.1, p: Math.random() * 6.28 });
            }
            pts.length = n;
            readAccent();
        };
        new ResizeObserver(resize).observe(cv);
        addEventListener('mousemove', e => {
            const r = cv.getBoundingClientRect();
            mouse.x = e.clientX - r.left;
            mouse.y = e.clientY - r.top;
        });
        document.addEventListener('mouseleave', () => (mouse.x = mouse.y = -1e4));
        document.addEventListener('visibilitychange', () => {
            running = !document.hidden;
            if (running) requestAnimationFrame(frame);
        });

        function frame(t) {
            if (!running) return;
            ctx.clearRect(0, 0, w, h);
            for (const p of pts) {
                const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy);
                if (d < 160) {
                    p.vx += (dx / d) * 0.006;
                    p.vy += (dy / d) * 0.006;
                }
                p.vx *= 0.995;
                p.vy *= 0.995;
                p.x = (p.x + p.vx + w) % w;
                p.y = (p.y + p.vy + h) % h;
            }
            ctx.lineWidth = 0.6;
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i];
                for (let j = i + 1; j < pts.length; j++) {
                    const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < 105) {
                        ctx.strokeStyle = `rgba(${rgb},${(1 - d / 105) * 0.16})`;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
                const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
                if (md < 150) {
                    ctx.strokeStyle = `rgba(${rgb},${(1 - md / 150) * 0.45})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
                const tw = 0.35 + 0.35 * Math.sin(t / 900 + a.p);
                ctx.fillStyle = `rgba(${rgb},${tw + (md < 150 ? 0.3 : 0)})`;
                ctx.beginPath();
                ctx.arc(a.x, a.y, a.r + (md < 150 ? 0.6 : 0), 0, 6.283);
                ctx.fill();
            }
            requestAnimationFrame(frame);
        }
        resize();
        requestAnimationFrame(frame);
    }

    window.egFx = { parallax, starfield };
})();
