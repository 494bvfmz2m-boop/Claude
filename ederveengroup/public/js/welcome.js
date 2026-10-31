// First sign-in: choose a username, checked live as you type.
(function () {
    const $ = id => document.getElementById(id);
    const form = $('welcome');
    const input = $('username');
    const hint = $('uname-state');
    const mark = $('uname-mark');
    const btn = $('submit');
    const err = $('err');
    const suggest = $('suggest');
    const field = input.closest('.uname');
    const nextParam = new URLSearchParams(location.search).get('next') || '/';
    const next = /^\/(?:|profile\/?|mail\/[\w/-]*)$/.test(nextParam) && !nextParam.startsWith('//') ? nextParam : '/';
    $('url-host').textContent = location.host;
    [...form.children].forEach((el, i) => el.style.setProperty('--i', i));

    const call = async (url, opts = {}) => {
        const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'X-EG': '1' } });
        if (res.status === 401) location.replace(`/login?next=${encodeURIComponent('/welcome')}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Something went wrong');
        return data;
    };
    const clean = v => v.trim().toLowerCase().replace(/^@/, '');

    let seq = 0;
    let available = false;
    function setState(kind, text) {
        field.dataset.state = kind; // checking | ok | bad
        mark.textContent = kind === 'ok' ? '✓' : kind === 'bad' ? '✕' : '';
        hint.textContent = text;
        available = kind === 'ok';
        btn.disabled = !available;
    }
    async function check() {
        const name = clean(input.value);
        $('url-name').textContent = name || '…';
        suggest.classList.add('hidden');
        if (!name) return setState('', '');
        const mine = ++seq;
        setState('checking', 'Checking…');
        try {
            const r = await call(`/api/username/check?u=${encodeURIComponent(name)}`);
            if (mine !== seq) return; // an older answer arriving late
            if (r.available) return setState('ok', 'Available');
            setState('bad', r.reason);
            if (r.suggestions && r.suggestions.length) {
                suggest.innerHTML = '<span>Free:</span>' + r.suggestions.map(s => `<button type="button" data-u="${s}">@${s}</button>`).join('');
                suggest.classList.remove('hidden');
            }
        } catch (e) {
            if (mine === seq) setState('bad', e.message);
        }
    }
    let timer = 0;
    input.addEventListener('input', () => {
        const pos = input.selectionStart;
        const lower = input.value.toLowerCase().replace(/\s/g, '');
        if (lower !== input.value) {
            input.value = lower;
            input.setSelectionRange(pos, pos);
        }
        clearTimeout(timer);
        setState('checking', '');
        timer = setTimeout(check, 280);
    });
    suggest.addEventListener('click', e => {
        const b = e.target.closest('[data-u]');
        if (!b) return;
        input.value = b.dataset.u;
        input.focus();
        check();
    });

    // start from a name made from the email address
    call('/api/username/suggest')
        .then(r => {
            if (!input.value && r.username) {
                input.value = r.username;
                check();
            }
        })
        .catch(() => {});
    input.focus();

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!available) return;
        err.classList.add('hidden');
        btn.disabled = true;
        btn.classList.add('busy');
        try {
            await call('/api/username', { method: 'POST', body: JSON.stringify({ username: clean(input.value) }) });
            form.classList.add('done');
            btn.querySelector('span').textContent = 'You’re all set';
            setTimeout(() => location.replace(next), 650);
        } catch (e2) {
            btn.classList.remove('busy');
            err.textContent = e2.message;
            err.classList.remove('hidden');
            check();
        }
    });
})();
