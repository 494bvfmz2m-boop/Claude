// Docs: a Word-like editor on a real page, saved as you type; download as .docx or PDF.
// Private, or shared with everyone (to read or to edit): shared docs are the knowledge base.
(function () {
    const { $, $$, esc, ic, call, toast, ask, debounce, ago } = window.EG;
    const root = $('#docs');
    let list = [];
    let open = null; // { id, title, body: { html, page }, canEdit, mine, share, version, … }
    let dirty = false;
    let zoom = Number(read('doc-zoom')) || 1;

    function read(k) {
        try {
            return localStorage.getItem(k);
        } catch {
            return null;
        }
    }
    function write(k, v) {
        try {
            localStorage.setItem(k, v);
        } catch {
            // private mode
        }
    }

    /* ---------- the start screen ---------- */
    function gallery() {
        open = null;
        document.body.classList.remove('dc-office');
        const mine = list.filter(d => d.mine);
        const shared = list.filter(d => !d.mine);
        const card = d => `<button class="dw-card" data-id="${esc(d.id)}"><span class="dw-thumb"><span class="dw-mini"><b>${esc(d.title || 'Untitled document')}</b><i></i><i></i><i class="s"></i><i></i><i class="s"></i></span></span><b>${d.share !== 'private' ? ic('globe') : ''}${esc(d.title || 'Untitled document')}</b><small>${esc(ago(d.updatedAt))}${d.mine ? (d.share === 'private' ? '' : d.share === 'edit' ? ' · everyone can edit' : ' · everyone can read') : ` · ${esc(d.ownerName)}`}</small></button>`;
        root.innerHTML = `<div class="sl-home">
            <div class="ea-head"><h1>Docs</h1><label class="btn">${ic('download')}<span>Open Word file</span><input type="file" id="open" accept=".docx" hidden></label></div>
            <div class="dw-new"><button class="dw-card" id="new"><span class="dw-thumb blank">${ic('plus')}</span><b>Blank document</b><small>Start writing</small></button></div>
            ${mine.length ? `<h2 class="ea-sec">My documents</h2><div class="dw-cards">${mine.map(card).join('')}</div>` : ''}
            ${shared.length ? `<h2 class="ea-sec">Shared with everyone</h2><div class="dw-cards">${shared.map(card).join('')}</div>` : ''}
            ${mine.length || shared.length ? '' : `<p class="ad-muted dw-hint">Write letters, plans and guides like in Word, and download them as .docx or PDF. Share a doc with everyone and it becomes part of your knowledge base.</p>`}
        </div>`;
        $('#new').onclick = create;
        $('#open').onchange = async e => {
            const f = e.target.files[0];
            if (!f) return;
            try {
                const res = await fetch(`/api/docs/import?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'X-EG': '1', 'Content-Type': 'application/octet-stream' }, body: f });
                const d = await res.json();
                if (!res.ok) throw new Error(d.error || 'Couldn’t open that file');
                list.unshift(d);
                select(d.id);
            } catch (err) {
                toast(err.message, { bad: true });
            }
        };
        history.replaceState(null, '', location.pathname);
    }
    async function create() {
        const d = await call('/api/docs', { method: 'POST', body: { kind: 'doc', title: '' } });
        list.unshift(d);
        await select(d.id);
        $('#t').focus();
    }
    async function select(id) {
        if (dirty) await saveNow();
        try {
            open = await call(`/api/docs/${id}`);
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        history.replaceState(null, '', `${location.pathname}#${id}`);
        editor();
    }

    /* ---------- the editor ---------- */
    const FONTS = ['Calibri', 'Aptos', 'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Garamond', 'Courier New', 'Comic Sans MS'];
    const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
    const COLORS = ['#000000', '#595959', '#c00000', '#e46c0a', '#bf8f00', '#2e7d32', '#1f5fbf', '#7030a0', '#ffffff'];
    const MARKS = ['#fff59d', '#c8f7c5', '#bde0fe', '#ffc9de', '#ffd8a8', '#e0e0e0', ''];
    const PAGES = { A4: [794, 1123], Letter: [816, 1056] };
    const MARGIN = { normal: [96, 96], narrow: [48, 48], wide: [96, 192] }; // [top/bottom, left/right] in px
    function editor() {
        document.body.classList.add('dc-office');
        const ro = !open.canEdit;
        const b = (cmd, icon, label, extra = '') => `<button class="rb-btn" data-cmd="${cmd}" title="${label}" aria-label="${label}" ${extra}>${icon.length > 2 && !/^[A-Z]/.test(icon) ? ic(icon) : icon}</button>`;
        open.body.page = open.body.page || { size: 'A4', orient: 'portrait', margins: 'normal' };
        root.innerHTML = `<div class="dw">
            <div class="of-title">
                <button class="icon-btn" id="home" title="All documents" aria-label="All documents">${ic('left')}</button>
                <span class="of-app dw-app">${ic('file')}</span>
                <input class="of-name" id="name" value="${esc(open.title)}" placeholder="Untitled document" ${ro ? 'readonly' : ''} aria-label="Document name">
                <span class="nt-saved" id="saved"></span><span class="spacer"></span>
                ${open.mine ? '<select class="input of-share" id="share" aria-label="Who can see it"><option value="private">Only me</option><option value="view">Everyone can read</option><option value="edit">Everyone can edit</option></select>' : ''}
                <button class="btn of-dl" id="download">${ic('download')}<span>Download</span></button>
                <button class="icon-btn" id="more" aria-label="More">${ic('more')}</button>
            </div>
            ${ro ? `<div class="of-ro">${ic('eye')} Read only · by ${esc(open.ownerName)}. Make a copy to change it.</div>` : `
            <nav class="rb-tabs" role="tablist"><button data-tab="home" class="on">Home</button><button data-tab="insert">Insert</button><button data-tab="layout">Layout</button></nav>
            <div class="rb" data-pane="home">
                <div class="rb-group"><div class="rb-row">${b('undo', 'undo', 'Undo (Ctrl Z)')}${b('redo', 'redo', 'Redo (Ctrl Y)')}</div><span class="rb-label">Undo</span></div>
                <div class="rb-group"><div class="rb-row"><select class="rb-select dw-font" id="font" aria-label="Font">${FONTS.map(f => `<option style="font-family:'${f}'">${f}</option>`).join('')}</select><select class="rb-select dw-size" id="size" aria-label="Font size">${SIZES.map(s => `<option>${s}</option>`).join('')}</select></div>
                    <div class="rb-row">${b('bold', 'bold', 'Bold (Ctrl B)')}${b('italic', 'italic', 'Italic (Ctrl I)')}${b('underline', 'underline', 'Underline (Ctrl U)')}${b('strikeThrough', 'strike', 'Strikethrough')}${b('subscript', 'X<sub>2</sub>', 'Subscript')}${b('superscript', 'X<sup>2</sup>', 'Superscript')}
                    <button class="rb-btn rb-color" data-pop="color" title="Font colour" aria-label="Font colour">A<i id="sw-color"></i></button><button class="rb-btn rb-fill" data-pop="mark" title="Highlight" aria-label="Highlight">${ic('highlight')}<i id="sw-mark"></i></button>${b('removeFormat', 'eraser', 'Clear formatting')}</div><span class="rb-label">Font</span></div>
                <div class="rb-group"><div class="rb-row">${b('insertUnorderedList', 'list', 'Bullets')}${b('insertOrderedList', 'listOl', 'Numbering')}${b('checklist', 'check', 'Checklist')}${b('outdent', 'outdent', 'Decrease indent')}${b('indent', 'indent', 'Increase indent')}</div>
                    <div class="rb-row">${b('justifyLeft', 'alignLeft', 'Align left')}${b('justifyCenter', 'alignCenter', 'Center')}${b('justifyRight', 'alignRight', 'Align right')}${b('justifyFull', 'alignJustify', 'Justify')}</div><span class="rb-label">Paragraph</span></div>
                <div class="rb-group dw-styles"><div class="rb-row">${[['p', 'Normal', ''], ['h1', 'Heading 1', 'h1'], ['h2', 'Heading 2', 'h2'], ['h3', 'Heading 3', 'h3'], ['blockquote', 'Quote', 'q'], ['pre', 'Code', 'c']].map(([v, l, c]) => `<button class="dw-style ${c}" data-block="${v}">${l}</button>`).join('')}</div><span class="rb-label">Styles</span></div>
            </div>
            <div class="rb" data-pane="insert" hidden>
                <div class="rb-group"><div class="rb-row"><button class="rb-btn big" data-pop="table">${ic('table')}<span>Table</span></button>${b('row-below', 'rowAdd', 'Insert a row below')}${b('col-right', 'colAdd', 'Insert a column to the right')}${b('row-del', 'rowDel', 'Delete this row')}${b('col-del', 'colDel', 'Delete this column')}</div><span class="rb-label">Tables</span></div>
                <div class="rb-group"><div class="rb-row"><button class="rb-btn big" data-cmd="picture">${ic('image')}<span>Picture</span></button><button class="rb-btn big" data-cmd="link">${ic('link')}<span>Link</span></button></div><span class="rb-label">Media</span></div>
                <div class="rb-group"><div class="rb-row"><button class="rb-btn big" data-cmd="insertHorizontalRule">${ic('minimize')}<span>Line</span></button><button class="rb-btn big" data-cmd="pagebreak">${ic('pageBreak')}<span>Page break</span></button><button class="rb-btn big" data-cmd="date">${ic('calendar')}<span>Date</span></button></div><span class="rb-label">Insert</span></div>
            </div>
            <div class="rb" data-pane="layout" hidden>
                <div class="rb-group"><div class="rb-row"><select class="rb-select" id="psize" aria-label="Page size"><option value="A4">A4</option><option value="Letter">Letter</option></select></div><span class="rb-label">Size</span></div>
                <div class="rb-group"><div class="rb-row"><select class="rb-select" id="porient" aria-label="Orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div><span class="rb-label">Orientation</span></div>
                <div class="rb-group"><div class="rb-row"><select class="rb-select" id="pmargins" aria-label="Margins"><option value="normal">Normal (2.54 cm)</option><option value="narrow">Narrow (1.27 cm)</option><option value="wide">Wide (5.08 cm sides)</option></select></div><span class="rb-label">Margins</span></div>
            </div>`}
            <div class="dw-desk" id="desk"><div class="dw-zoom" id="zoomer"><div class="dw-page" id="page">
                <input class="dw-title" id="t" placeholder="Title" maxlength="160" value="${esc(open.title)}" ${ro ? 'readonly' : ''} aria-label="Title">
                <div class="dw-body" id="b" ${ro ? '' : 'contenteditable="true"'} spellcheck="true">${open.body.html || ''}</div>
            </div></div><div class="dw-imgbar" id="imgbar" hidden>${[25, 50, 75, 100].map(p => `<button data-w="${p}">${p}%</button>`).join('')}<i></i><button data-imgalign="left" aria-label="Left">${ic('alignLeft')}</button><button data-imgalign="center" aria-label="Center">${ic('alignCenter')}</button><button data-imgalign="right" aria-label="Right">${ic('alignRight')}</button><i></i><button data-imgdel aria-label="Remove picture">${ic('trash')}</button></div></div>
            <div class="dw-status"><span id="pages"></span><span id="words"></span><span class="spacer"></span>
                <button class="icon-btn" id="zout" aria-label="Zoom out">−</button><input type="range" id="zoom" min="50" max="200" step="10" aria-label="Zoom"><button class="icon-btn" id="zin" aria-label="Zoom in">+</button><span id="zlabel"></span></div>
            <input type="file" id="img" accept="image/*" hidden>
        </div>`;
        const body = $('#b');
        if (!ro && !body.innerHTML.trim()) body.innerHTML = '<p><br></p>';
        if ($('#share')) $('#share').value = open.share;
        if (!ro) {
            $('#psize').value = open.body.page.size;
            $('#porient').value = open.body.page.orient;
            $('#pmargins').value = open.body.page.margins;
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('defaultParagraphSeparator', false, 'p');
        }
        layoutPage();
        setZoom(zoom);
        stats();
        wire(ro);
    }
    function layoutPage() {
        const p = open.body.page;
        let [w, h] = PAGES[p.size] || PAGES.A4;
        if (p.orient === 'landscape') [w, h] = [h, w];
        const [tb, lr] = MARGIN[p.margins] || MARGIN.normal;
        Object.assign($('#page').style, { width: w + 'px', minHeight: h + 'px', padding: `${tb}px ${lr}px` });
        $('#page').dataset.h = h - 2 * tb;
    }
    function setZoom(z) {
        zoom = Math.max(0.5, Math.min(2, Math.round(z * 10) / 10));
        // phones start by fitting the page to the screen
        $('#zoomer').style.zoom = zoom;
        $('#zoom').value = Math.round(zoom * 100);
        $('#zlabel').textContent = Math.round(zoom * 100) + '%';
        write('doc-zoom', zoom);
    }
    function stats() {
        const text = $('#b').innerText || '';
        const words = (text.match(/[\p{L}\p{N}'’-]+/gu) || []).length;
        const contentH = Number($('#page').dataset.h) || 931;
        const breaks = $$('#b hr[data-page-break]').length;
        const pages = Math.max(1 + breaks, Math.ceil(($('#b').scrollHeight + 70) / contentH));
        $('#pages').textContent = `${pages} page${pages === 1 ? '' : 's'}`;
        $('#words').textContent = `${words} word${words === 1 ? '' : 's'}`;
    }

    /* ---------- formatting ---------- */
    let caret = null;
    document.addEventListener('selectionchange', () => {
        const sel = getSelection();
        const body = $('#b');
        if (body && sel.rangeCount && body.contains(sel.anchorNode)) {
            caret = sel.getRangeAt(0).cloneRange();
            sync();
        }
    });
    function restore() {
        const body = $('#b');
        body.focus({ preventScroll: true });
        if (caret && body.contains(caret.startContainer)) {
            const sel = getSelection();
            sel.removeAllRanges();
            sel.addRange(caret);
        }
    }
    const blockOf = n => {
        const el = n && (n.nodeType === 1 ? n : n.parentElement);
        return el && el.closest('#b p, #b h1, #b h2, #b h3, #b li, #b blockquote, #b pre, #b div:not(#b)');
    };
    function sync() {
        if (!$('.rb')) return;
        for (const c of ['bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull']) {
            let on = false;
            try {
                on = document.queryCommandState(c);
            } catch {
                // unsupported
            }
            $(`.rb [data-cmd="${c}"]`)?.classList.toggle('on', on);
        }
        const n = getSelection().anchorNode;
        const el = n && (n.nodeType === 1 ? n : n.parentElement);
        if (!el || !el.closest('#b')) return;
        const cs = getComputedStyle(el);
        const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (FONTS.includes(fam)) $('#font').value = fam;
        const pt = Math.round((parseFloat(cs.fontSize) * 0.75) * 2) / 2;
        $('#size').value = SIZES.includes(pt) ? pt : '';
        const blk = el.closest('#b h1, #b h2, #b h3, #b blockquote, #b pre');
        const tag = blk ? blk.tagName.toLowerCase() : 'p';
        $$('[data-block]').forEach(x => x.classList.toggle('on', x.dataset.block === tag));
        $('#sw-color').style.background = cs.color;
        // inside a table: the table buttons light up
        const inTable = !!el.closest('#b td, #b th');
        $$('[data-cmd="row-below"], [data-cmd="col-right"], [data-cmd="row-del"], [data-cmd="col-del"]').forEach(x => (x.disabled = !inTable));
    }
    // a size in points: the browser only knows 1–7, so mark with 7 and set the real size
    let pendingSize = null;
    function fontSize(pt) {
        restore();
        document.execCommand('fontSize', false, '7');
        const fix = () => $$('#b [style*="xxx-large"], #b font[size="7"]').forEach(x => {
            if (x.tagName === 'FONT') {
                const s = document.createElement('span');
                s.style.fontSize = pt + 'pt';
                s.append(...x.childNodes);
                x.replaceWith(s);
            } else x.style.fontSize = pt + 'pt';
        });
        fix();
        pendingSize = getSelection().isCollapsed ? fix : null; // for what's typed next
        changed();
    }
    function indent(dir) {
        restore();
        const el = blockOf(getSelection().anchorNode);
        if (el && el.tagName === 'LI') return document.execCommand(dir > 0 ? 'indent' : 'outdent');
        if (!el) return;
        const now = parseInt(el.style.marginLeft || '0', 10);
        el.style.marginLeft = Math.max(0, Math.min(360, now + dir * 36)) + 'px';
        if (el.style.marginLeft === '0px') el.style.removeProperty('margin-left');
    }
    function tableAt() {
        const n = getSelection().anchorNode;
        const el = n && (n.nodeType === 1 ? n : n.parentElement);
        const cell = el && el.closest('#b td, #b th');
        return cell ? { cell, row: cell.parentElement, table: cell.closest('table') } : null;
    }
    // a table goes after the paragraph the cursor is in (built directly: pasting HTML into a
    // paragraph makes browsers break the table apart)
    function insertTable(rows, cols) {
        restore();
        const body = $('#b');
        const t = document.createElement('table');
        const tb = document.createElement('tbody');
        for (let r = 0; r < rows; r++) {
            const tr = document.createElement('tr');
            for (let c = 0; c < cols; c++) tr.append(Object.assign(document.createElement(r === 0 ? 'th' : 'td'), { innerHTML: '<br>' }));
            tb.append(tr);
        }
        t.append(tb);
        const n = getSelection().anchorNode;
        let blk = n && (n.nodeType === 1 ? n : n.parentElement);
        while (blk && blk.parentElement !== body) blk = blk.parentElement;
        if (!blk || blk === body) body.append(t);
        else if (blk.tagName === 'P' && !blk.textContent.trim() && !blk.querySelector('img')) blk.replaceWith(t);
        else blk.after(t);
        if (!t.nextElementSibling) t.after(Object.assign(document.createElement('p'), { innerHTML: '<br>' }));
        const r = document.createRange();
        r.selectNodeContents(t.querySelector('th, td'));
        r.collapse(true);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
    }
    // browsers sometimes put lists or tables inside a paragraph; move them out so the
    // document stays valid (and exports cleanly)
    function tidy() {
        for (const el of $$('#b p > ul, #b p > ol, #b p > table, #b p > p, #b p > h1, #b p > h2, #b p > h3, #b p > blockquote, #b p > pre')) {
            const p = el.parentElement;
            if (!p || p.tagName !== 'P') continue;
            const rest = [];
            for (let x = el.nextSibling; x; x = x.nextSibling) rest.push(x);
            p.after(el);
            if (rest.some(x => (x.textContent || '').trim() || x.nodeName === 'IMG')) {
                const tail = document.createElement('p');
                tail.append(...rest);
                el.after(tail);
            } else rest.forEach(x => x.remove());
            if (!p.textContent.trim() && !p.querySelector('img')) p.remove();
        }
    }
    function cmd(c, btn) {
        const body = $('#b');
        switch (c) {
            case 'undo':
            case 'redo':
            case 'bold':
            case 'italic':
            case 'underline':
            case 'strikeThrough':
            case 'subscript':
            case 'superscript':
            case 'removeFormat':
            case 'insertUnorderedList':
            case 'insertOrderedList':
            case 'justifyLeft':
            case 'justifyCenter':
            case 'justifyRight':
            case 'justifyFull':
            case 'insertHorizontalRule':
                restore();
                document.execCommand(c);
                break;
            case 'indent':
                indent(1);
                break;
            case 'outdent':
                indent(-1);
                break;
            case 'checklist': {
                restore();
                document.execCommand('insertUnorderedList');
                const n = getSelection().anchorNode;
                const ul = n && (n.nodeType === 1 ? n : n.parentElement).closest('#b ul');
                if (ul) {
                    ul.setAttribute('data-checklist', '');
                    $$('li', ul).forEach(li => li.dataset.checked || (li.dataset.checked = 'false'));
                }
                break;
            }
            case 'link': {
                restore();
                const url = prompt('Link to (https://…)');
                restore();
                if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) {
                    if (getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(url.trim())}">${esc(url.trim())}</a>`);
                    else document.execCommand('createLink', false, url.trim());
                }
                break;
            }
            case 'picture':
                $('#img').click();
                return;
            case 'pagebreak':
                restore();
                document.execCommand('insertHTML', false, '<hr data-page-break=""><p><br></p>');
                break;
            case 'date':
                restore();
                document.execCommand('insertText', false, new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }));
                break;
            case 'row-below':
            case 'row-del':
            case 'col-right':
            case 'col-del': {
                const t = tableAt();
                if (!t) return;
                const idx = [...t.row.children].indexOf(t.cell);
                if (c === 'row-below') {
                    const r = document.createElement('tr');
                    r.innerHTML = [...t.row.children].map(() => '<td><br></td>').join('');
                    t.row.after(r);
                } else if (c === 'row-del') {
                    if (t.table.rows.length === 1) t.table.remove();
                    else t.row.remove();
                } else if (c === 'col-right') {
                    for (const r of t.table.rows) r.children[idx]?.insertAdjacentElement('afterend', Object.assign(document.createElement(r.children[idx]?.tagName === 'TH' ? 'th' : 'td'), { innerHTML: '<br>' }));
                } else {
                    if (t.row.children.length === 1) t.table.remove();
                    else for (const r of t.table.rows) r.children[idx]?.remove();
                }
                break;
            }
        }
        tidy();
        changed();
        sync();
    }

    /* ---------- wiring ---------- */
    function wire(ro) {
        const body = $('#b');
        $('#home').onclick = async () => {
            if (dirty) await saveNow();
            list = await call('/api/docs?kind=doc');
            gallery();
        };
        $('#name').addEventListener('input', () => (($('#t').value = $('#name').value), changed()));
        $('#t').addEventListener('input', () => (($('#name').value = $('#t').value), changed()));
        $('#t').addEventListener('keydown', e => e.key === 'Enter' && (e.preventDefault(), body.focus()));
        $('#download').onclick = e => downloadMenu(e.currentTarget);
        $('#more').onclick = e => moreMenu(e.currentTarget);
        $('#zoom').oninput = e => setZoom(e.target.value / 100);
        $('#zin').onclick = () => setZoom(zoom + 0.1);
        $('#zout').onclick = () => setZoom(zoom - 0.1);
        $('#share') && ($('#share').onchange = async e => {
            const r = await call(`/api/docs/${open.id}`, { method: 'PATCH', body: { share: e.target.value } });
            open.share = r.share;
            toast(r.share === 'private' ? 'Only you can see it' : r.share === 'edit' ? 'Everyone on EderveenGroup can read and edit it' : 'Everyone on EderveenGroup can read it');
        });
        if (ro) return;
        $$('.rb-tabs [data-tab]').forEach(t =>
            t.addEventListener('click', () => {
                $$('.rb-tabs [data-tab]').forEach(x => x.classList.toggle('on', x === t));
                $$('.rb[data-pane]').forEach(p => (p.hidden = p.dataset.pane !== t.dataset.tab));
            })
        );
        // the ribbon never takes the cursor away from the page
        $$('.rb').forEach(r => r.addEventListener('mousedown', e => e.target.closest('.rb-btn, .dw-style') && e.preventDefault()));
        $$('.rb').forEach(r =>
            r.addEventListener('click', e => {
                const b = e.target.closest('[data-cmd]');
                if (b && !b.disabled) cmd(b.dataset.cmd, b);
                const blk = e.target.closest('[data-block]');
                if (blk) {
                    restore();
                    document.execCommand('formatBlock', false, blk.dataset.block);
                    changed();
                    sync();
                }
                const pop = e.target.closest('[data-pop]');
                if (pop) popover(pop, pop.dataset.pop);
            })
        );
        $('#font').onchange = e => {
            restore();
            document.execCommand('fontName', false, e.target.value);
            changed();
        };
        $('#size').onchange = e => e.target.value && fontSize(Number(e.target.value));
        for (const [id, key] of [['#psize', 'size'], ['#porient', 'orient'], ['#pmargins', 'margins']]) {
            $(id).onchange = e => {
                open.body.page[key] = e.target.value;
                layoutPage();
                stats();
                changed();
            };
        }
        body.addEventListener('input', () => {
            if (pendingSize) pendingSize();
            tidy();
            changed();
            stats();
        });
        // pasted text keeps its structure, not its colours and fonts from elsewhere
        body.addEventListener('paste', () => setTimeout(() => $$('#b [style]').forEach(el => {
            for (const p of [...el.style]) if (!['text-align', 'margin-left', 'font-weight', 'font-style', 'text-decoration'].includes(p)) el.style.removeProperty(p);
            if (!el.getAttribute('style')) el.removeAttribute('style');
        }), 0));
        body.addEventListener('click', e => {
            const li = e.target.closest('ul[data-checklist] > li');
            if (li && e.offsetX < 26) {
                li.dataset.checked = li.dataset.checked === 'true' ? 'false' : 'true';
                changed();
            }
            const img = e.target.closest('#b img');
            imgSelect(img);
        });
        body.addEventListener('keydown', e => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === 's') (e.preventDefault(), saveNow());
            if (mod && e.key.toLowerCase() === 'k') (e.preventDefault(), cmd('link'));
            if (mod && e.key === 'Enter') (e.preventDefault(), cmd('pagebreak'));
            if (e.key === 'Tab') {
                const t = tableAt();
                if (t) {
                    // Tab moves through table cells, like Word (and adds a row at the end)
                    e.preventDefault();
                    const cells = [...t.table.querySelectorAll('td, th')];
                    let i = cells.indexOf(t.cell) + (e.shiftKey ? -1 : 1);
                    if (i >= cells.length) {
                        cmd('row-below');
                        i = cells.length;
                    }
                    const next = [...t.table.querySelectorAll('td, th')][Math.max(0, i)];
                    if (next) {
                        const r = document.createRange();
                        r.selectNodeContents(next);
                        r.collapse(true);
                        getSelection().removeAllRanges();
                        getSelection().addRange(r);
                    }
                    return;
                }
                if (blockOf(getSelection().anchorNode)?.tagName === 'LI') (e.preventDefault(), document.execCommand(e.shiftKey ? 'outdent' : 'indent'));
            }
        });
        $('#img').addEventListener('change', async e => {
            const f = e.target.files[0];
            e.target.value = '';
            if (!f) return;
            const url = await shrink(f);
            if (!url) return toast('That picture couldn’t be read', { bad: true });
            restore();
            document.execCommand('insertImage', false, url);
            changed();
        });
        // the picture bar: size and place a picture
        $('#imgbar').addEventListener('mousedown', e => e.preventDefault());
        $('#imgbar').addEventListener('click', e => {
            const img = selectedImg;
            if (!img) return;
            const w = e.target.closest('[data-w]');
            const al = e.target.closest('[data-imgalign]');
            if (w) img.setAttribute('width', Math.round((($('#page').clientWidth - parseFloat(getComputedStyle($('#page')).paddingLeft) * 2) * w.dataset.w) / 100));
            if (al) {
                const blk = img.closest('p, div:not(#b)') || img.parentElement;
                if (blk && blk !== $('#b')) blk.style.textAlign = al.dataset.imgalign;
            }
            if (e.target.closest('[data-imgdel]')) {
                img.remove();
                imgSelect(null);
            }
            changed();
            imgSelect(selectedImg && selectedImg.isConnected ? selectedImg : null);
        });
        addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && open) {
                e.preventDefault();
                print();
            }
        });
    }
    let selectedImg = null;
    function imgSelect(img) {
        $$('#b img.sel').forEach(x => x.classList.remove('sel'));
        selectedImg = img || null;
        const bar = $('#imgbar');
        if (!img) return void (bar.hidden = true);
        img.classList.add('sel');
        const r = img.getBoundingClientRect();
        const d = $('#desk').getBoundingClientRect();
        bar.hidden = false;
        bar.style.top = r.top - d.top + $('#desk').scrollTop - 44 + 'px';
        bar.style.left = Math.max(8, r.left - d.left) + 'px';
    }
    function popover(anchor, kind) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop rb-swatches';
        if (kind === 'table') {
            pop.className = 'fl-pop dw-tgrid';
            pop.innerHTML = `<div class="dw-tcells">${Array.from({ length: 64 }, (_, i) => `<span data-r="${Math.floor(i / 8) + 1}" data-c="${(i % 8) + 1}"></span>`).join('')}</div><p id="tsize">Insert a table</p>`;
            pop.addEventListener('mouseover', e => {
                const s = e.target.closest('[data-r]');
                if (!s) return;
                $$('span', pop).forEach(x => x.classList.toggle('on', +x.dataset.r <= +s.dataset.r && +x.dataset.c <= +s.dataset.c));
                $('#tsize', pop).textContent = `${s.dataset.c} × ${s.dataset.r} table`;
            });
            pop.addEventListener('click', e => {
                const s = e.target.closest('[data-r]');
                if (!s) return;
                pop.remove();
                insertTable(+s.dataset.r, +s.dataset.c);
                changed();
            });
        } else {
            const list = kind === 'mark' ? MARKS : COLORS;
            pop.innerHTML = list.map(c => `<button data-c="${c}" title="${c || 'No highlight'}" style="background:${c || 'transparent'}" class="${c ? '' : 'none'}"></button>`).join('');
            pop.addEventListener('click', e => {
                const b = e.target.closest('[data-c]');
                if (!b) return;
                pop.remove();
                restore();
                if (kind === 'mark') document.execCommand('hiliteColor', false, b.dataset.c || 'transparent');
                else document.execCommand('foreColor', false, b.dataset.c);
                if (kind === 'mark') $('#sw-mark').style.background = b.dataset.c || 'transparent';
                changed();
            });
        }
        pop.addEventListener('mousedown', e => e.preventDefault());
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = r.bottom + 4 + 'px';
        pop.style.left = Math.min(innerWidth - pop.offsetWidth - 8, r.left) + 'px';
        const off = e => !pop.contains(e.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
    }
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
                resolve(c.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(file);
        });
    }

    /* ---------- menus ---------- */
    function menu(anchor, items) {
        $$('.fl-pop').forEach(x => x.remove());
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
    async function downloadMenu(anchor) {
        if (dirty) await saveNow();
        menu(anchor, [
            ['file', 'Word document (.docx)', () => (location.href = `/api/docs/${open.id}/export?format=docx`)],
            ['file', 'PDF (.pdf)', () => (location.href = `/api/docs/${open.id}/export?format=pdf`)],
            ['code', 'Web page (.html)', () => {
                const html = `<!doctype html><meta charset="utf-8"><title>${esc(open.title || 'Untitled')}</title><style>body{font:11pt/1.5 Calibri,Carlito,Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 20px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px}</style><h1>${esc(open.title || 'Untitled')}</h1>${$('#b').innerHTML}`;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
                a.download = `${(open.title || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-')}.html`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }]
        ]);
    }
    function moreMenu(anchor) {
        menu(anchor, [
            ['copy', 'Make a copy', async () => {
                const c = await call(`/api/docs/${open.id}/copy`, { method: 'POST', body: {} });
                list.unshift(c);
                select(c.id);
                toast('A copy of your own');
            }],
            ['file', 'Print', () => print()],
            ...(open.mine ? [['trash', 'Delete', async () => {
                if (!(await ask({ title: 'Delete this document?', text: open.share !== 'private' ? 'Everyone it’s shared with loses it too. This can’t be undone.' : 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
                await call(`/api/docs/${open.id}`, { method: 'DELETE' });
                list = list.filter(x => x.id !== open.id);
                dirty = false;
                gallery();
            }, true]] : [])
        ]);
    }

    /* ---------- saving ---------- */
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
        $$('#b img.sel').forEach(x => x.classList.remove('sel'));
        d.body = { html: $('#b') ? $('#b').innerHTML : d.body.html, page: d.body.page };
        try {
            const r = await call(`/api/docs/${d.id}`, { method: 'PUT', body: { title: d.title, body: d.body, version: d.version } });
            d.version = r.version;
            Object.assign(list.find(x => x.id === d.id) || {}, r);
            if (open === d && $('#saved')) $('#saved').textContent = 'Saved';
        } catch (e) {
            dirty = true;
            if ($('#saved')) $('#saved').textContent = 'Not saved';
            toast(e.message, { bad: true });
        }
    }
    const save = debounce(saveNow, 800);
    addEventListener('beforeunload', () => dirty && saveNow());

    root.addEventListener('click', e => {
        const c = e.target.closest('.dw-card[data-id]');
        if (c) select(c.dataset.id);
    });

    call('/api/docs?kind=doc')
        .then(r => {
            list = r;
            const want = location.hash.slice(1);
            if (want === 'new') create();
            else if (want && list.some(d => d.id === want)) select(want);
            else gallery();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your docs</h1><p>${esc(e.message)}</p></div>`));
})();
