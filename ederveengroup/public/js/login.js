(function () {
    const form = document.getElementById('login');
    const err = document.getElementById('err');
    const btn = document.getElementById('submit');
    const pw = document.getElementById('password');
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // stagger the form in, one row after another
    [...form.children].forEach((el, i) => el.style.setProperty('--i', i));

    // shared artwork motion (also used by the landing page)
    window.egFx.parallax(document.getElementById('rings'));
    window.egFx.starfield(document.getElementById('stars'));

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
    function warpTo(url, from = btn, leaving = form) {
        if (calm) return location.replace(url);
        const r = from.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        const warp = document.createElement('div');
        warp.className = 'warp';
        warp.style.left = `${x}px`;
        warp.style.top = `${y}px`;
        warp.style.setProperty('--s', (reach * 2.2) / 40);
        document.body.append(warp);
        leaving.classList.add('leaving');
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
            const res = await fetch('api/login', {
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
            if (data.twofa) return showTwofa(data);
            btn.classList.remove('busy');
            btn.classList.add('done');
            btn.innerHTML = window.icon('check') + '<span>Welcome</span>';
            setTimeout(() => warpTo('./'), 280);
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

    /* ---------- two-step check ---------- */

    const tf = document.getElementById('twofa');
    const tfErr = document.getElementById('tf-err');
    const tfBtn = document.getElementById('tf-submit');
    const boxes = [...tf.querySelectorAll('.otp input')];
    const recoveryWrap = document.getElementById('recovery-wrap');
    const recovery = document.getElementById('recovery');
    let ticket = null, useRecovery = false, timer = 0;

    function swap(out, into) {
        out.classList.add('leaving');
        setTimeout(() => {
            out.classList.add('hidden');
            out.classList.remove('leaving');
            [...into.children].forEach((el, i) => el.style.setProperty('--i', i));
            into.classList.remove('hidden');
        }, 380);
    }

    function showTwofa(data) {
        ticket = data.ticket;
        document.getElementById('tf-email').textContent = data.email;
        btn.disabled = false;
        btn.classList.remove('busy');
        btn.innerHTML = '<span>Sign in</span>';
        swap(form, tf);
        setTimeout(() => boxes[0].focus(), 420);
        // ring shows how long the code in your app has left
        const ring = tf.querySelector('.tf-timer .left');
        clearInterval(timer);
        const tick = () => ring.style.strokeDashoffset = String(1 - ((30 - ((Date.now() / 1000) % 30)) / 30));
        tick();
        timer = setInterval(tick, 250);
    }

    const code = () => boxes.map(b => b.value).join('');
    function fill(digits, from = 0) {
        digits.split('').forEach((d, i) => boxes[from + i] && (boxes[from + i].value = d));
        boxes.forEach(b => b.classList.toggle('filled', !!b.value));
        const next = boxes.find(b => !b.value);
        (next || boxes[5]).focus();
        if (code().length === 6) tf.requestSubmit();
    }
    boxes.forEach((b, i) => {
        b.addEventListener('input', () => {
            const digits = b.value.replace(/\D/g, '');
            b.value = '';
            if (digits) fill(digits.slice(0, 6 - i), i);
            else b.classList.remove('filled');
        });
        b.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !b.value && i > 0) {
                boxes[i - 1].value = '';
                boxes[i - 1].classList.remove('filled');
                boxes[i - 1].focus();
                e.preventDefault();
            } else if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
            else if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
        });
        b.addEventListener('paste', e => {
            const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
            if (!digits) return;
            e.preventDefault();
            boxes.forEach(x => (x.value = ''));
            fill(digits.slice(0, 6));
        });
        b.addEventListener('focus', () => b.select());
    });

    document.getElementById('use-recovery').addEventListener('click', e => {
        useRecovery = !useRecovery;
        tf.querySelector('.otp').classList.toggle('hidden', useRecovery);
        recoveryWrap.classList.toggle('hidden', !useRecovery);
        e.target.textContent = useRecovery ? 'Use your authenticator app' : 'Use a recovery code';
        (useRecovery ? recovery : boxes[0]).focus();
    });
    document.getElementById('tf-back').addEventListener('click', () => {
        ticket = null;
        clearInterval(timer);
        boxes.forEach(b => (b.value = '', b.classList.remove('filled')));
        tfErr.classList.add('hidden');
        swap(tf, form);
        setTimeout(() => pw.select(), 420);
    });

    tf.addEventListener('submit', async e => {
        e.preventDefault();
        const value = useRecovery ? recovery.value.trim() : code();
        if (!useRecovery && value.length < 6) return boxes.find(b => !b.value).focus();
        tfErr.classList.add('hidden');
        tfBtn.disabled = true;
        tfBtn.classList.add('busy');
        tfBtn.innerHTML = '<div class="spinner" style="border-top-color:currentColor"></div><span>Verifying…</span>';
        try {
            const res = await fetch('api/login/2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-EG': '1' },
                body: JSON.stringify({ ticket, code: value, trust: document.getElementById('trust').checked })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw Object.assign(new Error(data.error || 'Verification failed'), { restart: data.restart });
            tfBtn.classList.remove('busy');
            tfBtn.classList.add('done');
            tfBtn.innerHTML = window.icon('check') + '<span>Verified</span>';
            tf.querySelector('.otp').classList.add('ok');
            clearInterval(timer);
            if (data.usedRecovery) sessionStorage.setItem('eg.recoveryLeft', String(data.recoveryLeft));
            setTimeout(() => warpTo('./', tfBtn, tf), 380);
        } catch (ex) {
            tfBtn.disabled = false;
            tfBtn.classList.remove('busy');
            tfBtn.innerHTML = '<span>Verify</span>';
            if (ex.restart) {
                document.getElementById('tf-back').click();
                setTimeout(() => {
                    err.textContent = ex.message;
                    err.classList.remove('hidden');
                }, 420);
                return;
            }
            tfErr.textContent = ex.message;
            tfErr.classList.remove('hidden');
            tf.classList.remove('shake', 'error');
            void tf.offsetWidth;
            tf.classList.add('shake', 'error');
            if (useRecovery) recovery.select();
            else {
                boxes.forEach(b => (b.value = '', b.classList.remove('filled')));
                boxes[0].focus();
            }
        }
    });
})();
