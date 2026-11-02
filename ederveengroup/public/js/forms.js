// Forms: make a form, share its link (anyone can fill it in, no account needed), and see the
// responses as charts or one by one. Responses download as Excel (.xlsx) or CSV, or open in
// Spreadsheets.
(function () {
    const { $, $$, esc, ic, call, toast, ask, debounce, ago, typing: textBox, undoKey, undoable } = window.EG;
    const root = $('#forms');
    const TYPES = [
        ['choice', 'Choice', 'check'],
        ['checks', 'Checkboxes', 'tasks'],
        ['dropdown', 'Dropdown', 'down'],
        ['short', 'Short text', 'textbox'],
        ['long', 'Long text', 'note'],
        ['rating', 'Rating', 'star'],
        ['scale', 'Scale', 'chart'],
        ['date', 'Date', 'calendar'],
        ['time', 'Time', 'clock'],
        ['email', 'Email', 'mail'],
        ['number', 'Number', 'sigma'],
        ['section', 'Section', 'minimize']
    ];
    const TYPE = Object.fromEntries(TYPES.map(([k, l, i]) => [k, { label: l, icon: i }]));
    const COLORS = ['#0f7b6c', '#1f5fbf', '#6a3fc1', '#c2185b', '#c43e1c', '#b7791f', '#2e7d32', '#37474f'];
    const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    const uid = () => Math.random().toString(36).slice(2, 10);
    const q0 = type => ({ id: uid(), type, title: '', help: '', ...(['choice', 'checks', 'dropdown'].includes(type) ? { options: ['Option 1', 'Option 2'] } : {}), ...(type === 'scale' ? { low: 1, high: 5, lowLabel: '', highLabel: '' } : {}), ...(type === 'rating' ? { high: 5 } : {}) });
    // ready-made forms to start from
    const TEMPLATES = {
        blank: { name: 'Blank form', title: '', desc: '', questions: [] },
        event: {
            name: 'Event sign-up',
            title: 'Sign up for the event',
            desc: 'Let us know if you’re coming, and who you’re bringing.',
            questions: [
                { type: 'short', title: 'Your name', required: true },
                { type: 'email', title: 'Email address', required: true },
                { type: 'choice', title: 'Are you coming?', options: ['Yes', 'No', 'Maybe'], required: true },
                { type: 'number', title: 'How many guests are you bringing?' },
                { type: 'checks', title: 'Anything we should know about food?', options: ['Vegetarian', 'Vegan', 'No gluten', 'No lactose'], other: true }
            ]
        },
        feedback: {
            name: 'Feedback',
            title: 'How did we do?',
            desc: 'It takes a minute, and it helps a lot.',
            questions: [
                { type: 'rating', title: 'Overall, how happy are you?', high: 5, required: true },
                { type: 'scale', title: 'How likely are you to recommend us to a friend?', low: 0, high: 10, lowLabel: 'Not likely', highLabel: 'Very likely' },
                { type: 'long', title: 'What went well?' },
                { type: 'long', title: 'What could be better?' }
            ]
        },
        poll: { name: 'Quick poll', title: 'Quick poll', desc: '', questions: [{ type: 'choice', title: 'Which date works best?', options: ['Saturday', 'Sunday', 'Next weekend'], required: true }] },
        contact: {
            name: 'Contact details',
            title: 'Your contact details',
            desc: '',
            questions: [
                { type: 'short', title: 'Full name', required: true },
                { type: 'email', title: 'Email address', required: true },
                { type: 'short', title: 'Phone number' },
                { type: 'long', title: 'Address' },
                { type: 'date', title: 'Birthday' }
            ]
        }
    };
    let list = [];
    let open = null; // { id, title, body: { desc, color, questions, settings }, … }
    let tab = 'questions';
    let active = null; // the question being edited
    let responses = null;
    let one = 0; // which response, one by one
    let rview = 'summary'; // the responses as charts, or one by one
    let dirty = false;
    let poll = null;

    /* ---------- the start screen ---------- */
    function gallery() {
        open = null;
        clearInterval(poll);
        document.body.classList.remove('fm-office');
        const mine = list.filter(d => d.mine);
        const shared = list.filter(d => !d.mine);
        const card = d => `<button class="fm-card" data-id="${esc(d.id)}"><span class="fm-thumb"><b>${esc(d.title || 'Untitled form')}</b><i></i><i class="s"></i><i></i></span><b>${esc(d.title || 'Untitled form')}</b><small>${d.responses != null ? `${d.responses} response${d.responses === 1 ? '' : 's'}` : ''}${d.open === false ? ' · closed' : ''} · ${esc(ago(d.updatedAt))}${d.mine ? '' : ` · ${esc(d.ownerName)}`}</small></button>`;
        root.innerHTML = `<div class="sl-home">
            <div class="ea-head"><h1>Forms</h1></div>
            <div class="fm-new">${Object.entries(TEMPLATES).map(([k, t]) => `<button class="fm-card" data-new="${k}"><span class="fm-thumb${k === 'blank' ? ' blank' : ''}">${k === 'blank' ? ic('plus') : `<b>${esc(t.title)}</b><i></i><i class="s"></i>`}</span><b>${t.name}</b></button>`).join('')}</div>
            ${mine.length ? `<h2 class="ea-sec">My forms</h2><div class="fm-cards">${mine.map(card).join('')}</div>` : ''}
            ${shared.length ? `<h2 class="ea-sec">Shared with me</h2><div class="fm-cards">${shared.map(card).join('')}</div>` : ''}
            ${mine.length || shared.length ? '' : '<p class="cp-muted dw-hint">Make a sign-up sheet, a poll or a feedback form, and send its link to anyone: they don’t need an account. See the answers as charts, or download them for Excel.</p>'}
        </div>`;
        history.replaceState(null, '', location.pathname);
    }
    async function create(kind) {
        const t = TEMPLATES[kind] || TEMPLATES.blank;
        const body = { desc: t.desc, questions: t.questions.map(q => ({ ...q0(q.type), ...q })) };
        const d = await call('/api/docs', { method: 'POST', body: { kind: 'form', title: t.title, body } });
        list.unshift(d);
        await select(d.id);
        if (kind === 'blank') setTimeout(() => $('#ftitle')?.focus(), 50);
    }
    async function select(id) {
        if (dirty) await saveNow();
        try {
            open = await call(`/api/docs/${id}`);
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        tab = 'questions';
        active = null;
        responses = null;
        history.replaceState(null, '', `${location.pathname}#${id}`);
        hist.reset();
        editor();
    }

    /* ---------- the editor ---------- */
    const link = () => `${location.origin}/r/${open.token}`;
    function editor() {
        document.body.classList.add('fm-office');
        const ro = !open.canEdit;
        root.innerHTML = `<div class="fm">
            <div class="of-title">
                <button class="icon-btn" id="home" title="All forms" aria-label="All forms">${ic('left')}</button>
                <span class="of-app fm-app">${ic('form')}</span>
                <input class="of-name" id="name" value="${esc(open.title)}" placeholder="Untitled form" ${ro ? 'readonly' : ''} aria-label="Form name">
                <span class="nt-saved" id="saved"></span><span class="spacer"></span>
                ${open.mine ? '<select class="input of-share" id="share" aria-label="Who can see it" title="Who can open this form here (not who can fill it in)"><option value="private">Only me</option><option value="view">Everyone can see it</option><option value="edit">Everyone can edit it</option></select>' : ''}
                ${open.token ? `<a class="btn" id="preview" href="${esc(link())}" target="_blank" rel="noopener">${ic('eye')}<span>Preview</span></a><button class="btn fm-sendbtn" id="send">${ic('send')}<span>Send</span></button>` : ''}
                <button class="icon-btn" id="more" aria-label="More">${ic('more')}</button>
            </div>
            ${ro ? `<div class="of-ro">${ic('eye')} Read only · by ${esc(open.ownerName)}. Make a copy to change it.</div>` : ''}
            <nav class="fm-tabs" role="tablist">${[['questions', 'Questions'], ...(open.canEdit ? [['responses', `Responses <i id="rcount">${open.responses || 0}</i>`], ['settings', 'Settings']] : [])].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav>
            <div class="fm-desk" id="desk"></div>
        </div>`;
        if ($('#share')) $('#share').value = open.share;
        $('#home').onclick = async () => {
            if (dirty) await saveNow();
            list = await call('/api/docs?kind=form');
            gallery();
        };
        $('#name').addEventListener('input', () => {
            open.title = $('#name').value;
            if ($('#ftitle')) $('#ftitle').value = open.title;
            changed();
        });
        $('#send') && ($('#send').onclick = e => sendPop(e.currentTarget));
        $('#more').onclick = e => moreMenu(e.currentTarget);
        $('#share') && ($('#share').onchange = async e => {
            const r = await call(`/api/docs/${open.id}`, { method: 'PATCH', body: { share: e.target.value } });
            open.share = r.share;
            toast(r.share === 'private' ? 'Only you can open it here' : r.share === 'edit' ? 'Everyone on EderveenGroup can edit it' : 'Everyone on EderveenGroup can see it');
        });
        $$('.fm-tabs [data-tab]').forEach(t => (t.onclick = () => setTab(t.dataset.tab)));
        draw();
    }
    function setTab(t) {
        tab = t;
        $$('.fm-tabs [data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === t));
        clearInterval(poll);
        if (t === 'responses') {
            loadResponses();
            poll = setInterval(() => document.visibilityState === 'visible' && open && tab === 'responses' && loadResponses(true), 15000);
        }
        draw();
    }
    function draw() {
        if (tab === 'questions') drawQuestions();
        else if (tab === 'settings') drawSettings();
        else drawResponses();
    }

    /* ---------- questions ---------- */
    const preview = q => {
        if (['choice', 'checks'].includes(q.type)) return `<div class="fm-pv-opts">${q.options.filter(Boolean).map(o => `<span><i class="${q.type === 'checks' ? 'box' : 'dot'}"></i>${esc(o)}</span>`).join('')}${q.other ? `<span><i class="${q.type === 'checks' ? 'box' : 'dot'}"></i>Other…</span>` : ''}</div>`;
        if (q.type === 'dropdown') return `<div class="fm-pv-field">Choose… ${ic('down')}</div>`;
        if (q.type === 'scale') {
            let s = '';
            for (let i = q.low; i <= q.high; i++) s += `<i>${i}</i>`;
            return `<div class="fm-pv-scale">${q.lowLabel ? `<small>${esc(q.lowLabel)}</small>` : ''}${s}${q.highLabel ? `<small>${esc(q.highLabel)}</small>` : ''}</div>`;
        }
        if (q.type === 'rating') return `<div class="fm-pv-stars">${STAR.repeat(q.high)}</div>`;
        const ph = { long: 'Long answer', email: 'name@example.com', number: 'A number', date: 'dd-mm-yyyy', time: '--:--' }[q.type] || 'Short answer';
        return `<div class="fm-pv-field${q.type === 'long' ? ' tall' : ''}">${ph}</div>`;
    };
    function qHtml(q, n) {
        const ro = !open.canEdit;
        if (active !== q.id || ro) {
            if (q.type === 'section') return `<div class="fm-q fm-sec" data-q="${q.id}"><h2>${esc(q.title || 'Section')}</h2>${q.help ? `<p>${esc(q.help)}</p>` : ''}</div>`;
            return `<div class="fm-q" data-q="${q.id}"><div class="fm-qt"><span class="fm-n">${n}.</span> ${esc(q.title) || '<em>Question</em>'}${q.required ? '<span class="fm-req">*</span>' : ''}</div>${q.help ? `<p class="fm-help">${esc(q.help)}</p>` : ''}${preview(q)}</div>`;
        }
        const choices = ['choice', 'checks', 'dropdown'].includes(q.type);
        const mark = q.type === 'checks' ? 'box' : q.type === 'dropdown' ? 'num' : 'dot';
        const sel = (k, vals, v) => `<select class="input fm-mini" data-k="${k}">${vals.map(x => `<option value="${x}"${+v === x ? ' selected' : ''}>${x}</option>`).join('')}</select>`;
        return `<div class="fm-q on" data-q="${q.id}">
            <div class="fm-row"><textarea class="fm-qtitle" data-k="title" rows="1" placeholder="${q.type === 'section' ? 'Section title' : 'Question'}" maxlength="300">${esc(q.title)}</textarea>
                <select class="input fm-type" data-k="type" aria-label="Kind of question">${TYPES.map(([k, l]) => `<option value="${k}"${q.type === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
            <textarea class="fm-qhelp" data-k="help" rows="1" placeholder="Description (optional)" maxlength="600">${esc(q.help)}</textarea>
            ${choices ? `<div class="fm-opts">${q.options.map((o, i) => `<div class="fm-opt"><i class="${mark}">${mark === 'num' ? i + 1 : ''}</i><input class="fm-otext" data-opt="${i}" value="${esc(o)}" placeholder="Option ${i + 1}" maxlength="200" aria-label="Option ${i + 1}"><button class="icon-btn" data-delopt="${i}" aria-label="Remove option">${ic('x')}</button></div>`).join('')}${q.other ? `<div class="fm-opt other"><i class="${mark}"></i><span>Other (people type their own)</span><button class="icon-btn" data-noother aria-label="Remove Other">${ic('x')}</button></div>` : ''}
                <div class="fm-optadd"><button class="btn btn-ghost" data-addopt>${ic('plus')}<span>Add option</span></button>${q.type !== 'dropdown' && !q.other ? '<button class="btn btn-ghost" data-other>Add “Other”</button>' : ''}</div></div>` : ''}
            ${q.type === 'scale' ? `<div class="fm-scale">From ${sel('low', [0, 1], q.low)} to ${sel('high', [2, 3, 4, 5, 6, 7, 8, 9, 10], q.high)}<input class="input" data-k="lowLabel" placeholder="Label at ${q.low} (optional)" value="${esc(q.lowLabel)}" maxlength="60"><input class="input" data-k="highLabel" placeholder="Label at ${q.high} (optional)" value="${esc(q.highLabel)}" maxlength="60"></div>` : ''}
            ${q.type === 'rating' ? `<div class="fm-scale">Stars: ${sel('high', [3, 4, 5, 6, 7, 8, 9, 10], q.high)}</div>` : ''}
            ${!choices && q.type !== 'section' && q.type !== 'scale' && q.type !== 'rating' ? preview(q) : ''}
            <div class="fm-qfoot">${q.type === 'section' ? '' : `<label class="fm-switch"><input type="checkbox" data-k="required"${q.required ? ' checked' : ''}><span></span>Required</label>`}<span class="spacer"></span>
                <button class="icon-btn" data-act="up" title="Move up" aria-label="Move up">${ic('up')}</button><button class="icon-btn" data-act="down" title="Move down" aria-label="Move down">${ic('down')}</button><button class="icon-btn" data-act="copy" title="Duplicate" aria-label="Duplicate">${ic('copy')}</button><button class="icon-btn" data-act="del" title="Delete" aria-label="Delete">${ic('trash')}</button></div>
        </div>`;
    }
    function drawQuestions() {
        const b = open.body;
        const ro = !open.canEdit;
        let n = 0;
        $('#desk').innerHTML = `<div class="fm-col" style="--fc:${esc(b.color)}">
            <div class="fm-head">${ro ? `<h1>${esc(open.title || 'Untitled form')}</h1>${b.desc ? `<p>${esc(b.desc)}</p>` : ''}` : `<input class="fm-title" id="ftitle" value="${esc(open.title)}" placeholder="Untitled form" maxlength="160" aria-label="Form title"><textarea class="fm-desc" id="fdesc" rows="1" placeholder="Description (optional)" maxlength="4000">${esc(b.desc)}</textarea>`}</div>
            <div id="qs">${b.questions.map(q => qHtml(q, q.type === 'section' ? 0 : ++n)).join('')}</div>
            ${ro ? '' : `<div class="fm-add"><p>Add a question</p><div>${TYPES.map(([k, l, i]) => `<button class="fm-chip" data-add="${k}">${ic(i)}<span>${l}</span></button>`).join('')}</div></div>`}
            ${!b.questions.length ? `<p class="fm-empty">${ro ? 'No questions yet.' : 'Pick a kind of question above to start.'}</p>` : ''}
        </div>`;
        $$('#desk textarea').forEach(grow);
        if (ro) return;
        const t = $('#ftitle');
        t.addEventListener('input', () => {
            open.title = t.value;
            $('#name').value = t.value;
            changed();
        });
        $('#fdesc').addEventListener('input', e => {
            b.desc = e.target.value;
            grow(e.target);
            changed();
        });
    }
    const grow = el => {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };
    const qOf = el => {
        const card = el.closest('[data-q]');
        return card && open.body.questions.find(q => q.id === card.dataset.q);
    };
    function redrawQ(focus) {
        const y = $('#desk').scrollTop;
        drawQuestions();
        $('#desk').scrollTop = y;
        if (focus) {
            const el = $(focus);
            if (el) {
                el.focus();
                if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
            }
        }
    }
    root.addEventListener('click', e => {
        if (!open) {
            const c = e.target.closest('.fm-card');
            if (c && c.dataset.new) create(c.dataset.new);
            else if (c) select(c.dataset.id);
            return;
        }
        if (tab !== 'questions' || !open.canEdit) return;
        const add = e.target.closest('[data-add]');
        if (add) {
            const q = q0(add.dataset.add);
            const qs = open.body.questions;
            const at = active ? qs.findIndex(x => x.id === active) + 1 : qs.length;
            qs.splice(at || qs.length, 0, q);
            active = q.id;
            changed();
            redrawQ(`[data-q="${q.id}"] .fm-qtitle`);
            $(`[data-q="${q.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            return;
        }
        const card = e.target.closest('.fm-q');
        if (!card) {
            if (active && !e.target.closest('.fm-add, .fm-head') && e.target.closest('#desk')) {
                active = null;
                redrawQ();
            }
            return;
        }
        const q = qOf(card);
        if (!q) return;
        if (active !== q.id) {
            active = q.id;
            redrawQ(`[data-q="${q.id}"] .fm-qtitle`);
            return;
        }
        const qs = open.body.questions;
        const i = qs.indexOf(q);
        const act = e.target.closest('[data-act]');
        if (act) {
            const a = act.dataset.act;
            if (a === 'up' && i > 0) [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
            else if (a === 'down' && i < qs.length - 1) [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]];
            else if (a === 'copy') {
                const c = { ...JSON.parse(JSON.stringify(q)), id: uid() };
                qs.splice(i + 1, 0, c);
                active = c.id;
            } else if (a === 'del') {
                qs.splice(i, 1);
                active = null;
            }
            changed();
            redrawQ();
            if (active) $(`[data-q="${active}"]`)?.scrollIntoView({ block: 'nearest' });
            return;
        }
        if (e.target.closest('[data-addopt]')) {
            q.options.push('');
            changed();
            return redrawQ(`[data-q="${q.id}"] [data-opt="${q.options.length - 1}"]`);
        }
        const del = e.target.closest('[data-delopt]');
        if (del) {
            if (q.options.length === 1) return toast('A question with choices needs at least one');
            q.options.splice(+del.dataset.delopt, 1);
            changed();
            return redrawQ();
        }
        if (e.target.closest('[data-other]')) {
            q.other = true;
            changed();
            return redrawQ();
        }
        if (e.target.closest('[data-noother]')) {
            delete q.other;
            changed();
            return redrawQ();
        }
    });
    root.addEventListener('input', e => {
        if (!open || tab !== 'questions') return;
        const q = qOf(e.target);
        if (!q) return;
        const k = e.target.dataset.k;
        if (e.target.matches('textarea')) grow(e.target);
        if (e.target.dataset.opt != null) {
            q.options[+e.target.dataset.opt] = e.target.value;
            return changed();
        }
        if (k === 'title' || k === 'help' || k === 'lowLabel' || k === 'highLabel') {
            q[k] = e.target.value;
            changed();
        }
    });
    root.addEventListener('change', e => {
        if (!open || tab !== 'questions') return;
        const q = qOf(e.target);
        if (!q) return;
        const k = e.target.dataset.k;
        if (k === 'type') {
            const fresh = q0(e.target.value);
            // keep what still makes sense: the text, the choices, whether it's required
            Object.assign(q, { type: fresh.type });
            if (fresh.options && !q.options) q.options = fresh.options;
            if (!fresh.options) delete q.options;
            if (q.type === 'dropdown' || !fresh.options) delete q.other;
            for (const x of ['low', 'high', 'lowLabel', 'highLabel']) if (fresh[x] === undefined) delete q[x];
            for (const x of ['low', 'high', 'lowLabel', 'highLabel']) if (fresh[x] !== undefined && q[x] === undefined) q[x] = fresh[x];
            if (q.type === 'rating' && (q.high < 3 || q.high > 10)) q.high = 5;
            if (q.type === 'section') delete q.required;
            changed();
            return redrawQ(`[data-q="${q.id}"] .fm-qtitle`);
        }
        if (k === 'required') {
            if (e.target.checked) q.required = true;
            else delete q.required;
            changed();
            return redrawQ();
        }
        if (k === 'low' || k === 'high') {
            q[k] = +e.target.value;
            changed();
            return redrawQ();
        }
        if (e.target.dataset.opt != null) {
            // tidy the choices when leaving one: no empty ones
            q.options = q.options.map(o => o.trim()).filter(Boolean);
            if (!q.options.length) q.options = ['Option 1'];
            changed();
        }
    });
    root.addEventListener('keydown', e => {
        if (!open || tab !== 'questions') return;
        if (e.key === 'Enter' && e.target.dataset.opt != null) {
            // Enter in a choice adds the next one
            e.preventDefault();
            const q = qOf(e.target);
            const i = +e.target.dataset.opt;
            q.options.splice(i + 1, 0, '');
            changed();
            redrawQ(`[data-q="${q.id}"] [data-opt="${i + 1}"]`);
        } else if (e.key === 'Enter' && (e.target.matches('.fm-qtitle') || e.target.id === 'ftitle')) e.preventDefault();
    });

    /* ---------- settings ---------- */
    function drawSettings() {
        const s = open.body.settings;
        $('#desk').innerHTML = `<div class="fm-col fm-settings" style="--fc:${esc(open.body.color)}">
            <div class="fm-q"><h2>Responses</h2>
                <label class="fm-switch big"><input type="checkbox" id="sopen"${s.open ? ' checked' : ''}><span></span><div><b>Accept responses</b><small>Turn this off to close the form. The link then says it’s closed.</small></div></label></div>
            <div class="fm-q"><h2>Who can fill it in</h2>
                <label class="fm-radio"><input type="radio" name="who" value="anyone"${s.who === 'anyone' ? ' checked' : ''}><div><b>Anyone with the link</b><small>No account needed. Answers come in without a name.</small></div></label>
                <label class="fm-radio"><input type="radio" name="who" value="members"${s.who === 'members' ? ' checked' : ''}><div><b>Only people with an EderveenGroup account</b><small>They sign in first, and you see who answered.</small></div></label>
                <label class="fm-switch big${s.who === 'members' ? '' : ' off'}"><input type="checkbox" id="sonce"${s.once ? ' checked' : ''}${s.who === 'members' ? '' : ' disabled'}><span></span><div><b>One response per person</b><small>Only with sign-in, so it can tell people apart.</small></div></label></div>
            <div class="fm-q"><h2>After sending</h2><textarea class="input" id="sthanks" rows="3" maxlength="1000" placeholder="Thanks! Your response was sent.">${esc(s.thanks)}</textarea></div>
            <div class="fm-q"><h2>Colour</h2><div class="fm-colors">${COLORS.map(c => `<button data-color="${c}" class="${open.body.color === c ? 'on' : ''}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div></div>
        </div>`;
        const set = patch => {
            Object.assign(s, patch);
            open.open = s.open;
            changed();
        };
        $('#sopen').onchange = e => set({ open: e.target.checked });
        $$('[name=who]').forEach(r => (r.onchange = () => (set({ who: r.value, ...(r.value === 'anyone' ? { once: false } : {}) }), drawSettings())));
        $('#sonce').onchange = e => set({ once: e.target.checked });
        $('#sthanks').oninput = e => set({ thanks: e.target.value });
        $$('[data-color]').forEach(b =>
            (b.onclick = () => {
                open.body.color = b.dataset.color;
                changed();
                drawSettings();
            })
        );
    }

    /* ---------- responses ---------- */
    async function loadResponses(quiet) {
        try {
            const r = await call(`/api/forms/${open.id}/responses`);
            const changedCount = !responses || r.length !== responses.length;
            responses = r;
            open.responses = r.length;
            if ($('#rcount')) $('#rcount').textContent = r.length;
            if (tab === 'responses' && (!quiet || changedCount)) drawResponses();
        } catch (e) {
            if (!quiet) toast(e.message, { bad: true });
        }
    }
    const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
    // one bar per answer: a single colour (the form's), labelled with the count and share
    function bars(rows, total) {
        const max = Math.max(1, ...rows.map(r => r[1]));
        return `<div class="fm-bars">${rows.map(([label, n]) => `<div class="fm-bar" title="${esc(label)}: ${n} (${pct(n, total)}%)"><span class="fm-bl">${esc(label)}</span><span class="fm-bt"><i style="width:${(n / max) * 100}%"></i></span><span class="fm-bn">${n} <small>${pct(n, total)}%</small></span></div>`).join('')}</div>`;
    }
    function summary(q, items) {
        const got = items.map(r => r.a[q.id]).filter(v => v != null && v !== '');
        const head = `<div class="fm-qt">${esc(q.title || 'Question')}</div><p class="fm-count">${got.length} response${got.length === 1 ? '' : 's'}</p>`;
        if (!got.length) return head + '<p class="fm-none">No answers yet</p>';
        if (['choice', 'dropdown', 'checks'].includes(q.type)) {
            const counts = new Map(q.options.map(o => [o, 0]));
            const others = [];
            for (const v of got)
                for (const x of [].concat(v)) {
                    if (counts.has(x)) counts.set(x, counts.get(x) + 1);
                    else others.push(x);
                }
            const rows = [...counts.entries()];
            if (others.length) rows.push(['Other', others.length]);
            return `${head}${bars(rows, got.length)}${others.length ? `<details class="fm-others"><summary>“Other” answers (${others.length})</summary><ul>${others.slice(-50).reverse().map(o => `<li>${esc(o)}</li>`).join('')}</ul></details>` : ''}`;
        }
        if (q.type === 'scale' || q.type === 'rating') {
            const lo = q.type === 'scale' ? q.low : 1;
            const avg = got.reduce((a, b) => a + b, 0) / got.length;
            const rows = [];
            for (let i = q.high; i >= lo; i--) rows.push([q.type === 'rating' ? `${i} ★` : String(i), got.filter(v => v === i).length]);
            return `${head}<div class="fm-avg"><b>${avg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b><span>average${q.type === 'rating' ? ` of ${q.high} stars` : ` on ${lo}–${q.high}`}</span></div>${bars(rows, got.length)}`;
        }
        if (q.type === 'number') {
            const sum = got.reduce((a, b) => a + b, 0);
            const f = n => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
            return `${head}<div class="fm-nums"><div><b>${f(sum / got.length)}</b><span>average</span></div><div><b>${f(Math.min(...got))}</b><span>lowest</span></div><div><b>${f(Math.max(...got))}</b><span>highest</span></div><div><b>${f(sum)}</b><span>total</span></div></div>`;
        }
        const latest = got.slice(-200).reverse();
        const show = x => (q.type === 'date' ? new Date(`${x}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : x);
        return `${head}<ul class="fm-texts">${latest.slice(0, 5).map(x => `<li>${esc(show(x))}</li>`).join('')}</ul>${latest.length > 5 ? `<details class="fm-others"><summary>Show ${latest.length - 5} more</summary><ul class="fm-texts">${latest.slice(5).map(x => `<li>${esc(show(x))}</li>`).join('')}</ul></details>` : ''}`;
    }
    function drawResponses() {
        const desk = $('#desk');
        if (!responses) {
            desk.innerHTML = '<div class="pf-loading"><div class="spinner"></div></div>';
            return;
        }
        const qs = open.body.questions.filter(q => q.type !== 'section');
        const items = responses;
        const last = items.length ? items[items.length - 1].at : 0;
        const view = rview;
        one = Math.max(0, Math.min(one, items.length - 1));
        const r = items[items.length - 1 - one];
        desk.innerHTML = `<div class="fm-col" style="--fc:${esc(open.body.color)}">
            <div class="fm-stats"><div><b>${items.length}</b><span>Responses</span></div><div><b>${open.body.settings.open ? 'Open' : 'Closed'}</b><span>Status</span></div><div><b>${last ? esc(ago(last)) : '—'}</b><span>Latest</span></div></div>
            <div class="fm-ract">
                <button class="btn" data-x="xlsx">${ic('download')}<span>Excel (.xlsx)</span></button><button class="btn" data-x="csv">${ic('download')}<span>CSV</span></button><button class="btn" data-x="sheet">${ic('table')}<span>Open in Spreadsheets</span></button>
                <span class="spacer"></span>${items.length ? `<button class="btn btn-ghost danger" data-x="clear">${ic('trash')}<span>Delete all</span></button>` : ''}</div>
            ${items.length ? `<div class="fm-seg" role="tablist"><button data-view="summary" class="${view === 'summary' ? 'on' : ''}">Summary</button><button data-view="one" class="${view === 'one' ? 'on' : ''}">One by one</button></div>` : `<div class="fm-q fm-wait">${ic('send')}<h2>No responses yet</h2><p>Send the link and answers show up here as they come in.</p><button class="btn btn-primary" data-x="send">${ic('send')}<span>Send the form</span></button></div>`}
            ${items.length && view === 'summary' ? qs.map(q => `<div class="fm-q fm-sum">${summary(q, items)}</div>`).join('') : ''}
            ${items.length && view === 'one' && r ? `<div class="fm-q fm-one"><div class="fm-onehead"><button class="icon-btn" data-step="-1" aria-label="Newer" ${one === 0 ? 'disabled' : ''}>${ic('left')}</button><span>Response <b>${items.length - one}</b> of ${items.length}</span><button class="icon-btn" data-step="1" aria-label="Older" ${one >= items.length - 1 ? 'disabled' : ''}>${ic('right')}</button><span class="spacer"></span><button class="btn btn-ghost danger" data-delr="${esc(r.id)}">${ic('trash')}<span>Delete</span></button></div>
                <p class="fm-meta">${new Date(r.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · ${esc(r.by || 'Anonymous')}</p>
                ${qs.map(q => {
                    const v = r.a[q.id];
                    return `<div class="fm-ans"><div class="fm-qt">${esc(q.title || 'Question')}</div><p>${v == null || v === '' ? '<em>No answer</em>' : esc(Array.isArray(v) ? v.join(', ') : q.type === 'rating' ? `${v} of ${q.high} ★` : v)}</p></div>`;
                }).join('')}</div>` : ''}
        </div>`;
    }
    root.addEventListener('click', async e => {
        if (!open || tab !== 'responses') return;
        const v = e.target.closest('.fm-seg [data-view]');
        if (v) {
            rview = v.dataset.view;
            return drawResponses();
        }
        const st = e.target.closest('[data-step]');
        if (st) {
            one += +st.dataset.step;
            return drawResponses();
        }
        const del = e.target.closest('[data-delr]');
        if (del) {
            if (!(await ask({ title: 'Delete this response?', text: 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
            await call(`/api/forms/${open.id}/responses/${del.dataset.delr}`, { method: 'DELETE' });
            responses = responses.filter(x => x.id !== del.dataset.delr);
            open.responses = responses.length;
            $('#rcount').textContent = responses.length;
            return drawResponses();
        }
        const x = e.target.closest('[data-x]');
        if (!x) return;
        const a = x.dataset.x;
        if (a === 'xlsx' || a === 'csv') location.href = `/api/forms/${open.id}/responses/export?format=${a}`;
        else if (a === 'send') sendPop(x);
        else if (a === 'sheet') {
            const d = await call(`/api/forms/${open.id}/sheet`, { method: 'POST', body: {} });
            toast('The responses are in a new spreadsheet');
            window.open(`/sheets/#${d.id}`, '_blank', 'noopener');
        } else if (a === 'clear') {
            if (!(await ask({ title: `Delete all ${responses.length} responses?`, text: 'Download them first if you want to keep them. This can’t be undone.', ok: 'Delete all', danger: true }))) return;
            await call(`/api/forms/${open.id}/responses`, { method: 'DELETE' });
            responses = [];
            open.responses = 0;
            $('#rcount').textContent = 0;
            drawResponses();
        }
    });

    /* ---------- sending: the link, a QR code ---------- */
    function sendPop(anchor) {
        $$('.fl-pop').forEach(x => x.remove());
        const s = open.body.settings;
        const pop = document.createElement('div');
        pop.className = 'fl-pop fm-sendpop';
        pop.innerHTML = `<h3>Send this form</h3>
            <p>${s.open ? (s.who === 'members' ? 'People sign in with their EderveenGroup account to fill it in.' : 'Anyone with this link can fill it in, no account needed.') : 'The form is closed: turn on “Accept responses” in Settings first.'}</p>
            <div class="fm-link"><input class="input" readonly value="${esc(link())}" aria-label="Link to the form"><button class="btn btn-primary" id="copylink">${ic('copy')}<span>Copy</span></button></div>
            <div class="fm-qr"><img alt="QR code for the form" src="/api/forms/${esc(open.id)}/qr"><small>Scan to open it on a phone</small></div>
            <div class="fm-sendacts"><a class="btn btn-ghost" href="mailto:?subject=${encodeURIComponent(open.title || 'A form')}&body=${encodeURIComponent(`${open.title || 'Please fill in this form'}: ${link()}`)}">${ic('mail')}<span>Email it</span></a>${navigator.share ? `<button class="btn btn-ghost" id="fmsend-native">${ic('share')}<span>Share…</span></button>` : ''}</div>`;
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 8)}px`;
        pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth))}px`;
        const off = e => !pop.contains(e.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.querySelector('input').onclick = e => e.target.select();
        $('#copylink').onclick = async () => {
            try {
                await navigator.clipboard.writeText(link());
                toast('Link copied');
            } catch {
                pop.querySelector('input').select();
                toast('Press Ctrl C to copy');
            }
        };
        $('#fmsend-native') && ($('#fmsend-native').onclick = () => navigator.share({ title: open.title || 'Form', url: link() }).catch(() => {}));
    }
    function moreMenu(anchor) {
        $$('.fl-pop').forEach(x => x.remove());
        const items = [
            ['copy', 'Make a copy', async () => {
                if (dirty) await saveNow();
                const c = await call(`/api/docs/${open.id}/copy`, { method: 'POST', body: {} });
                list.unshift(c);
                select(c.id);
                toast('A copy of your own, with its own link');
            }],
            ...(open.mine ? [['trash', 'Delete', async () => {
                if (!(await ask({ title: 'Delete this form?', text: 'Its link stops working and all responses are deleted too. This can’t be undone.', ok: 'Delete', danger: true }))) return;
                await call(`/api/docs/${open.id}`, { method: 'DELETE' });
                dirty = false;
                list = list.filter(x => x.id !== open.id);
                gallery();
            }, true]] : [])
        ];
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        pop.innerHTML = items.map(([icon, label, , danger], i) => `<button data-i="${i}" class="${danger ? 'danger' : ''}">${ic(icon)}<span>${label}</span></button>`).join('');
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${r.bottom + 4}px`;
        pop.style.left = `${Math.max(8, r.right - pop.offsetWidth)}px`;
        const off = e => !pop.contains(e.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('click', e => {
            const b = e.target.closest('[data-i]');
            if (!b) return;
            pop.remove();
            items[+b.dataset.i][2]();
        });
    }

    /* ---------- undo (Ctrl Z, Ctrl Y) and saving ---------- */
    const hist = undoable(
        () => ({ title: open.title, body: open.body }),
        s => {
            open.title = s.title;
            open.body = s.body;
        }
    );
    addEventListener('keydown', e => {
        const u = undoKey(e);
        if (!u || !open || !open.canEdit || tab === 'responses' || textBox(e) || $('.pf-crop-back')) return;
        e.preventDefault();
        if (!(u === 'undo' ? hist.undo() : hist.redo())) return;
        if ($('#name')) $('#name').value = open.title || '';
        const y = $('#desk') ? $('#desk').scrollTop : 0;
        draw();
        if ($('#desk')) $('#desk').scrollTop = y;
        changed();
    });
    function changed() {
        if (!open || !open.canEdit) return;
        hist.note();
        dirty = true;
        $('#saved') && ($('#saved').textContent = 'Saving…');
        save();
    }
    async function saveNow() {
        if (!open || !dirty) return;
        dirty = false;
        const d = open;
        try {
            const r = await call(`/api/docs/${d.id}`, { method: 'PUT', body: { title: (d.title || '').trim(), body: d.body, version: d.version } });
            d.version = r.version;
            if ($('#saved') && open === d) $('#saved').textContent = 'Saved';
        } catch (e) {
            dirty = true;
            if ($('#saved')) $('#saved').textContent = 'Not saved';
            toast(e.message, { bad: true });
        }
    }
    const save = debounce(saveNow, 800);
    addEventListener('beforeunload', () => dirty && saveNow());

    call('/api/docs?kind=form')
        .then(r => {
            list = r;
            const want = location.hash.slice(1);
            if (want && list.some(d => d.id === want)) select(want);
            else gallery();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your forms</h1><p>${esc(e.message)}</p></div>`));
})();
