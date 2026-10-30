(function () {
    const form = document.getElementById('login');
    const err = document.getElementById('err');
    const btn = document.getElementById('submit');
    const pw = document.getElementById('password');
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // stagger the form in, one row after another
    [...form.children].forEach((el, i) => el.style.setProperty('--i', i));

    // parallax on the artwork
    const rings = document.getElementById('rings');
    if (rings && !calm) {
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
    const canvas = document.getElementById('stars');
    if (canvas && !calm) starfield(canvas);

    function starfield(cv) {
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

    // caps lock hint
    const caps = document.getElementById('caps');
    const checkCaps = e => e.getModifierState && caps.classList.toggle('on', e.getModifierState('CapsLock'));
    pw.addEventListener('keydown', checkCaps);
    pw.addEventListener('keyup', checkCaps);
    pw.addEventListener('blur', () => caps.classList.remove('on'));

    document.getElementById('peek').addEventListener('click', () => {
        pw.type = pw.type === 'password' ? 'text' : 'password';
        pw.focus();
    });

    // on success, a circle grows out of the button and hands over to the app's splash
    function warpTo(url) {
        if (calm) return location.replace(url);
        const r = btn.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const warp = document.createElement('div');
        warp.className = 'warp';
        warp.style.left = `${x}px`;
        warp.style.top = `${y}px`;
        warp.style.setProperty('--s', (reach * 2.2) / 40);
        document.body.append(warp);
        form.classList.add('leaving');
        requestAnimationFrame(() => requestAnimationFrame(() => warp.classList.add('go')));
        setTimeout(() => location.replace(url), 880);
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        err.classList.add('hidden');
        form.classList.remove('error');
        btn.disabled = true;
        btn.classList.add('busy');
        btn.innerHTML = '<div class="spinner" style="border-top-color:currentColor"></div><span>Signing in…</span>';
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-EG': '1' },
                body: JSON.stringify({
                    email: document.getElementById('email').value,
                    password: pw.value,
                    remember: document.getElementById('remember').checked
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Sign in failed');
            btn.classList.remove('busy');
            btn.classList.add('done');
            btn.innerHTML = window.icon('check') + '<span>Welcome</span>';
            setTimeout(() => warpTo('/'), 280);
        } catch (ex) {
            err.textContent = ex.message;
            err.classList.remove('hidden');
            form.classList.remove('shake', 'error');
            void form.offsetWidth;
            form.classList.add('shake', 'error');
            btn.disabled = false;
            btn.classList.remove('busy');
            btn.innerHTML = '<span>Sign in</span>';
            pw.select();
        }
    });
})();
