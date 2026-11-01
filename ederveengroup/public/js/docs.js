// Docs: documents, private or shared with everyone (the knowledge base), saved as you type.
(function () {
    const { $, $$, esc, ic, call, toast, ask, debounce, ago, phone } = window.EG;
    const root = $('#docs');
    let list = [];
    let open = null; // { id, title, body, canEdit, mine, share, version }
    let q = '';
    let dirty = false;

    root.innerHTML = `<div class="ea-split docs">
        <aside class="ea-list" aria-label="Docs">
            <div class="ea-head"><h1>Docs</h1><button class="btn btn-primary" id="new">${ic('plus')}<span>New doc</span></button></div>
            <div class="ad-search">${ic('search')}<input class="input" id="q" placeholder="Search docs" aria-label="Search docs"></div>
            <div id="list" class="nt-list"></div>
        </aside>
        <section class="ea-detail" id="detail" aria-label="Document"></section>
    </div>`;
    const detail = $('#detail');

    function drawList() {
        const shown = list.filter(d => !q || (d.title || '').toLowerCase().includes(q));
        const mine = shown.filter(d => d.mine);
        const shared = shown.filter(d => !d.mine);
        const row = d => `<button class="nt-row dc-row${open && open.id === d.id ? ' on' : ''}" data-id="${esc(d.id)}"><b>${d.share !== 'private' ? ic('globe') : ''}${esc(d.title || 'Untitled')}</b><small><time>${esc(ago(d.updatedAt))}</time> ${d.mine ? (d.share === 'private' ? 'Only you' : d.share === 'edit' ? 'Everyone can edit' : 'Everyone can read') : `by ${esc(d.ownerName)}`}</small></button>`;
        $('#list').innerHTML = shown.length
            ? (mine.length ? `<h2 class="ea-sec">My docs</h2>${mine.map(row).join('')}` : '') + (shared.length ? `<h2 class="ea-sec">Shared with everyone</h2>${shared.map(row).join('')}` : '')
            : `<div class="ea-empty">${ic('file')}<p>${q ? 'No docs match that.' : 'No docs yet. Write guides, plans or anything longer than a note; share them and everyone here can read them.'}</p></div>`;
    }

    const TOOLS = [
        ['bold', 'bold', 'Bold (Ctrl B)'], ['italic', 'italic', 'Italic (Ctrl I)'], ['underline', 'underline', 'Underline (Ctrl U)'], ['strikeThrough', 'strike', 'Strikethrough'], '|',
        ['insertUnorderedList', 'list', 'Bullets'], ['insertOrderedList', 'listOl', 'Numbers'], ['checklist', 'check', 'Checklist'], '|',
        ['link', 'link', 'Link'], ['image', 'image', 'Picture'], ['insertHorizontalRule', 'minimize', 'Line'], '|',
        ['undo', 'undo', 'Undo']
    ];
    function drawDetail() {
        document.body.classList.toggle('ea-open', !!open);
        if (!open) {
            detail.innerHTML = `<div class="ea-empty big">${ic('file')}<p>Pick a doc, or start a new one.</p></div>`;
            return;
        }
        const ro = !open.canEdit;
        detail.innerHTML = `<div class="dc-editor">
            <div class="nt-bar dc-bar">
                <button class="btn btn-ghost ea-back" id="back">${ic('left')}<span>Docs</span></button>
                ${ro ? `<span class="dc-ro">${ic('eye')} Read only · by ${esc(open.ownerName)}</span>` : `<div class="dc-tools" role="toolbar" aria-label="Formatting"><span class="dc-blocks" id="style">${[['p', 'Text'], ['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3']].map(([v, l]) => `<button data-block="${v}" title="${v === 'p' ? 'Normal text' : `Heading ${v[1]}`}">${l}</button>`).join('')}<button data-block="blockquote" class="icon-btn" title="Quote" aria-label="Quote">${ic('quote')}</button><button data-block="pre" class="icon-btn" title="Code" aria-label="Code">${ic('code')}</button></span><i class="dc-sep"></i>${TOOLS.map(t => (t === '|' ? '<i class="dc-sep"></i>' : `<button class="icon-btn" data-cmd="${t[0]}" title="${t[2]}" aria-label="${t[2]}">${ic(t[1])}</button>`)).join('')}</div>`}
                <span class="spacer"></span><span class="nt-saved" id="saved"></span>
                ${open.mine ? `<select class="input dc-share" id="share" aria-label="Who can see it"><option value="private">Only me</option><option value="view">Everyone can read</option><option value="edit">Everyone can edit</option></select>` : ''}
                <button class="icon-btn" id="more" aria-label="More" title="More">${ic('more')}</button>
            </div>
            <div class="dc-page">
                <input class="dc-title" id="t" placeholder="Untitled" maxlength="160" value="${esc(open.title)}" ${ro ? 'readonly' : ''}>
                <div class="dc-body" id="b" ${ro ? '' : 'contenteditable="true"'} spellcheck="true">${open.body.html || ''}</div>
            </div>
            <input type="file" id="img" accept="image/*" hidden>
        </div>`;
        if ($('#share')) $('#share').value = open.share;
        const b = $('#b');
        if (!ro && !b.innerHTML.trim()) b.innerHTML = '<p><br></p>';
        $('#back').onclick = close;
        $('#t').addEventListener('input', changed);
        $('#t').addEventListener('keydown', e => e.key === 'Enter' && (e.preventDefault(), b.focus()));
        if (ro) return;
        b.addEventListener('input', changed);
        // pasted text keeps its structure, not its colours and fonts
        b.addEventListener('paste', () => setTimeout(() => $$('[style]:not(h1,h2,h3,p), font', b).forEach(el => el.removeAttribute('style')), 0));
        // a click on a checklist box ticks it
        b.addEventListener('click', e => {
            const li = e.target.closest('ul[data-checklist] > li');
            if (li && e.offsetX < 26) {
                li.dataset.checked = li.dataset.checked === 'true' ? 'false' : 'true';
                changed();
            }
        });
        // the buttons never take the focus, so the cursor stays where it was
        $('.dc-tools').addEventListener('mousedown', e => e.target.closest('[data-cmd], [data-block]') && e.preventDefault());
        $('#style').addEventListener('click', e => {
            const t = e.target.closest('[data-block]');
            if (!t) return;
            const block = t.dataset.block;
            document.execCommand('formatBlock', false, block);
            syncStyle();
            changed();
        });
        $('.dc-tools').addEventListener('click', e => {
            const t = e.target.closest('[data-cmd]');
            if (!t) return;
            const cmd = t.dataset.cmd;
            if (cmd === 'link') {
                const url = prompt('Link to (https://…)');
                restore($('#b'));
                if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) document.execCommand('createLink', false, url.trim());
            } else if (cmd === 'image') $('#img').click();
            else if (cmd === 'checklist') {
                document.execCommand('insertUnorderedList');
                const ul = getSelection().anchorNode && (getSelection().anchorNode.nodeType === 1 ? getSelection().anchorNode : getSelection().anchorNode.parentElement).closest('ul');
                if (ul) {
                    ul.setAttribute('data-checklist', '');
                    $$('li', ul).forEach(li => li.dataset.checked || (li.dataset.checked = 'false'));
                }
            } else document.execCommand(cmd);
            changed();
        });
        $('#img').addEventListener('change', async e => {
            const f = e.target.files[0];
            e.target.value = '';
            if (!f) return;
            const url = await shrink(f);
            if (!url) return toast('That picture couldn’t be read', { bad: true });
            restore(b);
            document.execCommand('insertImage', false, url);
            changed();
        });
        b.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') (e.preventDefault(), saveNow());
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') (e.preventDefault(), $('[data-cmd=link]').click());
        });
        $('#share') && ($('#share').onchange = async e => {
            const r = await call(`/api/docs/${open.id}`, { method: 'PATCH', body: { share: e.target.value } });
            open.share = r.share;
            Object.assign(list.find(x => x.id === open.id), r);
            drawList();
            toast(r.share === 'private' ? 'Only you can see it' : r.share === 'edit' ? 'Everyone on EderveenGroup can read and edit it' : 'Everyone on EderveenGroup can read it');
        });
    }
    function syncStyle() {
        const s = $('#style');
        if (!s) return;
        const n = getSelection().anchorNode;
        const el = n && (n.nodeType === 1 ? n : n.parentElement);
        if (!el || !el.closest('#b')) return;
        const block = el.closest('#b h1, #b h2, #b h3, #b blockquote, #b pre');
        const tag = block ? block.tagName.toLowerCase() : 'p';
        $$('[data-block]', s).forEach(x => x.classList.toggle('on', x.dataset.block === tag));
    }
    // where the cursor was in the doc, so picking a style (which moves focus) applies it there
    let caret = null;
    document.addEventListener('selectionchange', () => {
        const sel = getSelection();
        const b = $('#b');
        if (b && sel.rangeCount && b.contains(sel.anchorNode)) caret = sel.getRangeAt(0).cloneRange();
        syncStyle();
    });
    function restore(b) {
        b.focus();
        if (caret && b.contains(caret.startContainer)) {
            const sel = getSelection();
            sel.removeAllRanges();
            sel.addRange(caret);
        }
    }
    // pictures are kept inside the doc, made small enough first
    function shrink(file) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * scale);
                c.height = Math.round(img.height * scale);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(img.src);
                resolve(c.toDataURL('image/jpeg', 0.84));
            };
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(file);
        });
    }

    function changed() {
        if (!open || !open.canEdit) return;
        dirty = true;
        $('#saved').textContent = 'Saving…';
        save();
    }
    async function saveNow() {
        if (!open || !dirty) return;
        const d = open;
        dirty = false;
        d.title = $('#t') ? $('#t').value : d.title;
        d.body = { html: $('#b') ? $('#b').innerHTML : d.body.html };
        try {
            const r = await call(`/api/docs/${d.id}`, { method: 'PUT', body: { title: d.title, body: d.body, version: d.version } });
            d.version = r.version;
            Object.assign(list.find(x => x.id === d.id) || {}, r);
            list.sort((a, b) => b.updatedAt - a.updatedAt);
            if (open === d && $('#saved')) $('#saved').textContent = 'Saved';
            drawList();
        } catch (e) {
            dirty = true;
            if ($('#saved')) $('#saved').textContent = 'Not saved';
            toast(e.message, { bad: true });
        }
    }
    const save = debounce(saveNow, 800);

    async function select(id) {
        if (dirty) await saveNow();
        try {
            open = await call(`/api/docs/${id}`);
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        drawList();
        drawDetail();
        history.replaceState(null, '', `${location.pathname}#${id}`);
    }
    function close() {
        if (dirty) saveNow();
        open = null;
        history.replaceState(null, '', location.pathname);
        drawList();
        drawDetail();
    }

    // the ⋯ menu: copy, download, print, delete
    detail.addEventListener('click', e => {
        if (!e.target.closest('#more')) return;
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        const acts = [['copy', 'copy', 'Make a copy'], ['download', 'download', 'Download (.html)'], ['print', 'file', 'Print or save as PDF'], ...(open.mine ? [['delete', 'trash', 'Delete']] : [])];
        pop.innerHTML = acts.map(([a, i, l]) => `<button data-a="${a}" class="${a === 'delete' ? 'danger' : ''}">${ic(i)}<span>${l}</span></button>`).join('');
        document.body.append(pop);
        const r = e.target.closest('#more').getBoundingClientRect();
        pop.style.top = `${r.bottom + 4}px`;
        pop.style.left = `${Math.max(8, r.right - pop.offsetWidth)}px`;
        const off = ev => !pop.contains(ev.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('click', async ev => {
            const a = ev.target.closest('[data-a]');
            if (!a) return;
            pop.remove();
            if (a.dataset.a === 'copy') {
                const c = await call(`/api/docs/${open.id}/copy`, { method: 'POST', body: {} });
                list.unshift(c);
                select(c.id);
                toast('A copy of your own');
            } else if (a.dataset.a === 'download') {
                const html = `<!doctype html><meta charset="utf-8"><title>${esc(open.title || 'Untitled')}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px}img{max-width:100%}</style><h1>${esc(open.title || 'Untitled')}</h1>${$('#b').innerHTML}`;
                const link = document.createElement('a');
                link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
                link.download = `${(open.title || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-')}.html`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            } else if (a.dataset.a === 'print') print();
            else if (a.dataset.a === 'delete') {
                if (!(await ask({ title: 'Delete this doc?', text: open.share !== 'private' ? 'Everyone it’s shared with loses it too. This can’t be undone.' : 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
                await call(`/api/docs/${open.id}`, { method: 'DELETE' });
                list = list.filter(x => x.id !== open.id);
                dirty = false;
                close();
            }
        });
    });

    $('#new').onclick = async () => {
        const d = await call('/api/docs', { method: 'POST', body: { kind: 'doc', title: '' } });
        list.unshift(d);
        await select(d.id);
        $('#t').focus();
    };
    $('#list').addEventListener('click', e => {
        const r = e.target.closest('.nt-row');
        if (r) select(r.dataset.id);
    });
    $('#q').addEventListener('input', e => {
        q = e.target.value.trim().toLowerCase();
        drawList();
    });
    addEventListener('beforeunload', () => dirty && saveNow());

    call('/api/docs?kind=doc')
        .then(async r => {
            list = r;
            drawList();
            const want = location.hash.slice(1);
            if (want === 'new') $('#new').click();
            else if (want && list.some(d => d.id === want)) select(want);
            else if (list.length && !phone()) select(list[0].id);
            else drawDetail();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your docs</h1><p>${esc(e.message)}</p></div>`));
})();
