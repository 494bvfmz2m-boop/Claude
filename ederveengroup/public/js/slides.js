// Slides: presentations like PowerPoint. A ribbon, the slide pane, placeholders you click into,
// text boxes, shapes and pictures you drag around, speaker notes and a full-screen slide show.
// Downloads as PowerPoint (.pptx) or PDF; opens PowerPoint files.
(function () {
    const { $, $$, esc, ic, call, toast, ask, debounce, ago, phone } = window.EG;
    const K = window.SlideKit;
    const root = $('#slides');
    const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
    const COLORS = ['#000000', '#ffffff', '#595959', '#c00000', '#e46c0a', '#f4c95d', '#2e7d32', '#0f9d6e', '#156082', '#1f5fbf', '#7aa7ff', '#7030a0', '#ff4f81', '#fde68a', '#d9f0e4'];
    let decks = [];
    let deck = null; // the open one: { id, title, body: { theme, slides }, canEdit, … }
    let cur = 0;
    let dirty = false;
    let sel = null; // the selected text box, shape or picture on this slide
    let editing = null; // the one whose text is being typed
    let field = 'title'; // the placeholder the ribbon's formatting goes to
    let area = 'slide'; // where the keyboard goes: the slide, or the slide pane
    let view = 'normal';
    let undo = [];
    let redo = [];
    let clip = null;
    const uid = () => Math.random().toString(36).slice(2, 10);
    const blank = (layout = 'bullets') => ({ id: uid(), layout, title: '', body: '', body2: '', image: '', notes: '', fmt: {}, objs: [], bg: '', transition: 'none' });
    const slide = () => deck.body.slides[cur];
    const th = () => K.theme(deck.body.theme);
    const store = (k, v) => {
        try {
            if (v === undefined) return localStorage.getItem(k);
            localStorage.setItem(k, v);
        } catch {
            return null;
        }
    };

    /* ---------- drawing a slide ---------- */
    const pct = b => `left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;`;
    const textStyle = L => `--pt:${L.size};font-family:${L.css};line-height:${L.lh};color:${L.color};text-align:${L.align};${L.b ? 'font-weight:700;' : ''}${L.i ? 'font-style:italic;' : ''}${L.u ? 'text-decoration:underline;' : ''}`;
    const lines = t => K.paras(t).map(p => `<div class="ln" data-lv="${p.lv}">${esc(p.text) || '<br>'}</div>`).join('');
    const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => `<span class="hd" data-h="${h}"></span>`).join('');
    function phStyle(box, s, t) {
        const L = K.look(box, s.fmt && s.fmt[box.f], t);
        return { L, style: pct(box) + textStyle(L), cls: `sl-ph v-${L.v}${L.bullets ? ' bul' : ''}${String(s[box.f] || '').trim() ? '' : ' empty'}` };
    }
    function objArt(o, t) {
        const L = K.objLook(o, t);
        const shape = K.SHAPES[o.t];
        if (shape && shape.poly) return `<svg class="sl-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="${shape.poly.map(p => p.join(',')).join(' ')}" fill="${L.fill || 'none'}" stroke="${L.line || 'none'}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
        if (o.t === 'text' && !L.fill && !L.line) return '';
        const r = o.t === 'ellipse' ? 'border-radius:50%;' : o.t === 'round' ? `border-radius:${(Math.min(o.w, o.h * 0.5625) * 0.16).toFixed(2)}cqw;` : '';
        return `<i class="sl-art" style="${r}background:${L.fill || 'transparent'};${L.line ? `box-shadow:inset 0 0 0 .16cqw ${L.line};` : ''}"></i>`;
    }
    function objHtml(o, t, mode) {
        const on = mode === 'edit' && sel === o.id ? ' sel' : '';
        if (o.t === 'img') return `<div class="sl-ob img${on}" data-oid="${o.id}" style="${pct(o)}"><img alt="" src="${esc(o.src)}" draggable="false">${mode === 'edit' ? HANDLES : ''}</div>`;
        const L = K.objLook(o, t);
        const empty = !String(o.text || '').trim();
        return `<div class="sl-ob ${o.t} v-${L.v}${on}${empty ? ' empty' : ''}" data-oid="${o.id}" data-hint="${o.t === 'text' && mode === 'edit' ? 'Click to add text' : ''}" style="${pct(o)}${textStyle(L)}">${objArt(o, t)}<div class="sl-tx">${empty && mode !== 'edit' ? '' : lines(o.text)}</div>${mode === 'edit' ? HANDLES : ''}</div>`;
    }
    // mode: edit (the big one), view (thumbnails, the show) or layout (an outline of the layout)
    function slideHtml(s, mode, t = th()) {
        const edit = mode === 'edit';
        let h = '';
        for (const box of K.boxes(s)) {
            if (box.kind === 'bar') h += `<div class="sl-bar" style="${pct(box)}"></div>`;
            else if (box.kind === 'shade') h += s.image || s.title || mode === 'layout' ? `<div class="sl-shade" style="${pct(box)}"></div>` : '';
            else if (box.kind === 'picture') {
                if (mode === 'layout') h += `<div class="sl-pic lay" style="${pct(box)}"></div>`;
                else if (s.image) h += `<div class="sl-pic${box.round ? ' round' : ''}" style="${pct(box)}"><img alt="" src="${esc(s.image)}" draggable="false">${edit && deck.canEdit ? `<span class="sl-pic-acts"><button data-pick>${ic('image')}<span>Change</span></button><button data-unpick>${ic('trash')}<span>Remove</span></button></span>` : ''}</div>`;
                else if (edit && deck.canEdit) h += `<button class="sl-pic sl-pick" data-pick style="${pct(box)}">${ic('image')}<span>Click to add a picture</span></button>`;
            } else if (mode === 'layout') h += `<div class="sl-ph lay" style="${pct(box)}"></div>`;
            else {
                if (!edit && !String(s[box.f] || '').trim()) continue;
                const { style, cls } = phStyle(box, s, t);
                h += `<div class="${cls}" data-ph="${box.f}" data-hint="${esc(box.ph)}" style="${style}"><div class="sl-tx" ${edit && deck.canEdit ? 'contenteditable="true" spellcheck="true"' : ''}>${lines(s[box.f])}</div></div>`;
            }
        }
        if (mode !== 'layout') for (const o of s.objs || []) h += objHtml(o, t, mode);
        return `<div class="sl${edit ? ' sl-edit' : ''}" style="background:${s.bg || K.cssBg(t.bg)};color:${t.ink};--ac:${t.accent}">${h}</div>`;
    }
    // text that doesn't fit its placeholder or shape gets smaller, like PowerPoint's autofit
    function fit(scope) {
        $$('.sl-ph:not(.lay), .sl-ob:not(.img):not(.text)', scope).forEach(box => {
            const tx = box.firstElementChild?.classList.contains('sl-tx') ? box.firstElementChild : box.querySelector(':scope > .sl-tx');
            if (!tx || !box.clientHeight) return;
            let f = 1;
            box.style.setProperty('--fit', 1);
            for (let n = 0; n < 16 && tx.offsetHeight > box.clientHeight + 1 && f > 0.4; n++) {
                f -= 0.05;
                box.style.setProperty('--fit', f.toFixed(2));
            }
        });
    }
    // and a text box grows to hold what's typed in it
    function grow(el, o) {
        const tx = el.querySelector('.sl-tx');
        const c = $('#canvas .sl');
        if (!tx || !c) return;
        const need = (tx.offsetHeight / c.clientHeight) * 100;
        if (need > o.h + 0.2) {
            o.h = Math.round(need * 100) / 100;
            el.style.height = `${o.h}%`;
        }
    }
    function readLines(tx) {
        const out = [];
        let loose = '';
        const flush = () => {
            if (loose) out.push(loose);
            loose = '';
        };
        for (const n of tx.childNodes) {
            if (n.nodeType === 3) loose += n.textContent;
            else if (n.nodeName === 'BR') flush();
            else if (n.nodeName === 'DIV' || n.nodeName === 'P') {
                flush();
                out.push('\t'.repeat(Math.min(4, +n.dataset.lv || 0)) + n.innerText.replace(/\n+$/, '').replace(/\n/g, ' '));
            } else loose += n.textContent;
        }
        flush();
        const t = out.join('\n').replace(/ /g, ' ');
        return t.trim() ? t.replace(/\n+$/, '') : '';
    }

    /* ---------- the start screen ---------- */
    function gallery() {
        deck = null;
        document.body.classList.remove('pp-office');
        const mine = decks.filter(d => d.mine);
        const shared = decks.filter(d => !d.mine);
        const card = d => {
            const [theme, title] = (d.cover || 'midnight|').split('|');
            const s = { ...blank('title'), title: title || d.title || '' };
            return `<button class="pp-card" data-id="${esc(d.id)}"><span class="pp-thumb">${slideHtml(s, 'view', K.theme(theme))}</span><b>${d.share !== 'private' ? ic('globe') : ''}${esc(d.title || 'Untitled presentation')}</b><small>${esc(ago(d.updatedAt))}${d.mine ? '' : ` · ${esc(d.ownerName)}`}</small></button>`;
        };
        const themeCard = ([k, t]) => `<button class="pp-card" data-new="${k}"><span class="pp-thumb">${slideHtml({ ...blank('title'), title: k === 'office' ? 'Blank presentation' : t.name }, 'view', t)}</span><b>${k === 'office' ? 'Blank presentation' : t.name}</b></button>`;
        root.innerHTML = `<div class="sl-home">
            <div class="ea-head"><h1>Slides</h1><label class="btn">${ic('download')}<span>Open PowerPoint file</span><input type="file" id="open" accept=".pptx" hidden></label></div>
            <div class="pp-new">${Object.entries(K.THEMES).map(themeCard).join('')}</div>
            ${mine.length ? `<h2 class="ea-sec">My presentations</h2><div class="pp-cards">${mine.map(card).join('')}</div>` : ''}
            ${shared.length ? `<h2 class="ea-sec">Shared with everyone</h2><div class="pp-cards">${shared.map(card).join('')}</div>` : ''}
            ${mine.length || shared.length ? '' : '<p class="ad-muted dw-hint">Make presentations like in PowerPoint and show them full screen. Download them as .pptx or PDF, or open a PowerPoint file to carry on here.</p>'}
        </div>`;
        $$('.pp-thumb .sl', root).forEach(x => fit(x));
        $('#open').onchange = async e => {
            const f = e.target.files[0];
            if (!f) return;
            toast('Opening…');
            try {
                const res = await fetch(`/api/docs/import?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'X-EG': '1', 'Content-Type': 'application/octet-stream' }, body: f });
                const d = await res.json();
                if (!res.ok) throw new Error(d.error || 'Couldn’t open that file');
                decks.unshift(d);
                openDeck(d.id);
            } catch (err) {
                toast(err.message, { bad: true });
            }
        };
        history.replaceState(null, '', location.pathname);
    }
    async function create(theme = 'office') {
        const d = await call('/api/docs', { method: 'POST', body: { kind: 'deck', title: '', body: { theme, slides: [blank('title')] } } });
        decks.unshift(d);
        openDeck(d.id);
    }
    async function openDeck(id) {
        if (dirty) await saveNow();
        try {
            deck = await call(`/api/docs/${id}`);
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        // presentations made before text boxes and shapes existed
        deck.body.slides = deck.body.slides.map(s => ({ ...blank(s.layout), ...s, fmt: s.fmt || {}, objs: s.objs || [], bg: s.bg || '', transition: s.transition || 'none' }));
        cur = 0;
        sel = editing = null;
        undo = [];
        redo = [];
        view = 'normal';
        history.replaceState(null, '', `${location.pathname}#${id}`);
        editor();
    }

    /* ---------- the editor ---------- */
    function editor() {
        document.body.classList.add('pp-office');
        const ro = !deck.canEdit;
        const b = (cmd, icon, label, extra = '') => `<button class="rb-btn" data-cmd="${cmd}" title="${label}" aria-label="${label}" ${extra}>${/^[a-z][A-Za-z]+$/.test(icon) ? ic(icon) : icon}</button>`;
        const big = (cmd, icon, label, extra = '') => `<button class="rb-btn big" data-cmd="${cmd}" ${extra}>${ic(icon)}<span>${label}</span></button>`;
        const group = (label, rows) => `<div class="rb-group">${rows.map(r => `<div class="rb-row">${r}</div>`).join('')}<span class="rb-label">${label}</span></div>`;
        const notesOn = store('eg-slides-notes') !== '0';
        root.innerHTML = `<div class="pp${notesOn ? '' : ' no-notes'}">
            <div class="of-title">
                <button class="icon-btn" id="home" title="All presentations" aria-label="All presentations">${ic('left')}</button>
                <span class="of-app pp-app">${ic('slide')}</span>
                <input class="of-name" id="name" value="${esc(deck.title)}" placeholder="Untitled presentation" ${ro ? 'readonly' : ''} aria-label="Presentation name">
                <span class="nt-saved" id="saved"></span><span class="spacer"></span>
                ${deck.mine ? '<select class="input of-share" id="share" aria-label="Who can see it"><option value="private">Only me</option><option value="view">Everyone can watch</option><option value="edit">Everyone can edit</option></select>' : ''}
                <button class="btn pp-present" id="present" title="From current slide (Shift F5)">${ic('play')}<span>Present</span></button>
                <button class="btn of-dl" id="download">${ic('download')}<span>Download</span></button>
                <button class="icon-btn" id="more" aria-label="More">${ic('more')}</button>
            </div>
            ${ro ? `<div class="of-ro">${ic('eye')} Read only · by ${esc(deck.ownerName)}. Make a copy to change it.</div>` : `
            <nav class="rb-tabs" role="tablist">${[['home', 'Home'], ['insert', 'Insert'], ['design', 'Design'], ['transitions', 'Transitions'], ['show', 'Slide Show']].map(([k, l], i) => `<button data-tab="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</nav>
            <div class="rb" data-pane="home">
                ${group('Undo', [b('undo', 'undo', 'Undo (Ctrl Z)') + b('redo', 'redo', 'Redo (Ctrl Y)')])}
                ${group('Slides', [`<button class="rb-btn big" data-pop="new">${ic('slide')}<span>New Slide ▾</span></button><div class="pp-col">${b('layout', 'layout', 'Layout', 'data-pop="layout"')}${b('dup', 'copy', 'Duplicate slide (Ctrl D)')}${b('delslide', 'trash', 'Delete slide')}</div>`])}
                ${group('Font', [`<select class="rb-select pp-font" id="font" aria-label="Font"><option value="">Theme font</option>${K.FONTS.map(f => `<option style="font-family:${esc(K.fontCss(f))}">${f}</option>`).join('')}</select><select class="rb-select pp-size" id="size" aria-label="Font size">${SIZES.map(s => `<option>${s}</option>`).join('')}</select>${b('grow', 'A<sup>+</sup>', 'Bigger text')}${b('shrink', 'A<sup>−</sup>', 'Smaller text')}`,
                    b('b', 'bold', 'Bold (Ctrl B)') + b('i', 'italic', 'Italic (Ctrl I)') + b('u', 'underline', 'Underline (Ctrl U)') + `<button class="rb-btn rb-color" data-pop="color" title="Font colour" aria-label="Font colour">A<i id="sw-color"></i></button>` + b('plain', 'eraser', 'Clear formatting')])}
                ${group('Paragraph', [b('bullets', 'list', 'Bullets') + b('outdent', 'outdent', 'Decrease list level (Shift Tab)') + b('indent', 'indent', 'Increase list level (Tab)'), b('left', 'alignLeft', 'Align left') + b('center', 'alignCenter', 'Center') + b('right', 'alignRight', 'Align right')])}
                ${group('Drawing', [`<button class="rb-btn" data-pop="fill" title="Shape fill" aria-label="Shape fill">${ic('bucket')}</button><button class="rb-btn" data-pop="line" title="Shape outline" aria-label="Shape outline">${ic('outline')}</button>`, b('front', 'front', 'Bring forward') + b('back', 'back', 'Send backward')])}
            </div>
            <div class="rb" data-pane="insert" hidden>
                ${group('Slides', [`<button class="rb-btn big" data-pop="new">${ic('slide')}<span>New Slide ▾</span></button>`])}
                ${group('Images', [big('picture', 'image', 'Pictures')])}
                ${group('Illustrations', [`<button class="rb-btn big" data-pop="shapes">${ic('shapes')}<span>Shapes ▾</span></button>`])}
                ${group('Text', [big('textbox', 'textbox', 'Text Box') + big('date', 'calendar', 'Date')])}
            </div>
            <div class="rb" data-pane="design" hidden>
                <div class="rb-group"><div class="rb-row pp-themes">${Object.entries(K.THEMES).map(([k, t]) => `<button class="pp-theme" data-skin="${k}" title="${t.name}"><span>${slideHtml({ ...blank('title'), title: 'Aa' }, 'view', t)}</span></button>`).join('')}</div><span class="rb-label">Themes</span></div>
                ${group('Customize', [`<button class="rb-btn big" data-pop="bg">${ic('palette')}<span>Format Background ▾</span></button>`])}
            </div>
            <div class="rb" data-pane="transitions" hidden>
                <div class="rb-group"><div class="rb-row">${Object.entries(K.TRANSITIONS).map(([k, l]) => `<button class="rb-btn big pp-tr" data-tr="${k}">${ic(k === 'none' ? 'x' : 'transition')}<span>${l}</span></button>`).join('')}</div><span class="rb-label">Transition to this slide</span></div>
                ${group('Timing', [big('trall', 'copy', 'Apply To All') + big('preview', 'play', 'Preview')])}
            </div>
            <div class="rb" data-pane="show" hidden>
                ${group('Start Slide Show', [big('fromstart', 'play', 'From Beginning') + big('fromhere', 'slide', 'From Current Slide')])}
            </div>`}
            <div class="pp-main" id="main">
                <ol class="pp-strip" id="strip" tabindex="0" aria-label="Slides"></ol>
                <div class="pp-work">
                    <div class="pp-stage" id="stage"><div class="pp-canvas" id="canvas"></div><div class="pp-guide v" hidden></div><div class="pp-guide h" hidden></div></div>
                    <textarea class="pp-notes" id="notes" placeholder="Click to add notes" ${ro ? 'readonly' : ''} aria-label="Speaker notes"></textarea>
                </div>
                <div class="pp-sorter" id="sorter" hidden></div>
            </div>
            <div class="dw-status pp-status"><span id="count"></span><span class="spacer"></span>
                <button class="pp-sbtn" id="notesBtn" title="Notes">${ic('notes')}<span>Notes</span></button>
                <button class="pp-sbtn" id="normalBtn" title="Normal">${ic('slide')}</button>
                <button class="pp-sbtn" id="sorterBtn" title="Slide Sorter">${ic('grid')}</button>
                <button class="pp-sbtn" id="showBtn" title="Slide Show (F5)">${ic('play')}</button></div>
            <input type="file" id="pic" accept="image/*" hidden>
        </div>`;
        if ($('#share')) $('#share').value = deck.share;
        $('#home').onclick = async () => {
            if (dirty) await saveNow();
            decks = await call('/api/docs?kind=deck');
            gallery();
        };
        $('#present').onclick = () => present(cur);
        $('#showBtn').onclick = () => present(cur);
        $('#download').onclick = e => downloadMenu(e.currentTarget);
        $('#more').onclick = e => moreMenu(e.currentTarget);
        $('#notesBtn').onclick = () => {
            const off = !$('.pp').classList.toggle('no-notes');
            store('eg-slides-notes', off ? '1' : '0');
            sizeCanvas();
        };
        $('#normalBtn').onclick = () => setView('normal');
        $('#sorterBtn').onclick = () => setView('sorter');
        $('#name').addEventListener('input', () => changed());
        $('#share') && ($('#share').onchange = async e => {
            const r = await call(`/api/docs/${deck.id}`, { method: 'PATCH', body: { share: e.target.value } });
            deck.share = r.share;
            toast(r.share === 'private' ? 'Only you can see it' : r.share === 'edit' ? 'Everyone can watch and edit it' : 'Everyone on EderveenGroup can watch it');
        });
        new ResizeObserver(sizeCanvas).observe($('#stage'));
        drawAll();
        if (ro) return;
        $$('.rb-tabs [data-tab]').forEach(t =>
            t.addEventListener('click', () => {
                $$('.rb-tabs [data-tab]').forEach(x => x.classList.toggle('on', x === t));
                $$('.rb[data-pane]').forEach(p => (p.hidden = p.dataset.pane !== t.dataset.tab));
            })
        );
        // the ribbon never takes the cursor out of the text
        $$('.rb').forEach(r => r.addEventListener('mousedown', e => e.target.closest('.rb-btn, .pp-theme') && e.preventDefault()));
        $$('.rb').forEach(r => r.addEventListener('click', ribbon));
        $('#font').onchange = e => setLook({ font: e.target.value || null });
        $('#size').onchange = e => setLook({ size: +e.target.value });
        $('#notes').addEventListener('focus', () => (area = 'notes'));
        $('#notes').addEventListener('input', e => {
            typing();
            slide().notes = e.target.value;
            changed();
        });
        $('#pic').addEventListener('change', async e => {
            const f = e.target.files[0];
            e.target.value = '';
            if (f) addPicture(f, $('#pic').dataset.to);
        });
    }
    function setView(v) {
        view = v;
        $('#main').classList.toggle('sorting', v === 'sorter');
        $('#sorter').hidden = v !== 'sorter';
        $('#normalBtn').classList.toggle('on', v === 'normal');
        $('#sorterBtn').classList.toggle('on', v === 'sorter');
        if (v === 'sorter') drawSorter();
        else drawAll();
    }
    function sizeCanvas() {
        const st = $('#stage');
        const c = $('#canvas');
        if (!st || !c) return;
        const pad = phone() ? 8 : 28;
        const w = Math.max(160, Math.min(st.clientWidth - pad * 2, ((st.clientHeight - pad * 2) * 16) / 9));
        c.style.width = `${Math.floor(w)}px`;
        requestAnimationFrame(() => fit($('#canvas')));
    }
    function drawAll() {
        drawStrip();
        drawSlide();
        $('#normalBtn')?.classList.toggle('on', view === 'normal');
    }
    function drawStrip() {
        const ro = !deck.canEdit;
        $('#strip').innerHTML = deck.body.slides.map((s, i) => `<li class="pp-mini${i === cur ? ' on' : ''}" data-i="${i}" draggable="${ro ? 'false' : 'true'}"><span class="pp-n">${i + 1}${s.transition !== 'none' ? `<i title="${K.TRANSITIONS[s.transition]}">★</i>` : ''}</span><span class="pp-thumb">${slideHtml(s, 'view')}</span></li>`).join('');
        requestAnimationFrame(() => $$('#strip .sl').forEach(x => fit(x)));
        $('#count').textContent = `Slide ${cur + 1} of ${deck.body.slides.length}`;
    }
    function drawMini(i = cur) {
        const m = $(`#strip .pp-mini[data-i="${i}"] .pp-thumb`);
        if (!m) return;
        m.innerHTML = slideHtml(deck.body.slides[i], 'view');
        fit(m);
    }
    const drawMiniSoon = debounce(() => deck && drawMini(), 250);
    function drawSlide() {
        if (!deck) return;
        cur = Math.max(0, Math.min(cur, deck.body.slides.length - 1));
        const s = slide();
        if (sel && !s.objs.some(o => o.id === sel)) sel = null;
        editing = null;
        $('#canvas').innerHTML = slideHtml(s, deck.canEdit ? 'edit' : 'view');
        $('#notes').value = s.notes || '';
        $$('#strip .pp-mini').forEach(m => m.classList.toggle('on', +m.dataset.i === cur));
        $('#strip .pp-mini.on')?.scrollIntoView({ block: 'nearest' });
        $('#count').textContent = `Slide ${cur + 1} of ${deck.body.slides.length}`;
        if (!K.boxes(s).some(b => b.f === field)) field = (K.boxes(s).find(b => b.f) || {}).f || 'title';
        sizeCanvas();
        syncRibbon();
    }
    function drawSorter() {
        $('#sorter').innerHTML = `<div class="pp-sort">${deck.body.slides.map((s, i) => `<div class="pp-mini${i === cur ? ' on' : ''}" data-i="${i}" draggable="${deck.canEdit}"><span class="pp-thumb">${slideHtml(s, 'view')}</span><span class="pp-n">${i + 1}</span></div>`).join('')}</div>`;
        requestAnimationFrame(() => $$('#sorter .sl').forEach(x => fit(x)));
    }
    function go(i) {
        if (!deck.body.slides[i]) return;
        cur = i;
        sel = null;
        drawSlide();
    }

    /* ---------- undo ---------- */
    let typed = false;
    function remember() {
        undo.push(JSON.stringify({ body: deck.body, cur }));
        if (undo.length > 80) undo.shift();
        redo = [];
    }
    // typing counts as one step per text box
    function typing() {
        if (typed) return;
        typed = true;
        remember();
    }
    function step(from, to) {
        if (!from.length) return toast(from === undo ? 'Nothing to undo' : 'Nothing to redo');
        document.activeElement?.blur();
        to.push(JSON.stringify({ body: deck.body, cur }));
        const st = JSON.parse(from.pop());
        deck.body = st.body;
        cur = Math.min(st.cur, deck.body.slides.length - 1);
        sel = editing = null;
        view === 'sorter' ? drawSorter() : drawAll();
        changed();
    }

    /* ---------- the ribbon ---------- */
    function target() {
        const s = slide();
        if (sel) {
            const o = s.objs.find(x => x.id === sel);
            if (o) return o.t === 'img' ? { o, img: true } : { o, L: K.objLook(o, th()) };
        }
        const box = K.boxes(s).find(x => x.f === field);
        return box ? { f: field, box, L: K.look(box, s.fmt[field], th()) } : null;
    }
    function setLook(patch) {
        const t = target();
        if (!t || t.img) return toast('Click a placeholder, a text box or a shape first');
        remember();
        const s = slide();
        const into = t.o || (s.fmt[t.f] = s.fmt[t.f] || {});
        for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === false || v === '') delete into[k];
            else into[k] = v;
        }
        repaint(t);
        changed();
    }
    // apply a new look in place, so the cursor stays where it is
    function repaint(t) {
        const s = slide();
        if (t.o) {
            const el = $(`#canvas [data-oid="${t.o.id}"]`);
            if (!el) return;
            if (t.o.t === 'img') el.setAttribute('style', pct(t.o));
            else {
                const L = K.objLook(t.o, th());
                el.setAttribute('style', pct(t.o) + textStyle(L));
                el.className = el.className.replace(/\bv-\w+/, `v-${L.v}`);
                el.querySelector('.sl-art')?.remove();
                el.insertAdjacentHTML('afterbegin', objArt(t.o, th()));
            }
        } else {
            const el = $(`#canvas [data-ph="${t.f}"]`);
            const { style, cls } = phStyle(t.box, s, th());
            if (el) {
                el.setAttribute('style', style);
                el.className = cls;
            }
        }
        fit($('#canvas'));
        drawMiniSoon();
        syncRibbon();
    }
    function syncRibbon() {
        if (!deck || !deck.canEdit || !$('#font')) return;
        const t = target();
        const L = t && t.L;
        const s = slide();
        const own = t && !t.img ? (t.o ? t.o : s.fmt[t.f] || {}) : {};
        $('#font').value = own.font || '';
        const size = L ? Math.round(L.size * 10) / 10 : '';
        if (size && ![...$('#size').options].some(o => +o.value === size)) $('#size').insertAdjacentHTML('beforeend', `<option>${size}</option>`);
        $('#size').value = size;
        const on = (cmd, v) => $$(`.rb [data-cmd="${cmd}"]`).forEach(x => x.classList.toggle('on', !!v));
        on('b', L && L.b);
        on('i', L && L.i);
        on('u', L && L.u);
        on('left', L && L.align === 'left');
        on('center', L && L.align === 'center');
        on('right', L && L.align === 'right');
        on('bullets', L && L.bullets);
        $('#sw-color').style.background = (L && L.color) || '#000';
        const obj = t && t.o && !t.img;
        $$('.rb [data-pop="fill"], .rb [data-pop="line"]').forEach(x => (x.disabled = !obj));
        $$('.rb [data-cmd="front"], .rb [data-cmd="back"]').forEach(x => (x.disabled = !(t && t.o)));
        $$('.rb [data-cmd="bullets"], .rb [data-cmd="indent"], .rb [data-cmd="outdent"]').forEach(x => (x.disabled = !(t && t.box && t.box.bullets)));
        $$('.pp-theme').forEach(x => x.classList.toggle('on', x.dataset.skin === deck.body.theme));
        $$('.pp-tr').forEach(x => x.classList.toggle('on', x.dataset.tr === s.transition));
    }
    function ribbon(e) {
        const pop = e.target.closest('[data-pop]');
        if (pop) return popover(pop.dataset.pop, pop);
        const th_ = e.target.closest('.pp-theme[data-skin]');
        if (th_) {
            remember();
            deck.body.theme = th_.dataset.skin;
            drawAll();
            return changed();
        }
        const tr = e.target.closest('[data-tr]');
        if (tr) {
            remember();
            slide().transition = tr.dataset.tr;
            drawStrip();
            syncRibbon();
            changed();
            return tr.dataset.tr !== 'none' && previewTransition();
        }
        const b = e.target.closest('[data-cmd]');
        if (!b || b.disabled) return;
        command(b.dataset.cmd);
    }
    function command(cmd) {
        const t = target();
        const s = slide();
        const L = t && t.L;
        const step2 = d => {
            const now = L ? L.size : 18;
            return d > 0 ? SIZES.find(x => x > now) || now + 8 : [...SIZES].reverse().find(x => x < now) || Math.max(6, now - 1);
        };
        const acts = {
            undo: () => step(undo, redo),
            redo: () => step(redo, undo),
            dup: duplicate,
            delslide: deleteSlide,
            b: () => setLook({ b: !(L && L.b) }),
            i: () => setLook({ i: !(L && L.i) }),
            u: () => setLook({ u: !(L && L.u) }),
            grow: () => setLook({ size: step2(1) }),
            shrink: () => setLook({ size: step2(-1) }),
            plain: () => setLook({ font: null, size: null, b: null, i: null, u: null, color: null, align: null }),
            left: () => setLook({ align: 'left' }),
            center: () => setLook({ align: 'center' }),
            right: () => setLook({ align: 'right' }),
            bullets: () => setLook({ nob: !!(L && L.bullets) }),
            indent: () => level(1),
            outdent: () => level(-1),
            front: () => arrange(1),
            back: () => arrange(-1),
            picture: () => pickPicture(''),
            textbox: () => addObject({ t: 'text', x: 25, y: 40, w: 50, h: 10, text: '' }, true),
            date: () => addObject({ t: 'text', x: 60, y: 88, w: 33, h: 8, text: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), align: 'right', size: 14 }),
            trall: () => {
                remember();
                deck.body.slides.forEach(x => (x.transition = s.transition));
                drawStrip();
                changed();
                toast(`Every slide now has “${K.TRANSITIONS[s.transition]}”`);
            },
            preview: previewTransition,
            fromstart: () => present(0),
            fromhere: () => present(cur)
        };
        acts[cmd] && acts[cmd]();
    }

    /* ---------- slides ---------- */
    function addSlide(layout) {
        remember();
        // after a title slide comes Title and Content; otherwise the same layout again
        const s = blank(layout || (slide().layout === 'title' ? 'bullets' : slide().layout));
        s.transition = slide().transition;
        deck.body.slides.splice(cur + 1, 0, s);
        cur++;
        sel = null;
        drawAll();
        changed();
        setTimeout(() => $('#canvas [data-ph="title"] .sl-tx')?.focus(), 40);
    }
    function duplicate() {
        if (sel) {
            const o = slide().objs.find(x => x.id === sel);
            if (o) return addObject({ ...JSON.parse(JSON.stringify(o)), id: uid(), x: o.x + 2, y: o.y + 3 });
        }
        remember();
        deck.body.slides.splice(cur + 1, 0, { ...JSON.parse(JSON.stringify(slide())), id: uid() });
        cur++;
        view === 'sorter' ? drawSorter() : drawAll();
        changed();
    }
    function deleteSlide(i = cur) {
        if (deck.body.slides.length === 1) return toast('A presentation needs at least one slide');
        remember();
        deck.body.slides.splice(i, 1);
        cur = Math.min(i, deck.body.slides.length - 1);
        sel = null;
        view === 'sorter' ? drawSorter() : drawAll();
        changed();
    }
    function setLayout(l) {
        remember();
        slide().layout = l;
        drawSlide();
        drawMini();
        changed();
    }
    function moveSlide(from, to) {
        if (from === to || to < 0 || to >= deck.body.slides.length) return;
        remember();
        const [s] = deck.body.slides.splice(from, 1);
        deck.body.slides.splice(to, 0, s);
        cur = to;
        view === 'sorter' ? drawSorter() : drawAll();
        changed();
    }

    /* ---------- text boxes, shapes and pictures ---------- */
    function addObject(o, edit) {
        remember();
        o.id = o.id || uid();
        slide().objs.push(o);
        sel = o.id;
        drawSlide();
        drawMini();
        changed();
        if (edit) startEdit(o.id);
    }
    function removeObject() {
        if (!sel) return;
        remember();
        slide().objs = slide().objs.filter(o => o.id !== sel);
        sel = null;
        drawSlide();
        drawMini();
        changed();
    }
    function arrange(d) {
        const objs = slide().objs;
        const i = objs.findIndex(o => o.id === sel);
        const j = i + d;
        if (i < 0 || j < 0 || j >= objs.length) return;
        remember();
        [objs[i], objs[j]] = [objs[j], objs[i]];
        drawSlide();
        drawMini();
        changed();
    }
    function level(d) {
        const s = slide();
        const ph = $(`#canvas [data-ph="${field}"]`);
        if (!ph || !ph.classList.contains('bul')) return;
        const tx = ph.querySelector('.sl-tx');
        const r = getSelection().rangeCount ? getSelection().getRangeAt(0) : null;
        let ls = [...tx.querySelectorAll('.ln')].filter(l => r && r.intersectsNode(l));
        if (!ls.length) ls = [tx.querySelector('.ln')].filter(Boolean);
        typing();
        ls.forEach(l => (l.dataset.lv = Math.max(0, Math.min(4, (+l.dataset.lv || 0) + d))));
        s[field] = readLines(tx);
        drawMiniSoon();
        changed();
    }
    function select(id) {
        if (sel === id) return;
        sel = id;
        $$('#canvas .sl-ob').forEach(x => x.classList.toggle('sel', x.dataset.oid === id));
        syncRibbon();
    }
    function startEdit(id) {
        const el = $(`#canvas [data-oid="${id}"]`);
        if (!el || el.classList.contains('img') || !deck.canEdit) return;
        select(id);
        editing = id;
        typed = false;
        el.classList.add('editing');
        const tx = el.querySelector('.sl-tx');
        if (!tx.innerHTML.trim()) tx.innerHTML = '<div class="ln" data-lv="0"><br></div>';
        tx.contentEditable = 'true';
        tx.focus();
        const r = document.createRange();
        r.selectNodeContents(tx);
        r.collapse(false);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
    }
    function stopEdit() {
        if (!editing) return;
        const el = $(`#canvas [data-oid="${editing}"]`);
        editing = null;
        if (!el) return;
        el.classList.remove('editing');
        el.querySelector('.sl-tx').removeAttribute('contenteditable');
        typed = false;
    }
    function pickPicture(to) {
        $('#pic').dataset.to = to;
        $('#pic').click();
    }
    async function addPicture(file, to) {
        const p = await shrink(file);
        if (!p) return toast('That picture couldn’t be read', { bad: true });
        const s = slide();
        if (to === 'ph' || (s.layout === 'image' && !s.image)) {
            remember();
            s.image = p.url;
            if (s.layout === 'title' || s.layout === 'statement' || s.layout === 'blank') s.layout = 'image';
            drawSlide();
            drawMini();
            return changed();
        }
        let w = 40;
        let h = (((w * K.W) / 100) * (p.h / p.w) * 100) / K.H;
        if (h > 70) {
            w *= 70 / h;
            h = 70;
        }
        addObject({ t: 'img', x: Math.round((50 - w / 2) * 100) / 100, y: Math.round((50 - h / 2) * 100) / 100, w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100, src: p.url });
    }
    function shrink(file) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * scale);
                c.height = Math.round(img.height * scale);
                const g = c.getContext('2d');
                const keepPng = file.type === 'image/png' && file.size < 600 * 1024;
                if (!keepPng) {
                    g.fillStyle = '#fff';
                    g.fillRect(0, 0, c.width, c.height);
                }
                g.drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(img.src);
                resolve({ url: keepPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height });
            };
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(file);
        });
    }

    /* ---------- on the slide: typing, clicking, dragging ---------- */
    root.addEventListener('focusin', e => {
        if (!e.target.closest('.sl-ob.editing')) typed = false;
        const ph = e.target.closest('#canvas [data-ph]');
        if (ph) {
            field = ph.dataset.ph;
            area = 'slide';
            typed = false;
            if (sel && !editing) select(null);
            syncRibbon();
        }
    });
    root.addEventListener('focusout', e => {
        const ob = e.target.closest('#canvas .sl-ob.editing');
        if (ob && !ob.contains(e.relatedTarget)) {
            stopEdit();
            if (!String((slide().objs.find(o => o.id === ob.dataset.oid) || {}).text || '').trim()) ob.classList.add('empty');
        }
        if (e.target.closest('#canvas [data-ph]')) typed = false;
    });
    root.addEventListener('input', e => {
        if (!deck || !e.target.closest('#canvas')) return;
        const ph = e.target.closest('[data-ph]');
        const ob = e.target.closest('.sl-ob');
        const tx = e.target.closest('.sl-tx');
        if (!tx) return;
        const text = readLines(tx);
        if (ph) {
            const s = slide();
            if (s[ph.dataset.ph] === text) return;
            typing(); // the step to undo to is the text as it was before typing started
            s[ph.dataset.ph] = text;
            ph.classList.toggle('empty', !text.trim());
            fit(ph.parentElement);
        } else if (ob) {
            const o = slide().objs.find(x => x.id === ob.dataset.oid);
            if (!o) return;
            typing();
            o.text = text;
            ob.classList.toggle('empty', !text.trim());
            if (o.t === 'text') grow(ob, o);
            else fit(ob.parentElement);
        }
        drawMiniSoon();
        changed();
    });
    root.addEventListener('paste', e => {
        if (!e.target.closest('#canvas .sl-tx')) return;
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
    root.addEventListener('keydown', e => {
        const tx = e.target.closest('#canvas .sl-tx');
        if (!tx) return;
        const ph = tx.closest('[data-ph]');
        if (e.key === 'Enter' && ph && ph.dataset.ph === 'title') return e.preventDefault(); // a title is one line
        if (e.key === 'Tab' && ph && ph.classList.contains('bul')) {
            e.preventDefault();
            return level(e.shiftKey ? -1 : 1);
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            const ob = tx.closest('.sl-ob');
            tx.blur();
            if (ob) select(ob.dataset.oid);
        }
        if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
            e.preventDefault();
            command(e.key.toLowerCase());
        }
    });
    // pick up, move and resize, with a snap to the middle of the slide
    let drag = null;
    root.addEventListener('pointerdown', e => {
        if (!deck || !deck.canEdit || e.button) return;
        const canvas = e.target.closest('#canvas');
        if (!canvas) return;
        if (e.target.closest('[data-pick], [data-unpick]')) return;
        const hd = e.target.closest('.hd');
        const ob = e.target.closest('.sl-ob');
        area = 'slide';
        if (!ob) {
            if (sel) {
                stopEdit();
                select(null);
            }
            return;
        }
        if (ob.classList.contains('editing') && !hd) return; // clicking inside text being typed
        e.preventDefault();
        if (document.activeElement && document.activeElement.closest('#canvas')) document.activeElement.blur();
        const was = sel === ob.dataset.oid;
        select(ob.dataset.oid);
        const o = slide().objs.find(x => x.id === ob.dataset.oid);
        const rect = canvas.firstElementChild.getBoundingClientRect();
        drag = { o, el: ob, hd: hd && hd.dataset.h, sx: e.clientX, sy: e.clientY, start: { ...o }, rect, moved: false, was };
        ob.setPointerCapture(e.pointerId);
    });
    root.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = ((e.clientX - drag.sx) / drag.rect.width) * 100;
        const dy = ((e.clientY - drag.sy) / drag.rect.height) * 100;
        if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 4) return;
        if (!drag.moved) {
            drag.moved = true;
            remember();
        }
        const { o, start: s0 } = drag;
        const snapV = $('.pp-guide.v');
        const snapH = $('.pp-guide.h');
        if (!drag.hd) {
            o.x = s0.x + dx;
            o.y = s0.y + dy;
            const cx = o.x + o.w / 2;
            const cy = o.y + o.h / 2;
            snapV.hidden = Math.abs(cx - 50) > 1.2 || e.altKey;
            snapH.hidden = Math.abs(cy - 50) > 1.6 || e.altKey;
            if (!snapV.hidden) o.x = 50 - o.w / 2;
            if (!snapH.hidden) o.y = 50 - o.h / 2;
            placeGuides();
        } else {
            const h = drag.hd;
            let { x, y, w, h: hh } = s0;
            if (h.includes('e')) w = s0.w + dx;
            if (h.includes('s')) hh = s0.h + dy;
            if (h.includes('w')) {
                w = s0.w - dx;
                x = s0.x + dx;
            }
            if (h.includes('n')) {
                hh = s0.h - dy;
                y = s0.y + dy;
            }
            // pictures keep their shape from the corners (or anything, with Shift)
            if (h.length === 2 && (o.t === 'img' || e.shiftKey)) {
                const ratio = s0.h / s0.w;
                if (Math.abs(dx) > Math.abs(dy)) hh = w * ratio;
                else w = hh / ratio;
                if (h.includes('n')) y = s0.y + s0.h - hh;
                if (h.includes('w')) x = s0.x + s0.w - w;
            }
            if (w < 1.5) {
                if (h.includes('w')) x -= 1.5 - w;
                w = 1.5;
            }
            if (hh < 1.5) {
                if (h.includes('n')) y -= 1.5 - hh;
                hh = 1.5;
            }
            Object.assign(o, { x, y, w, h: hh });
        }
        for (const k of ['x', 'y', 'w', 'h']) o[k] = Math.round(o[k] * 100) / 100;
        drag.el.style.left = `${o.x}%`;
        drag.el.style.top = `${o.y}%`;
        drag.el.style.width = `${o.w}%`;
        drag.el.style.height = `${o.h}%`;
        if (drag.hd && o.t !== 'img' && o.t !== 'text') fit(drag.el.parentElement);
    });
    function placeGuides() {
        const c = $('#canvas').getBoundingClientRect();
        const st = $('#stage').getBoundingClientRect();
        Object.assign($('.pp-guide.v').style, { left: `${c.left - st.left + c.width / 2}px`, top: `${c.top - st.top}px`, height: `${c.height}px` });
        Object.assign($('.pp-guide.h').style, { top: `${c.top - st.top + c.height / 2}px`, left: `${c.left - st.left}px`, width: `${c.width}px` });
    }
    function endDrag() {
        if (!drag) return;
        const d = drag;
        drag = null;
        $$('.pp-guide').forEach(g => (g.hidden = true));
        if (d.moved) {
            if (d.o.t === 'text') grow(d.el, d.o);
            drawMini();
            changed();
        } else if ((d.was || d.o.t === 'text') && d.o.t !== 'img') startEdit(d.o.id); // click in a text box (or a shape again) to type
    }
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);
    root.addEventListener('dblclick', e => {
        const ob = e.target.closest('#canvas .sl-ob');
        if (ob && !ob.classList.contains('img') && !ob.classList.contains('editing')) startEdit(ob.dataset.oid);
    });
    root.addEventListener('click', e => {
        if (!deck) {
            const c = e.target.closest('.pp-card');
            if (c && c.dataset.new) create(c.dataset.new);
            else if (c) openDeck(c.dataset.id);
            return;
        }
        if (e.target.closest('#canvas [data-pick]')) return pickPicture('ph');
        if (e.target.closest('#canvas [data-unpick]')) {
            remember();
            slide().image = '';
            drawSlide();
            drawMini();
            return changed();
        }
        const mini = e.target.closest('#strip .pp-mini, #sorter .pp-mini');
        if (mini) {
            area = 'strip';
            if (view === 'sorter') {
                cur = +mini.dataset.i;
                return $$('#sorter .pp-mini').forEach(m => m.classList.toggle('on', m === mini));
            }
            stopEdit();
            go(+mini.dataset.i);
            $('#strip').focus({ preventScroll: true });
        }
    });
    root.addEventListener('dblclick', e => {
        const mini = e.target.closest('#sorter .pp-mini');
        if (mini) {
            cur = +mini.dataset.i;
            setView('normal');
        }
    });
    root.addEventListener('contextmenu', e => {
        const mini = e.target.closest('#strip .pp-mini, #sorter .pp-mini');
        if (!mini || !deck.canEdit) return;
        e.preventDefault();
        cur = +mini.dataset.i;
        view === 'sorter' ? drawSorter() : drawSlide();
        menu({ getBoundingClientRect: () => ({ bottom: e.clientY, right: e.clientX + 220 }) }, [
            ['slide', 'New Slide', () => addSlide()],
            ['copy', 'Duplicate Slide', duplicate],
            ['trash', 'Delete Slide', () => deleteSlide(), true]
        ]);
    });
    // drag a slide in the slide pane (or the sorter) to move it
    let dragFrom = null;
    root.addEventListener('dragstart', e => {
        const m = e.target.closest('.pp-mini');
        if (m) dragFrom = +m.dataset.i;
    });
    root.addEventListener('dragover', e => e.target.closest('.pp-mini') && dragFrom != null && e.preventDefault());
    root.addEventListener('drop', e => {
        const m = e.target.closest('.pp-mini');
        if (!m || dragFrom == null) return;
        e.preventDefault();
        const from = dragFrom;
        dragFrom = null;
        moveSlide(from, +m.dataset.i);
    });

    // the keyboard, like PowerPoint
    addEventListener('keydown', e => {
        if (!deck || $('.pp-show')) return;
        const mod = e.ctrlKey || e.metaKey;
        if (e.key === 'F5') {
            e.preventDefault();
            return present(e.shiftKey ? cur : 0);
        }
        if (mod && e.key.toLowerCase() === 's') {
            e.preventDefault();
            return saveNow();
        }
        const t = e.target;
        if (t.closest && (t.closest('[contenteditable="true"]') || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        if (!deck.canEdit) {
            if (['ArrowDown', 'PageDown'].includes(e.key)) go(cur + 1);
            if (['ArrowUp', 'PageUp'].includes(e.key)) go(cur - 1);
            return;
        }
        const k = e.key.toLowerCase();
        if (mod && k === 'z') return (e.preventDefault(), step(undo, redo));
        if (mod && k === 'y') return (e.preventDefault(), step(redo, undo));
        if (mod && k === 'm') return (e.preventDefault(), addSlide());
        if (mod && k === 'd') return (e.preventDefault(), duplicate());
        if (mod && k === 'c') {
            const o = sel && slide().objs.find(x => x.id === sel);
            clip = o ? { obj: JSON.parse(JSON.stringify(o)) } : area === 'strip' ? { slide: JSON.parse(JSON.stringify(slide())) } : clip;
            return;
        }
        if (mod && k === 'x' && sel) {
            const o = slide().objs.find(x => x.id === sel);
            clip = { obj: JSON.parse(JSON.stringify(o)) };
            return removeObject();
        }
        if (mod && k === 'v' && clip) {
            e.preventDefault();
            if (clip.obj) return addObject({ ...JSON.parse(JSON.stringify(clip.obj)), id: uid(), x: clip.obj.x + 2, y: clip.obj.y + 3 });
            remember();
            deck.body.slides.splice(cur + 1, 0, { ...JSON.parse(JSON.stringify(clip.slide)), id: uid() });
            cur++;
            drawAll();
            return changed();
        }
        if (sel) {
            const o = slide().objs.find(x => x.id === sel);
            if (!o) return;
            if (e.key === 'Delete' || e.key === 'Backspace') return (e.preventDefault(), removeObject());
            if (e.key === 'Escape') return select(null);
            if (e.key === 'Enter' && o.t !== 'img') return (e.preventDefault(), startEdit(o.id));
            const n = e.shiftKey ? 2 : 0.5;
            const mv = { ArrowLeft: [-n, 0], ArrowRight: [n, 0], ArrowUp: [0, -n], ArrowDown: [0, n] }[e.key];
            if (mv) {
                e.preventDefault();
                remember();
                o.x = Math.round((o.x + mv[0]) * 100) / 100;
                o.y = Math.round((o.y + mv[1] * 1.78) * 100) / 100;
                repaint({ o });
                return changed();
            }
            return;
        }
        if (area === 'strip' || view === 'sorter') {
            if (e.key === 'Delete' || e.key === 'Backspace') return (e.preventDefault(), deleteSlide());
            if (e.key === 'Enter' && view === 'normal') return (e.preventDefault(), addSlide());
        }
        if (['ArrowDown', 'PageDown', 'ArrowRight'].includes(e.key) && (area === 'strip' || view === 'sorter' || e.key.startsWith('Page'))) {
            e.preventDefault();
            view === 'sorter' ? ((cur = Math.min(cur + 1, deck.body.slides.length - 1)), drawSorter()) : go(cur + 1);
        }
        if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key) && (area === 'strip' || view === 'sorter' || e.key.startsWith('Page'))) {
            e.preventDefault();
            view === 'sorter' ? ((cur = Math.max(cur - 1, 0)), drawSorter()) : go(cur - 1);
        }
    });

    /* ---------- pop-overs: layouts, colours, shapes, backgrounds ---------- */
    function popover(kind, anchor) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        const swatches = (none, custom) => `<div class="rb-swatches">${COLORS.map(c => `<button data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}${none ? `<button data-c="none" class="none" title="${none}"></button>` : ''}</div><label class="pp-custom">${ic('palette')}<span>${custom || 'More colours'}</span><input type="color" data-custom></label>`;
        const s = slide();
        if (kind === 'new' || kind === 'layout') {
            pop.classList.add('pp-layouts');
            pop.innerHTML = `<p>${kind === 'new' ? 'New slide' : 'Layout'}</p><div>${Object.entries(K.LAYOUTS).map(([k, l]) => `<button data-l="${k}" class="${kind === 'layout' && s.layout === k ? 'on' : ''}"><span>${slideHtml({ ...blank(k) }, 'layout')}</span><small>${l.name}</small></button>`).join('')}</div>`;
        } else if (kind === 'shapes') {
            pop.classList.add('pp-shapes');
            pop.innerHTML = `<p>Shapes</p><div>${Object.entries(K.SHAPES).map(([k, sh]) => `<button data-shape="${k}" title="${sh.name}">${sh.poly ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="${sh.poly.map(p => p.join(',')).join(' ')}"/></svg>` : `<i class="${k}"></i>`}</button>`).join('')}</div>`;
        } else if (kind === 'color') pop.innerHTML = swatches('', 'More colours');
        else if (kind === 'fill') pop.innerHTML = swatches('No fill');
        else if (kind === 'line') pop.innerHTML = swatches('No outline');
        else if (kind === 'bg') pop.innerHTML = `<p>Background of this slide</p>${swatches('')}<div class="pp-pop-acts"><button data-bg="reset">Theme background</button><button data-bg="all">Apply to all</button></div>`;
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${r.bottom + 4}px`;
        pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left))}px`;
        const close = () => (pop.remove(), removeEventListener('pointerdown', off, true));
        const off = e => !pop.contains(e.target) && close();
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('mousedown', e => !e.target.closest('input') && e.preventDefault());
        const colour = c => {
            if (kind === 'color') setLook({ color: c === 'none' ? null : c });
            else if (kind === 'fill' || kind === 'line') {
                const t = target();
                if (!t || !t.o) return;
                remember();
                t.o[kind] = c;
                repaint(t);
                changed();
            } else if (kind === 'bg') {
                remember();
                s.bg = c;
                drawSlide();
                drawMini();
                changed();
            }
        };
        pop.addEventListener('input', e => e.target.matches('[data-custom]') && colour(e.target.value));
        pop.addEventListener('click', e => {
            const l = e.target.closest('[data-l]');
            if (l) {
                close();
                return kind === 'new' ? addSlide(l.dataset.l) : setLayout(l.dataset.l);
            }
            const sh = e.target.closest('[data-shape]');
            if (sh) {
                close();
                return addObject({ t: sh.dataset.shape, x: 41, y: 34, w: 18, h: sh.dataset.shape === 'arrow' ? 18 : 32, text: '' });
            }
            const c = e.target.closest('[data-c]');
            if (c) {
                colour(c.dataset.c);
                return close();
            }
            const bg = e.target.closest('[data-bg]');
            if (bg) {
                remember();
                if (bg.dataset.bg === 'reset') s.bg = '';
                else deck.body.slides.forEach(x => (x.bg = s.bg));
                drawAll();
                changed();
                close();
            }
        });
    }
    function menu(anchor, items) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        pop.innerHTML = items.map(([icon, label, , danger], i) => `<button data-i="${i}" class="${danger ? 'danger' : ''}">${ic(icon)}<span>${label}</span></button>`).join('');
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${Math.min(r.bottom + 4, innerHeight - pop.offsetHeight - 8)}px`;
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
    async function downloadMenu(anchor) {
        if (dirty) await saveNow();
        menu(anchor, [
            ['slide', 'PowerPoint (.pptx)', () => (location.href = `/api/docs/${deck.id}/export?format=pptx`)],
            ['file', 'PDF (.pdf)', () => (location.href = `/api/docs/${deck.id}/export?format=pdf`)]
        ]);
    }
    function moreMenu(anchor) {
        menu(anchor, [
            ['copy', 'Make a copy', async () => {
                if (dirty) await saveNow();
                const c = await call(`/api/docs/${deck.id}/copy`, { method: 'POST', body: {} });
                decks.unshift(c);
                openDeck(c.id);
                toast('A copy of your own');
            }],
            ['file', 'Print', () => {
                const sheet = document.createElement('div');
                sheet.className = 'pp-print';
                sheet.innerHTML = deck.body.slides.map(s => `<div class="pp-page">${slideHtml(s, 'view')}</div>`).join('');
                document.body.append(sheet);
                $$('.sl', sheet).forEach(x => fit(x));
                print();
                sheet.remove();
            }],
            ...(deck.mine ? [['trash', 'Delete', async () => {
                if (!(await ask({ title: 'Delete this presentation?', text: deck.share !== 'private' ? 'Everyone it’s shared with loses it too. This can’t be undone.' : 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
                await call(`/api/docs/${deck.id}`, { method: 'DELETE' });
                dirty = false;
                decks = decks.filter(x => x.id !== deck.id);
                gallery();
            }, true]] : [])
        ]);
    }

    /* ---------- saving ---------- */
    function changed() {
        if (!deck || !deck.canEdit) return;
        dirty = true;
        $('#saved') && ($('#saved').textContent = 'Saving…');
        save();
    }
    async function saveNow() {
        if (!deck || !dirty) return;
        dirty = false;
        const d = deck;
        d.title = $('#name') ? $('#name').value.trim() : d.title;
        // until it's given a name, a presentation is called after its first slide
        const first = String(d.body.slides[0].title || '').trim();
        if (!d.title && first && $('#name') && document.activeElement !== $('#name')) {
            d.title = first.slice(0, 160);
            $('#name').value = d.title;
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

    /* ---------- the slide show ---------- */
    function previewTransition() {
        const c = $('#canvas .sl');
        const t = slide().transition;
        if (!c || t === 'none') return;
        c.classList.remove(`in-${t}`);
        void c.offsetWidth;
        c.classList.add(`in-${t}`);
        setTimeout(() => c.classList.remove(`in-${t}`), 800);
    }
    function present(start) {
        if (document.activeElement) document.activeElement.blur();
        const slides = deck.body.slides;
        let i = Math.max(0, Math.min(start, slides.length - 1));
        let typedNo = '';
        let over = false;
        const v = document.createElement('div');
        v.className = 'pp-show';
        v.innerHTML = '<div class="pp-show-stage"></div><div class="pp-show-cover"></div><div class="pp-show-ctl"><button data-go="-1" aria-label="Previous">‹</button><span></span><button data-go="1" aria-label="Next">›</button><button data-end>End show</button></div>';
        document.body.append(v);
        const stage = v.firstElementChild;
        const show = (anim = 0) => {
            const old = stage.lastElementChild;
            const f = document.createElement('div');
            f.className = 'pp-frame';
            f.innerHTML = over ? '<div class="pp-end">End of slide show, click to exit.</div>' : slideHtml(slides[i], 'view');
            stage.append(f);
            if (!over) fit(f);
            const t = !over && anim > 0 ? slides[i].transition : 'none';
            if (t !== 'none') {
                f.firstElementChild.classList.add(`in-${t}`);
                if (old) old.classList.add(`out-${t}`);
                setTimeout(() => old && old.remove(), 700);
            } else if (old) old.remove();
            $('.pp-show-ctl span', v).textContent = over ? '' : `${i + 1} / ${slides.length}`;
        };
        const go = d => {
            if (over) {
                if (d > 0) return end();
                over = false;
                return show();
            }
            if (i + d >= slides.length) {
                over = true;
                return show();
            }
            const n = Math.max(0, Math.min(slides.length - 1, i + d));
            if (n === i) return;
            i = n;
            show(d);
        };
        const cover = cls => {
            const c = $('.pp-show-cover', v);
            c.className = c.classList.contains(cls) ? 'pp-show-cover' : `pp-show-cover ${cls}`;
        };
        function end() {
            removeEventListener('keydown', onKey, true);
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            v.remove();
            if (!over) cur = i;
            if ($('#canvas')) {
                view = 'normal';
                setView('normal');
            }
        }
        function onKey(e) {
            e.stopPropagation();
            const k = e.key;
            if (/^[0-9]$/.test(k)) return void (typedNo += k);
            if (k === 'Enter' && typedNo) {
                e.preventDefault();
                over = false;
                i = Math.max(0, Math.min(slides.length - 1, +typedNo - 1));
                typedNo = '';
                return show();
            }
            typedNo = '';
            if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(k)) (e.preventDefault(), go(1));
            else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(k)) (e.preventDefault(), go(-1));
            else if (k === 'Home') ((over = false), (i = 0), show());
            else if (k === 'End') ((over = false), (i = slides.length - 1), show());
            else if (k === 'b' || k === 'B' || k === '.') cover('black');
            else if (k === 'w' || k === 'W' || k === ',') cover('white');
            else if (k === 'Escape' || k === '-') (e.preventDefault(), end());
        }
        addEventListener('keydown', onKey, true);
        let sx = null;
        v.addEventListener('pointerdown', e => (sx = e.clientX));
        v.addEventListener('pointerup', e => {
            if (e.target.closest('.pp-show-ctl')) return;
            if ($('.pp-show-cover', v).className !== 'pp-show-cover') return cover('none');
            const dx = sx == null ? 0 : e.clientX - sx;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            else go(e.clientX < innerWidth / 4 ? -1 : 1);
        });
        v.addEventListener('click', e => {
            const b = e.target.closest('[data-go]');
            if (b) go(+b.dataset.go);
            if (e.target.closest('[data-end]')) end();
        });
        // the controls show up when the mouse moves, then hide again
        let idle;
        v.addEventListener('pointermove', () => {
            v.classList.add('awake');
            clearTimeout(idle);
            idle = setTimeout(() => v.classList.remove('awake'), 2200);
        });
        document.addEventListener('fullscreenchange', () => !document.fullscreenElement && v.isConnected && end(), { once: true });
        if (v.requestFullscreen && !phone()) v.requestFullscreen().catch(() => {});
        show();
    }

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
