(function () {
    const form = document.getElementById('login');
    const err = document.getElementById('err');
    const btn = document.getElementById('submit');
    const pw = document.getElementById('password');

    // gentle parallax on the artwork
    const rings = document.getElementById('rings');
    if (rings && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

    document.getElementById('peek').addEventListener('click', () => {
        pw.type = pw.type === 'password' ? 'text' : 'password';
        pw.focus();
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        err.classList.add('hidden');
        btn.disabled = true;
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
            btn.innerHTML = window.icon('check') + '<span>Welcome</span>';
            location.replace('/');
        } catch (ex) {
            err.textContent = ex.message;
            err.classList.remove('hidden');
            form.classList.remove('shake');
            void form.offsetWidth;
            form.classList.add('shake');
            btn.disabled = false;
            btn.innerHTML = '<span>Sign in</span>';
            pw.select();
        }
    });
})();
