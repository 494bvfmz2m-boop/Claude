// Notes: quick private notes, saved as you type.
(function () {
    const { $, $$, esc, ic, call, toast, ask, id: newId, debounce, ago } = window.EG;
    const root = $('#notes');
    const COLORS = ['', 'yellow', 'green', 'blue', 'purple', 'pink', 'orange'];
    let notes = [];
    let open = null; // the note being edited
    let q = '';
    let dirty = false; // typed but not saved yet

    const title = n => n.title || (n.body || '').split('\n').find(l => l.trim()) || 'New note';
    const snippet = n => (n.title ? n.body : (n.body || '').split('\n').filter(l => l.trim()).slice(1).join(' ')).slice(0, 140);

    root.innerHTML = `<div class="ea-split notes">
        <aside class="ea-list" aria-label="Notes">
            <div class="ea-head"><h1>Notes</h1><button class="btn btn-primary" id="new">${ic('plus')}<span>New note</span></button></div>
            <div class="ad-search">${ic('search')}<input class="input" id="q" placeholder="Search notes" aria-label="Search notes"></div>
            <div id="list" class="nt-list"></div>
        </aside>
        <section class="ea-detail" id="detail" aria-label="Note"></section>
    </div>`;
    const list = $('#list');
    const detail = $('#detail');

    function drawList() {
        const shown = notes.filter(n => !q || (n.title + ' ' + n.body).toLowerCase().includes(q));
        const pinned = shown.filter(n => n.pinned);
        const rest = shown.filter(n => !n.pinned);
        const row = (n, i) => `<button class="nt-row${open && open.id === n.id ? ' on' : ''}" data-id="${esc(n.id)}" data-color="${esc(n.color)}" style="animation-delay:${Math.min(i, 12) * 25}ms">
            <b>${n.pinned ? ic('pinned') : ''}${esc(title(n))}</b><small><time>${esc(ago(n.updatedAt))}</time> ${esc(snippet(n))}</small></button>`;
        list.innerHTML = shown.length
            ? (pinned.length ? `<h2 class="ea-sec">Pinned</h2>${pinned.map(row).join('')}` : '') + (rest.length ? `${pinned.length ? '<h2 class="ea-sec">Notes</h2>' : ''}${rest.map(row).join('')}` : '')
            : `<div class="ea-empty">${ic('note')}<p>${q ? 'No notes match that.' : 'No notes yet. Your first one is a click away.'}</p></div>`;
    }

    const meta = n => (n.createdAt ? `Created ${esc(new Date(n.createdAt).toLocaleString())}` : 'Not saved yet');

    function drawDetail() {
        document.body.classList.toggle('ea-open', !!open);
        if (!open) {
            detail.innerHTML = `<div class="ea-empty big">${ic('note')}<p>Pick a note, or start a new one.</p></div>`;
            return;
        }
        detail.innerHTML = `<div class="nt-editor" data-color="${esc(open.color)}">
            <div class="nt-bar">
                <button class="btn btn-ghost ea-back" id="back">${ic('left')}<span>Notes</span></button>
                <span class="nt-saved" id="saved"></span><span class="spacer"></span>
                <div class="nt-colors" role="group" aria-label="Colour">${COLORS.map(c => `<button class="nt-dot${open.color === c ? ' on' : ''}" data-c="${c}" aria-label="${c || 'No colour'}"></button>`).join('')}</div>
                <button class="icon-btn${open.pinned ? ' active' : ''}" id="pin" aria-label="${open.pinned ? 'Unpin' : 'Pin'}" title="${open.pinned ? 'Unpin' : 'Pin to the top'}">${ic('pinned')}</button>
                <button class="icon-btn" id="del" aria-label="Delete" title="Delete">${ic('trash')}</button>
            </div>
            <input class="nt-title" id="t" placeholder="Title" maxlength="140" value="${esc(open.title)}">
            <textarea class="nt-body" id="b" placeholder="Start writing…">${esc(open.body)}</textarea>
            <p class="nt-meta" id="meta">${meta(open)}</p>
        </div>`;
        const t = $('#t'), b = $('#b');
        const grow = () => {
            b.style.height = 'auto';
            b.style.height = b.scrollHeight + 'px';
        };
        grow();
        const changed = () => {
            open.title = t.value;
            open.body = b.value;
            $('#saved').textContent = 'Saving…';
            dirty = true;
            save(open);
        };
        t.addEventListener('input', changed);
        b.addEventListener('input', () => (grow(), changed()));
        t.addEventListener('keydown', e => e.key === 'Enter' && (e.preventDefault(), b.focus()));
        $('#back').onclick = () => close();
        $('#pin').onclick = () => {
            open.pinned = !open.pinned;
            saveNow().then(drawDetail);
        };
        $$('.nt-dot', detail).forEach(d =>
            d.addEventListener('click', () => {
                open.color = d.dataset.c;
                $('.nt-editor', detail).dataset.color = open.color;
                $$('.nt-dot', detail).forEach(x => x.classList.toggle('on', x === d));
                saveNow();
            })
        );
        $('#del').onclick = async () => {
            const gone = open;
            if (gone.createdAt && !(await ask({ title: 'Delete this note?', text: title(gone), ok: 'Delete', danger: true }))) return;
            await remove(gone);
        };
    }

    async function persist(n) {
        if (n.gone || (!n.title.trim() && !n.body.trim())) return; // deleted, or nothing to keep yet
        const saved = await call(`/api/apps/notes/${n.id}`, { method: 'PUT', body: { title: n.title, body: n.body, color: n.color, pinned: n.pinned } });
        Object.assign(n, { createdAt: saved.createdAt, updatedAt: saved.updatedAt });
        if (!notes.includes(n)) notes.unshift(n);
        notes.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    const saveNow = async (n = open) => {
        if (!n) return;
        dirty = false;
        try {
            await persist(n);
            if (open === n && $('#saved')) {
                $('#saved').textContent = n.createdAt ? 'Saved' : '';
                $('#meta').innerHTML = meta(n);
            }
            drawList();
        } catch (e) {
            dirty = true;
            toast(e.message, { bad: true });
            if ($('#saved')) $('#saved').textContent = 'Not saved';
        }
    };
    const save = debounce(saveNow, 500);

    async function remove(n) {
        n.gone = true; // a save still on its way mustn't bring it back
        if (open === n) dirty = false;
        notes = notes.filter(x => x !== n);
        if (open === n) open = null;
        drawList();
        drawDetail();
        if (!n.createdAt) return;
        try {
            await call(`/api/apps/notes/${n.id}`, { method: 'DELETE' });
            toast('Note deleted', { action: 'Undo', onAction: async () => {
                n.gone = false;
                open = n;
                await persist(n);
                drawList();
                drawDetail();
            } });
        } catch (e) {
            toast(e.message, { bad: true });
        }
    }

    function close() {
        if (dirty) saveNow();
        const n = open;
        if (n && !n.createdAt && !n.title.trim() && !n.body.trim()) notes = notes.filter(x => x !== n);
        open = null;
        drawList();
        drawDetail();
    }
    function select(n, focus) {
        if (dirty && open !== n) saveNow();
        open = n;
        drawList();
        drawDetail();
        if (focus) $(focus).focus();
    }

    $('#new').onclick = () => {
        const n = { id: newId(), title: '', body: '', color: '', pinned: false, createdAt: 0, updatedAt: Date.now() };
        select(n, '#t');
    };
    list.addEventListener('click', e => {
        const r = e.target.closest('.nt-row');
        if (r) select(notes.find(n => n.id === r.dataset.id));
    });
    $('#q').addEventListener('input', e => {
        q = e.target.value.trim().toLowerCase();
        drawList();
    });
    addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveNow();
        }
    });
    addEventListener('beforeunload', () => dirty && saveNow()); // only unsaved typing, never a note deleted elsewhere

    call('/api/apps/notes')
        .then(r => {
            notes = r.items;
            drawList();
            // from the dashboard's + Note: a new one straight away; big screens otherwise open the newest
            if (location.hash === '#new') {
                history.replaceState(null, '', location.pathname);
                $('#new').click();
            } else if (notes.length && !window.EG.phone()) select(notes[0]);
            else drawDetail();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your notes</h1><p>${esc(e.message)}</p></div>`));
})();
