// Spreadsheets: an Excel-like grid with formulas, formatting, several sheets, and downloads
// as .xlsx, .csv or PDF. Formulas are worked out by public/js/formula.js (also on the server).
(function () {
    const { $, $$, esc, ic, call, toast, ask, debounce, ago, typing: textBox, undoKey } = window.EG;
    const FX = window.EGFormula;
    const root = $('#sheets');
    let books = [];
    let wb = null; // the open workbook: { id, title, body: { sheets, active }, canEdit, version, … }
    let sh = null; // its current sheet
    let ev = null; // values, worked out
    let sel = { r: 1, c: 1, r2: 1, c2: 1 }; // the selection (r,c is the active cell)
    let editing = null; // { r, c, input, fromBar }
    let dirty = false;
    let undo = [];
    let redo = [];
    const ROWS_MIN = 60;
    const COLS_MIN = 26;
    const DEF_W = 96;

    /* ---------- the gallery ---------- */
    function gallery() {
        wb = null;
        document.body.classList.remove('sx-editing');
        const mine = books.filter(d => d.mine);
        const shared = books.filter(d => !d.mine);
        const card = d => `<button class="sx-card" data-id="${esc(d.id)}"><span class="sx-thumb">${ic('grid')}</span><b>${esc(d.title || 'Untitled spreadsheet')}</b><small>${esc(ago(d.updatedAt))}${d.mine ? '' : ` · ${esc(d.ownerName)}`}</small></button>`;
        root.innerHTML = `<div class="sl-home">
            <div class="ea-head"><h1>Spreadsheets</h1><div class="sx-home-acts"><label class="btn">${ic('download')}<span>Open Excel or CSV</span><input type="file" id="open" accept=".xlsx,.csv" hidden></label><button class="btn btn-primary" id="new">${ic('plus')}<span>New spreadsheet</span></button></div></div>
            ${mine.length || shared.length ? '' : `<div class="ea-empty big">${ic('grid')}<p>No spreadsheets yet. Make a budget, a list or a schedule, with formulas like Excel; download it as .xlsx any time.</p></div>`}
            ${mine.length ? `<h2 class="ea-sec">My spreadsheets</h2><div class="sx-cards">${mine.map(card).join('')}</div>` : ''}
            ${shared.length ? `<h2 class="ea-sec">Shared with everyone</h2><div class="sx-cards">${shared.map(card).join('')}</div>` : ''}
        </div>`;
        $('#new').onclick = create;
        $('#open').onchange = async e => {
            const f = e.target.files[0];
            if (!f) return;
            try {
                const res = await fetch(`/api/docs/import?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'X-EG': '1', 'Content-Type': 'application/octet-stream' }, body: f });
                const d = await res.json();
                if (!res.ok) throw new Error(d.error || 'Couldn’t open that file');
                books.unshift(d);
                open(d.id);
            } catch (err) {
                toast(err.message, { bad: true });
            }
        };
        history.replaceState(null, '', location.pathname);
    }
    async function create() {
        const d = await call('/api/docs', { method: 'POST', body: { kind: 'sheet', title: 'Untitled spreadsheet' } });
        books.unshift(d);
        open(d.id);
    }
    async function open(id) {
        try {
            wb = await call(`/api/docs/${id}`);
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        history.replaceState(null, '', `${location.pathname}#${id}`);
        undo = [];
        redo = [];
        sh = wb.body.sheets[wb.body.active || 0] || wb.body.sheets[0];
        sel = { r: 1, c: 1, r2: 1, c2: 1 };
        editor();
    }

    /* ---------- the editor ---------- */
    const COLORS = ['#000000', '#7f7f7f', '#c00000', '#e46c0a', '#d4a017', '#2e9e4f', '#1f6fd1', '#7030a0', '#ffffff'];
    const FILLS = ['', '#fff2cc', '#e2efda', '#ddebf7', '#fce4d6', '#ededed', '#ffc7ce', '#c6efce', '#9bc2e6'];
    function editor() {
        document.body.classList.add('sx-editing');
        const ro = !wb.canEdit;
        const btn = (cmd, icon, label, extra = '') => `<button class="rb-btn" data-cmd="${cmd}" title="${label}" aria-label="${label}" ${extra}>${ic(icon)}</button>`;
        root.innerHTML = `<div class="sx">
            <div class="of-title">
                <button class="icon-btn" id="home" title="All spreadsheets" aria-label="All spreadsheets">${ic('left')}</button>
                <span class="of-app sx-app">${ic('grid')}</span>
                <input class="of-name" id="name" value="${esc(wb.title)}" ${ro ? 'readonly' : ''} aria-label="Spreadsheet name">
                <span class="nt-saved" id="saved"></span><span class="spacer"></span>
                ${wb.mine ? '<select class="input of-share" id="share" aria-label="Who can see it"><option value="private">Only me</option><option value="view">Everyone can view</option><option value="edit">Everyone can edit</option></select>' : ''}
                <button class="btn of-dl" id="download">${ic('download')}<span>Download</span></button>
                <button class="icon-btn" id="more" aria-label="More">${ic('more')}</button>
            </div>
            ${ro ? `<div class="of-ro">${ic('eye')} Read only · ${esc(wb.ownerName)} shared this with everyone</div>` : `<div class="rb" role="toolbar" aria-label="Home">
                <div class="rb-group"><div class="rb-row">${btn('undo', 'undo', 'Undo (Ctrl Z)')}${btn('redo', 'redo', 'Redo (Ctrl Y)')}</div><span class="rb-label">Undo</span></div>
                <div class="rb-group"><div class="rb-row">${btn('cut', 'x', 'Cut (Ctrl X)')}${btn('copy', 'copy', 'Copy (Ctrl C)')}${btn('paste', 'paste', 'Paste (Ctrl V)')}</div><span class="rb-label">Clipboard</span></div>
                <div class="rb-group"><div class="rb-row">${btn('b', 'bold', 'Bold (Ctrl B)')}${btn('i', 'italic', 'Italic (Ctrl I)')}${btn('u', 'underline', 'Underline (Ctrl U)')}${btn('st', 'strike', 'Strikethrough')}
                    <span class="rb-pick"><button class="rb-btn rb-color" data-pop="color" title="Font colour" aria-label="Font colour">A<i id="sw-color"></i></button></span>
                    <span class="rb-pick"><button class="rb-btn rb-fill" data-pop="fill" title="Fill colour" aria-label="Fill colour">${ic('palette')}<i id="sw-fill"></i></button></span></div><span class="rb-label">Font</span></div>
                <div class="rb-group"><div class="rb-row">${btn('align-left', 'alignLeft', 'Align left')}${btn('align-center', 'alignCenter', 'Center')}${btn('align-right', 'alignRight', 'Align right')}${btn('wrap', 'wrap', 'Wrap text')}</div><span class="rb-label">Alignment</span></div>
                <div class="rb-group"><div class="rb-row"><select class="rb-select" id="fmt" aria-label="Number format"><option value="general">General</option><option value="number">Number</option><option value="currency">Currency (€)</option><option value="percent">Percentage</option><option value="date">Date</option><option value="text">Text</option></select>${btn('dec-less', 'decLess', 'Fewer decimals')}${btn('dec-more', 'decMore', 'More decimals')}</div><span class="rb-label">Number</span></div>
                <div class="rb-group"><div class="rb-row">${btn('row-add', 'rowAdd', 'Insert a row above')}${btn('col-add', 'colAdd', 'Insert a column to the left')}${btn('row-del', 'rowDel', 'Delete rows')}${btn('col-del', 'colDel', 'Delete columns')}</div><span class="rb-label">Cells</span></div>
                <div class="rb-group"><div class="rb-row">${btn('sum', 'sigma', 'AutoSum (Alt =)')}${btn('sort-asc', 'sortAsc', 'Sort A to Z')}${btn('sort-desc', 'sortDesc', 'Sort Z to A')}${btn('freeze', 'pin', 'Freeze the top row')}${btn('clear', 'eraser', 'Clear (Delete)')}</div><span class="rb-label">Editing</span></div>
            </div>`}
            <div class="sx-bar">
                <input class="sx-namebox" id="namebox" aria-label="Cell" spellcheck="false">
                <span class="sx-fx">fx</span>
                <input class="sx-formula" id="formula" aria-label="Contents" spellcheck="false" ${ro ? 'readonly' : ''} placeholder="${ro ? '' : 'Type a value, or a formula such as =SUM(B2:B10)'}">
            </div>
            <div class="sx-scroll" id="scroll"><table class="sx-grid" id="grid"></table><div class="sx-handle" id="handle" hidden></div></div>
            <div class="sx-foot">
                <div class="sx-tabs" id="tabs"></div>
                <span class="spacer"></span>
                <span class="sx-stats" id="stats"></span>
            </div>
        </div>`;
        if ($('#share')) $('#share').value = wb.share;
        compute();
        drawGrid();
        drawTabs();
        select(1, 1);
        $('#home').onclick = async () => {
            if (dirty) await saveNow();
            books = await call('/api/docs?kind=sheet');
            gallery();
        };
        $('#name').addEventListener('input', changed);
        $('#download').onclick = e => downloadMenu(e.currentTarget);
        $('#share') && ($('#share').onchange = async e => {
            const r = await call(`/api/docs/${wb.id}`, { method: 'PATCH', body: { share: e.target.value } });
            wb.share = r.share;
            toast(r.share === 'private' ? 'Only you can see it' : r.share === 'edit' ? 'Everyone on EderveenGroup can view and edit it' : 'Everyone on EderveenGroup can view it');
        });
        $('#more').onclick = e => menu(e.currentTarget, [
            ['copy', 'copy', 'Make a copy', async () => {
                const c = await call(`/api/docs/${wb.id}/copy`, { method: 'POST', body: {} });
                books.unshift(c);
                open(c.id);
            }],
            ...(wb.mine ? [['trash', 'trash', 'Delete', async () => {
                if (!(await ask({ title: 'Delete this spreadsheet?', text: 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
                await call(`/api/docs/${wb.id}`, { method: 'DELETE' });
                dirty = false;
                books = books.filter(x => x.id !== wb.id);
                gallery();
            }]] : [])
        ]);
        wire();
    }

    /* ---------- the grid ---------- */
    function compute() {
        ev = FX.evaluator(wb.body);
    }
    const si = () => wb.body.sheets.indexOf(sh);
    function size() {
        let rows = ROWS_MIN;
        let cols = COLS_MIN;
        for (const a of Object.keys(sh.cells)) {
            const p = FX.parseAddr(a);
            if (p) (rows = Math.max(rows, p.r + 20)), (cols = Math.max(cols, p.c + 4));
        }
        return { rows: Math.max(rows, sh._rows || 0), cols: Math.max(cols, sh._cols || 0) };
    }
    const width = c => (sh.cols && sh.cols[FX.colName(c)]) || DEF_W;
    function cellHtml(r, c) {
        const a = FX.addr(c, r);
        const cell = sh.cells[a];
        if (!cell) return `<td data-a="${a}"></td>`;
        const s = cell.s || {};
        const v = ev.get(si(), a);
        const text = s.fmt === 'text' ? String(cell.v || '') : FX.format(v, s);
        const cls = [s.b && 'b', s.i && 'i', s.u && 'u', s.st && 'st', s.wrap && 'wrap', FX.isErr(v) && 'err', typeof v === 'number' && !s.align && 'num'].filter(Boolean).join(' ');
        const style = [s.color && `color:${s.color}`, s.fill && `background:${s.fill}`, s.align && `text-align:${s.align}`].filter(Boolean).join(';');
        return `<td data-a="${a}"${cls ? ` class="${cls}"` : ''}${style ? ` style="${style}"` : ''}>${esc(text)}</td>`;
    }
    function drawGrid() {
        const { rows, cols } = size();
        let html = `<colgroup><col style="width:46px">${Array.from({ length: cols }, (_, i) => `<col style="width:${width(i + 1)}px">`).join('')}</colgroup>`;
        html += `<thead><tr><th class="sx-corner"></th>${Array.from({ length: cols }, (_, i) => `<th class="sx-ch" data-c="${i + 1}">${FX.colName(i + 1)}<span class="sx-resize" data-rc="${i + 1}"></span></th>`).join('')}</tr></thead><tbody>`;
        for (let r = 1; r <= rows; r++) {
            html += `<tr${sh.freeze && r === 1 ? ' class="sx-frozen"' : ''}><th class="sx-rh" data-r="${r}">${r}</th>`;
            for (let c = 1; c <= cols; c++) html += cellHtml(r, c);
            html += '</tr>';
        }
        $('#grid').innerHTML = html + '</tbody>';
        $('#grid').style.width = 46 + Array.from({ length: cols }, (_, i) => width(i + 1)).reduce((a, b) => a + b, 0) + 'px';
        paintSel();
    }
    // after a change: redraw only the cells, not the whole table
    function refreshCells() {
        compute();
        for (const td of $$('#grid td[data-a]')) {
            const p = FX.parseAddr(td.dataset.a);
            const tmp = document.createElement('tbody');
            tmp.innerHTML = `<tr>${cellHtml(p.r, p.c)}</tr>`;
            const fresh = tmp.querySelector('td');
            if (fresh.outerHTML !== td.outerHTML) td.replaceWith(fresh);
        }
        paintSel();
    }
    const tdOf = (r, c) => $(`#grid td[data-a="${FX.addr(c, r)}"]`);
    const box = () => ({ r1: Math.min(sel.r, sel.r2), r2: Math.max(sel.r, sel.r2), c1: Math.min(sel.c, sel.c2), c2: Math.max(sel.c, sel.c2) });
    function paintSel() {
        $$('#grid .in, #grid .act').forEach(x => x.classList.remove('in', 'act'));
        $$('#grid .hl').forEach(x => x.classList.remove('hl'));
        const b = box();
        for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) tdOf(r, c)?.classList.add('in');
        tdOf(sel.r, sel.c)?.classList.add('act');
        for (let c = b.c1; c <= b.c2; c++) $(`#grid .sx-ch[data-c="${c}"]`)?.classList.add('hl');
        for (let r = b.r1; r <= b.r2; r++) $(`#grid .sx-rh[data-r="${r}"]`)?.classList.add('hl');
        // the fill handle sits on the bottom-right corner of the selection
        const last = tdOf(b.r2, b.c2);
        const h = $('#handle');
        if (last && h && wb.canEdit) {
            h.hidden = false;
            h.style.left = last.offsetLeft + last.offsetWidth - 4 + 'px';
            h.style.top = last.offsetTop + last.offsetHeight - 4 + 'px';
        }
        const a = FX.addr(sel.c, sel.r);
        $('#namebox').value = b.r1 === b.r2 && b.c1 === b.c2 ? a : `${FX.addr(b.c1, b.r1)}:${FX.addr(b.c2, b.r2)}`;
        if (!editing || !editing.fromBar) $('#formula').value = (sh.cells[a] && sh.cells[a].v) || '';
        stats();
        syncRibbon();
    }
    function stats() {
        const b = box();
        if (b.r1 === b.r2 && b.c1 === b.c2) return ($('#stats').textContent = '');
        const nums = [];
        let count = 0;
        for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) {
            const v = ev.get(si(), FX.addr(c, r));
            if (v !== null && v !== '') count++;
            if (typeof v === 'number') nums.push(v);
        }
        const f = x => x.toLocaleString(undefined, { maximumFractionDigits: 4 });
        $('#stats').innerHTML = nums.length ? `Average: <b>${f(nums.reduce((a, x) => a + x, 0) / nums.length)}</b> Count: <b>${count}</b> Sum: <b>${f(nums.reduce((a, x) => a + x, 0))}</b>` : count ? `Count: <b>${count}</b>` : '';
    }
    function syncRibbon() {
        if (!$('.rb')) return;
        const s = (sh.cells[FX.addr(sel.c, sel.r)] || {}).s || {};
        for (const k of ['b', 'i', 'u', 'st', 'wrap']) $(`.rb [data-cmd="${k}"]`)?.classList.toggle('on', !!s[k]);
        for (const k of ['left', 'center', 'right']) $(`.rb [data-cmd="align-${k}"]`)?.classList.toggle('on', s.align === k);
        $('#fmt').value = s.fmt || 'general';
        $('[data-cmd="freeze"]')?.classList.toggle('on', !!sh.freeze);
        $('#sw-color').style.background = s.color || '#000';
        $('#sw-fill').style.background = s.fill || 'transparent';
    }
    function select(r, c, extend) {
        r = Math.max(1, r);
        c = Math.max(1, c);
        if (extend) Object.assign(sel, { r2: r, c2: c });
        else sel = { r, c, r2: r, c2: c };
        const { rows, cols } = size();
        if (r > rows - 5 || c > cols - 2) {
            sh._rows = Math.max(rows, r + 30);
            sh._cols = Math.max(cols, c + 6);
            drawGrid();
        }
        paintSel();
        const td = tdOf(extend ? sel.r2 : r, extend ? sel.c2 : c);
        if (td) {
            const sc = $('#scroll');
            const top = td.offsetTop - 26;
            const left = td.offsetLeft - 46;
            if (top < sc.scrollTop) sc.scrollTop = top;
            else if (td.offsetTop + td.offsetHeight > sc.scrollTop + sc.clientHeight) sc.scrollTop = td.offsetTop + td.offsetHeight - sc.clientHeight + 2;
            if (left < sc.scrollLeft) sc.scrollLeft = left;
            else if (td.offsetLeft + td.offsetWidth > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = td.offsetLeft + td.offsetWidth - sc.clientWidth + 2;
        }
    }

    /* ---------- changing cells (with undo) ---------- */
    function change(edits, label) {
        // edits: [{ a, v?, s? }] on the current sheet; undefined leaves that part as it is
        const before = edits.map(e => ({ a: e.a, cell: sh.cells[e.a] ? JSON.parse(JSON.stringify(sh.cells[e.a])) : null }));
        for (const e of edits) {
            const cur = sh.cells[e.a] || {};
            const next = { v: e.v !== undefined ? e.v : cur.v, s: e.s !== undefined ? e.s : cur.s };
            if (!next.v) delete next.v;
            if (!next.s || !Object.keys(next.s).length) delete next.s;
            if (Object.keys(next).length) sh.cells[e.a] = next;
            else delete sh.cells[e.a];
        }
        undo.push({ sheet: sh, before, label });
        if (undo.length > 200) undo.shift();
        redo = [];
        refreshCells();
        changed();
    }
    function restore(stackFrom, stackTo) {
        const step = stackFrom.pop();
        if (!step) return;
        const back = step.before.map(b => ({ a: b.a, cell: step.sheet.cells[b.a] ? JSON.parse(JSON.stringify(step.sheet.cells[b.a])) : null }));
        for (const b of step.before) {
            if (b.cell) step.sheet.cells[b.a] = b.cell;
            else delete step.sheet.cells[b.a];
        }
        stackTo.push({ sheet: step.sheet, before: back, label: step.label });
        if (step.sheet !== sh) (sh = step.sheet), drawTabs();
        if (step.cols) sh.cols = step.cols;
        drawGrid();
        compute();
        refreshCells();
        changed();
    }
    function setStyle(fn) {
        const b = box();
        const edits = [];
        for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) {
            const a = FX.addr(c, r);
            const s = { ...((sh.cells[a] || {}).s || {}) };
            fn(s);
            for (const k of Object.keys(s)) if (s[k] === undefined || s[k] === false || s[k] === '') delete s[k];
            edits.push({ a, s });
        }
        change(edits, 'format');
    }
    function clearSel() {
        const b = box();
        const edits = [];
        for (let r = b.r1; r <= b.r2; r++) for (let c = b.c1; c <= b.c2; c++) if (sh.cells[FX.addr(c, r)]) edits.push({ a: FX.addr(c, r), v: '' });
        if (edits.length) change(edits, 'clear');
    }

    /* ---------- typing in a cell ---------- */
    function startEdit(initial, fromBar) {
        if (!wb.canEdit) return;
        if (editing) commit(false);
        const a = FX.addr(sel.c, sel.r);
        const td = tdOf(sel.r, sel.c);
        if (fromBar) {
            editing = { r: sel.r, c: sel.c, input: $('#formula'), fromBar: true };
            return;
        }
        const input = document.createElement('input');
        input.className = 'sx-edit';
        input.spellcheck = false;
        input.value = initial !== undefined ? initial : (sh.cells[a] && sh.cells[a].v) || '';
        $('#scroll').append(input);
        Object.assign(input.style, { left: td.offsetLeft + 'px', top: td.offsetTop + 'px', minWidth: td.offsetWidth + 'px', height: td.offsetHeight + 'px' });
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        editing = { r: sel.r, c: sel.c, input };
        input.addEventListener('input', () => ($('#formula').value = input.value));
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') (e.preventDefault(), commit(true), select(sel.r + (e.shiftKey ? -1 : 1), sel.c));
            else if (e.key === 'Tab') (e.preventDefault(), commit(true), select(sel.r, sel.c + (e.shiftKey ? -1 : 1)));
            else if (e.key === 'Escape') (e.preventDefault(), cancel());
            else if (/^Arrow(Up|Down)$/.test(e.key) && !input.value.startsWith('=')) (e.preventDefault(), commit(true), select(sel.r + (e.key === 'ArrowUp' ? -1 : 1), sel.c));
        });
        input.addEventListener('blur', () => editing && editing.input === input && commit(true));
        $('#formula').value = input.value;
    }
    function commit(save) {
        if (!editing) return;
        const { r, c, input, fromBar } = editing;
        editing = null;
        const v = input.value;
        if (!fromBar) input.remove();
        const a = FX.addr(c, r);
        if (save && v !== ((sh.cells[a] && sh.cells[a].v) || '')) change([{ a, v: v.slice(0, 5000) }], 'type');
        $('#grid').focus({ preventScroll: true });
    }
    function cancel() {
        if (!editing) return;
        if (!editing.fromBar) editing.input.remove();
        editing = null;
        paintSel();
        $('#grid').focus({ preventScroll: true });
    }

    /* ---------- copy, cut, paste (as tab-separated text, like Excel) ---------- */
    let clip = null; // { r, c, rows: [[raw]], styles, cut }
    async function copy(cut) {
        const b = box();
        const rows = [];
        const styles = [];
        for (let r = b.r1; r <= b.r2; r++) {
            const row = [];
            const srow = [];
            for (let c = b.c1; c <= b.c2; c++) {
                const cell = sh.cells[FX.addr(c, r)] || {};
                row.push(cell.v || '');
                srow.push(cell.s || null);
            }
            rows.push(row);
            styles.push(srow);
        }
        clip = { r: b.r1, c: b.c1, rows, styles, cut, sheet: sh };
        const text = rows.map((row, i) => row.map((v, j) => {
            const shown = FX.format(ev.get(si(), FX.addr(b.c1 + j, b.r1 + i)), styles[i][j] || {});
            return /[\t\n"]/.test(shown) ? `"${shown.replace(/"/g, '""')}"` : shown;
        }).join('\t')).join('\n');
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // the clipboard isn't available (e.g. not https): copying within the sheet still works
        }
        toast(cut ? 'Cut: paste it somewhere' : 'Copied');
    }
    async function paste() {
        let text = null;
        try {
            text = await navigator.clipboard.readText();
        } catch {
            // no access to the clipboard: use what was copied here
        }
        const edits = [];
        if (clip && (text === null || text === clipText())) {
            // from this spreadsheet: formulas move along, styles come too
            clip.rows.forEach((row, i) => row.forEach((v, j) => {
                const a = FX.addr(sel.c + j, sel.r + i);
                edits.push({ a, v: FX.shift(v, sel.r - clip.r, sel.c - clip.c), s: clip.styles[i][j] });
            }));
            if (clip.cut) {
                clip.rows.forEach((row, i) => row.forEach((v, j) => {
                    const a = FX.addr(clip.c + j, clip.r + i);
                    if (!edits.some(e => e.a === a)) edits.push({ a, v: '', s: null });
                }));
                clip = null;
            }
        } else if (text !== null) {
            // from Excel or another app: tab-separated rows
            const rows = parseTsv(text);
            rows.forEach((row, i) => row.forEach((v, j) => edits.push({ a: FX.addr(sel.c + j, sel.r + i), v })));
        }
        if (edits.length) change(edits, 'paste');
    }
    function clipText() {
        if (!clip) return null;
        return clip.rows.map((row, i) => row.map((v, j) => {
            const shown = FX.format(ev.get(wb.body.sheets.indexOf(clip.sheet), FX.addr(clip.c + j, clip.r + i)), clip.styles[i][j] || {});
            return /[\t\n"]/.test(shown) ? `"${shown.replace(/"/g, '""')}"` : shown;
        }).join('\t')).join('\n');
    }
    function parseTsv(text) {
        const rows = [[]];
        let cur = '';
        let q = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (q) {
                if (ch === '"' && text[i + 1] === '"') (cur += '"'), i++;
                else if (ch === '"') q = false;
                else cur += ch;
            } else if (ch === '"' && cur === '') q = true;
            else if (ch === '\t') rows[rows.length - 1].push(cur), (cur = '');
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                rows[rows.length - 1].push(cur);
                cur = '';
                rows.push([]);
            } else cur += ch;
        }
        rows[rows.length - 1].push(cur);
        while (rows.length > 1 && rows[rows.length - 1].every(v => v === '')) rows.pop();
        return rows.slice(0, 5000).map(r => r.slice(0, 200));
    }

    /* ---------- rows, columns, sorting ---------- */
    function moveCells(fn) {
        // rebuild the sheet's cells through fn(r, c) -> new position or null; formulas aren't rewritten
        const before = Object.keys(sh.cells).map(a => ({ a, cell: JSON.parse(JSON.stringify(sh.cells[a])) }));
        const next = {};
        for (const [a, cell] of Object.entries(sh.cells)) {
            const p = FX.parseAddr(a);
            const to = fn(p.r, p.c);
            if (to) next[FX.addr(to.c, to.r)] = cell;
        }
        const touched = new Set([...Object.keys(sh.cells), ...Object.keys(next)]);
        sh.cells = next;
        undo.push({ sheet: sh, before: [...touched].map(a => ({ a, cell: (before.find(b => b.a === a) || {}).cell || null })), label: 'move' });
        redo = [];
        drawGrid();
        refreshCells();
        changed();
    }
    function sortSel(desc) {
        const b = box();
        const top = b.r1 === b.r2 ? 1 : b.r1;
        const { rows } = size();
        const bottom = b.r1 === b.r2 ? Math.max(...Object.keys(sh.cells).map(a => FX.parseAddr(a).r), 1) : b.r2;
        const c1 = b.c1 === b.c2 ? 1 : b.c1;
        const c2 = b.c1 === b.c2 ? Math.max(...Object.keys(sh.cells).map(a => FX.parseAddr(a).c), 1) : b.c2;
        const key = sel.c;
        // a header row (text above numbers) stays on top
        const head = top === 1 && typeof ev.get(si(), FX.addr(key, 1)) === 'string' && typeof ev.get(si(), FX.addr(key, 2)) === 'number' ? 1 : 0;
        const list = [];
        for (let r = top + head; r <= Math.min(bottom, rows); r++) {
            const row = [];
            for (let c = c1; c <= c2; c++) row.push(sh.cells[FX.addr(c, r)] || null);
            list.push({ k: ev.get(si(), FX.addr(key, r)), row });
        }
        list.sort((x, y) => {
            const a = x.k;
            const b2 = y.k;
            if (a === null || a === '') return 1;
            if (b2 === null || b2 === '') return -1;
            const res = typeof a === 'number' && typeof b2 === 'number' ? a - b2 : String(a).localeCompare(String(b2), undefined, { numeric: true });
            return desc ? -res : res;
        });
        const edits = [];
        list.forEach((item, i) => item.row.forEach((cell, j) => edits.push({ a: FX.addr(c1 + j, top + head + i), v: cell ? cell.v || '' : '', s: cell ? cell.s || null : null })));
        change(edits, 'sort');
    }

    /* ---------- the ribbon, keys and mouse ---------- */
    function cmd(name) {
        if (!wb.canEdit && !['copy'].includes(name)) return;
        const b = box();
        const s0 = (sh.cells[FX.addr(sel.c, sel.r)] || {}).s || {};
        switch (name) {
            case 'undo': return restore(undo, redo);
            case 'redo': return restore(redo, undo);
            case 'cut': return copy(true);
            case 'copy': return copy(false);
            case 'paste': return paste();
            case 'b': case 'i': case 'u': case 'st': case 'wrap': return setStyle(s => (s[name] = !s0[name]));
            case 'align-left': case 'align-center': case 'align-right': {
                const a = name.slice(6);
                return setStyle(s => (s.align = s0.align === a ? undefined : a));
            }
            case 'dec-more': return setStyle(s => (s.dec = Math.min(6, (s.dec != null ? s.dec : s.fmt === 'percent' ? 0 : 2) + 1)));
            case 'dec-less': return setStyle(s => (s.dec = Math.max(0, (s.dec != null ? s.dec : s.fmt === 'percent' ? 0 : 2) - 1)));
            case 'clear': return clearSel();
            case 'row-add': return moveCells((r, c) => ({ r: r >= b.r1 ? r + (b.r2 - b.r1 + 1) : r, c }));
            case 'col-add': return moveCells((r, c) => ({ r, c: c >= b.c1 ? c + (b.c2 - b.c1 + 1) : c }));
            case 'row-del': return moveCells((r, c) => (r >= b.r1 && r <= b.r2 ? null : { r: r > b.r2 ? r - (b.r2 - b.r1 + 1) : r, c }));
            case 'col-del': return moveCells((r, c) => (c >= b.c1 && c <= b.c2 ? null : { r, c: c > b.c2 ? c - (b.c2 - b.c1 + 1) : c }));
            case 'sort-asc': return sortSel(false);
            case 'sort-desc': return sortSel(true);
            case 'freeze':
                sh.freeze = !sh.freeze;
                drawGrid();
                return changed();
            case 'sum': {
                // the numbers right above (or to the left of) the active cell
                let r = sel.r - 1;
                while (r >= 1 && typeof ev.get(si(), FX.addr(sel.c, r)) === 'number') r--;
                if (r < sel.r - 1) return change([{ a: FX.addr(sel.c, sel.r), v: `=SUM(${FX.addr(sel.c, r + 1)}:${FX.addr(sel.c, sel.r - 1)})` }], 'sum');
                let c = sel.c - 1;
                while (c >= 1 && typeof ev.get(si(), FX.addr(c, sel.r)) === 'number') c--;
                if (c < sel.c - 1) return change([{ a: FX.addr(sel.c, sel.r), v: `=SUM(${FX.addr(c + 1, sel.r)}:${FX.addr(sel.c - 1, sel.r)})` }], 'sum');
                return startEdit('=SUM()');
            }
        }
    }
    function wire() {
        const grid = $('#grid');
        grid.tabIndex = 0;
        $('.rb')?.addEventListener('mousedown', e => e.target.closest('.rb-btn') && e.preventDefault());
        $('.rb')?.addEventListener('click', e => {
            const b = e.target.closest('[data-cmd]');
            if (b) cmd(b.dataset.cmd);
            const p = e.target.closest('[data-pop]');
            if (p) colorPop(p, p.dataset.pop);
        });
        $('#fmt')?.addEventListener('change', e => setStyle(s => (s.fmt = e.target.value === 'general' ? undefined : e.target.value)));
        // the formula bar
        const bar = $('#formula');
        bar.addEventListener('focus', () => wb.canEdit && (editing = { r: sel.r, c: sel.c, input: bar, fromBar: true }));
        bar.addEventListener('keydown', e => {
            if (e.key === 'Enter') (e.preventDefault(), commit(true), select(sel.r + 1, sel.c));
            else if (e.key === 'Escape') (e.preventDefault(), (bar.value = (sh.cells[FX.addr(sel.c, sel.r)] || {}).v || ''), cancel());
        });
        bar.addEventListener('blur', () => editing && editing.fromBar && commit(true));
        // the name box: type B12 (or B2:D8) to go there
        $('#namebox').addEventListener('keydown', e => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const [a, b] = e.target.value.trim().toUpperCase().split(':').map(FX.parseAddr);
            if (!a) return paintSel();
            select(a.r, a.c);
            if (b) select(b.r, b.c, true);
            grid.focus();
        });
        // mouse: click, shift-click and drag to select; double-click to type
        let dragging = false;
        grid.addEventListener('mousedown', e => {
            const td = e.target.closest('td[data-a]');
            const ch = e.target.closest('.sx-ch');
            const rh = e.target.closest('.sx-rh');
            if (e.target.closest('.sx-resize')) return;
            if (editing && editing.input && editing.input.value.startsWith('=') && td) {
                // building a formula: clicking a cell adds its address
                e.preventDefault();
                const p = FX.parseAddr(td.dataset.a);
                editing.input.value += FX.addr(p.c, p.r);
                editing.input.focus();
                $('#formula').value = editing.input.value;
                return;
            }
            if (editing) commit(true);
            const { rows, cols } = size();
            if (ch) {
                const c = +ch.dataset.c;
                if (e.shiftKey) Object.assign(sel, { c2: c, r2: rows });
                else sel = { r: 1, c, r2: rows, c2: c };
                return paintSel();
            }
            if (rh) {
                const r = +rh.dataset.r;
                if (e.shiftKey) Object.assign(sel, { r2: r, c2: cols });
                else sel = { r, c: 1, r2: r, c2: cols };
                return paintSel();
            }
            if (!td) return;
            const p = FX.parseAddr(td.dataset.a);
            select(p.r, p.c, e.shiftKey);
            dragging = true;
            grid.focus({ preventScroll: true });
        });
        grid.addEventListener('mouseover', e => {
            if (!dragging) return;
            const td = e.target.closest('td[data-a]');
            if (td) {
                const p = FX.parseAddr(td.dataset.a);
                Object.assign(sel, { r2: p.r, c2: p.c });
                paintSel();
            }
        });
        addEventListener('mouseup', () => (dragging = false));
        grid.addEventListener('dblclick', e => e.target.closest('td[data-a]') && startEdit());
        // keys
        grid.addEventListener('keydown', e => {
            if (editing) return;
            const k = e.key;
            const mod = e.ctrlKey || e.metaKey;
            const move = (dr, dc) => (e.preventDefault(), e.shiftKey ? select(sel.r2 + dr, sel.c2 + dc, true) : select(sel.r + dr, sel.c + dc));
            if (k === 'ArrowDown') return move(1, 0);
            if (k === 'ArrowUp') return move(-1, 0);
            if (k === 'ArrowRight') return move(0, 1);
            if (k === 'ArrowLeft') return move(0, -1);
            if (k === 'Enter') return move(e.shiftKey ? -1 : 1, 0);
            if (k === 'Tab') return (e.preventDefault(), select(sel.r, sel.c + (e.shiftKey ? -1 : 1)));
            if (k === 'Home') return (e.preventDefault(), select(sel.r, 1));
            if (k === 'PageDown') return move(20, 0);
            if (k === 'PageUp') return move(-20, 0);
            if (k === 'F2') return (e.preventDefault(), startEdit());
            if (k === 'Delete' || k === 'Backspace') return (e.preventDefault(), cmd('clear'));
            if (mod && !e.altKey) {
                const key = k.toLowerCase();
                const map = { z: 'undo', y: 'redo', b: 'b', i: 'i', u: 'u', c: 'copy', x: 'cut', v: 'paste' };
                if (key === 'a') return (e.preventDefault(), (sel = { r: 1, c: 1, ...{ r2: size().rows, c2: size().cols } }), paintSel());
                if (map[key]) return (e.preventDefault(), cmd(e.shiftKey && key === 'z' ? 'redo' : map[key]));
            }
            if (e.altKey && k === '=') return (e.preventDefault(), cmd('sum'));
            if (k.length === 1 && !mod && !e.altKey) (e.preventDefault(), startEdit(k));
        });
        // dragging a column's edge resizes it
        grid.addEventListener('mousedown', e => {
            const h = e.target.closest('.sx-resize');
            if (!h) return;
            e.preventDefault();
            const c = +h.dataset.rc;
            const x0 = e.clientX;
            const w0 = width(c);
            const col = $$('#grid col')[c];
            const onMove = ev2 => {
                const w = Math.max(30, Math.min(800, w0 + ev2.clientX - x0));
                col.style.width = w + 'px';
                sh.cols = { ...(sh.cols || {}), [FX.colName(c)]: w };
            };
            const onUp = () => {
                removeEventListener('mousemove', onMove);
                removeEventListener('mouseup', onUp);
                drawGrid();
                changed();
            };
            addEventListener('mousemove', onMove);
            addEventListener('mouseup', onUp);
        });
        // the fill handle: drag to copy down or across (formulas move along)
        $('#handle').addEventListener('mousedown', e => {
            e.preventDefault();
            const b = box();
            let to = null;
            const onMove = ev2 => {
                const el = document.elementFromPoint(ev2.clientX, ev2.clientY);
                const td = el && el.closest('td[data-a]');
                if (!td) return;
                const p = FX.parseAddr(td.dataset.a);
                to = p.r > b.r2 ? { r: p.r, c: b.c2, down: true } : p.c > b.c2 ? { r: b.r2, c: p.c, down: false } : null;
                $$('#grid .fillto').forEach(x => x.classList.remove('fillto'));
                if (to) for (let r = b.r1; r <= to.r; r++) for (let c = b.c1; c <= to.c; c++) tdOf(r, c)?.classList.add('fillto');
            };
            const onUp = () => {
                removeEventListener('mousemove', onMove);
                removeEventListener('mouseup', onUp);
                $$('#grid .fillto').forEach(x => x.classList.remove('fillto'));
                if (!to) return;
                const edits = [];
                if (to.down) {
                    for (let r = b.r2 + 1; r <= to.r; r++) for (let c = b.c1; c <= b.c2; c++) {
                        const src = sh.cells[FX.addr(c, b.r1 + ((r - b.r2 - 1) % (b.r2 - b.r1 + 1)))] || {};
                        edits.push({ a: FX.addr(c, r), v: FX.shift(src.v || '', r - (b.r1 + ((r - b.r2 - 1) % (b.r2 - b.r1 + 1))), 0), s: src.s || null });
                    }
                } else {
                    for (let c = b.c2 + 1; c <= to.c; c++) for (let r = b.r1; r <= b.r2; r++) {
                        const srcC = b.c1 + ((c - b.c2 - 1) % (b.c2 - b.c1 + 1));
                        const src = sh.cells[FX.addr(srcC, r)] || {};
                        edits.push({ a: FX.addr(c, r), v: FX.shift(src.v || '', 0, c - srcC), s: src.s || null });
                    }
                }
                change(edits, 'fill');
                sel.r2 = to.r;
                sel.c2 = to.c;
                paintSel();
            };
            addEventListener('mousemove', onMove);
            addEventListener('mouseup', onUp);
        });
        grid.focus({ preventScroll: true });
    }
    function colorPop(anchor, kind) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop rb-swatches';
        const list = kind === 'fill' ? FILLS : COLORS;
        pop.innerHTML = list.map(c => `<button data-c="${c}" title="${c || 'No fill'}" style="background:${c || 'transparent'}" class="${c ? '' : 'none'}"></button>`).join('');
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = r.bottom + 4 + 'px';
        pop.style.left = r.left + 'px';
        const off = e => !pop.contains(e.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('click', e => {
            const b = e.target.closest('[data-c]');
            if (!b) return;
            pop.remove();
            setStyle(s => (s[kind] = b.dataset.c && !(kind === 'color' && b.dataset.c === '#000000') ? b.dataset.c : undefined));
        });
    }

    /* ---------- sheets (the tabs at the bottom) ---------- */
    function drawTabs() {
        $('#tabs').innerHTML = wb.body.sheets.map((s, i) => `<button class="sx-tab${s === sh ? ' on' : ''}" data-i="${i}">${esc(s.name)}</button>`).join('') + (wb.canEdit ? `<button class="sx-tab add" id="addsheet" title="New sheet" aria-label="New sheet">${ic('plus')}</button>` : '');
    }
    root.addEventListener('click', e => {
        const t = e.target.closest('.sx-tab[data-i]');
        if (t && wb) {
            if (editing) commit(true);
            sh = wb.body.sheets[+t.dataset.i];
            wb.body.active = +t.dataset.i;
            sel = { r: 1, c: 1, r2: 1, c2: 1 };
            drawTabs();
            drawGrid();
            changed(true);
        }
        if (e.target.closest('#addsheet')) {
            let n = wb.body.sheets.length + 1;
            while (wb.body.sheets.some(s => s.name.toLowerCase() === `sheet${n}`)) n++;
            wb.body.sheets.push({ id: Math.random().toString(36).slice(2, 9), name: `Sheet${n}`, cells: {}, cols: {} });
            sh = wb.body.sheets[wb.body.sheets.length - 1];
            wb.body.active = wb.body.sheets.length - 1;
            drawTabs();
            drawGrid();
            changed();
        }
        const c = e.target.closest('.sx-card');
        if (c) open(c.dataset.id);
    });
    root.addEventListener('dblclick', async e => {
        const t = e.target.closest('.sx-tab[data-i]');
        if (!t || !wb.canEdit) return;
        const s = wb.body.sheets[+t.dataset.i];
        const name = prompt('Name of this sheet', s.name);
        if (!name || !name.trim()) return;
        if (wb.body.sheets.some(x => x !== s && x.name.toLowerCase() === name.trim().toLowerCase())) return toast('There’s already a sheet with that name', { bad: true });
        s.name = name.trim().slice(0, 31);
        drawTabs();
        changed();
    });
    root.addEventListener('contextmenu', e => {
        const t = e.target.closest('.sx-tab[data-i]');
        if (!t || !wb.canEdit) return;
        e.preventDefault();
        const i = +t.dataset.i;
        menu(t, [
            ['pen', 'rename', 'Rename', () => t.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))],
            ...(wb.body.sheets.length > 1 ? [['trash', 'delete', 'Delete sheet', async () => {
                if (!(await ask({ title: `Delete ${wb.body.sheets[i].name}?`, text: 'Everything on this sheet goes. This can’t be undone.', ok: 'Delete', danger: true }))) return;
                wb.body.sheets.splice(i, 1);
                sh = wb.body.sheets[Math.min(i, wb.body.sheets.length - 1)];
                wb.body.active = wb.body.sheets.indexOf(sh);
                compute();
                drawTabs();
                drawGrid();
                changed();
            }]] : [])
        ]);
    });

    /* ---------- menus and downloads ---------- */
    function menu(anchor, items) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        pop.innerHTML = items.map(([icon, id, label], i) => `<button data-i="${i}" class="${id === 'trash' || id === 'delete' ? 'danger' : ''}">${ic(icon)}<span>${label}</span></button>`).join('');
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4)}px`;
        pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth))}px`;
        const off = e => !pop.contains(e.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('click', e => {
            const b = e.target.closest('[data-i]');
            if (!b) return;
            pop.remove();
            items[+b.dataset.i][3]();
        });
    }
    async function downloadMenu(anchor) {
        if (dirty) await saveNow();
        const go = fmt => (location.href = `/api/docs/${wb.id}/export?format=${fmt}&sheet=${wb.body.sheets.indexOf(sh)}`);
        menu(anchor, [
            ['grid', 'x', 'Excel workbook (.xlsx)', () => go('xlsx')],
            ['file', 'p', 'PDF (.pdf)', () => go('pdf')],
            ['list', 'c', 'CSV, this sheet (.csv)', () => go('csv')]
        ]);
    }

    /* ---------- saving ---------- */
    function changed(quiet) {
        if (!wb || !wb.canEdit) return;
        dirty = true;
        if (!quiet) $('#saved').textContent = 'Saving…';
        save();
    }
    async function saveNow() {
        if (!wb || !dirty) return;
        dirty = false;
        const d = wb;
        d.title = $('#name') ? $('#name').value : d.title;
        const body = { ...d.body, sheets: d.body.sheets.map(({ _rows, _cols, ...s }) => s) };
        try {
            const r = await call(`/api/docs/${d.id}`, { method: 'PUT', body: { title: d.title, body, version: d.version } });
            d.version = r.version;
            if (wb === d && $('#saved')) $('#saved').textContent = 'Saved';
        } catch (e) {
            dirty = true;
            if ($('#saved')) $('#saved').textContent = 'Not saved';
            toast(e.message, { bad: true });
        }
    }
    const save = debounce(saveNow, 900);
    addEventListener('beforeunload', () => dirty && saveNow());
    // Ctrl Z / Ctrl Y also work when the toolbar or a menu has the focus (the grid handles its own)
    addEventListener('keydown', e => {
        const u = undoKey(e);
        if (!u || !wb || !$('#grid') || editing || textBox(e) || $('#grid').contains(e.target)) return;
        e.preventDefault();
        cmd(u);
    });

    call('/api/docs?kind=sheet')
        .then(r => {
            books = r;
            const want = location.hash.slice(1);
            if (want === 'new') create();
            else if (want && books.some(d => d.id === want)) open(want);
            else gallery();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your spreadsheets</h1><p>${esc(e.message)}</p></div>`));
})();
