// Whiteboard: an endless canvas to draw, sketch and plan on, like Microsoft Whiteboard.
// Pen, highlighter, eraser, lines, arrows, shapes, text and sticky notes; pan and zoom (pinch on
// a phone); undo; share a board to draw together; download as PNG or SVG.
(function () {
    const { $, $$, esc, ic, call, toast, ask, debounce, ago } = window.EG;
    const root = $('#whiteboard');
    const NS = 'http://www.w3.org/2000/svg';
    const COLORS = ['#1f1f1f', '#e5484d', '#f08a24', '#e8b500', '#2fb36a', '#2f6bff', '#9b5de5', '#ffffff'];
    const NOTES = ['#ffe680', '#ffc2d6', '#bdf2c7', '#bde0ff', '#ffd2a8', '#e2d4ff'];
    const WIDTHS = [2, 4, 8];
    const TOOLS = [
        ['select', 'V', 'Select and move', '<path d="M5 3l14 8-6 1.6L10 19z"/>'],
        ['hand', 'H', 'Move around', '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-8a1.5 1.5 0 0 1 3 0V12M14 11.5v-6a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6.5 7S5 18.5 4 16l-1.6-3.2a1.4 1.4 0 0 1 2.4-1.4L8 15"/>'],
        ['pen', 'P', 'Pen', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'],
        ['marker', 'M', 'Highlighter', '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'],
        ['eraser', 'E', 'Eraser', '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L11 21z"/><path d="M22 21H7M5 11l9 9"/>'],
        ['line', 'L', 'Line', '<path d="M5 19 19 5"/>'],
        ['arrow', 'A', 'Arrow', '<path d="M5 19 19 5M10 5h9v9"/>'],
        ['rect', 'R', 'Rectangle', '<rect x="4" y="6" width="16" height="12" rx="1.5"/>'],
        ['ellipse', 'O', 'Circle', '<ellipse cx="12" cy="12" rx="9" ry="7"/>'],
        ['text', 'T', 'Text', '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'],
        ['note', 'N', 'Sticky note', '<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5"/>']
    ];
    const uid = () => Math.random().toString(36).slice(2, 10);
    let list = [];
    let open = null; // { id, title, body: { bg, items }, … }
    let tool = 'pen';
    let color = '#1f1f1f';
    let width = 4;
    let noteColor = NOTES[0];
    let fill = false;
    let view = { x: 0, y: 0, z: 1 }; // the world point at the top-left, and the zoom
    let sel = new Set();
    let undo = [];
    let redo = [];
    let dirty = false;
    let pendingIds = new Set(); // changed here since the last save (for merging with others)
    let removedIds = new Set();
    let busy = false; // in the middle of drawing or moving
    let svg = null;
    let layer = null;

    /* ---------- the start screen ---------- */
    function gallery() {
        open = null;
        document.body.classList.remove('wb-office');
        const mine = list.filter(d => d.mine);
        const shared = list.filter(d => !d.mine);
        const card = d => `<button class="wb-card" data-id="${esc(d.id)}"><span class="wb-thumb">${ic('pen')}</span><b>${d.share !== 'private' ? ic('globe') : ''}${esc(d.title || 'Untitled whiteboard')}</b><small>${esc(ago(d.updatedAt))}${d.mine ? '' : ` · ${esc(d.ownerName)}`}</small></button>`;
        root.innerHTML = `<div class="sl-home">
            <div class="ea-head"><h1>Whiteboard</h1><button class="btn btn-primary" id="new">${ic('plus')}<span>New whiteboard</span></button></div>
            ${mine.length ? `<h2 class="ea-sec">My whiteboards</h2><div class="wb-cards">${mine.map(card).join('')}</div>` : ''}
            ${shared.length ? `<h2 class="ea-sec">Shared with me</h2><div class="wb-cards">${shared.map(card).join('')}</div>` : ''}
            ${mine.length || shared.length ? '' : `<button class="wb-first" id="new2"><span class="wb-thumb blank">${ic('pen')}</span><b>Start drawing</b><small>Sketch an idea, plan a room, draw with the kids. Share a whiteboard to draw on it together.</small></button>`}
        </div>`;
        $('#new').onclick = create;
        $('#new2') && ($('#new2').onclick = create);
        history.replaceState(null, '', location.pathname);
    }
    async function create() {
        const d = await call('/api/docs', { method: 'POST', body: { kind: 'wb', title: '', body: { bg: 'dots', items: [] } } });
        list.unshift(d);
        select(d.id);
    }
    async function select(id) {
        if (dirty) await saveNow();
        try {
            open = await call(`/api/docs/${id}`);
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        undo = [];
        redo = [];
        sel = new Set();
        pendingIds = new Set();
        removedIds = new Set();
        history.replaceState(null, '', `${location.pathname}#${id}`);
        editor();
    }

    /* ---------- the editor ---------- */
    function editor() {
        document.body.classList.add('wb-office');
        const ro = !open.canEdit;
        if (ro) tool = 'hand';
        root.innerHTML = `<div class="wb bg-${esc(open.body.bg)}">
            <div class="of-title">
                <button class="icon-btn" id="home" title="All whiteboards" aria-label="All whiteboards">${ic('left')}</button>
                <span class="of-app wb-app">${ic('pen')}</span>
                <input class="of-name" id="name" value="${esc(open.title)}" placeholder="Untitled whiteboard" ${ro ? 'readonly' : ''} aria-label="Whiteboard name">
                <span class="nt-saved" id="saved"></span><span class="spacer"></span>
                ${open.mine ? '<select class="input of-share" id="share" aria-label="Who can see it"><option value="private">Only me</option><option value="view">Everyone can see it</option><option value="edit">Everyone can draw on it</option></select>' : ''}
                <button class="btn of-dl" id="download">${ic('download')}<span>Download</span></button>
                <button class="icon-btn" id="more" aria-label="More">${ic('more')}</button>
            </div>
            <div class="wb-stage" id="stage">
                <svg class="wb-svg" id="svg" xmlns="${NS}"><defs>
                    <pattern id="pat-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.1" class="wb-dot"/></pattern>
                    <pattern id="pat-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" class="wb-gridline"/></pattern>
                    <marker id="arrowhead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="context-stroke"/></marker>
                </defs><rect class="wb-bg" id="bgrect"/><g id="layer"></g><g id="overlay"></g></svg>
                ${ro ? '' : `<div class="wb-tools" id="tools" role="toolbar" aria-label="Tools">${TOOLS.map(([t, k, l, path]) => `<button data-tool="${t}" title="${l} (${k})" aria-label="${l}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg></button>`).join('')}<i></i><button data-act="undo" title="Undo (Ctrl Z)" aria-label="Undo">${ic('undo')}</button><button data-act="redo" title="Redo (Ctrl Y)" aria-label="Redo">${ic('redo')}</button></div>
                <div class="wb-style" id="style"></div>`}
                <div class="wb-zoom"><button data-z="-1" aria-label="Zoom out">−</button><button data-z="fit" id="zlabel" title="Fit to screen">100%</button><button data-z="1" aria-label="Zoom in">+</button></div>
                <textarea class="wb-editor" id="editor" hidden></textarea>
            </div>
        </div>`;
        svg = $('#svg');
        layer = $('#layer');
        if ($('#share')) $('#share').value = open.share;
        $('#home').onclick = async () => {
            if (dirty) await saveNow();
            list = await call('/api/docs?kind=wb');
            gallery();
        };
        $('#name').addEventListener('input', () => {
            open.title = $('#name').value;
            changed();
        });
        $('#name').addEventListener('keydown', e => e.key === 'Enter' && e.target.blur());
        $('#download').onclick = e => downloadMenu(e.currentTarget);
        $('#more').onclick = e => moreMenu(e.currentTarget);
        $('#share') && ($('#share').onchange = async e => {
            const r = await call(`/api/docs/${open.id}`, { method: 'PATCH', body: { share: e.target.value } });
            open.share = r.share;
            toast(r.share === 'private' ? 'Only you can see it' : r.share === 'edit' ? 'Everyone on EderveenGroup can see and draw on it' : 'Everyone on EderveenGroup can see it');
        });
        $$('.wb-zoom [data-z]').forEach(b => (b.onclick = () => (b.dataset.z === 'fit' ? fitView() : zoomAt(b.dataset.z > 0 ? 1.25 : 0.8))));
        if (!ro) {
            $('#tools').addEventListener('click', e => {
                const b = e.target.closest('[data-tool]');
                if (b) setTool(b.dataset.tool);
                const a = e.target.closest('[data-act]');
                if (a) step(a.dataset.act === 'undo' ? undo : redo, a.dataset.act === 'undo' ? redo : undo);
            });
        }
        bindCanvas();
        new ResizeObserver(() => applyView()).observe($('#stage'));
        open.body.items.length ? fitView() : applyView();
        setTool(ro ? 'hand' : tool === 'hand' && !ro ? 'pen' : tool);
        draw();
    }
    function setTool(t) {
        tool = t;
        sel = t === 'select' ? sel : new Set();
        $$('#tools [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
        $('#stage').dataset.tool = t;
        drawStyle();
        drawSel();
    }
    function drawStyle() {
        const st = $('#style');
        if (!st) return;
        const selItems = [...sel].map(id => itemById(id)).filter(Boolean);
        const shows = ['pen', 'marker', 'line', 'arrow', 'rect', 'ellipse', 'text'].includes(tool) || (tool === 'select' && selItems.length);
        const noteMode = tool === 'note' || (tool === 'select' && selItems.length && selItems.every(i => i.t === 'note'));
        if (!shows && !noteMode) return (st.hidden = true);
        st.hidden = false;
        const cur = tool === 'select' && selItems.length ? selItems[0].c : noteMode ? noteColor : color;
        st.innerHTML = (noteMode ? NOTES : COLORS).map(c => `<button class="wb-sw${c === cur ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('') +
            (['pen', 'line', 'arrow', 'rect', 'ellipse'].includes(tool) ? `<i></i>${WIDTHS.map(w => `<button class="wb-w${w === width ? ' on' : ''}" data-w="${w}" aria-label="Thickness ${w}"><span style="height:${w}px"></span></button>`).join('')}` : '') +
            (['rect', 'ellipse'].includes(tool) ? `<i></i><button class="wb-fill${fill ? ' on' : ''}" data-fill title="Filled">${ic('bucket')}</button>` : '') +
            (tool === 'select' && selItems.length ? `<i></i><button data-front title="Bring to front">${ic('front')}</button><button data-del title="Delete (Del)">${ic('trash')}</button>` : '');
        st.onclick = e => {
            const c = e.target.closest('[data-c]');
            if (c) {
                if (tool === 'select' && sel.size) {
                    remember();
                    for (const it of selItems) {
                        it.c = c.dataset.c;
                        touch(it);
                    }
                    draw();
                    changed();
                } else if (noteMode) noteColor = c.dataset.c;
                else color = c.dataset.c;
                return drawStyle();
            }
            const w = e.target.closest('[data-w]');
            if (w) return ((width = +w.dataset.w), drawStyle());
            if (e.target.closest('[data-fill]')) return ((fill = !fill), drawStyle());
            if (e.target.closest('[data-del]')) return deleteSel();
            if (e.target.closest('[data-front]')) {
                remember();
                const items = open.body.items;
                for (const it of selItems) {
                    items.splice(items.indexOf(it), 1);
                    items.push(it);
                    touch(it);
                }
                draw();
                changed();
            }
        };
    }

    /* ---------- drawing the board ---------- */
    const itemById = id => open.body.items.find(i => i.id === id);
    const el = (name, attrs) => {
        const e = document.createElementNS(NS, name);
        for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
        return e;
    };
    function strokePath(p) {
        if (p.length < 4) return '';
        let d = `M${p[0]} ${p[1]}`;
        if (p.length === 4) return `${d}L${p[2]} ${p[3]}`;
        for (let i = 2; i < p.length - 2; i += 2) {
            const mx = (p[i] + p[i + 2]) / 2;
            const my = (p[i + 1] + p[i + 3]) / 2;
            d += `Q${p[i]} ${p[i + 1]} ${mx} ${my}`;
        }
        return `${d}L${p[p.length - 2]} ${p[p.length - 1]}`;
    }
    // text that wraps inside a note, measured like the browser would draw it
    const measure = document.createElement('canvas').getContext('2d');
    function wrap(text, size, max) {
        measure.font = `${size}px Geist, system-ui, sans-serif`;
        const out = [];
        for (const para of String(text).split('\n')) {
            let lineText = '';
            for (const word of para.split(/(\s+)/)) {
                const next = lineText + word;
                if (measure.measureText(next).width > max && lineText.trim()) {
                    out.push(lineText.trimEnd());
                    lineText = word.trimStart();
                } else lineText = next;
            }
            out.push(lineText);
        }
        return out;
    }
    function textLines(g, lines, x, y, size, fillC, anchor = 'start') {
        const t = el('text', { x, y, 'font-size': size, fill: fillC, 'font-family': 'Geist, system-ui, sans-serif', 'text-anchor': anchor });
        lines.forEach((l, i) => {
            const s = el('tspan', { x, dy: i ? size * 1.25 : size });
            s.textContent = l || ' ';
            t.append(s);
        });
        g.append(t);
    }
    function render(it) {
        const g = el('g', { 'data-id': it.id });
        if (it.t === 'pen' || it.t === 'marker') g.append(el('path', { d: strokePath(it.p), fill: 'none', stroke: it.c, 'stroke-width': it.w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: it.t === 'marker' ? 0.38 : null }));
        else if (it.t === 'line' || it.t === 'arrow') g.append(el('line', { x1: it.x, y1: it.y, x2: it.x + it.w, y2: it.y + it.h, stroke: it.c, 'stroke-width': it.s, 'stroke-linecap': 'round', 'marker-end': it.t === 'arrow' ? 'url(#arrowhead)' : null }));
        else if (it.t === 'rect') g.append(el('rect', { x: it.x, y: it.y, width: Math.max(1, it.w), height: Math.max(1, it.h), rx: 4, fill: it.f || 'none', stroke: it.c, 'stroke-width': it.s }));
        else if (it.t === 'ellipse') g.append(el('ellipse', { cx: it.x + it.w / 2, cy: it.y + it.h / 2, rx: Math.max(0.5, it.w / 2), ry: Math.max(0.5, it.h / 2), fill: it.f || 'none', stroke: it.c, 'stroke-width': it.s }));
        else if (it.t === 'text') {
            textLines(g, String(it.text).split('\n'), it.x, it.y, it.size, it.c);
            g.append(el('rect', { x: it.x, y: it.y, width: Math.max(10, it.w), height: Math.max(10, it.h), fill: 'transparent' }));
        } else if (it.t === 'note') {
            g.append(el('rect', { x: it.x + 3, y: it.y + 5, width: it.w, height: it.h, rx: 3, fill: 'rgba(0,0,0,.18)', filter: null }));
            g.append(el('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 3, fill: it.c }));
            const pad = 14;
            textLines(g, wrap(it.text, it.size, it.w - pad * 2), it.x + pad, it.y + pad - 4, it.size, '#1f1f1f');
        }
        return g;
    }
    function draw() {
        if (!layer) return;
        layer.textContent = '';
        for (const it of open.body.items) layer.append(render(it));
        drawSel();
    }
    function bbox(it) {
        if (it.t === 'pen' || it.t === 'marker') {
            let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
            for (let i = 0; i < it.p.length; i += 2) {
                x1 = Math.min(x1, it.p[i]);
                y1 = Math.min(y1, it.p[i + 1]);
                x2 = Math.max(x2, it.p[i]);
                y2 = Math.max(y2, it.p[i + 1]);
            }
            const h = it.w / 2;
            return { x: x1 - h, y: y1 - h, w: x2 - x1 + it.w, h: y2 - y1 + it.w };
        }
        if (it.t === 'line' || it.t === 'arrow') return { x: Math.min(it.x, it.x + it.w) - it.s, y: Math.min(it.y, it.y + it.h) - it.s, w: Math.abs(it.w) + it.s * 2, h: Math.abs(it.h) + it.s * 2 };
        return { x: it.x, y: it.y, w: it.w, h: it.h };
    }
    function drawSel() {
        const ov = $('#overlay');
        if (!ov) return;
        ov.textContent = '';
        for (const id of sel) {
            const it = itemById(id);
            if (!it) continue;
            const b = bbox(it);
            const pad = 6 / view.z;
            ov.append(el('rect', { x: b.x - pad, y: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2, class: 'wb-selbox', 'stroke-width': 1.5 / view.z, rx: 4 / view.z }));
            if (sel.size === 1 && ['rect', 'ellipse', 'note', 'text'].includes(it.t)) {
                const s = 12 / view.z;
                ov.append(el('rect', { x: b.x + b.w + pad - s / 2, y: b.y + b.h + pad - s / 2, width: s, height: s, rx: s / 3, class: 'wb-handle', 'data-handle': id, 'stroke-width': 1.5 / view.z }));
            }
        }
    }
    function applyView() {
        if (!svg) return;
        const st = $('#stage');
        const w = st.clientWidth;
        const h = st.clientHeight;
        svg.setAttribute('viewBox', `${view.x} ${view.y} ${w / view.z} ${h / view.z}`);
        const bg = $('#bgrect');
        bg.setAttribute('x', view.x);
        bg.setAttribute('y', view.y);
        bg.setAttribute('width', w / view.z);
        bg.setAttribute('height', h / view.z);
        $('#zlabel').textContent = `${Math.round(view.z * 100)}%`;
        drawSel();
    }
    function zoomAt(f, cx, cy) {
        const st = $('#stage').getBoundingClientRect();
        cx = cx == null ? st.width / 2 : cx;
        cy = cy == null ? st.height / 2 : cy;
        const z = Math.max(0.1, Math.min(8, view.z * f));
        const wx = view.x + cx / view.z;
        const wy = view.y + cy / view.z;
        view = { x: wx - cx / z, y: wy - cy / z, z };
        applyView();
    }
    function contentBox(items = open.body.items) {
        if (!items.length) return null;
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        for (const it of items) {
            const b = bbox(it);
            x1 = Math.min(x1, b.x);
            y1 = Math.min(y1, b.y);
            x2 = Math.max(x2, b.x + b.w);
            y2 = Math.max(y2, b.y + b.h);
        }
        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
    function fitView() {
        const st = $('#stage');
        const b = contentBox();
        if (!b) {
            view = { x: -st.clientWidth / 2, y: -st.clientHeight / 2, z: 1 };
            return applyView();
        }
        const z = Math.max(0.1, Math.min(2, Math.min((st.clientWidth - 120) / Math.max(b.w, 1), (st.clientHeight - 140) / Math.max(b.h, 1))));
        view = { z, x: b.x + b.w / 2 - st.clientWidth / 2 / z, y: b.y + b.h / 2 - st.clientHeight / 2 / z };
        applyView();
    }

    /* ---------- pointer input: draw, erase, move, pan, pinch ---------- */
    const world = e => {
        const r = $('#stage').getBoundingClientRect();
        return { x: view.x + (e.clientX - r.left) / view.z, y: view.y + (e.clientY - r.top) / view.z, sx: e.clientX - r.left, sy: e.clientY - r.top };
    };
    function hit(pt, tol) {
        const items = open.body.items;
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it.t === 'pen' || it.t === 'marker') {
                const d = it.w / 2 + tol;
                for (let j = 0; j < it.p.length - 2; j += 2) if (segDist(pt.x, pt.y, it.p[j], it.p[j + 1], it.p[j + 2], it.p[j + 3]) <= d) return it;
            } else if (it.t === 'line' || it.t === 'arrow') {
                if (segDist(pt.x, pt.y, it.x, it.y, it.x + it.w, it.y + it.h) <= it.s / 2 + tol) return it;
            } else if (it.t === 'rect' && !it.f) {
                const edges = [[it.x, it.y, it.x + it.w, it.y], [it.x + it.w, it.y, it.x + it.w, it.y + it.h], [it.x, it.y + it.h, it.x + it.w, it.y + it.h], [it.x, it.y, it.x, it.y + it.h]];
                if (edges.some(e => segDist(pt.x, pt.y, ...e) <= it.s / 2 + tol)) return it;
            } else if (it.t === 'ellipse' && !it.f) {
                const rx = it.w / 2;
                const ry = it.h / 2;
                const nx = (pt.x - it.x - rx) / Math.max(rx, 1);
                const ny = (pt.y - it.y - ry) / Math.max(ry, 1);
                if (Math.abs(Math.hypot(nx, ny) - 1) * Math.min(rx, ry) <= it.s / 2 + tol) return it;
            } else {
                const b = bbox(it);
                if (pt.x >= b.x - tol && pt.x <= b.x + b.w + tol && pt.y >= b.y - tol && pt.y <= b.y + b.h + tol) return it;
            }
        }
        return null;
    }
    function segDist(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const l = dx * dx + dy * dy;
        const t = l ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l)) : 0;
        return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
    }
    // fewer points for the same line (Ramer–Douglas–Peucker)
    function simplify(p, eps) {
        const pts = [];
        for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]]);
        const keep = new Uint8Array(pts.length);
        keep[0] = keep[pts.length - 1] = 1;
        const stack = [[0, pts.length - 1]];
        while (stack.length) {
            const [a, b] = stack.pop();
            let best = 0;
            let at = -1;
            for (let i = a + 1; i < b; i++) {
                const d = segDist(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
                if (d > best) (best = d), (at = i);
            }
            if (best > eps && at > 0) {
                keep[at] = 1;
                stack.push([a, at], [at, b]);
            }
        }
        const out = [];
        pts.forEach((q, i) => keep[i] && out.push(Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10));
        return out;
    }
    let act = null; // what the pointer is doing
    const pointers = new Map();
    function bindCanvas() {
        const st = $('#stage');
        st.addEventListener('pointerdown', down);
        st.addEventListener('pointermove', moveP);
        st.addEventListener('pointerup', up);
        st.addEventListener('pointercancel', up);
        st.addEventListener('dblclick', e => {
            if (!open.canEdit) return;
            const it = hit(world(e), 4 / view.z);
            if (it && (it.t === 'text' || it.t === 'note')) editText(it);
        });
        st.addEventListener('wheel', e => {
            e.preventDefault();
            const r = st.getBoundingClientRect();
            if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
            else {
                view.x += e.deltaX / view.z;
                view.y += e.deltaY / view.z;
                applyView();
            }
        }, { passive: false });
    }
    function down(e) {
        if (e.target.closest('.wb-tools, .wb-style, .wb-zoom, .wb-editor')) return;
        // the canvas never takes focus (that would end typing in a text or note just placed)
        e.preventDefault();
        commitText();
        $('#stage').setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        // two fingers: pinch and pan, whatever the tool
        if (pointers.size === 2) {
            if (act && act.kind === 'draw') layer.lastChild && act.live && act.live.remove();
            const [a, b] = [...pointers.values()];
            act = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, view: { ...view } };
            return;
        }
        const pt = world(e);
        const panning = tool === 'hand' || e.button === 1 || spaceDown || !open.canEdit;
        if (panning) {
            act = { kind: 'pan', sx: e.clientX, sy: e.clientY, view: { ...view } };
            $('#stage').classList.add('grabbing');
            return;
        }
        if (e.button) return;
        busy = true;
        if (tool === 'pen' || tool === 'marker') {
            const w = tool === 'marker' ? 18 : width;
            const c = tool === 'marker' && color === '#1f1f1f' ? '#e8b500' : color;
            act = { kind: 'draw', it: { id: uid(), t: tool, c, w, p: [pt.x, pt.y] } };
            act.live = el('path', { fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: tool === 'marker' ? 0.38 : null });
            layer.append(act.live);
        } else if (['line', 'arrow', 'rect', 'ellipse'].includes(tool)) {
            act = { kind: 'shape', sx: pt.x, sy: pt.y, it: { id: uid(), t: tool, c: color, s: width, x: pt.x, y: pt.y, w: 0, h: 0, ...(tool === 'rect' || tool === 'ellipse' ? { f: fill ? color : '' } : {}) } };
            act.live = render(act.it);
            layer.append(act.live);
        } else if (tool === 'eraser') {
            remember();
            act = { kind: 'erase', gone: 0 };
            eraseAt(pt);
        } else if (tool === 'text' || tool === 'note') {
            busy = false;
            remember();
            const it = tool === 'note' ? { id: uid(), t: 'note', c: noteColor, x: pt.x - 100, y: pt.y - 100, w: 200, h: 200, text: '', size: 18 } : { id: uid(), t: 'text', c: color, x: pt.x, y: pt.y - 14, w: 20, h: 30, text: '', size: 24 };
            open.body.items.push(it);
            touch(it);
            draw();
            editText(it, true);
        } else if (tool === 'select') {
            const handle = e.target.closest('[data-handle]');
            if (handle) {
                const it = itemById(handle.dataset.handle);
                remember();
                act = { kind: 'resize', it, sx: pt.x, sy: pt.y, start: { ...it } };
                return;
            }
            const it = hit(pt, 6 / view.z);
            if (it) {
                if (!sel.has(it.id)) sel = e.shiftKey ? new Set([...sel, it.id]) : new Set([it.id]);
                remember();
                act = { kind: 'move', sx: pt.x, sy: pt.y, moved: false, starts: [...sel].map(id => [itemById(id), JSON.parse(JSON.stringify(itemById(id)))]) };
            } else {
                sel = new Set();
                act = { kind: 'marquee', sx: pt.x, sy: pt.y };
                act.live = el('rect', { class: 'wb-marquee', x: pt.x, y: pt.y, width: 0, height: 0, 'stroke-width': 1 / view.z });
                $('#overlay').append(act.live);
            }
            drawSel();
            drawStyle();
        }
    }
    function moveP(e) {
        if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (!act) return;
        if (act.kind === 'pinch') {
            if (pointers.size < 2) return;
            const [a, b] = [...pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const r = $('#stage').getBoundingClientRect();
            const z = Math.max(0.1, Math.min(8, act.view.z * (d / act.d)));
            const cx = (a.x + b.x) / 2 - r.left;
            const cy = (a.y + b.y) / 2 - r.top;
            const wx = act.view.x + (act.cx - r.left) / act.view.z;
            const wy = act.view.y + (act.cy - r.top) / act.view.z;
            view = { z, x: wx - cx / z, y: wy - cy / z };
            return applyView();
        }
        if (act.kind === 'pan') {
            view.x = act.view.x - (e.clientX - act.sx) / view.z;
            view.y = act.view.y - (e.clientY - act.sy) / view.z;
            return applyView();
        }
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        const pt = world(e);
        if (act.kind === 'draw') {
            for (const ce of evs.length ? evs : [e]) {
                const q = world(ce);
                const p = act.it.p;
                if (Math.hypot(q.x - p[p.length - 2], q.y - p[p.length - 1]) * view.z > 1.2) p.push(q.x, q.y);
            }
            act.live.setAttribute('d', strokePath(act.it.p.length === 2 ? [...act.it.p, act.it.p[0] + 0.1, act.it.p[1]] : act.it.p));
        } else if (act.kind === 'shape') {
            const it = act.it;
            let dx = pt.x - act.sx;
            let dy = pt.y - act.sy;
            if (e.shiftKey) {
                if (it.t === 'line' || it.t === 'arrow') {
                    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
                    const len = Math.hypot(dx, dy);
                    dx = Math.cos(a) * len;
                    dy = Math.sin(a) * len;
                } else {
                    const m = Math.max(Math.abs(dx), Math.abs(dy));
                    dx = Math.sign(dx || 1) * m;
                    dy = Math.sign(dy || 1) * m;
                }
            }
            if (it.t === 'line' || it.t === 'arrow') Object.assign(it, { x: act.sx, y: act.sy, w: dx, h: dy });
            else Object.assign(it, { x: Math.min(act.sx, act.sx + dx), y: Math.min(act.sy, act.sy + dy), w: Math.abs(dx), h: Math.abs(dy) });
            const fresh = render(it);
            act.live.replaceWith(fresh);
            act.live = fresh;
        } else if (act.kind === 'erase') eraseAt(pt);
        else if (act.kind === 'move') {
            const dx = pt.x - act.sx;
            const dy = pt.y - act.sy;
            if (Math.hypot(dx, dy) * view.z > 2) act.moved = true;
            for (const [it, s] of act.starts) {
                if (it.p) it.p = s.p.map((v, i) => v + (i % 2 ? dy : dx));
                else Object.assign(it, { x: s.x + dx, y: s.y + dy });
                const g = layer.querySelector(`[data-id="${it.id}"]`);
                if (g) g.replaceWith(render(it));
            }
            drawSel();
        } else if (act.kind === 'resize') {
            const it = act.it;
            const s = act.start;
            const w = Math.max(16, s.w + pt.x - act.sx);
            const h = Math.max(16, s.h + pt.y - act.sy);
            if (it.t === 'text') it.size = Math.max(8, Math.min(200, Math.round(s.size * (h / s.h)))), measureText(it);
            else Object.assign(it, { w, h: it.t === 'note' && e.shiftKey ? w : h });
            const g = layer.querySelector(`[data-id="${it.id}"]`);
            if (g) g.replaceWith(render(it));
            drawSel();
        } else if (act.kind === 'marquee') {
            const x = Math.min(act.sx, pt.x);
            const y = Math.min(act.sy, pt.y);
            const w = Math.abs(pt.x - act.sx);
            const h = Math.abs(pt.y - act.sy);
            Object.entries({ x, y, width: w, height: h }).forEach(([k, v]) => act.live.setAttribute(k, v));
            act.box = { x, y, w, h };
        }
    }
    function up(e) {
        pointers.delete(e.pointerId);
        $('#stage').classList.remove('grabbing');
        if (!act) return;
        const a = act;
        if (a.kind === 'pinch') {
            if (pointers.size < 2) act = null;
            return;
        }
        act = null;
        busy = false;
        if (a.kind === 'draw') {
            a.live.remove();
            const it = a.it;
            if (it.p.length === 2) it.p.push(it.p[0] + 0.1, it.p[1]); // a dot
            it.p = simplify(it.p, 0.6 / view.z);
            if (it.p.length < 4) it.p = [it.p[0], it.p[1], it.p[0] + 0.1, it.p[1]];
            remember();
            open.body.items.push(it);
            touch(it);
            layer.append(render(it));
            changed();
        } else if (a.kind === 'shape') {
            a.live.remove();
            const it = a.it;
            if (Math.hypot(it.w, it.h) * view.z < 4) return;
            remember();
            open.body.items.push(it);
            touch(it);
            layer.append(render(it));
            changed();
        } else if (a.kind === 'erase') {
            if (a.gone) changed();
            else undo.pop();
        } else if (a.kind === 'move') {
            if (a.moved) {
                for (const [it] of a.starts) touch(it);
                changed();
            } else undo.pop();
            drawStyle();
        } else if (a.kind === 'resize') {
            touch(a.it);
            changed();
        } else if (a.kind === 'marquee') {
            a.live.remove();
            if (a.box) {
                const b = a.box;
                sel = new Set(open.body.items.filter(it => {
                    const q = bbox(it);
                    return q.x < b.x + b.w && q.x + q.w > b.x && q.y < b.y + b.h && q.y + q.h > b.y;
                }).map(it => it.id));
            }
            drawSel();
            drawStyle();
        }
    }
    function eraseAt(pt) {
        const it = hit(pt, 8 / view.z);
        if (!it) return;
        open.body.items.splice(open.body.items.indexOf(it), 1);
        removedIds.add(it.id);
        pendingIds.delete(it.id);
        sel.delete(it.id);
        layer.querySelector(`[data-id="${it.id}"]`)?.remove();
        act.gone++;
    }
    function deleteSel() {
        if (!sel.size) return;
        remember();
        open.body.items = open.body.items.filter(it => {
            if (!sel.has(it.id)) return true;
            removedIds.add(it.id);
            pendingIds.delete(it.id);
            return false;
        });
        sel = new Set();
        draw();
        drawStyle();
        changed();
    }

    /* ---------- typing text and notes ---------- */
    let editingItem = null;
    function measureText(it) {
        measure.font = `${it.size}px Geist, system-ui, sans-serif`;
        const lines = String(it.text || ' ').split('\n');
        it.w = Math.max(20, ...lines.map(l => measure.measureText(l || ' ').width)) + 4;
        it.h = lines.length * it.size * 1.25 + it.size * 0.3;
    }
    function editText(it, fresh) {
        const ed = $('#editor');
        editingItem = it;
        const z = view.z;
        const note = it.t === 'note';
        Object.assign(ed.style, {
            left: `${(it.x - view.x) * z + (note ? 14 * z : 0)}px`,
            top: `${(it.y - view.y) * z + (note ? 10 * z : -2)}px`,
            width: note ? `${(it.w - 28) * z}px` : `${Math.max(160, it.w * z + 40)}px`,
            height: note ? `${(it.h - 20) * z}px` : `${Math.max(it.size * 1.4 * z, it.h * z) + 8}px`,
            fontSize: `${it.size * z}px`,
            lineHeight: 1.25,
            color: note ? '#1f1f1f' : it.c,
            background: note ? it.c : 'transparent'
        });
        ed.classList.toggle('note', note);
        ed.value = it.text;
        ed.hidden = false;
        const g = layer.querySelector(`[data-id="${it.id}"]`);
        if (g) g.style.visibility = 'hidden';
        ed.dataset.fresh = fresh ? '1' : '';
        if (!fresh) remember();
        ed.focus();
        ed.setSelectionRange(ed.value.length, ed.value.length);
        ed.oninput = () => {
            if (note) return;
            ed.style.height = 'auto';
            ed.style.height = `${ed.scrollHeight}px`;
            ed.style.width = `${Math.max(160, ed.scrollWidth + 20)}px`;
        };
        ed.onkeydown = e => {
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) (e.preventDefault(), commitText());
        };
        ed.onblur = () => setTimeout(commitText, 0);
    }
    function commitText() {
        const ed = $('#editor');
        const it = editingItem;
        if (!it || !ed) return;
        editingItem = null;
        ed.hidden = true;
        it.text = ed.value.replace(/\s+$/, '');
        if (!it.text.trim() && it.t === 'text') {
            open.body.items.splice(open.body.items.indexOf(it), 1);
            removedIds.add(it.id);
            pendingIds.delete(it.id);
            if (ed.dataset.fresh) undo.pop();
        } else {
            if (it.t === 'text') measureText(it);
            touch(it);
        }
        draw();
        changed();
    }

    /* ---------- undo, keys ---------- */
    function remember() {
        undo.push(JSON.stringify(open.body.items));
        if (undo.length > 100) undo.shift();
        redo = [];
    }
    function step(from, to) {
        if (!from.length) return;
        commitText();
        to.push(JSON.stringify(open.body.items));
        const before = new Map(open.body.items.map(i => [i.id, JSON.stringify(i)]));
        open.body.items = JSON.parse(from.pop());
        const after = new Map(open.body.items.map(i => [i.id, i]));
        // what changed, for merging with others' drawing
        for (const [id, it] of after) if (before.get(id) !== JSON.stringify(it)) touch(it);
        for (const id of before.keys()) if (!after.has(id)) (removedIds.add(id), pendingIds.delete(id));
        sel = new Set();
        draw();
        drawStyle();
        changed();
    }
    const touch = it => {
        pendingIds.add(it.id);
        removedIds.delete(it.id);
    };
    let spaceDown = false;
    addEventListener('keydown', e => {
        if (!open || !svg) return;
        if (e.target.closest && (e.target.closest('input, textarea, select') || e.target.isContentEditable)) return;
        const k = e.key.toLowerCase();
        const mod = e.ctrlKey || e.metaKey;
        if (k === ' ') {
            spaceDown = true;
            $('#stage').classList.add('pan');
            return e.preventDefault();
        }
        if (!open.canEdit) return;
        if (mod && k === 'z') return (e.preventDefault(), e.shiftKey ? step(redo, undo) : step(undo, redo));
        if (mod && k === 'y') return (e.preventDefault(), step(redo, undo));
        if (mod && k === 'a') {
            e.preventDefault();
            setTool('select');
            sel = new Set(open.body.items.map(i => i.id));
            return (drawSel(), drawStyle());
        }
        if ((k === 'delete' || k === 'backspace') && sel.size) return (e.preventDefault(), deleteSel());
        if (k === 'escape') return ((sel = new Set()), drawSel(), drawStyle());
        if (mod && k === 'd' && sel.size) {
            e.preventDefault();
            remember();
            const copies = [...sel].map(id => itemById(id)).map(it => {
                const c = JSON.parse(JSON.stringify(it));
                c.id = uid();
                if (c.p) c.p = c.p.map(v => v + 20);
                else (c.x += 20), (c.y += 20);
                touch(c);
                return c;
            });
            open.body.items.push(...copies);
            sel = new Set(copies.map(c => c.id));
            draw();
            return changed();
        }
        if (mod && (k === '=' || k === '+')) return (e.preventDefault(), zoomAt(1.25));
        if (mod && k === '-') return (e.preventDefault(), zoomAt(0.8));
        if (mod && k === '0') return (e.preventDefault(), fitView());
        const t = TOOLS.find(x => x[1].toLowerCase() === k);
        if (t && !mod) setTool(t[0]);
    });
    addEventListener('keyup', e => {
        if (e.key === ' ') {
            spaceDown = false;
            $('#stage')?.classList.remove('pan');
        }
    });

    /* ---------- downloads ---------- */
    function exportSvg() {
        const b = contentBox() || { x: 0, y: 0, w: 800, h: 600 };
        const pad = 40;
        const clone = svg.cloneNode(true);
        clone.removeAttribute('id');
        clone.querySelector('#overlay').remove();
        const bg = clone.querySelector('#bgrect');
        Object.entries({ x: b.x - pad, y: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2 }).forEach(([k, v]) => bg.setAttribute(k, v));
        bg.setAttribute('fill', '#ffffff');
        clone.setAttribute('viewBox', `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`);
        clone.setAttribute('width', Math.round(b.w + pad * 2));
        clone.setAttribute('height', Math.round(b.h + pad * 2));
        clone.querySelectorAll('[style]').forEach(n => n.removeAttribute('style'));
        return { text: new XMLSerializer().serializeToString(clone), w: b.w + pad * 2, h: b.h + pad * 2 };
    }
    const fileName = ext => `${(open.title || 'Whiteboard').replace(/[\\/:*?"<>|]+/g, '-')}.${ext}`;
    function save_(blob, name) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }
    function toPng(scale = 2) {
        return new Promise((resolve, reject) => {
            const { text, w, h } = exportSvg();
            const img = new Image();
            img.onload = () => {
                const s = Math.min(scale, 8000 / Math.max(w, h));
                const cv = document.createElement('canvas');
                cv.width = Math.round(w * s);
                cv.height = Math.round(h * s);
                const g = cv.getContext('2d');
                g.fillStyle = '#fff';
                g.fillRect(0, 0, cv.width, cv.height);
                g.drawImage(img, 0, 0, cv.width, cv.height);
                cv.toBlob(b => (b ? resolve(b) : reject(new Error('Couldn’t make the picture'))), 'image/png');
            };
            img.onerror = () => reject(new Error('Couldn’t make the picture'));
            img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
        });
    }
    function downloadMenu(anchor) {
        commitText();
        menu(anchor, [
            ['image', 'Picture (.png)', () => toPng().then(b => save_(b, fileName('png'))).catch(e => toast(e.message, { bad: true }))],
            ['code', 'Drawing (.svg)', () => save_(new Blob([exportSvg().text], { type: 'image/svg+xml' }), fileName('svg'))]
        ]);
    }
    function menu(anchor, items) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        pop.innerHTML = items.map(([icon, label, , danger], i) => `<button data-i="${i}" class="${danger ? 'danger' : ''}">${ic(icon)}<span>${esc(label)}</span></button>`).join('');
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
            removeEventListener('pointerdown', off, true);
            items[+b.dataset.i][2]();
        });
    }
    function moreMenu(anchor) {
        menu(anchor, [
            ...(open.canEdit ? [['grid', 'Background: dots', () => setBg('dots')], ['table', 'Background: grid', () => setBg('grid')], ['minimize', 'Background: plain', () => setBg('plain')]] : []),
            ['maximize', 'Fit to screen (Ctrl 0)', fitView],
            ['copy', 'Make a copy', async () => {
                if (dirty) await saveNow();
                const c = await call(`/api/docs/${open.id}/copy`, { method: 'POST', body: {} });
                list.unshift(c);
                select(c.id);
                toast('A copy of your own');
            }],
            ...(open.canEdit ? [['eraser', 'Clear the whiteboard', async () => {
                if (!(await ask({ title: 'Clear everything?', text: 'You can undo this.', ok: 'Clear', danger: true }))) return;
                remember();
                for (const it of open.body.items) removedIds.add(it.id);
                pendingIds = new Set();
                open.body.items = [];
                sel = new Set();
                draw();
                changed();
            }]] : []),
            ...(open.mine ? [['trash', 'Delete whiteboard', async () => {
                if (!(await ask({ title: 'Delete this whiteboard?', text: 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
                await call(`/api/docs/${open.id}`, { method: 'DELETE' });
                dirty = false;
                list = list.filter(x => x.id !== open.id);
                gallery();
            }, true]] : [])
        ]);
    }
    function setBg(bg) {
        open.body.bg = bg;
        $('.wb').className = `wb bg-${bg}`;
        changed();
    }

    /* ---------- saving, and drawing together ---------- */
    function changed() {
        if (!open || !open.canEdit) return;
        dirty = true;
        $('#saved') && ($('#saved').textContent = 'Saving…');
        save();
    }
    // others' drawing, with what was changed here put on top
    function merge(fresh) {
        const mine = new Map(open.body.items.filter(i => pendingIds.has(i.id)).map(i => [i.id, i]));
        const items = fresh.body.items.filter(i => !removedIds.has(i.id) && !mine.has(i.id));
        for (const it of mine.values()) items.push(it);
        open.body.items = items;
        open.version = fresh.version;
        open.title = $('#name') && document.activeElement === $('#name') ? open.title : fresh.title;
        if (!busy && !editingItem) draw();
    }
    async function saveNow() {
        if (!open || !dirty) return;
        if (busy || editingItem) return save();
        dirty = false;
        const d = open;
        const sent = { pending: new Set(pendingIds), removed: new Set(removedIds) };
        try {
            const r = await call(`/api/docs/${d.id}`, { method: 'PUT', body: { title: (d.title || '').trim(), body: d.body, version: d.version } });
            d.version = r.version;
            for (const id of sent.pending) pendingIds.delete(id);
            for (const id of sent.removed) removedIds.delete(id);
            if ($('#saved') && open === d) $('#saved').textContent = 'Saved';
        } catch (e) {
            if (/changed this/.test(e.message)) {
                // someone else drew at the same time: take theirs, add ours, save again
                const fresh = await call(`/api/docs/${d.id}`);
                merge(fresh);
                dirty = true;
                return saveNow();
            }
            dirty = true;
            if ($('#saved')) $('#saved').textContent = 'Not saved';
            toast(e.message, { bad: true });
        }
    }
    const save = debounce(saveNow, 800);
    addEventListener('beforeunload', () => dirty && saveNow());
    setInterval(async () => {
        if (!open || open.share === 'private' || dirty || busy || editingItem || document.visibilityState !== 'visible' || !svg) return;
        try {
            const fresh = await call(`/api/docs/${open.id}`);
            if (fresh.version !== open.version && !dirty && !busy) merge(fresh);
        } catch {
            // offline for a moment
        }
    }, 4000);

    root.addEventListener('click', e => {
        if (open) return;
        const c = e.target.closest('.wb-card');
        if (c) select(c.dataset.id);
    });
    call('/api/docs?kind=wb')
        .then(r => {
            list = r;
            const want = location.hash.slice(1);
            if (want && list.some(d => d.id === want)) select(want);
            else gallery();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your whiteboards</h1><p>${esc(e.message)}</p></div>`));
})();
