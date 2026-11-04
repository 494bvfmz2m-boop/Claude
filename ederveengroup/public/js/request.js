// Request access with your own mail server: detect the settings, test them once, send.
(function () {
    const $ = id => document.getElementById(id);
    const form = $('request');
    const err = $('err');
    const ok = $('ok');
    const btn = $('submit');
    const note = $('detect-note');

    [...form.children].forEach((el, i) => el.style.setProperty('--i', i));
    window.egFx.splitChars(document.querySelector('.login-art h1 .split'));
    // the headline comes in a different way every visit: rising, out of a blur, a wave, dropping, spinning, typed, or zooming
    const fx = ['rise', 'blur', 'wave', 'drop', 'spin', 'type', 'zoom'];
    const head = document.querySelector('.login-art h1');
    if (head) head.dataset.fx = new URLSearchParams(location.search).get('fx') || fx[Math.floor(Math.random() * fx.length)];
    window.egFx.parallax(document.getElementById('rings'));
    window.egFx.starfield(document.getElementById('stars'));
    window.egFx.cursorGlow();

    $('peek').addEventListener('click', () => {
        const pw = $('password');
        pw.type = pw.type === 'password' ? 'text' : 'password';
        pw.focus();
    });

    const show = (el, text) => {
        el.textContent = text;
        el.classList.toggle('hidden', !text);
    };
    const call = async (url, opts = {}) => {
        const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'X-EG': '1' } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status})`);
        return data;
    };
    const setServer = (kind, s) => {
        $(`${kind}-host`).value = s.host;
        const sel = $(`${kind}-port`);
        sel.value = `${s.port}/${s.security}`;
        [$(`${kind}-host`), sel].forEach(x => {
            x.classList.remove('filled');
            void x.offsetWidth;
            x.classList.add('filled');
        });
    };

    // fill in the servers for well-known providers (and custom domains hosted by them)
    let detected = '';
    async function detect() {
        const email = $('email').value.trim();
        if (!/@.+\./.test(email) || email === detected) return;
        detected = email;
        $('detect').classList.add('busy');
        note.textContent = 'Looking up your provider…';
        try {
            const { settings } = await call(`api/requests/autodetect?email=${encodeURIComponent(email)}`);
            if (settings && settings.provider) {
                const name = settings.provider === 'google' ? 'Google' : 'Microsoft';
                const on = await fetch('/api/auth/providers').then(r => r.json()).catch(() => []);
                note.innerHTML = on.some(p => p.id === settings.provider && p.ready)
                    ? `Your mail is with ${name}: no settings needed. <a href="/auth/${settings.provider}?email=${encodeURIComponent(email)}">Sign in with ${name}</a>`
                    : `Your mail is with ${name}, which needs “Sign in with ${name}”. It isn’t switched on here yet; ask the admin.`;
            } else if (settings && settings.purelymail) {
                note.innerHTML = 'Your mail is on Purelymail: no request needed. <a href="/login">Sign in now</a>';
            } else if (settings) {
                setServer('imap', settings.imap);
                setServer('smtp', settings.smtp);
                $('login').value = settings.login || 'email';
                note.textContent = 'Found your provider’s settings. Check them and add your password.';
            } else note.textContent = 'Couldn’t find settings automatically. Your provider’s help pages list them as “IMAP” and “SMTP”.';
        } catch (e) {
            note.textContent = e.message;
        } finally {
            $('detect').classList.remove('busy');
        }
    }
    $('detect').addEventListener('click', () => {
        detected = '';
        detect();
    });
    $('email').addEventListener('blur', () => !$('imap-host').value && detect());

    const server = kind => {
        const [port, security] = $(`${kind}-port`).value.split('/');
        return { host: $(`${kind}-host`).value.trim(), port: Number(port), security };
    };

    form.addEventListener('submit', async e => {
        e.preventDefault();
        show(err, '');
        if (!$('email').value.trim() || !$('imap-host').value.trim() || !$('smtp-host').value.trim() || !$('password').value) {
            show(err, 'Fill in your email, both servers and your password.');
            form.classList.remove('shake');
            void form.offsetWidth;
            form.classList.add('shake');
            return;
        }
        btn.disabled = true;
        btn.classList.add('busy');
        btn.querySelector('span').textContent = 'Testing your settings…';
        try {
            await call('api/requests', {
                method: 'POST',
                body: JSON.stringify({
                    name: $('name').value,
                    email: $('email').value,
                    imap: server('imap'),
                    smtp: server('smtp'),
                    login: $('login').value,
                    password: $('password').value,
                    note: $('note').value,
                    website: $('website').value
                })
            });
            $('password').value = '';
            const sentTo = $('email').value.trim();
            form.classList.add('sent');
            form.innerHTML = `<div class="sent-card"><div class="sent-check"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" pathLength="1"/><path d="M15 27l7 7 15-16" pathLength="1"/></svg></div>
                <h2>Request sent</h2><p class="sub">Your settings worked. An admin will review your request, and you’ll get an email at <b></b> when it’s decided.</p>
                <a class="btn btn-primary" href="/login"><span>Back to sign in</span></a></div>`;
            form.querySelector('b').textContent = sentTo;
        } catch (e2) {
            show(err, e2.message);
            btn.disabled = false;
            btn.classList.remove('busy');
            btn.querySelector('span').textContent = 'Check & send request';
        }
    });
})();
