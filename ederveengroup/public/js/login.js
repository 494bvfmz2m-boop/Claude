(function () {
    const form = document.getElementById('login');
    const err = document.getElementById('err');
    const btn = document.getElementById('submit');
    const pw = document.getElementById('password');
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // stagger the form in, one row after another
    [...form.children].forEach((el, i) => el.style.setProperty('--i', i));

    // shared artwork motion (also used by the landing page)
    window.egFx.splitChars(document.querySelector('.login-art h1 .split'));
    window.egFx.parallax(document.getElementById('rings'));
    window.egFx.starfield(document.getElementById('stars'));
    window.egFx.magnetic(document.querySelectorAll('[data-magnetic]'));
    window.egFx.cursorGlow();

    // where to go after signing in: the page you asked for (only pages inside the app)
    // (the server checks it again; anything else goes to the hub)
    const nextParam = new URLSearchParams(location.search).get('next') || '';
    const next = /^\/(?:|welcome|profile\/?|admin\/?|mail\/(?:inbox|sent|drafts|archive|junk|trash|snoozed|starred|f\/[\w-]{8}|search\/[\w-]{6,16}|settings)(?:\/[\w-]{2,20}){0,2})$/.test(nextParam) ? nextParam : '/';

    // "Sign in with Microsoft / Google": only the ones that are set up
    const OAUTH_LOGOS = {
        microsoft: '<svg viewBox="0 0 21 21" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>',
        google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"/></svg>'
    };
    const oauthBox = document.getElementById('oauth');
    fetch('/api/auth/providers')
        .then(r => (r.ok ? r.json() : []))
        .then(list => {
            if (!list.length) return;
            oauthBox.innerHTML =
                list.map(p => `<a class="oauth-btn" data-provider="${p.id}" href="/auth/${p.id}?next=${encodeURIComponent(next)}">${OAUTH_LOGOS[p.id] || ''}<span>Sign in with ${p.name}</span></a>`).join('') +
                '<div class="oauth-or"><span>or use your email and password</span></div>';
            oauthBox.classList.remove('hidden');
            // pass the address along if they already typed it, so the right account is suggested
            oauthBox.addEventListener('click', e => {
                const a = e.target.closest('.oauth-btn');
                const email = document.getElementById('email').value.trim();
                if (a && /@/.test(email)) a.href += `&email=${encodeURIComponent(email)}`;
                if (a) a.classList.add('busy');
            });
        })
        .catch(() => {});

    // back from Microsoft / Google with something to explain
    const OAUTH_MESSAGES = {
        cancelled: [false, 'Sign-in was cancelled.'],
        expired: [false, 'That sign-in took too long or was started elsewhere. Please try again.'],
        failed: [false, 'The sign-in didn’t go through. Please try again.'],
        unreachable: [false, 'Couldn’t reach the sign-in service. Try again in a moment.'],
        busy: [false, 'Too many sign-in attempts. Wait a few minutes and try again.'],
        off: [false, 'That sign-in option isn’t available.'],
        no_email: [false, 'That account has no email address we can use.'],
        imap_off_personal: [false, 'You’re signed in with Microsoft, but your mailbox doesn’t allow mail apps yet. In Outlook.com open Settings → Mail → Forwarding and IMAP, turn on “Let devices and apps use IMAP”, then try again.'],
        imap_off_work: [false, 'You’re signed in with Microsoft, but your organisation’s mailbox doesn’t allow IMAP and SMTP for apps. Ask your Microsoft 365 admin to turn on IMAP and “Authenticated SMTP” for your mailbox.'],
        imap_off: [false, 'You’re signed in, but your mailbox didn’t accept the connection. Check that IMAP is turned on for your account, then try again.'],
        pending: [true, 'Thanks! Your request to use EderveenGroup is waiting for an admin. You’ll get an email when it’s approved.']
    };
    const oauthMsg = new URLSearchParams(location.search).get('oauth');
    if (oauthMsg && OAUTH_MESSAGES[oauthMsg]) {
        const [good, text] = OAUTH_MESSAGES[oauthMsg];
        const box = document.getElementById(good ? 'ok' : 'err');
        box.textContent = text;
        box.classList.remove('hidden');
        history.replaceState(null, '', location.pathname + (nextParam ? `?next=${encodeURIComponent(nextParam)}` : ''));
    }

    // sent here because this device was signed out from somewhere else
    if (new URLSearchParams(location.search).has('signedout')) {
        err.textContent = 'You were signed out from another device. Sign in again to continue.';
        err.classList.remove('hidden');
        history.replaceState(null, '', location.pathname + (nextParam ? `?next=${encodeURIComponent(nextParam)}` : ''));
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
            setTimeout(() => warpTo(next), 280);
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

    // after a Microsoft / Google sign-in, the two-step code is asked here
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.get('twofa')) {
        history.replaceState(null, '', location.pathname + location.search);
        showTwofa({ ticket: hash.get('twofa'), email: hash.get('email') || '' });
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
            setTimeout(() => warpTo(next, tfBtn, tf), 380);
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
