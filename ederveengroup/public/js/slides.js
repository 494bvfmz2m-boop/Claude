// Slides: presentations, edited right on the slide, shown full screen.
(function () {
    const { $, $$, esc, ic, call, toast, ask, debounce, ago, phone } = window.EG;
    const root = $('#slides');
    const LAYOUTS = [['title', 'Title'], ['bullets', 'Title and points'], ['statement', 'Big statement'], ['image', 'Picture'], ['columns', 'Two columns']];
    const THEMES = [['midnight', 'Midnight'], ['paper', 'Paper'], ['sunset', 'Sunset'], ['ocean', 'Ocean'], ['forest', 'Forest']];
    let decks = [];
    let deck = null; // the open one: { id, title, body: { theme, slides }, canEdit, … }
    let cur = 0;
    let dirty = false;
    const newSlide = (layout = 'bullets') => ({ id: Math.random().toString(36).slice(2, 10), layout, title: '', body: '', body2: '', image: '', notes: '' });
    const lines = t => String(t || '').split('\n').map(l => l.trim()).filter(Boolean);

    // one slide as HTML; editable fields carry data-f
    function slideHtml(s, theme, edit) {
        const field = (f, tag, cls, ph) => (edit ? `<${tag} class="${cls}" data-f="${f}" contenteditable="true" data-ph="${ph}">${esc(s[f])}</${tag}>` : `<${tag} class="${cls}">${esc(s[f])}</${tag}>`);
        const points = (f, ph) => (edit ? `<div class="sl-points" data-f="${f}" contenteditable="true" data-ph="${ph}">${esc(s[f])}</div>` : `<ul class="sl-points">${lines(s[f]).map(l => `<li>${esc(l)}</li>`).join('')}</ul>`);
        const pic = s.image ? `<img class="sl-img" alt="" src="${esc(s.image)}">` : edit ? `<button class="sl-img sl-pick" data-pick>${ic('image')}<span>Add a picture</span></button>` : '';
        const inner = {
            title: field('title', 'h1', 'sl-h1', 'Title') + field('body', 'p', 'sl-sub', 'Subtitle'),
            bullets: field('title', 'h2', 'sl-h2', 'Title') + `<div class="sl-row">${points('body', 'One point per line')}${s.image ? pic : ''}</div>`,
            statement: field('title', 'p', 'sl-big', 'Say one thing'),
            image: `${pic}${field('title', 'p', 'sl-cap', 'Caption')}`,
            columns: field('title', 'h2', 'sl-h2', 'Title') + `<div class="sl-cols">${points('body', 'Left: one point per line')}${points('body2', 'Right: one point per line')}</div>`
        }[s.layout];
        return `<div class="sl sl-${s.layout} th-${theme}">${inner}</div>`;
    }

    /* ---------- the gallery ---------- */
    function gallery() {
        deck = null;
        document.body.classList.remove('sl-editing');
        const mine = decks.filter(d => d.mine);
        const shared = decks.filter(d => !d.mine);
        const card = d => {
            const [theme, title] = (d.cover || 'midnight|').split('|');
            return `<button class="sl-card" data-id="${esc(d.id)}"><span class="sl-thumb"><span class="sl sl-title th-${esc(theme)}"><span class="sl-h1">${esc(title || d.title || '')}</span></span></span><b>${esc(d.title || 'Untitled')}</b><small>${esc(ago(d.updatedAt))}${d.mine ? '' : ` · ${esc(d.ownerName)}`}</small></button>`;
        };
        root.innerHTML = `<div class="sl-home">
            <div class="ea-head"><h1>Slides</h1><button class="btn btn-primary" id="new">${ic('plus')}<span>New presentation</span></button></div>
            ${mine.length || shared.length ? '' : `<div class="ea-empty big">${ic('laptop')}<p>No presentations yet. Make one for a meeting, a birthday or a plan, then show it full screen.</p></div>`}
            ${mine.length ? `<h2 class="ea-sec">My presentations</h2><div class="sl-cards">${mine.map(card).join('')}</div>` : ''}
            ${shared.length ? `<h2 class="ea-sec">Shared with everyone</h2><div class="sl-cards">${shared.map(card).join('')}</div>` : ''}
        </div>`;
        $('#new').onclick = create;
        history.replaceState(null, '', location.pathname);
    }
    async function create() {
        const d = await call('/api/docs', { method: 'POST', body: { kind: 'deck', title: 'Untitled presentation' } });
        decks.unshift(d);
        openDeck(d.id);
    }

    /* ---------- the editor ---------- */
    async function openDeck(id) {
        try {
            deck = await call(`/api/docs/${id}`);
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        cur = 0;
        history.replaceState(null, '', `${location.pathname}#${id}`);
        editor();
    }
    function editor() {
        document.body.classList.add('sl-editing');
        const ro = !deck.canEdit;
        root.innerHTML = `<div class="sl-ed">
            <div class="sl-top">
                <button class="btn btn-ghost" id="home">${ic('left')}<span>Slides</span></button>
                <input class="sl-name" id="name" value="${esc(deck.title)}" ${ro ? 'readonly' : ''} aria-label="Presentation name">
                <span class="nt-saved" id="saved"></span><span class="spacer"></span>
                ${ro ? `<span class="dc-ro">${ic('eye')} Read only</span>` : `<select class="input" id="theme" aria-label="Theme">${THEMES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`}
                ${deck.mine ? '<select class="input" id="share" aria-label="Who can see it"><option value="private">Only me</option><option value="view">Everyone can watch</option><option value="edit">Everyone can edit</option></select>' : ''}
                <button class="icon-btn" id="more" aria-label="More">${ic('more')}</button>
                <button class="btn btn-primary" id="present">${ic('maximize')}<span>Present</span></button>
            </div>
            <div class="sl-main">
                <ol class="sl-strip" id="strip"></ol>
                <div class="sl-stage">
                    ${ro ? '' : `<div class="sl-layouts" id="layouts">${LAYOUTS.map(([v, l]) => `<button data-layout="${v}" title="${l}">${l}</button>`).join('')}<span class="spacer"></span><button class="icon-btn" id="dup" title="Duplicate slide" aria-label="Duplicate slide">${ic('copy')}</button><button class="icon-btn" id="del" title="Delete slide" aria-label="Delete slide">${ic('trash')}</button></div>`}
                    <div class="sl-canvas" id="canvas"></div>
                    <textarea class="input sl-notes" id="notes" placeholder="Speaker notes (only you see these)" ${ro ? 'readonly' : ''}></textarea>
                </div>
            </div>
            <input type="file" id="pic" accept="image/*" hidden>
        </div>`;
        if ($('#theme')) $('#theme').value = deck.body.theme;
        if ($('#share')) $('#share').value = deck.share;
        drawStrip();
        drawSlide();
        $('#home').onclick = async () => {
            if (dirty) await saveNow();
            decks = await call('/api/docs?kind=deck');
            gallery();
        };
        $('#present').onclick = () => present(cur);
        $('#name').addEventListener('input', changed);
        if (ro) return;
        $('#theme').onchange = e => {
            deck.body.theme = e.target.value;
            drawStrip();
            drawSlide();
            changed();
        };
        $('#share') && ($('#share').onchange = async e => {
            const r = await call(`/api/docs/${deck.id}`, { method: 'PATCH', body: { share: e.target.value } });
            deck.share = r.share;
            toast(r.share === 'private' ? 'Only you can see it' : r.share === 'edit' ? 'Everyone can watch and edit it' : 'Everyone on EderveenGroup can watch it');
        });
        $('#layouts').addEventListener('click', e => {
            const b = e.target.closest('[data-layout]');
            if (!b) return;
            deck.body.slides[cur].layout = b.dataset.layout;
            drawSlide();
            drawStrip();
            changed();
        });
        $('#dup').onclick = () => {
            deck.body.slides.splice(cur + 1, 0, { ...deck.body.slides[cur], id: newSlide().id });
            cur++;
            drawStrip();
            drawSlide();
            changed();
        };
        $('#del').onclick = () => {
            if (deck.body.slides.length === 1) return toast('A presentation needs at least one slide');
            deck.body.slides.splice(cur, 1);
            cur = Math.min(cur, deck.body.slides.length - 1);
            drawStrip();
            drawSlide();
            changed();
        };
        $('#notes').addEventListener('input', e => {
            deck.body.slides[cur].notes = e.target.value;
            changed();
        });
        $('#pic').addEventListener('change', async e => {
            const f = e.target.files[0];
            e.target.value = '';
            if (!f) return;
            const url = await shrink(f);
            if (!url) return toast('That picture couldn’t be read', { bad: true });
            const s = deck.body.slides[cur];
            s.image = url;
            if (s.layout === 'title' || s.layout === 'statement') s.layout = 'image';
            drawSlide();
            drawStrip();
            changed();
        });
    }
    function drawStrip() {
        const ro = !deck.canEdit;
        $('#strip').innerHTML =
            deck.body.slides.map((s, i) => `<li class="sl-mini${i === cur ? ' on' : ''}" data-i="${i}" draggable="${ro ? 'false' : 'true'}"><span class="sl-n">${i + 1}</span><span class="sl-thumb">${slideHtml(s, deck.body.theme, false)}</span></li>`).join('') +
            (ro ? '' : `<li><button class="btn btn-ghost sl-add" id="add">${ic('plus')}<span>Slide</span></button></li>`);
        $('#add') && ($('#add').onclick = () => {
            deck.body.slides.splice(cur + 1, 0, newSlide(deck.body.slides.length ? 'bullets' : 'title'));
            cur++;
            drawStrip();
            drawSlide();
            changed();
            setTimeout(() => $('#canvas [data-f="title"]')?.focus(), 30);
        });
    }
    function drawSlide() {
        const s = deck.body.slides[cur];
        $('#canvas').innerHTML = slideHtml(s, deck.body.theme, deck.canEdit);
        $('#notes').value = s.notes || '';
        $$('#layouts [data-layout]').forEach(b => b.classList.toggle('on', b.dataset.layout === s.layout));
        $$('#strip .sl-mini').forEach(m => m.classList.toggle('on', +m.dataset.i === cur));
        $('#strip .sl-mini.on')?.scrollIntoView({ block: 'nearest' });
    }
    // typing on the slide (plain text only)
    root.addEventListener('input', e => {
        const f = e.target.closest('[data-f]');
        if (!f || !deck) return;
        deck.body.slides[cur][f.dataset.f] = f.innerText.replace(/\n{3,}/g, '\n\n').replace(/\n$/, '');
        const mini = $(`#strip .sl-mini[data-i="${cur}"] .sl-thumb`);
        if (mini) mini.innerHTML = slideHtml(deck.body.slides[cur], deck.body.theme, false);
        changed();
    });
    root.addEventListener('paste', e => {
        if (!e.target.closest('[data-f]')) return;
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
    root.addEventListener('keydown', e => {
        const f = e.target.closest('[data-f]');
        if (f && e.key === 'Enter' && !f.classList.contains('sl-points')) e.preventDefault(); // titles stay one line
    });
    root.addEventListener('click', e => {
        if (e.target.closest('[data-pick]')) return $('#pic').click();
        if (e.target.closest('.sl-canvas .sl-img') && deck && deck.canEdit) return $('#pic').click();
        const mini = e.target.closest('.sl-mini');
        if (mini && deck) {
            cur = +mini.dataset.i;
            drawSlide();
        }
        const c = e.target.closest('.sl-card');
        if (c) openDeck(c.dataset.id);
    });
    // drag a slide in the strip to move it
    let dragFrom = null;
    root.addEventListener('dragstart', e => {
        const m = e.target.closest('.sl-mini');
        if (m) dragFrom = +m.dataset.i;
    });
    root.addEventListener('dragover', e => e.target.closest('.sl-mini') && dragFrom != null && e.preventDefault());
    root.addEventListener('drop', e => {
        const m = e.target.closest('.sl-mini');
        if (!m || dragFrom == null) return;
        e.preventDefault();
        const to = +m.dataset.i;
        const [s] = deck.body.slides.splice(dragFrom, 1);
        deck.body.slides.splice(to, 0, s);
        cur = to;
        dragFrom = null;
        drawStrip();
        drawSlide();
        changed();
    });
    function shrink(file) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
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

    /* ---------- saving ---------- */
    function changed() {
        if (!deck || !deck.canEdit) return;
        dirty = true;
        $('#saved').textContent = 'Saving…';
        save();
    }
    async function saveNow() {
        if (!deck || !dirty) return;
        dirty = false;
        const d = deck;
        d.title = $('#name') ? $('#name').value : d.title;
        // until it's given a name, a presentation is called after its first slide
        const first = (d.body.slides[0].title || '').trim();
        if ((!d.title.trim() || d.title === 'Untitled presentation') && first) {
            d.title = first.slice(0, 160);
            if ($('#name') && document.activeElement !== $('#name')) $('#name').value = d.title;
        }
        try {
            const r = await call(`/api/docs/${d.id}`, { method: 'PUT', body: { title: d.title, body: d.body, version: d.version } });
            d.version = r.version;
            if ($('#saved') && deck === d) $('#saved').textContent = 'Saved';
        } catch (e) {
            dirty = true;
            if ($('#saved')) $('#saved').textContent = 'Not saved';
            toast(e.message, { bad: true });
        }
    }
    const save = debounce(saveNow, 900);
    addEventListener('beforeunload', () => dirty && saveNow());

    /* ---------- presenting ---------- */
    function present(start) {
        let i = start;
        const v = document.createElement('div');
        v.className = 'sl-show';
        document.body.append(v);
        const show = () => {
            v.innerHTML = `<div class="sl-show-frame">${slideHtml(deck.body.slides[i], deck.body.theme, false)}</div><div class="sl-show-bar"><span>${i + 1} / ${deck.body.slides.length}</span></div>`;
        };
        const go = d => {
            i = Math.max(0, Math.min(deck.body.slides.length - 1, i + d));
            show();
        };
        const end = () => {
            removeEventListener('keydown', onKey);
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            v.remove();
            cur = i;
            if ($('#canvas')) drawSlide();
        };
        const onKey = e => {
            if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) (e.preventDefault(), go(1));
            else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) (e.preventDefault(), go(-1));
            else if (e.key === 'Home') ((i = 0), show());
            else if (e.key === 'End') ((i = deck.body.slides.length - 1), show());
            else if (e.key === 'Escape') end();
        };
        addEventListener('keydown', onKey);
        v.addEventListener('click', e => go(e.clientX < innerWidth / 3 ? -1 : 1));
        document.addEventListener('fullscreenchange', () => !document.fullscreenElement && v.isConnected && end(), { once: true });
        if (v.requestFullscreen && !phone()) v.requestFullscreen().catch(() => {});
        show();
    }

    // ⋯: copy, print, delete
    root.addEventListener('click', e => {
        if (!e.target.closest('#more') || !deck) return;
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        const acts = [['copy', 'copy', 'Make a copy'], ['print', 'file', 'Print or save as PDF'], ...(deck.mine ? [['delete', 'trash', 'Delete']] : [])];
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
                const c = await call(`/api/docs/${deck.id}/copy`, { method: 'POST', body: {} });
                decks.unshift(c);
                openDeck(c.id);
                toast('A copy of your own');
            } else if (a.dataset.a === 'print') {
                const sheet = document.createElement('div');
                sheet.className = 'sl-print';
                sheet.innerHTML = deck.body.slides.map(s => `<div class="sl-page">${slideHtml(s, deck.body.theme, false)}</div>`).join('');
                document.body.append(sheet);
                print();
                sheet.remove();
            } else if (a.dataset.a === 'delete') {
                if (!(await ask({ title: 'Delete this presentation?', text: 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
                await call(`/api/docs/${deck.id}`, { method: 'DELETE' });
                dirty = false;
                decks = decks.filter(x => x.id !== deck.id);
                gallery();
            }
        });
    });

    call('/api/docs?kind=deck')
        .then(r => {
            decks = r;
            const want = location.hash.slice(1);
            if (want === 'new') create();
            else if (want && decks.some(d => d.id === want)) openDeck(want);
            else gallery();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your presentations</h1><p>${esc(e.message)}</p></div>`));
})();
