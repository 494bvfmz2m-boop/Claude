// Filling in a form from its link (/r/<token>). No account needed unless the form asks.
// Answers are kept in this browser until they're sent, so a reload loses nothing.
(function () {
    const root = document.getElementById('rf');
    const token = location.pathname.split('/').filter(Boolean)[1] || '';
    const KEY = `eg-form-${token}`;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
    let form = null;
    let answers = {};
    const remember = () => {
        try {
            localStorage.setItem(KEY, JSON.stringify(answers));
        } catch {
            // private mode: nothing kept
        }
    };
    try {
        answers = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    } catch {
        answers = {};
    }
    async function api(method, body) {
        const res = await fetch(`/api/respond/${encodeURIComponent(token)}`, { method, credentials: 'same-origin', headers: { 'X-EG': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Try again.'), { status: res.status });
        return data;
    }
    const colour = c => /^#[0-9a-f]{6}$/i.test(c || '') && document.documentElement.style.setProperty('--c', c);
    function message(title, text, extra = '', tick = false) {
        root.innerHTML = `<div class="rf-card rf-msg">${tick ? `<div class="rf-tick">${TICK}</div>` : ''}<h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}${extra}</div>`;
    }

    function field(q) {
        const v = answers[q.id];
        const name = `q-${q.id}`;
        if (q.type === 'long') return `<textarea class="rf-in" id="${name}" maxlength="8000" rows="4">${esc(v || '')}</textarea>`;
        if (q.type === 'email') return `<input class="rf-in" id="${name}" type="email" autocomplete="email" maxlength="254" value="${esc(v || '')}" placeholder="name@example.com">`;
        if (q.type === 'number') return `<input class="rf-in short" id="${name}" inputmode="decimal" maxlength="40" value="${esc(v == null ? '' : v)}">`;
        if (q.type === 'date') return `<input class="rf-in short" id="${name}" type="date" value="${esc(v || '')}">`;
        if (q.type === 'time') return `<input class="rf-in short" id="${name}" type="time" value="${esc(v || '')}">`;
        if (q.type === 'dropdown') return `<select class="rf-in" id="${name}"><option value="">Choose…</option>${q.options.map(o => `<option${v === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
        if (q.type === 'choice' || q.type === 'checks') {
            const multi = q.type === 'checks';
            const picked = multi ? [].concat(v || []) : [v];
            const other = picked.find(x => x && !q.options.includes(x));
            return `<div class="rf-opts" role="${multi ? 'group' : 'radiogroup'}">${q.options.map(o => `<label class="rf-opt"><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${esc(o)}"${picked.includes(o) ? ' checked' : ''}><span>${esc(o)}</span></label>`).join('')}${q.other ? `<label class="rf-opt"><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="" data-other${other ? ' checked' : ''}><input class="rf-in" data-other-text placeholder="Other" maxlength="300" value="${esc(other || '')}"></label>` : ''}</div>`;
        }
        if (q.type === 'scale') {
            let pts = '';
            for (let i = q.low; i <= q.high; i++) pts += `<button type="button" class="rf-pt${v === i ? ' on' : ''}" data-v="${i}" aria-pressed="${v === i}">${i}</button>`;
            return `<div class="rf-scale">${q.lowLabel ? `<small>${esc(q.lowLabel)}</small>` : ''}<div class="rf-pts">${pts}</div>${q.highLabel ? `<small>${esc(q.highLabel)}</small>` : ''}</div>`;
        }
        if (q.type === 'rating') {
            let s = '';
            for (let i = 1; i <= q.high; i++) s += `<button type="button" class="rf-star${v >= i ? ' on' : ''}" data-v="${i}" aria-label="${i} of ${q.high}">${STAR}</button>`;
            return `<div class="rf-stars">${s}</div>`;
        }
        return `<input class="rf-in" id="${name}" maxlength="1000" value="${esc(v || '')}">`;
    }

    function render() {
        colour(form.color);
        document.title = `${form.title || 'Form'} · EderveenGroup`;
        let n = 0;
        root.innerHTML = `<form class="rf-form" novalidate>
            <div class="rf-card rf-head"><h1>${esc(form.title || 'Untitled form')}</h1>${form.desc ? `<p class="rf-desc">${esc(form.desc)}</p>` : ''}
                <p class="rf-who">${form.who === 'members' ? `Signed in as ${esc(form.signedInAs || '')}. Your name is sent with your answers.` : 'Your answers are sent without your name.'}${form.questions.some(q => q.required) ? ' <span class="rf-req">*</span> Required' : ''}</p></div>
            ${form.questions
                .map(q => {
                    if (q.type === 'section') return `<div class="rf-section"><h2>${esc(q.title)}</h2>${q.help ? `<p>${esc(q.help)}</p>` : ''}</div>`;
                    n++;
                    const id = `q-${q.id}`;
                    const labelled = ['short', 'long', 'email', 'number', 'date', 'time', 'dropdown'].includes(q.type);
                    return `<div class="rf-card rf-q" data-q="${esc(q.id)}">${labelled ? `<label class="rf-title" for="${id}">` : '<div class="rf-title">'}<span class="rf-num">${n}.</span> ${esc(q.title || 'Question')}${q.required ? ' <span class="rf-req" aria-label="required">*</span>' : ''}${labelled ? '</label>' : '</div>'}${q.help ? `<p class="rf-help">${esc(q.help)}</p>` : ''}${field(q)}</div>`;
                })
                .join('')}
            <input class="rf-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
            <div class="rf-send"><button class="rf-btn" type="submit">Submit</button><button class="rf-clear" type="button" id="clear">Clear form</button></div>
            <p class="rf-err" id="err" role="alert" hidden></p>
        </form>`;
    }
    function read(q, card) {
        if (q.type === 'choice') {
            const on = card.querySelector('input[type=radio]:checked');
            if (!on) return undefined;
            return on.hasAttribute('data-other') ? card.querySelector('[data-other-text]').value.trim() : on.value;
        }
        if (q.type === 'checks') {
            const list = [...card.querySelectorAll('input[type=checkbox]:checked')].map(x => (x.hasAttribute('data-other') ? card.querySelector('[data-other-text]').value.trim() : x.value)).filter(Boolean);
            return list.length ? list : undefined;
        }
        if (q.type === 'scale' || q.type === 'rating') return answers[q.id];
        const el = card.querySelector('.rf-in');
        return el && el.value.trim() !== '' ? el.value.trim() : undefined;
    }
    function collect() {
        const out = {};
        for (const q of form.questions) {
            if (q.type === 'section') continue;
            const card = root.querySelector(`[data-q="${CSS.escape(q.id)}"]`);
            const v = card && read(q, card);
            if (v !== undefined) out[q.id] = v;
        }
        return out;
    }
    root.addEventListener('input', e => {
        const card = e.target.closest('.rf-q');
        if (!card || !form) return;
        if (e.target.matches('[data-other-text]')) {
            const box = card.querySelector('[data-other]');
            if (box && e.target.value.trim()) box.checked = true;
        }
        const now = collect();
        for (const q of form.questions) if (q.type !== 'scale' && q.type !== 'rating') delete answers[q.id];
        answers = { ...answers, ...now };
        card.classList.remove('bad');
        card.querySelector('.rf-err')?.remove();
        remember();
    });
    root.addEventListener('click', e => {
        const pt = e.target.closest('.rf-pt, .rf-star');
        if (pt) {
            const card = pt.closest('.rf-q');
            const q = form.questions.find(x => x.id === card.dataset.q);
            const v = +pt.dataset.v;
            answers[q.id] = answers[q.id] === v ? undefined : v;
            if (answers[q.id] === undefined) delete answers[q.id];
            card.querySelectorAll('.rf-pt').forEach(b => {
                b.classList.toggle('on', +b.dataset.v === answers[q.id]);
                b.setAttribute('aria-pressed', +b.dataset.v === answers[q.id]);
            });
            card.querySelectorAll('.rf-star').forEach(b => b.classList.toggle('on', +b.dataset.v <= (answers[q.id] || 0)));
            card.classList.remove('bad');
            card.querySelector('.rf-err')?.remove();
            remember();
        }
        if (e.target.closest('#clear')) {
            answers = {};
            remember();
            render();
        }
        if (e.target.closest('#again')) {
            answers = {};
            remember();
            load();
        }
    });
    root.addEventListener('submit', async e => {
        e.preventDefault();
        const got = { ...collect() };
        for (const q of form.questions) if ((q.type === 'scale' || q.type === 'rating') && answers[q.id] != null) got[q.id] = answers[q.id];
        // the required questions first, right here
        root.querySelectorAll('.rf-q.bad').forEach(c => c.classList.remove('bad'));
        root.querySelectorAll('.rf-q .rf-err').forEach(c => c.remove());
        const missing = form.questions.filter(q => q.required && (got[q.id] == null || got[q.id] === '' || (Array.isArray(got[q.id]) && !got[q.id].length)));
        if (missing.length) {
            missing.forEach(q => {
                const card = root.querySelector(`[data-q="${CSS.escape(q.id)}"]`);
                card.classList.add('bad');
                card.insertAdjacentHTML('beforeend', '<p class="rf-err">This question needs an answer.</p>');
            });
            root.querySelector(`[data-q="${CSS.escape(missing[0].id)}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        const btn = root.querySelector('.rf-btn');
        btn.disabled = true;
        btn.textContent = 'Sending…';
        try {
            const r = await api('POST', { answers: got, website: root.querySelector('.rf-hp').value });
            answers = {};
            remember();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            message('Thanks!', r.thanks || 'Your response was sent.', form.once ? '' : '<button class="rf-btn ghost" id="again" type="button">Send another response</button>', true);
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Submit';
            const box = root.querySelector('#err');
            box.textContent = err.message;
            box.hidden = false;
        }
    });

    function load() {
        api('GET')
            .then(f => {
                colour(f.color);
                if (f.title) document.title = `${f.title} · EderveenGroup`;
                if (f.closed) return message(f.title || 'This form', 'This form isn’t taking responses any more.');
                if (f.answered) return message(f.title || 'This form', 'You’ve already filled in this form. Thanks!', '', true);
                if (f.signIn) return message(f.title || 'This form', 'Sign in to EderveenGroup to fill in this form.', `<a class="rf-btn rf-link" href="/login?next=${encodeURIComponent(location.pathname)}">Sign in</a>`);
                form = f;
                render();
            })
            .catch(e => message('Form not found', e.message));
    }
    load();
})();
