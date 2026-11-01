// Tasks: a simple to-do list with due dates.
(function () {
    const { $, $$, esc, ic, call, toast, id: newId } = window.EG;
    const root = $('#tasks');
    let tasks = [];
    let addDue = '';
    let showDone = false;

    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = () => iso(new Date());
    const plus = n => {
        const d = new Date();
        d.setDate(d.getDate() + n);
        return iso(d);
    };
    function dueLabel(due) {
        if (!due) return '';
        if (due === today()) return 'Today';
        if (due === plus(1)) return 'Tomorrow';
        if (due === plus(-1)) return 'Yesterday';
        const d = new Date(due + 'T00:00');
        const days = Math.round((d - new Date(today() + 'T00:00')) / 864e5);
        if (days > 0 && days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
    }

    root.innerHTML = `<div class="tk">
        <div class="ea-head"><h1>Tasks</h1><span class="tk-count" id="count"></span></div>
        <form class="tk-add" id="add">
            <span class="tk-plus">${ic('plus')}</span>
            <input class="input" id="text" placeholder="Add a task" maxlength="300" autocomplete="off" aria-label="New task">
            <div class="tk-when" role="group" aria-label="Due">
                <button type="button" data-due="${today()}">Today</button><button type="button" data-due="${plus(1)}">Tomorrow</button>
                <label class="tk-pick">${ic('calendar')}<input type="date" id="pick" aria-label="Pick a date"></label>
            </div>
        </form>
        <div id="list"></div>
    </div>`;
    const list = $('#list');

    function sections() {
        const open = tasks.filter(t => !t.done);
        const by = (a, b) => (b.starred - a.starred) || (a.due || '9').localeCompare(b.due || '9') || a.createdAt - b.createdAt;
        const t0 = today();
        return [
            ['Overdue', open.filter(t => t.due && t.due < t0).sort(by), 'overdue'],
            ['Today', open.filter(t => t.due === t0).sort(by), 'today'],
            ['Upcoming', open.filter(t => t.due > t0).sort(by), ''],
            ['Someday', open.filter(t => !t.due).sort(by), '']
        ];
    }

    function row(t) {
        const late = !t.done && t.due && t.due < today();
        return `<div class="tk-row${t.done ? ' done' : ''}" data-id="${esc(t.id)}">
            <button class="tk-check" data-act="done" aria-label="${t.done ? 'Mark as not done' : 'Mark as done'}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg></button>
            <div class="tk-text"><span class="tk-t" data-act="edit">${esc(t.text)}</span>${t.due ? `<small class="${late ? 'late' : ''}">${ic('calendar')}${esc(dueLabel(t.due))}</small>` : ''}</div>
            <button class="icon-btn tk-star${t.starred ? ' on' : ''}" data-act="star" aria-label="${t.starred ? 'Unstar' : 'Star'}">${ic('star')}</button>
            <button class="icon-btn tk-del" data-act="del" aria-label="Delete">${ic('trash')}</button>
        </div>`;
    }

    function draw() {
        const groups = sections().filter(([, items]) => items.length);
        const done = tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
        const left = tasks.length - done.length;
        $('#count').textContent = left ? `${left} to do` : tasks.length ? 'All done' : '';
        list.innerHTML =
            (groups.length
                ? groups.map(([name, items, cls]) => `<section class="tk-sec ${cls}"><h2 class="ea-sec">${name} <i>${items.length}</i></h2>${items.map(row).join('')}</section>`).join('')
                : `<div class="ea-empty">${ic('tasks')}<p>${done.length ? 'Everything’s done. Nice.' : 'Nothing to do yet. Add your first task above.'}</p></div>`) +
            (done.length ? `<section class="tk-sec"><button class="ea-sec tk-toggle" id="toggle">${showDone ? ic('down') : ic('right')} Completed <i>${done.length}</i></button>${showDone ? done.slice(0, 200).map(row).join('') : ''}</section>` : '');
        $('#toggle')?.addEventListener('click', () => {
            showDone = !showDone;
            draw();
        });
    }

    async function save(t) {
        const s = await call(`/api/apps/tasks/${t.id}`, { method: 'PUT', body: { text: t.text, note: t.note || '', due: t.due || '', done: t.done, doneAt: t.doneAt, starred: t.starred } });
        Object.assign(t, s);
    }

    $('#add').addEventListener('submit', async e => {
        e.preventDefault();
        const text = $('#text').value.trim();
        if (!text) return;
        const t = { id: newId(), text, due: addDue, done: false, starred: false, createdAt: Date.now(), updatedAt: Date.now() };
        tasks.push(t);
        $('#text').value = '';
        setDue('');
        draw();
        $(`.tk-row[data-id="${t.id}"]`)?.classList.add('fresh');
        try {
            await save(t);
        } catch (err) {
            tasks = tasks.filter(x => x !== t);
            draw();
            toast(err.message, { bad: true });
        }
    });
    function setDue(due) {
        addDue = due;
        $$('.tk-when [data-due]').forEach(b => b.classList.toggle('on', b.dataset.due === due));
        $('#pick').value = due && !$$('.tk-when [data-due]').some(b => b.dataset.due === due) ? due : '';
        $('.tk-pick').classList.toggle('on', !!$('#pick').value);
    }
    // picking a day hands the cursor back to the task, so Enter adds it
    $('.tk-when').addEventListener('pointerdown', e => e.target.closest('[data-due]') && e.preventDefault());
    $('.tk-when').addEventListener('click', e => {
        const b = e.target.closest('[data-due]');
        if (!b) return;
        setDue(addDue === b.dataset.due ? '' : b.dataset.due);
        $('#text').focus();
    });
    $('#pick').addEventListener('change', e => {
        setDue(e.target.value);
        $('#text').focus();
    });

    list.addEventListener('click', async e => {
        const el = e.target.closest('[data-act]');
        const rowEl = e.target.closest('.tk-row');
        if (!el || !rowEl) return;
        const t = tasks.find(x => x.id === rowEl.dataset.id);
        const act = el.dataset.act;
        if (act === 'done') {
            t.done = !t.done;
            t.doneAt = t.done ? Date.now() : null;
            rowEl.classList.toggle('done', t.done);
            rowEl.classList.add('ticking');
            setTimeout(draw, t.done ? 650 : 0); // let the tick play before it moves
            if (t.done) toast(`Done: ${t.text}`, { action: 'Undo', onAction: () => ((t.done = false), (t.doneAt = null), draw(), save(t)) });
            save(t).catch(err => toast(err.message, { bad: true }));
        } else if (act === 'star') {
            t.starred = !t.starred;
            draw();
            save(t).catch(err => toast(err.message, { bad: true }));
        } else if (act === 'del') {
            tasks = tasks.filter(x => x !== t);
            rowEl.classList.add('gone');
            setTimeout(draw, 250);
            try {
                await call(`/api/apps/tasks/${t.id}`, { method: 'DELETE' });
                toast('Task deleted', { action: 'Undo', onAction: async () => (tasks.push(t), draw(), await save(t)) });
            } catch (err) {
                toast(err.message, { bad: true });
            }
        } else if (act === 'edit' && !t.done) {
            const span = el;
            const input = document.createElement('input');
            input.className = 'input tk-edit';
            input.value = t.text;
            input.maxLength = 300;
            span.replaceWith(input);
            input.focus();
            input.select();
            let finished = false; // Escape must not be undone by the blur that follows
            const done = async keep => {
                if (finished) return;
                finished = true;
                const v = input.value.trim();
                if (keep && v && v !== t.text) {
                    t.text = v;
                    save(t).catch(err => toast(err.message, { bad: true }));
                }
                draw();
            };
            input.addEventListener('keydown', ev => {
                if (ev.key === 'Enter') done(true);
                if (ev.key === 'Escape') done(false);
            });
            input.addEventListener('blur', () => done(true));
        }
    });

    call('/api/apps/tasks')
        .then(r => {
            tasks = r.items;
            draw();
            const fresh = location.hash === '#new'; // from the dashboard's + Task
            if (fresh) history.replaceState(null, '', location.pathname);
            if (!window.EG.phone() || fresh) $('#text').focus();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your tasks</h1><p>${esc(e.message)}</p></div>`));
})();
