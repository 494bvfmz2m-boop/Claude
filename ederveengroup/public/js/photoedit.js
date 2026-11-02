// Photo Editor: light and colour, looks, effects, crop, rotate and straighten, text, stickers
// and drawing, with undo. Everything runs on the graphics card (imagefx.js); the photo itself
// is never changed: you download an edited copy or save one to Files. Admins can let Claude
// edit a photo (Admin → AI).
(function () {
    const { $, $$, esc, ic, call, toast, upload, phone, typing: textBox, undoKey } = window.EG;
    const FX = window.EGFX;
    const root = $('#photoedit');
    const ASPECTS = [['free', 'Free'], ['original', 'Original'], ['1:1', 'Square'], ['4:5', '4:5'], ['16:9', '16:9'], ['9:16', '9:16'], ['3:2', '3:2'], ['2:3', '2:3']];
    const FONTS = [['Geist', "Geist, system-ui, sans-serif"], ['Serif', "'Instrument Serif', Georgia, serif"], ['Impact', "Impact, 'Arial Black', sans-serif"], ['Rounded', "'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif"], ['Mono', "'Courier New', monospace"], ['Script', "'Brush Script MT', 'Segoe Script', cursive"]];
    const COLORS = ['#ffffff', '#111111', '#e5484d', '#f08a24', '#f5c518', '#2fb36a', '#2f6bff', '#9b5de5', '#ff6fb5'];
    const STICKERS = ['😀', '😂', '😍', '🥰', '😎', '🤩', '😭', '😱', '🥳', '🤔', '👍', '👏', '🙌', '💪', '❤️', '🔥', '✨', '⭐', '🌈', '☀️', '🌙', '⚡', '🎉', '🎂', '🎁', '🍕', '☕', '🍻', '🌸', '🌴', '🏖️', '⛰️', '🚗', '✈️', '🐶', '🐱', '⚽', '🎵', '📍', '✅'];
    const TOOLS = [['adjust', 'Adjust', 'sun'], ['filters', 'Looks', 'palette'], ['effects', 'Effects', 'zap'], ['crop', 'Crop', 'maximize'], ['text', 'Text', 'textbox'], ['stickers', 'Stickers', 'sparkle'], ['draw', 'Draw', 'pen']];
    const blankEdit = () => ({ filter: 'none', strength: 100, adjust: {}, crop: { x: 0, y: 0, w: 1, h: 1 }, aspect: 'free', quarter: 0, angle: 0, flip: [1, 1], layers: [] });
    let img = null; // the photo
    let name = 'photo.jpg';
    let E = blankEdit();
    let tool = 'adjust';
    let undo = [];
    let redo = [];
    let fx = null; // the visible renderer
    let sel = null; // the selected text or sticker
    let comparing = false;
    let aiOn = false;
    let aiName = 'Claude'; // the AI service set up in Admin → AI
    let brush = { color: '#ffffff', size: 1.2 };
    const uid = () => Math.random().toString(36).slice(2, 9);

    /* ---------- opening a photo ---------- */
    async function start() {
        document.body.classList.remove('pe-office');
        root.innerHTML = `<div class="sl-home">
            <div class="ea-head"><h1>Photo Editor</h1><label class="btn btn-primary">${ic('image')}<span>Open a photo</span><input type="file" id="pick" accept="image/*" hidden></label></div>
            <label class="pe-drop" id="drop">${ic('image')}<b>Drop a photo here</b><small>or open one from your device. JPEG, PNG, WebP and (on Apple devices) HEIC.</small><input type="file" accept="image/*" hidden></label>
            <h2 class="ea-sec">From your Photos</h2><div class="pe-recent" id="recent"><p class="cp-muted">Loading…</p></div>
        </div>`;
        const onFile = e => e.target.files[0] && openFile(e.target.files[0]);
        $('#pick').onchange = onFile;
        $('#drop input').onchange = onFile;
        const drop = $('#drop');
        drop.addEventListener('dragover', e => (e.preventDefault(), drop.classList.add('over')));
        drop.addEventListener('dragleave', () => drop.classList.remove('over'));
        drop.addEventListener('drop', e => {
            e.preventDefault();
            drop.classList.remove('over');
            const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
            if (f) openFile(f);
        });
        try {
            const r = await call('/api/files');
            const pics = r.items.filter(f => f.kind === 'file' && /^image\/(jpeg|png|webp|gif|heic|heif)/.test(f.type)).sort((a, b) => (b.taken || b.createdAt) - (a.taken || a.createdAt)).slice(0, 30);
            $('#recent').innerHTML = pics.length ? pics.map(f => `<button class="pe-thumb" data-file="${esc(f.id)}" data-name="${esc(f.name)}" title="${esc(f.name)}"><img alt="" loading="lazy" src="/api/files/${encodeURIComponent(f.id)}/${f.thumb ? 'thumb' : 'content?inline=1'}"></button>`).join('') : '<p class="cp-muted">No photos in Files yet.</p>';
        } catch {
            $('#recent').innerHTML = '';
        }
        history.replaceState(null, '', location.pathname);
    }
    root.addEventListener('click', e => {
        const t = e.target.closest('[data-file]');
        if (t && !img) openUrl(`/api/files/${encodeURIComponent(t.dataset.file)}/content?inline=1`, t.dataset.name, t.dataset.file);
    });
    function openFile(file) {
        name = file.name || 'photo.jpg';
        openUrl(URL.createObjectURL(file), name);
    }
    function openUrl(url, n, fileId) {
        const im = new Image();
        im.onload = () => {
            img = im;
            name = n || name;
            E = blankEdit();
            undo = [];
            redo = [];
            sel = null;
            if (fileId) history.replaceState(null, '', `${location.pathname}#file=${fileId}`);
            editor();
        };
        im.onerror = () => toast('That photo couldn’t be opened here. Try a JPEG or PNG.', { bad: true });
        im.src = url;
    }

    /* ---------- the editor ---------- */
    function editor() {
        document.body.classList.add('pe-office');
        root.innerHTML = `<div class="pe">
            <div class="of-title">
                <button class="icon-btn" id="home" title="Close" aria-label="Close">${ic('left')}</button>
                <span class="of-app pe-app">${ic('image')}</span>
                <span class="pe-name">${esc(name)}</span><span class="spacer"></span>
                <button class="icon-btn" id="undo" title="Undo (Ctrl Z)" aria-label="Undo">${ic('undo')}</button>
                <button class="icon-btn" id="redo" title="Redo (Ctrl Y)" aria-label="Redo">${ic('redo')}</button>
                <button class="btn pe-compare" id="compare" title="Hold to see the original">${ic('eye')}<span>Before</span></button>
                <button class="btn" id="save">${ic('folder')}<span>Save to Files</span></button>
                <button class="btn btn-primary" id="export">${ic('download')}<span>Download</span></button>
            </div>
            <div class="pe-main">
                <nav class="pe-tools" id="tools">${TOOLS.map(([k, l, i]) => `<button data-tool="${k}" class="${tool === k ? 'on' : ''}">${ic(i)}<span>${l}</span></button>`).join('')}${aiOn ? `<button data-tool="ai" class="pe-ai${tool === 'ai' ? ' on' : ''}">${ic('zap')}<span>AI edit</span></button>` : ''}</nav>
                <aside class="pe-panel" id="panel"></aside>
                <div class="pe-stage" id="stage"><div class="pe-frame" id="frame"><canvas id="gl"></canvas><canvas id="ov"></canvas></div><textarea class="pe-typer" id="typer" hidden></textarea></div>
            </div>
        </div>`;
        fx = FX.create($('#gl'));
        if (!fx) {
            root.innerHTML = '<div class="pf-empty"><h1>This browser can’t edit photos</h1><p>It doesn’t have WebGL switched on. Try Chrome, Edge, Safari or Firefox.</p></div>';
            return;
        }
        $('#home').onclick = () => {
            img = null;
            start();
        };
        $('#undo').onclick = () => step(undo, redo);
        $('#redo').onclick = () => step(redo, undo);
        $('#export').onclick = e => exportMenu(e.currentTarget);
        $('#save').onclick = saveToFiles;
        const cmp = $('#compare');
        const on = v => () => ((comparing = v), draw());
        cmp.addEventListener('pointerdown', on(true));
        cmp.addEventListener('pointerup', on(false));
        cmp.addEventListener('pointerleave', on(false));
        $('#tools').addEventListener('click', e => {
            const b = e.target.closest('[data-tool]');
            if (b) setTool(b.dataset.tool);
        });
        bindOverlay();
        new ResizeObserver(() => layout()).observe($('#stage'));
        setTool(tool);
    }
    function setTool(t) {
        if (tool === 'crop' && t !== 'crop') commitTyping();
        tool = t;
        sel = t === 'text' || t === 'stickers' ? sel : null;
        $$('#tools [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
        $('#stage').dataset.tool = t;
        panel();
        layout();
    }
    // the size of the photo as edited (turned and cropped), in its own pixels
    const turned = () => (E.quarter % 2 ? [img.naturalHeight, img.naturalWidth] : [img.naturalWidth, img.naturalHeight]);
    const outSize = () => {
        const [rw, rh] = turned();
        const c = tool === 'crop' ? { w: 1, h: 1 } : E.crop;
        return [Math.max(1, Math.round(rw * c.w)), Math.max(1, Math.round(rh * c.h))];
    };
    function layout() {
        if (!img || !$('#stage')) return;
        const st = $('#stage');
        const pad = phone() ? 12 : 36;
        const [w, h] = outSize();
        const k = Math.min((st.clientWidth - pad * 2) / w, (st.clientHeight - pad * 2) / h);
        const cw = Math.max(40, Math.floor(w * k));
        const ch = Math.max(40, Math.floor(h * k));
        Object.assign($('#frame').style, { width: `${cw}px`, height: `${ch}px` });
        const dpr = Math.min(2, devicePixelRatio || 1);
        // the preview is drawn at screen size (the download is drawn at full size)
        const scale = Math.min(1, (Math.min(2400, Math.max(w, h)) / Math.max(w, h)), (Math.max(cw, ch) * dpr) / Math.max(w, h));
        prev.w = Math.max(1, Math.round(w * scale));
        prev.h = Math.max(1, Math.round(h * scale));
        const ov = $('#ov');
        ov.width = Math.round(cw * dpr);
        ov.height = Math.round(ch * dpr);
        draw();
    }
    const prev = { w: 1, h: 1 };
    const params = () => (comparing ? FX.merge('none') : FX.merge(E.filter, E.strength, E.adjust));
    function draw() {
        if (!fx || !img) return;
        fx.render(img, { w: prev.w, h: prev.h, p: params(), crop: tool === 'crop' || comparing ? (comparing ? E.crop : { x: 0, y: 0, w: 1, h: 1 }) : E.crop, quarter: E.quarter, angle: (E.angle * Math.PI) / 180, flip: E.flip });
        overlay();
    }

    /* ---------- text, stickers and drawing, on top ---------- */
    function drawLayers(g, W, H, opts = {}) {
        for (const l of E.layers) {
            if (opts.skip === l.id) continue;
            g.save();
            if (l.t === 'draw') {
                g.strokeStyle = l.color;
                g.lineWidth = (l.w / 100) * H;
                g.lineCap = g.lineJoin = 'round';
                g.beginPath();
                for (let i = 0; i < l.pts.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, l.pts[i] * W, l.pts[i + 1] * H);
                if (l.pts.length === 2) g.lineTo(l.pts[0] * W + 0.1, l.pts[1] * H);
                g.stroke();
            } else {
                const size = (l.size / 100) * H;
                const lines = String(l.t === 'sticker' ? l.emoji : l.text || ' ').split('\n');
                g.font = l.t === 'sticker' ? `${size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif` : `${l.italic ? 'italic ' : ''}${l.bold ? '700 ' : '500 '}${size}px ${(FONTS.find(f => f[0] === l.font) || FONTS[0])[1]}`;
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                const lh = size * 1.18;
                const widths = lines.map(t => g.measureText(t).width);
                const bw = Math.max(...widths);
                const bh = lh * lines.length;
                const x = l.x * W;
                const y = l.y * H;
                if (l.style === 'box') {
                    g.fillStyle = l.bg || 'rgba(0,0,0,.65)';
                    const p = size * 0.3;
                    g.beginPath();
                    (g.roundRect || g.rect).call(g, x - bw / 2 - p, y - bh / 2 - p * 0.6, bw + p * 2, bh + p * 1.2, size * 0.25);
                    g.fill();
                }
                lines.forEach((t, i) => {
                    const ly = y - bh / 2 + lh * (i + 0.5);
                    if (l.style === 'shadow') {
                        g.shadowColor = 'rgba(0,0,0,.6)';
                        g.shadowBlur = size * 0.25;
                        g.shadowOffsetY = size * 0.06;
                    }
                    if (l.style === 'outline') {
                        g.lineWidth = Math.max(2, size * 0.12);
                        g.strokeStyle = l.color === '#111111' ? '#ffffff' : '#111111';
                        g.lineJoin = 'round';
                        g.strokeText(t, x, ly);
                    }
                    g.fillStyle = l.t === 'sticker' ? '#000' : l.color;
                    g.fillText(t, x, ly);
                });
                l._box = { x: (x - bw / 2) / W, y: (y - bh / 2) / H, w: bw / W, h: bh / H };
            }
            g.restore();
        }
    }
    function overlay() {
        const ov = $('#ov');
        if (!ov) return;
        const g = ov.getContext('2d');
        g.clearRect(0, 0, ov.width, ov.height);
        if (tool === 'crop') return cropOverlay(g, ov.width, ov.height);
        if (comparing) return;
        drawLayers(g, ov.width, ov.height, { skip: typing && typing.id });
        const l = sel && E.layers.find(x => x.id === sel);
        if (l && l._box) {
            const dpr = ov.width / $('#frame').clientWidth;
            const b = { x: l._box.x * ov.width - 8 * dpr, y: l._box.y * ov.height - 6 * dpr, w: l._box.w * ov.width + 16 * dpr, h: l._box.h * ov.height + 12 * dpr };
            g.save();
            g.strokeStyle = '#4b8bf5';
            g.lineWidth = 1.5 * dpr;
            g.setLineDash([6 * dpr, 4 * dpr]);
            g.strokeRect(b.x, b.y, b.w, b.h);
            g.setLineDash([]);
            g.fillStyle = '#fff';
            g.beginPath();
            g.arc(b.x + b.w, b.y + b.h, 7 * dpr, 0, Math.PI * 2);
            g.fill();
            g.stroke();
            g.restore();
        }
    }
    function cropOverlay(g, W, H) {
        const c = E.crop;
        const x = c.x * W;
        const y = c.y * H;
        const w = c.w * W;
        const h = c.h * H;
        const dpr = W / $('#frame').clientWidth;
        g.fillStyle = 'rgba(0,0,0,.55)';
        g.fillRect(0, 0, W, y);
        g.fillRect(0, y + h, W, H - y - h);
        g.fillRect(0, y, x, h);
        g.fillRect(x + w, y, W - x - w, h);
        g.strokeStyle = 'rgba(255,255,255,.45)';
        g.lineWidth = 1 * dpr;
        for (let i = 1; i < 3; i++) {
            g.beginPath();
            g.moveTo(x + (w * i) / 3, y);
            g.lineTo(x + (w * i) / 3, y + h);
            g.moveTo(x, y + (h * i) / 3);
            g.lineTo(x + w, y + (h * i) / 3);
            g.stroke();
        }
        g.strokeStyle = '#fff';
        g.lineWidth = 2 * dpr;
        g.strokeRect(x, y, w, h);
        g.lineWidth = 4 * dpr;
        const L = 18 * dpr;
        for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
            g.beginPath();
            g.moveTo(cx, cy + dy * L);
            g.lineTo(cx, cy);
            g.lineTo(cx + dx * L, cy);
            g.stroke();
        }
    }
    // pointer: move/resize text and stickers, draw, or shape the crop
    let drag = null;
    function bindOverlay() {
        const ov = $('#ov');
        const pos = e => {
            const r = ov.getBoundingClientRect();
            return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r };
        };
        ov.addEventListener('pointerdown', e => {
            if (comparing) return;
            const p = pos(e);
            ov.setPointerCapture(e.pointerId);
            if (tool === 'crop') {
                const c = E.crop;
                const near = (a, b) => Math.abs(a - b) * p.r.width < 22;
                const nearY = (a, b) => Math.abs(a - b) * p.r.height < 22;
                const edge = { l: near(p.x, c.x), r: near(p.x, c.x + c.w), t: nearY(p.y, c.y), b: nearY(p.y, c.y + c.h) };
                const inside = p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h;
                if (edge.l || edge.r || edge.t || edge.b || inside) drag = { kind: 'crop', edge, start: { ...c }, p, any: edge.l || edge.r || edge.t || edge.b };
                return;
            }
            if (tool === 'draw') {
                remember();
                const l = { id: uid(), t: 'draw', color: brush.color, w: brush.size, pts: [p.x, p.y] };
                E.layers.push(l);
                drag = { kind: 'draw', l };
                return draw();
            }
            // a handle, a layer, or nothing
            const l = sel && E.layers.find(x => x.id === sel);
            if (l && l._box) {
                const hx = l._box.x + l._box.w;
                const hy = l._box.y + l._box.h;
                if (Math.hypot((p.x - hx) * p.r.width, (p.y - hy) * p.r.height) < 20) {
                    remember();
                    drag = { kind: 'size', l, start: l.size, d0: Math.hypot((p.x - l.x) * p.r.width, (p.y - l.y) * p.r.height) };
                    return;
                }
            }
            const hit = [...E.layers].reverse().find(x => x.t !== 'draw' && x._box && p.x >= x._box.x - 0.02 && p.x <= x._box.x + x._box.w + 0.02 && p.y >= x._box.y - 0.02 && p.y <= x._box.y + x._box.h + 0.02);
            if (hit) {
                const again = sel === hit.id;
                sel = hit.id;
                if (hit.t === 'text' && tool !== 'text') setTool('text');
                if (hit.t === 'sticker' && tool !== 'stickers') setTool('stickers');
                remember();
                drag = { kind: 'move', l: hit, dx: p.x - hit.x, dy: p.y - hit.y, moved: false, again };
                panel();
            } else {
                sel = null;
                panel();
            }
            draw();
        });
        ov.addEventListener('pointermove', e => {
            if (!drag) return;
            const p = pos(e);
            if (drag.kind === 'draw') {
                const pts = drag.l.pts;
                if (Math.hypot((p.x - pts[pts.length - 2]) * p.r.width, (p.y - pts[pts.length - 1]) * p.r.height) > 1.5) pts.push(+p.x.toFixed(4), +p.y.toFixed(4));
                return overlay();
            }
            if (drag.kind === 'move') {
                drag.l.x = Math.max(0, Math.min(1, p.x - drag.dx));
                drag.l.y = Math.max(0, Math.min(1, p.y - drag.dy));
                drag.moved = true;
                return overlay();
            }
            if (drag.kind === 'size') {
                const d = Math.hypot((p.x - drag.l.x) * p.r.width, (p.y - drag.l.y) * p.r.height);
                drag.l.size = Math.max(1.5, Math.min(60, (drag.start * d) / Math.max(10, drag.d0)));
                return overlay();
            }
            if (drag.kind === 'crop') {
                const s = drag.start;
                const dx = p.x - drag.p.x;
                const dy = p.y - drag.p.y;
                let { x, y, w, h } = s;
                if (!drag.any) {
                    x = Math.max(0, Math.min(1 - w, s.x + dx));
                    y = Math.max(0, Math.min(1 - h, s.y + dy));
                } else {
                    if (drag.edge.l) (x = Math.min(s.x + s.w - 0.05, Math.max(0, s.x + dx))), (w = s.x + s.w - x);
                    if (drag.edge.r) w = Math.max(0.05, Math.min(1 - s.x, s.w + dx));
                    if (drag.edge.t) (y = Math.min(s.y + s.h - 0.05, Math.max(0, s.y + dy))), (h = s.y + s.h - y);
                    if (drag.edge.b) h = Math.max(0.05, Math.min(1 - s.y, s.h + dy));
                    const ratio = aspectRatio();
                    if (ratio) {
                        // keep the shape: follow the edge that moved most
                        const [rw, rh] = turned();
                        const r = ratio * (rh / rw);
                        if (drag.edge.l || drag.edge.r) h = Math.min(w / r, drag.edge.t ? s.y + s.h : 1 - y);
                        else w = Math.min(h * r, 1 - x);
                        w = h * r;
                        if (drag.edge.t) y = s.y + s.h - h;
                        if (drag.edge.l) x = s.x + s.w - w;
                        if (x < 0 || y < 0 || x + w > 1 || y + h > 1) return;
                    }
                }
                E.crop = { x, y, w, h };
                return overlay();
            }
        });
        const end = () => {
            if (!drag) return;
            const d = drag;
            drag = null;
            if (d.kind === 'move' && !d.moved) {
                undo.pop();
                if (d.again && d.l.t === 'text') editText(d.l);
            }
            if (d.kind === 'draw' || d.kind === 'size' || (d.kind === 'move' && d.moved)) panel();
        };
        ov.addEventListener('pointerup', end);
        ov.addEventListener('pointercancel', end);
        ov.addEventListener('dblclick', e => {
            const l = sel && E.layers.find(x => x.id === sel);
            if (l && l.t === 'text') (e.preventDefault(), editText(l));
        });
    }
    // typing straight onto the photo
    let typing = null;
    function editText(l) {
        typing = l;
        const t = $('#typer');
        const fr = $('#frame').getBoundingClientRect();
        const st = $('#stage').getBoundingClientRect();
        const size = (l.size / 100) * fr.height;
        Object.assign(t.style, { left: `${fr.left - st.left + l._box.x * fr.width - 10}px`, top: `${fr.top - st.top + l._box.y * fr.height - 6}px`, width: `${Math.max(160, l._box.w * fr.width + 40)}px`, height: `${Math.max(size * 1.4, l._box.h * fr.height + 12)}px`, fontSize: `${size}px`, color: l.color, fontFamily: (FONTS.find(f => f[0] === l.font) || FONTS[0])[1], fontWeight: l.bold ? 700 : 500, fontStyle: l.italic ? 'italic' : 'normal' });
        t.value = l.text;
        t.hidden = false;
        t.focus();
        t.select();
        overlay();
        t.oninput = () => {
            l.text = t.value;
            const ta = $('#ptext');
            if (ta) ta.value = t.value;
        };
        t.onblur = commitTyping;
        t.onkeydown = e => {
            if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
                e.preventDefault();
                t.blur();
            }
        };
    }
    function commitTyping() {
        const t = $('#typer');
        if (!typing || !t) return;
        typing.text = t.value.trim() || 'Text';
        typing = null;
        t.hidden = true;
        draw();
    }
    const aspectRatio = () => {
        if (E.aspect === 'free') return 0;
        if (E.aspect === 'original') return img.naturalWidth / img.naturalHeight;
        const [a, b] = E.aspect.split(':').map(Number);
        return a / b;
    };
    // the biggest centred crop with the chosen shape
    function fitCrop() {
        const r = aspectRatio();
        if (!r) return (E.crop = { x: 0, y: 0, w: 1, h: 1 });
        const [rw, rh] = turned();
        let w = 1;
        let h = (rw / r) / rh;
        if (h > 1) {
            h = 1;
            w = (rh * r) / rw;
        }
        E.crop = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
    }

    /* ---------- the panel of the chosen tool ---------- */
    const slider = (key, label, lo, hi, v, extra = '') => `<label class="pe-slider"><span><b>${label}</b><i>${Math.round(v)}</i></span><input type="range" min="${lo}" max="${hi}" value="${v}" data-k="${key}" ${extra}></label>`;
    function panel() {
        const p = $('#panel');
        if (!p) return;
        if (tool === 'adjust') {
            p.innerHTML = `<div class="pe-phead"><h3>Adjust</h3><button class="btn btn-ghost" data-auto>${ic('sparkle')}<span>Auto</span></button><button class="btn btn-ghost" data-reset>Reset</button></div>
                ${FX.PARAMS.map(([k, l, lo, hi]) => slider(k, l, lo, hi, E.adjust[k] || 0)).join('')}`;
        } else if (tool === 'filters') {
            p.innerHTML = `<div class="pe-phead"><h3>Looks</h3></div><div class="pe-looks">${Object.entries(FX.FILTERS).map(([k, [l]]) => `<button class="pe-look${E.filter === k ? ' on' : ''}" data-filter="${k}"><canvas width="120" height="90" data-thumb="${k}"></canvas><span>${l}</span></button>`).join('')}</div>${E.filter !== 'none' ? slider('strength', 'Strength', 0, 100, E.strength) : ''}`;
            thumbs();
        } else if (tool === 'effects') {
            p.innerHTML = `<div class="pe-phead"><h3>Effects</h3><button class="btn btn-ghost" data-reset>Reset</button></div>${FX.EFFECTS.map(([k, l, lo, hi]) => slider(k, l, lo, hi, E.adjust[k] || 0)).join('')}`;
        } else if (tool === 'crop') {
            p.innerHTML = `<div class="pe-phead"><h3>Crop &amp; rotate</h3><button class="btn btn-ghost" data-reset>Reset</button></div>
                <div class="pe-chips">${ASPECTS.map(([k, l]) => `<button class="pe-chip${E.aspect === k ? ' on' : ''}" data-aspect="${k}">${l}</button>`).join('')}</div>
                <div class="pe-row"><button class="btn" data-rot="-1">${ic('undo')}<span>Left</span></button><button class="btn" data-rot="1">${ic('redo')}<span>Right</span></button></div>
                <div class="pe-row"><button class="btn" data-flip="0">⇋ <span>Flip</span></button><button class="btn" data-flip="1">⇵ <span>Flip vertical</span></button></div>
                ${slider('angle', 'Straighten', -45, 45, E.angle, 'step="0.5"')}
                <button class="btn btn-primary pe-done" data-done>${ic('check')}<span>Done</span></button>`;
        } else if (tool === 'text') {
            const l = sel && E.layers.find(x => x.id === sel && x.t === 'text');
            p.innerHTML = `<div class="pe-phead"><h3>Text</h3></div><button class="btn btn-primary pe-wide" data-addtext>${ic('plus')}<span>Add text</span></button>
                ${l ? `<textarea class="input pe-ta" id="ptext" rows="2">${esc(l.text)}</textarea>
                <div class="pe-chips">${FONTS.map(([f, css]) => `<button class="pe-chip${l.font === f ? ' on' : ''}" data-font="${f}" style="font-family:${esc(css)}">${f}</button>`).join('')}</div>
                <div class="pe-swatches">${COLORS.map(c => `<button data-color="${c}" class="${l.color === c ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
                <div class="pe-chips">${[['plain', 'Plain'], ['shadow', 'Shadow'], ['outline', 'Outline'], ['box', 'Box']].map(([k, n]) => `<button class="pe-chip${l.style === k ? ' on' : ''}" data-style="${k}">${n}</button>`).join('')}<button class="pe-chip${l.bold ? ' on' : ''}" data-bold><b>B</b></button><button class="pe-chip${l.italic ? ' on' : ''}" data-italic><i>I</i></button></div>
                ${slider('lsize', 'Size', 2, 40, l.size, 'step="0.5"')}
                <button class="btn btn-ghost danger pe-wide" data-dellayer>${ic('trash')}<span>Delete text</span></button>` : '<p class="cp-muted">Add text, then drag it into place. Double-click it to type; drag the round handle to resize.</p>'}`;
        } else if (tool === 'stickers') {
            const l = sel && E.layers.find(x => x.id === sel && x.t === 'sticker');
            p.innerHTML = `<div class="pe-phead"><h3>Stickers</h3></div><div class="pe-stickers">${STICKERS.map(s => `<button data-sticker="${s}">${s}</button>`).join('')}</div>
                ${l ? `${slider('lsize', 'Size', 3, 60, l.size, 'step="0.5"')}<button class="btn btn-ghost danger pe-wide" data-dellayer>${ic('trash')}<span>Delete sticker</span></button>` : ''}`;
        } else if (tool === 'draw') {
            p.innerHTML = `<div class="pe-phead"><h3>Draw</h3></div><p class="cp-muted">Draw on the photo with your mouse, pen or finger.</p>
                <div class="pe-swatches">${COLORS.map(c => `<button data-brush="${c}" class="${brush.color === c ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
                ${slider('brush', 'Brush size', 0.3, 6, brush.size, 'step="0.1"')}
                <button class="btn btn-ghost danger pe-wide" data-cleardraw>${ic('eraser')}<span>Clear drawing</span></button>`;
        } else if (tool === 'ai') {
            p.innerHTML = `<div class="pe-phead"><h3>AI edit</h3></div><p class="cp-muted">${esc(aiName)} looks at the photo and edits it: light, colour, a look, crop and straightening. Everything it changes stays adjustable, and Undo takes it back.</p>
                <textarea class="input pe-ta" id="wish" rows="3" placeholder="Optional: what you want, e.g. “warm and moody”, “make it pop for Instagram”, “fix the dark faces”">${esc(wish)}</textarea>
                <button class="btn btn-primary pe-wide" data-ai>${ic('zap')}<span>Edit with ${esc(aiName)}</span></button><p class="cp-muted pe-note" id="ainote"></p>`;
        }
    }
    // little previews of each look
    let thumbFx = null;
    function thumbs() {
        if (!thumbFx) thumbFx = FX.create(document.createElement('canvas'));
        if (!thumbFx) return;
        const [w, h] = outSize();
        const k = Math.min(240 / w, 180 / h);
        $$('[data-thumb]').forEach(cv => {
            cv.width = Math.max(1, Math.round(w * k));
            cv.height = Math.max(1, Math.round(h * k));
            thumbFx.render(img, { w: cv.width, h: cv.height, p: FX.merge(cv.dataset.thumb, 100, E.adjust), crop: E.crop, quarter: E.quarter, angle: (E.angle * Math.PI) / 180, flip: E.flip });
            cv.getContext('2d').drawImage(thumbFx.gl.canvas, 0, 0);
        });
    }
    root.addEventListener('input', e => {
        if (!img || !e.target.closest('#panel')) return;
        const k = e.target.dataset.k;
        if (!k) {
            if (e.target.id === 'ptext') {
                const l = E.layers.find(x => x.id === sel);
                if (l) {
                    l.text = e.target.value || ' ';
                    overlay();
                }
            }
            return;
        }
        const v = +e.target.value;
        const out = e.target.closest('.pe-slider').querySelector('i');
        if (out) out.textContent = Math.round(v * 10) / 10;
        if (!e.target.dataset.touched) {
            remember();
            e.target.dataset.touched = '1';
        }
        if (k === 'strength') E.strength = v;
        else if (k === 'angle') E.angle = v;
        else if (k === 'lsize') {
            const l = E.layers.find(x => x.id === sel);
            if (l) l.size = v;
        } else if (k === 'brush') brush.size = v;
        else E.adjust[k] = v;
        draw();
    });
    root.addEventListener('change', e => {
        if (e.target.dataset && e.target.dataset.k) delete e.target.dataset.touched;
        if (e.target.id === 'ptext') remember();
    });
    // double-click a slider to put it back to zero
    root.addEventListener('dblclick', e => {
        const r = e.target.closest('.pe-slider input');
        if (!r || r.dataset.k === 'brush' || r.dataset.k === 'lsize') return;
        remember();
        if (r.dataset.k === 'strength') E.strength = 100;
        else if (r.dataset.k === 'angle') E.angle = 0;
        else delete E.adjust[r.dataset.k];
        panel();
        draw();
    });
    root.addEventListener('click', async e => {
        if (!img || !e.target.closest('#panel')) return;
        const b = e.target.closest('button');
        if (!b) return;
        const d = b.dataset;
        const l = sel && E.layers.find(x => x.id === sel);
        if (d.reset !== undefined) {
            remember();
            if (tool === 'adjust') for (const [k] of FX.PARAMS) delete E.adjust[k];
            else if (tool === 'effects') for (const [k] of FX.EFFECTS) delete E.adjust[k];
            else if (tool === 'crop') Object.assign(E, { crop: { x: 0, y: 0, w: 1, h: 1 }, aspect: 'free', quarter: 0, angle: 0, flip: [1, 1] });
            panel();
            return layout();
        }
        if (d.auto !== undefined) return autoAdjust();
        if (d.filter) {
            remember();
            E.filter = d.filter;
            if (E.filter !== 'none' && !E.strength) E.strength = 100;
            $$('.pe-look').forEach(x => x.classList.toggle('on', x.dataset.filter === d.filter));
            panel();
            return draw();
        }
        if (d.aspect) {
            remember();
            E.aspect = d.aspect;
            fitCrop();
            panel();
            return overlay();
        }
        if (d.rot) {
            remember();
            E.quarter = (E.quarter + (+d.rot) + 4) % 4;
            fitCrop();
            return layout();
        }
        if (d.flip) {
            remember();
            E.flip = d.flip === '0' ? [-E.flip[0], E.flip[1]] : [E.flip[0], -E.flip[1]];
            return draw();
        }
        if (d.done !== undefined) return setTool('adjust');
        if (d.addtext !== undefined) {
            remember();
            const t = { id: uid(), t: 'text', x: 0.5, y: 0.5, text: 'Your text', size: 8, color: '#ffffff', font: 'Geist', style: 'shadow', bold: true };
            E.layers.push(t);
            sel = t.id;
            panel();
            draw();
            return setTimeout(() => editText(t), 30);
        }
        if (d.sticker) {
            remember();
            const s = { id: uid(), t: 'sticker', x: 0.5, y: 0.5, emoji: d.sticker, size: 14 };
            E.layers.push(s);
            sel = s.id;
            panel();
            return draw();
        }
        if (l && (d.font || d.color || d.style || d.bold !== undefined || d.italic !== undefined)) {
            remember();
            if (d.font) l.font = d.font;
            if (d.color) l.color = d.color;
            if (d.style) l.style = d.style;
            if (d.bold !== undefined) l.bold = !l.bold;
            if (d.italic !== undefined) l.italic = !l.italic;
            panel();
            return draw();
        }
        if (d.dellayer !== undefined && l) {
            remember();
            E.layers = E.layers.filter(x => x.id !== l.id);
            sel = null;
            panel();
            return draw();
        }
        if (d.brush) {
            brush.color = d.brush;
            return panel();
        }
        if (d.cleardraw !== undefined) {
            remember();
            E.layers = E.layers.filter(x => x.t !== 'draw');
            return draw();
        }
        if (d.ai !== undefined) return aiEdit(b);
    });

    /* ---------- Auto (here, for everyone) and AI edit (Claude, for admins) ---------- */
    function autoAdjust() {
        const cv = document.createElement('canvas');
        const k = Math.min(1, 200 / Math.max(img.naturalWidth, img.naturalHeight));
        cv.width = Math.max(1, Math.round(img.naturalWidth * k));
        cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        const g = cv.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, cv.width, cv.height);
        const px = g.getImageData(0, 0, cv.width, cv.height).data;
        const lum = [];
        let r = 0;
        let b = 0;
        let s = 0;
        for (let i = 0; i < px.length; i += 4) {
            const R = px[i] / 255;
            const G = px[i + 1] / 255;
            const B = px[i + 2] / 255;
            lum.push(0.2126 * R + 0.7152 * G + 0.0722 * B);
            r += R;
            b += B;
            s += Math.max(R, G, B) - Math.min(R, G, B);
        }
        const n = lum.length;
        lum.sort((a, c) => a - c);
        const at = q => lum[Math.min(n - 1, Math.floor(q * n))];
        const mean = lum.reduce((a, c) => a + c, 0) / n;
        const spread = at(0.98) - at(0.02);
        const cl = (v, lo, hi) => Math.round(Math.max(lo, Math.min(hi, v)));
        remember();
        E.adjust = {
            ...E.adjust,
            exposure: cl((0.47 - mean) * 140, -45, 45),
            contrast: cl((0.82 - spread) * 70, -10, 35),
            shadows: cl(at(0.1) < 0.08 ? 18 : 0, 0, 30),
            highlights: cl(at(0.98) > 0.97 ? -22 : 0, -30, 0),
            saturation: cl((0.22 - s / n) * 90, -10, 22),
            vibrance: 12,
            temperature: cl(((b - r) / n) * 140, -25, 25)
        };
        panel();
        draw();
        toast('Auto adjusted. Undo takes it back.');
    }
    // the photo as Claude sees it: turned the way it's shown, at most 1280 pixels
    function photoForAi() {
        const [rw, rh] = turned();
        const k = Math.min(1, 1280 / Math.max(rw, rh));
        const w = Math.round(rw * k);
        const h = Math.round(rh * k);
        const r = FX.create(document.createElement('canvas'));
        r.render(img, { w, h, p: FX.merge('none'), quarter: E.quarter, flip: E.flip });
        const data = r.gl.canvas.toDataURL('image/jpeg', 0.85);
        r.gl.getExtension('WEBGL_lose_context')?.loseContext();
        return { data, w: rw, h: rh };
    }
    let wish = '';
    async function aiEdit(btn) {
        wish = $('#wish').value;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner sm"></span><span>${esc(aiName)} is editing…</span>`;
        try {
            const ph = photoForAi();
            const r = await call('/api/ai/photo', { method: 'POST', body: { photo: ph.data, wish, size: { w: ph.w, h: ph.h } } });
            const ed = r.edit;
            remember();
            E.filter = ed.filter;
            E.strength = ed.strength;
            E.adjust = { ...ed.adjust, ...Object.fromEntries(FX.EFFECTS.map(([k]) => [k, E.adjust[k] || 0]).filter(([, v]) => v)) };
            E.angle = ed.straighten;
            if (ed.crop) {
                E.aspect = ['1:1', '4:5', '16:9', '9:16', '3:2', '2:3'].includes(ed.crop.aspect) ? ed.crop.aspect : 'free';
                E.crop = { x: ed.crop.x, y: ed.crop.y, w: ed.crop.w, h: ed.crop.h };
                // make the box exactly the shape it names, around the same centre
                const m = /^(\d+):(\d+)$/.exec(E.aspect);
                if (m) {
                    const want = +m[1] / +m[2];
                    let bw = E.crop.w * ph.w;
                    let bh = E.crop.h * ph.h;
                    if (bw / bh > want) bw = bh * want;
                    else bh = bw / want;
                    const cx = E.crop.x + E.crop.w / 2;
                    const cy = E.crop.y + E.crop.h / 2;
                    const w = bw / ph.w;
                    const h = bh / ph.h;
                    E.crop = { x: Math.min(Math.max(0, cx - w / 2), 1 - w), y: Math.min(Math.max(0, cy - h / 2), 1 - h), w, h };
                }
            }
            layout();
            panel();
            $('#ainote').textContent = ed.note || 'Done.';
            toast(`Edited by ${aiName}. Undo takes it back.`);
        } catch (e) {
            toast(e.message, { bad: true });
        }
        btn.disabled = false;
        btn.innerHTML = `${ic('zap')}<span>Edit with ${esc(aiName)}</span>`;
    }

    /* ---------- undo ---------- */
    const snap = () => JSON.stringify(E, (k, v) => (k === '_box' ? undefined : v));
    function remember() {
        undo.push(snap());
        if (undo.length > 80) undo.shift();
        redo = [];
    }
    function step(from, to) {
        if (!from.length) return;
        commitTyping();
        to.push(snap());
        E = JSON.parse(from.pop());
        if (sel && !E.layers.some(l => l.id === sel)) sel = null;
        panel();
        layout();
    }
    addEventListener('keydown', e => {
        if (!img || !$('#gl')) return;
        // undo and redo work everywhere, also right after moving a slider (not while typing in a box)
        const u = undoKey(e);
        if (u && !textBox(e)) return (e.preventDefault(), u === 'undo' ? step(undo, redo) : step(redo, undo));
        if (e.target.closest && e.target.closest('input, textarea, select')) return;
        const k = e.key.toLowerCase();
        if ((k === 'delete' || k === 'backspace') && sel) {
            e.preventDefault();
            remember();
            E.layers = E.layers.filter(x => x.id !== sel);
            sel = null;
            panel();
            draw();
        }
    });

    /* ---------- the finished photo, at full size ---------- */
    async function render(type = 'image/jpeg', quality = 0.92) {
        commitTyping();
        const [rw, rh] = turned();
        let w = Math.round(rw * E.crop.w);
        let h = Math.round(rh * E.crop.h);
        const max = Math.min(fx.maxTex, 8192);
        if (Math.max(w, h) > max) {
            const k = max / Math.max(w, h);
            w = Math.round(w * k);
            h = Math.round(h * k);
        }
        const r = FX.create(document.createElement('canvas'));
        r.render(img, { w, h, p: FX.merge(E.filter, E.strength, E.adjust), crop: E.crop, quarter: E.quarter, angle: (E.angle * Math.PI) / 180, flip: E.flip });
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        const g = out.getContext('2d');
        if (type === 'image/jpeg') {
            g.fillStyle = '#fff';
            g.fillRect(0, 0, w, h);
        }
        g.drawImage(r.gl.canvas, 0, 0);
        drawLayers(g, w, h);
        r.gl.getExtension('WEBGL_lose_context')?.loseContext();
        return new Promise(resolve => out.toBlob(resolve, type, quality));
    }
    const baseName = () => name.replace(/\.[a-z0-9]+$/i, '');
    function exportMenu(anchor) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        const items = [['image/jpeg', 'JPEG (.jpg)', 'jpg'], ['image/png', 'PNG (.png), lossless', 'png'], ['image/webp', 'WebP (.webp), smaller', 'webp']];
        pop.innerHTML = items.map(([t, l], i) => `<button data-i="${i}">${ic('download')}<span>${l}</span></button>`).join('');
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${r.bottom + 4}px`;
        pop.style.left = `${Math.max(8, r.right - pop.offsetWidth)}px`;
        const off = e => !pop.contains(e.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('click', async e => {
            const b = e.target.closest('[data-i]');
            if (!b) return;
            pop.remove();
            const [type, , ext] = items[+b.dataset.i];
            const blob = await render(type);
            if (!blob) return toast('That format isn’t available in this browser', { bad: true });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${baseName()}-edited.${ext}`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        });
    }
    async function folderId(folderName) {
        const r = await call('/api/files');
        const f = r.items.find(x => x.kind === 'folder' && x.name === folderName && !x.folder);
        if (f) return f.id;
        return (await call('/api/files/folders', { method: 'POST', body: { name: folderName, folder: '' } })).id;
    }
    async function saveToFiles() {
        const btn = $('#save');
        btn.disabled = true;
        try {
            const blob = await render('image/jpeg');
            const file = new File([blob], `${baseName()}-edited.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
            await upload(file, { folder: await folderId('Edited photos') });
            toast('Saved in Files → Edited photos, and in Photos');
        } catch (e) {
            toast(e.message, { bad: true });
        }
        btn.disabled = false;
    }

    // open straight from Photos or Files: /photoedit/#file=<id>
    Promise.all([call('/api/ai/status').catch(() => ({ on: false }))]).then(([s]) => {
        aiOn = !!s.on;
        aiName = s.name || 'AI';
        const m = /^#file=([A-Za-z0-9_-]+)$/.exec(location.hash);
        if (m) {
            call('/api/files')
                .then(r => {
                    const f = r.items.find(x => x.id === m[1]);
                    if (f) openUrl(`/api/files/${encodeURIComponent(f.id)}/content?inline=1`, f.name, f.id);
                    else start();
                })
                .catch(start);
        } else start();
    });
})();
