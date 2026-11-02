// Video Editor, like CapCut: a timeline of clips (trim, split, reorder, speed, volume), looks and
// adjustments on the graphics card (imagefx.js), effects, transitions, animated text, music, and
// export to a video file. Footage lives in Files; a project is the edit. Admins can let an AI (Claude, or another one set up in Admin → AI)
// make the edit (Admin → AI).
(function () {
    const { $, $$, esc, ic, call, toast, ask, debounce, ago, upload, phone, typing: textBox, undoKey } = window.EG;
    const FX = window.EGFX;
    const root = $('#videoedit');
    const ASPECTS = { '16:9': [16, 9, 'Landscape · YouTube'], '9:16': [9, 16, 'Vertical · TikTok, Reels, Shorts'], '1:1': [1, 1, 'Square'], '4:5': [4, 5, 'Portrait · Instagram'] };
    // effects on a clip, in groups for the Effects tab
    const EFFECT_GROUPS = [
        ['Motion', [['none', 'None'], ['zoom_in', 'Zoom in'], ['zoom_out', 'Zoom out'], ['slow_zoom', 'Slow zoom'], ['pan_left', 'Pan left'], ['pan_right', 'Pan right'], ['pan_up', 'Pan up'], ['pan_down', 'Pan down'], ['pulse', 'Pulse'], ['heartbeat', 'Heartbeat'], ['shake', 'Shake'], ['earthquake', 'Earthquake'], ['wobble', 'Wobble'], ['spin_in', 'Spin in']]],
        ['Retro & glitch', [['glitch', 'Glitch'], ['vhs', 'VHS'], ['rgb_split', 'RGB split'], ['film', 'Old film'], ['pixel_in', 'Pixel in']]],
        ['Light & colour', [['flash', 'Flash'], ['strobe', 'Strobe'], ['invert_flash', 'Invert flash'], ['bw', 'Black & white'], ['color_in', 'Colour in'], ['dream', 'Dream'], ['rainbow', 'Rainbow'], ['blur_in', 'Blur in'], ['blur_out', 'Blur out']]]
    ];
    const EFFECTS = EFFECT_GROUPS.flatMap(g => g[1]);
    const TRANSITIONS = [['none', 'Cut'], ['fade', 'Fade'], ['dip_black', 'Dip to black'], ['dip_white', 'Dip to white'], ['flash', 'Flash'], ['slide_left', 'Slide left'], ['slide_right', 'Slide right'], ['slide_up', 'Slide up'], ['slide_down', 'Slide down'], ['cover', 'Cover'], ['zoom', 'Zoom in'], ['zoom_out', 'Zoom out'], ['spin', 'Spin'], ['wipe', 'Wipe'], ['wipe_up', 'Wipe up'], ['wipe_diag', 'Diagonal'], ['circle', 'Circle'], ['split', 'Split'], ['blur', 'Blur'], ['whip', 'Whip pan'], ['glitch', 'Glitch'], ['pixelate', 'Pixelate']];
    const STYLES = [['plain', 'Plain'], ['shadow', 'Shadow'], ['outline', 'Outline'], ['box', 'Box'], ['title', 'Title'], ['neon', 'Neon'], ['highlight', 'Highlight'], ['retro', 'Retro'], ['gradient', 'Gradient']];
    const ANIMS = [['none', 'None'], ['fade', 'Fade'], ['pop', 'Pop'], ['slide', 'Slide up'], ['slide_left', 'Slide in'], ['drop', 'Drop'], ['bounce', 'Bounce'], ['zoom', 'Zoom'], ['type', 'Typewriter'], ['wave', 'Wave'], ['blur', 'Blur in'], ['flicker', 'Flicker']];
    const BG_COLORS = ['#000000', '#ffffff', '#111827', '#f5c518', '#e5484d', '#2f6bff', '#2fb36a', '#9b5de5', '#ff6fb5'];
    const TF = { scale: 100, x: 0, y: 0, rot: 0, quarter: 0, flipH: false, flipV: false }; // a clip's place in the frame
    const tfOf = c => ({ ...TF, ...(c.tf || {}) });
    const hash = n => {
        const x = Math.sin(n * 127.1) * 43758.5453;
        return x - Math.floor(x);
    };
    const FONTS = { Geist: 'Geist, system-ui, sans-serif', Serif: "'Instrument Serif', Georgia, serif", Impact: "Impact, 'Arial Black', sans-serif", Rounded: "'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif", Mono: "'Courier New', monospace", Script: "'Brush Script MT', 'Segoe Script', cursive" };
    const COLORS = ['#ffffff', '#111111', '#f5c518', '#e5484d', '#f08a24', '#2fb36a', '#2f6bff', '#9b5de5', '#ff6fb5'];
    const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3, 4];
    const uid = () => Math.random().toString(36).slice(2, 10);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const secs = s => (s < 60 ? `${s.toFixed(1)}s` : fmt(s).replace(/\.\d$/, ''));
    const fmt = s => {
        s = Math.max(0, s || 0);
        return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`;
    };
    let list = [];
    let doc = null; // the open project: { id, title, body: { aspect, bg, media, clips, texts, audio }, … }
    let P = null; // = doc.body
    let T = 0; // the playhead, in seconds
    let total = 0;
    let starts = []; // when each clip starts on the timeline
    let playing = false;
    let sel = null; // { kind: 'clip' | 'text' | 'audio', id }
    let pps = 60; // timeline pixels per second
    let undo = [];
    let redo = [];
    let dirty = false;
    let aiOn = false;
    let aiName = 'Claude'; // the AI service set up in Admin → AI
    let exporting = null;
    const blobs = new Map(); // media id → a local blob: address while it uploads
    const progress = new Map(); // media id → upload fraction
    const thumbs = new Map(); // media id → [{ t, url }]
    const els = new Map(); // clip / audio id → <video> / <audio>
    const imgs = new Map(); // media id → <img>

    /* ---------- the start screen ---------- */
    async function gallery() {
        stopAll();
        doc = null;
        document.body.classList.remove('ve-office');
        const mine = list.filter(d => d.mine);
        const shared = list.filter(d => !d.mine);
        const card = d => {
            const [aspect, file, secs] = (d.cover || '16:9||0').split('|');
            const [a, b] = ASPECTS[aspect] || ASPECTS['16:9'];
            return `<div class="ve-card" data-id="${esc(d.id)}" role="button" tabindex="0" aria-label="Open ${esc(d.title || 'Untitled video')}"><span class="ve-cthumb"><span style="aspect-ratio:${a}/${b}">${file ? `<img alt="" loading="lazy" src="/api/files/${encodeURIComponent(file)}/thumb">` : ic('play')}</span><i>${fmt(+secs).replace(/\.\d$/, '')}</i><button class="ve-cmenu" data-menu="${esc(d.id)}" aria-label="More for ${esc(d.title || 'Untitled video')}" title="More">${ic('more')}</button></span><b>${esc(d.title || 'Untitled video')}</b><small>${esc(aspect)} · ${esc(ago(d.updatedAt))}${d.mine ? '' : ` · ${esc(d.ownerName)}`}</small></div>`;
        };
        root.innerHTML = `<div class="sl-home">
            <div class="ea-head"><h1>Video Editor</h1></div>
            <h2 class="ea-sec">New project</h2>
            <div class="ve-new">${Object.entries(ASPECTS).map(([k, [a, b, l]]) => `<button class="ve-newcard" data-new="${k}"><span class="ve-shape"><i style="aspect-ratio:${a}/${b}"></i></span><b>${k}</b><small>${l}</small></button>`).join('')}</div>
            ${mine.length ? `<h2 class="ea-sec">My projects</h2><div class="ve-cards">${mine.map(card).join('')}</div>` : ''}
            ${shared.length ? `<h2 class="ea-sec">Shared with me</h2><div class="ve-cards">${shared.map(card).join('')}</div>` : ''}
            ${mine.length || shared.length ? '' : '<p class="ad-muted dw-hint">Cut your clips together, add looks, effects, transitions, titles and music, and export a video to share. Your footage is kept in Files.</p>'}
        </div>`;
        history.replaceState(null, '', location.pathname);
    }
    root.addEventListener('keydown', e => {
        if (!doc && e.key === 'Enter' && e.target.matches('.ve-card')) openProject(e.target.dataset.id);
    });
    // a project's menu in the gallery: open, duplicate, delete
    function cardMenu(anchor, d) {
        if (!d) return;
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop';
        pop.setAttribute('role', 'menu');
        pop.innerHTML = `<button data-a="open" role="menuitem">${ic('play')}<span>Open</span></button><button data-a="dup" role="menuitem">${ic('copy')}<span>Duplicate</span></button>${d.mine ? `<button data-a="del" class="danger" role="menuitem">${ic('trash')}<span>Delete project</span></button>` : ''}`;
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 8)}px`;
        pop.style.left = `${clamp(r.right - pop.offsetWidth, 8, innerWidth - pop.offsetWidth - 8)}px`;
        const off = e => !pop.contains(e.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('click', e => {
            const b = e.target.closest('[data-a]');
            if (!b) return;
            pop.remove();
            removeEventListener('pointerdown', off, true);
            if (b.dataset.a === 'open') openProject(d.id);
            else if (b.dataset.a === 'dup') duplicateProject(d);
            else deleteProject(d);
        });
        $('button', pop).focus();
    }
    async function create(aspect) {
        const d = await call('/api/docs', { method: 'POST', body: { kind: 'video', title: '', body: { aspect, bg: 'blur' } } });
        list.unshift(d);
        await openProject(d.id);
    }
    async function openProject(id, then) {
        try {
            doc = await call(`/api/docs/${id}`);
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        P = doc.body;
        T = 0;
        sel = null;
        undo = [];
        redo = [];
        history.replaceState(null, '', `${location.pathname}#${id}`);
        editor();
        if (then) then();
    }

    /* ---------- where things are on the timeline ---------- */
    const mediaOf = id => P.media.find(m => m.id === id);
    const clipDur = c => (c.out - c.in) / c.speed;
    const trDur = i => {
        const c = P.clips[i];
        const n = P.clips[i + 1];
        if (!n || !c.tr || c.tr.type === 'none') return 0;
        return Math.min(c.tr.dur, clipDur(c) / 2, clipDur(n) / 2);
    };
    function relayout() {
        starts = [];
        let at = 0;
        let end = 0;
        P.clips.forEach((c, i) => {
            starts[i] = at;
            end = at + clipDur(c);
            at = end - trDur(i);
        });
        total = end;
        T = clamp(T, 0, total);
    }
    const outSize = (short = 720) => {
        const [a, b] = ASPECTS[P.aspect] || ASPECTS['16:9'];
        return a >= b ? [Math.round((short * a) / b / 2) * 2, short] : [short, Math.round((short * b) / a / 2) * 2];
    };
    const srcOf = m => (m.file ? `/api/files/${encodeURIComponent(m.file)}/content?inline=1` : blobs.get(m.id) || '');

    /* ---------- the editor ---------- */
    function editor() {
        document.body.classList.add('ve-office');
        const ro = !doc.canEdit;
        root.innerHTML = `<div class="ve">
            <div class="of-title">
                <button class="icon-btn" id="home" title="All projects" aria-label="All projects">${ic('left')}</button>
                <span class="of-app ve-app">${ic('play')}</span>
                <input class="of-name" id="name" value="${esc(doc.title)}" placeholder="Untitled video" ${ro ? 'readonly' : ''} aria-label="Project name">
                <span class="nt-saved" id="saved"></span><span class="spacer"></span>
                ${aiOn && !ro ? `<button class="btn ve-aibtn" id="auto">${ic('zap')}<span>Auto edit</span></button>` : ''}
                ${doc.mine ? '<select class="input of-share" id="share" aria-label="Who can see it"><option value="private">Only me</option><option value="view">Everyone can see it</option><option value="edit">Everyone can edit it</option></select>' : ''}
                <button class="btn btn-primary" id="export">${ic('download')}<span>Export</span></button>
            </div>
            <div class="ve-main">
                <div class="ve-preview">
                    <div class="ve-stage" id="stage"><canvas id="out"></canvas><div class="ve-empty" id="empty" hidden>${ic('play')}<b>Add your clips</b><small>Videos and photos from your device or from Files.</small>${ro ? '' : `<div><label class="btn btn-primary">${ic('plus')}<span>Import</span><input type="file" id="imp2" accept="video/*,image/*,audio/*" multiple hidden></label><button class="btn" data-fromfiles>${ic('folder')}<span>From Files</span></button></div>`}</div></div>
                    <div class="ve-controls"><span class="ve-time" id="time">0:00.0</span><span class="spacer"></span><button class="icon-btn" id="tostart" aria-label="To the start">⏮</button><button class="ve-play" id="play" aria-label="Play (Space)">${ic('play')}</button><button class="icon-btn" id="toend" aria-label="To the end">⏭</button><span class="spacer"></span><span class="ve-time" id="dur">0:00.0</span></div>
                </div>
                <aside class="ve-insp" id="insp"></aside>
            </div>
            ${ro ? '' : `<div class="ve-bar" id="bar">
                <label class="ve-tool">${ic('plus')}<span>Import</span><input type="file" id="imp" accept="video/*,image/*,audio/*" multiple hidden></label>
                <button class="ve-tool" data-fromfiles>${ic('folder')}<span>Files</span></button>
                <button class="ve-tool" data-addtext>${ic('textbox')}<span>Text</span></button>
                <button class="ve-tool" data-music>${ic('bell')}<span>Music</span></button>
                <i></i>
                <button class="ve-tool" data-split title="Split at the playhead (S)">${ic('minimize')}<span>Split</span></button>
                <button class="ve-tool" data-freeze title="Freeze frame at the playhead (F)">${ic('clock')}<span>Freeze</span></button>
                <button class="ve-tool" data-dup title="Duplicate (Ctrl D)">${ic('copy')}<span>Copy</span></button>
                <button class="ve-tool" data-del title="Delete (Del)">${ic('trash')}<span>Delete</span></button>
                <i></i>
                <button class="ve-tool" data-undo title="Undo (Ctrl Z)">${ic('undo')}<span>Undo</span></button>
                <button class="ve-tool" data-redo title="Redo (Ctrl Y)">${ic('redo')}<span>Redo</span></button>
                <span class="spacer"></span>
                <span class="ve-zoom">${ic('search')}<input type="range" id="zoom" min="8" max="300" value="${pps}" aria-label="Timeline zoom"></span>
                <input type="file" id="musicfile" accept="audio/*" hidden>
            </div>`}
            <div class="ve-tl" id="tl"><div class="ve-scroll" id="tlscroll"><div class="ve-inner" id="tlinner">
                <div class="ve-ruler" id="ruler"></div>
                <div class="ve-track ve-ttext" id="ttext"></div>
                <div class="ve-track ve-tvideo" id="tvideo"></div>
                <div class="ve-track ve-taudio" id="taudio"></div>
                <div class="ve-ph" id="ph"><i></i></div>
            </div></div></div>
        </div>`;
        if ($('#share')) $('#share').value = doc.share;
        $('#home').onclick = async () => {
            if (dirty) await saveNow();
            list = await call('/api/docs?kind=video');
            gallery();
        };
        $('#name').addEventListener('input', () => {
            doc.title = $('#name').value;
            changed();
        });
        $('#share') && ($('#share').onchange = async e => {
            const r = await call(`/api/docs/${doc.id}`, { method: 'PATCH', body: { share: e.target.value } });
            doc.share = r.share;
            toast(r.share === 'private' ? 'Only you can see it' : 'Shared on EderveenGroup');
        });
        $('#export').onclick = exportDialog;
        $('#auto') && ($('#auto').onclick = autoDialog);
        $('#play').onclick = () => (playing ? pause() : play());
        $('#tostart').onclick = () => seek(0);
        $('#toend').onclick = () => seek(total);
        const imp = e => {
            const fs = [...e.target.files];
            e.target.value = '';
            importFiles(fs);
        };
        $('#imp') && ($('#imp').onchange = imp);
        $('#imp2') && ($('#imp2').onchange = imp);
        $('#musicfile') && ($('#musicfile').onchange = imp);
        $('#zoom') && ($('#zoom').oninput = e => {
            pps = +e.target.value;
            drawTimeline();
        });
        bindTimeline();
        new ResizeObserver(() => sizeStage()).observe($('#stage'));
        relayout();
        // fit the whole project in the timeline
        const w = $('#tlscroll').clientWidth - 80;
        if (total > 0) pps = clamp(w / total, 8, 200);
        if ($('#zoom')) $('#zoom').value = pps;
        drawTimeline();
        inspector();
        for (const m of P.media) if (m.kind === 'video') makeThumbs(m);
        syncUndo();
        sizeStage();
    }

    /* ---------- drawing a frame ---------- */
    let out = null; // the canvas being drawn on (the preview, or the export)
    let W = 640;
    let H = 360;
    const comps = [document.createElement('canvas'), document.createElement('canvas')];
    const gls = [null, null];
    function sizeStage() {
        const st = $('#stage');
        if (!st || exporting) return;
        const [a, b] = ASPECTS[P.aspect] || ASPECTS['16:9'];
        const k = Math.min(st.clientWidth / a, st.clientHeight / b);
        const cw = Math.max(80, Math.floor(a * k));
        const ch = Math.max(45, Math.floor(b * k));
        const c = $('#out');
        Object.assign(c.style, { width: `${cw}px`, height: `${ch}px` });
        const dpr = Math.min(1.5, devicePixelRatio || 1);
        // the preview is drawn at screen size, at most 720p
        const scale = Math.min(1, 1280 / Math.max(cw * dpr, ch * dpr));
        c.width = Math.round(cw * dpr * scale);
        c.height = Math.round(ch * dpr * scale);
        target(c);
        $('#empty').hidden = !!P.clips.length;
        frame();
    }
    function target(c) {
        out = c;
        W = c.width;
        H = c.height;
        for (const k of comps) {
            k.width = W;
            k.height = H;
        }
    }
    const renderer = i => (gls[i] = gls[i] || FX.create(document.createElement('canvas')));
    // a clip's look at u seconds into it: its own colours plus its effect, and how the effect moves it
    function look(c, u) {
        const D = clipDur(c);
        const k = clamp(u / D, 0, 1);
        const own = { ...c.adjust };
        const add = (key, v, lo = -100, hi = 100) => (own[key] = clamp((own[key] || 0) + v, lo, hi));
        let zoom = 1;
        let shift = [0, 0]; // in the footage's own size
        let pan = [0, 0]; // −1…1 of the room there is to move without showing an edge
        let angle = 0;
        switch (c.effect) {
            case 'zoom_in':
                zoom = 1 + 0.16 * k;
                break;
            case 'zoom_out':
                zoom = 1.16 - 0.16 * k;
                break;
            case 'slow_zoom':
                zoom = 1 + 0.06 * k;
                break;
            case 'pan_left':
            case 'pan_right':
            case 'pan_up':
            case 'pan_down': {
                zoom = 1.12;
                const e = (k - 0.5) * 2;
                pan = { pan_left: [e, 0], pan_right: [-e, 0], pan_up: [0, e], pan_down: [0, -e] }[c.effect];
                break;
            }
            case 'pulse':
                zoom = 1 + 0.06 * Math.exp(-((u * 2) % 1) * 5);
                break;
            case 'heartbeat': {
                const b = u % 1;
                zoom = 1 + 0.07 * Math.exp(-b * 14) + (b > 0.22 ? 0.05 * Math.exp(-(b - 0.22) * 14) : 0);
                break;
            }
            case 'shake':
                zoom = 1.05;
                shift = [Math.sin(u * 41) * 0.012 + Math.sin(u * 17) * 0.006, Math.cos(u * 37) * 0.012];
                break;
            case 'earthquake':
                zoom = 1.12;
                shift = [Math.sin(u * 53) * 0.03 + Math.sin(u * 23) * 0.015, Math.cos(u * 47) * 0.03];
                add('blur', 6, 0, 100);
                break;
            case 'wobble':
                angle = Math.sin(u * 3) * 0.05;
                break;
            case 'spin_in': {
                const e = 1 - Math.pow(1 - clamp(u / 0.6, 0, 1), 3);
                angle = (1 - e) * -0.6;
                zoom = 1 + (1 - e) * 0.5;
                break;
            }
            case 'glitch': {
                const burst = (u * 3) % 1 < 0.25;
                add('glitch', burst ? 85 : 20, 0, 100);
                if (burst) shift = [Math.sin(u * 90) * 0.01, 0];
                break;
            }
            case 'vhs':
                add('grain', 45, 0, 100);
                add('fade', 30);
                add('saturation', -20);
                add('blur', 6, 0, 100);
                add('glitch', (u * 2) % 1 < 0.1 ? 70 : 22, 0, 100);
                shift = [Math.sin(u * 31) * 0.002, 0];
                break;
            case 'rgb_split':
                add('glitch', 45 + 25 * Math.sin(u * 6), 0, 100);
                break;
            case 'film':
                add('grain', 35, 0, 100);
                add('vignette', 50, 0, 100);
                add('sepia', 35, 0, 100);
                add('fade', 15);
                add('exposure', (hash(Math.floor(u * 12)) - 0.5) * 14);
                break;
            case 'pixel_in':
                add('pixelate', 100 * Math.max(0, 1 - u / 0.8), 0, 100);
                break;
            case 'flash':
                add('exposure', 100 * Math.max(0, 1 - u / 0.45));
                break;
            case 'strobe':
                add('exposure', Math.floor(u * 8) % 2 ? 45 : -10);
                break;
            case 'invert_flash':
                if (u % 1 < 0.12) add('invert', 100, 0, 100);
                break;
            case 'bw':
                own.saturation = -100;
                break;
            case 'color_in':
                add('saturation', -100 * Math.max(0, 1 - u / 1.5));
                break;
            case 'dream':
                add('blur', 18, 0, 100);
                add('exposure', 12);
                add('fade', 25);
                add('saturation', 15);
                add('highlights', 30);
                zoom = 1.03 + 0.03 * Math.sin(u * 1.5);
                break;
            case 'rainbow':
                add('temperature', Math.sin(u * 2.4) * 60);
                add('tint', Math.cos(u * 3.1) * 60);
                add('saturation', 20);
                break;
            case 'blur_in':
                add('blur', 70 * Math.max(0, 1 - u / 0.7), 0, 100);
                break;
            case 'blur_out':
                add('blur', 70 * clamp((u - (D - 0.7)) / 0.7, 0, 1), 0, 100);
                break;
            default:
        }
        return { p: FX.merge(c.filter, c.strength, own), zoom, shift, pan, angle };
    }
    // the part of the footage that fills (or fits in) the frame
    function fitCrop(sw, sh, fit) {
        const sa = sw / sh;
        const oa = W / H;
        if (fit === 'contain') return sa > oa ? { x: 0, y: (1 - sa / oa) / 2, w: 1, h: sa / oa } : { x: (1 - oa / sa) / 2, y: 0, w: oa / sa, h: 1 };
        return sa > oa ? { x: (1 - oa / sa) / 2, y: 0, w: oa / sa, h: 1 } : { x: 0, y: (1 - sa / oa) / 2, w: 1, h: sa / oa };
    }
    const sourceOf = c => {
        const m = mediaOf(c.m);
        if (!m) return null;
        if (m.kind === 'image') return imageOf(m);
        return elFor(c.id, m);
    };
    // what's behind footage that doesn't fill the frame: the footage blurred, or a colour
    function background(g, src, sw, sh) {
        if (P.bg === 'blur') {
            g.save();
            g.filter = 'blur(28px) brightness(.7)';
            const k = Math.max(W / sw, H / sh) * 1.15;
            g.drawImage(src, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k);
            g.restore();
            return;
        }
        g.fillStyle = P.bg === 'white' ? '#fff' : /^#[0-9a-f]{6}$/i.test(P.bg) ? P.bg : '#000';
        g.fillRect(0, 0, W, H);
    }
    function drawClip(c, i, u) {
        const src = sourceOf(c);
        const sw = src && (src.videoWidth || src.naturalWidth);
        const sh = src && (src.videoHeight || src.naturalHeight);
        const comp = comps[i];
        const g = comp.getContext('2d');
        g.clearRect(0, 0, W, H);
        if (!sw || !sh) {
            g.fillStyle = '#111';
            g.fillRect(0, 0, W, H);
            return comp;
        }
        const tf = tfOf(c);
        const turned = tf.quarter % 2 === 1;
        const tw = turned ? sh : sw;
        const th = turned ? sw : sh;
        const crop = fitCrop(tw, th, c.fit);
        const contains = c.fit === 'contain' && Math.abs(tw / th - W / H) > 0.01;
        const free = tf.rot !== 0;
        if (contains || free || tf.scale < 100 || tf.x || tf.y) background(g, src, sw, sh);
        const fx = look(c, u);
        // the clip's own place: scale, position and rotation; then the effect's movement on top
        const zoom = fx.zoom * (tf.scale / 100);
        const room = [Math.max(0, zoom / 2 - crop.w / 2), Math.max(0, zoom / 2 - crop.h / 2)];
        const shift = [fx.shift[0] + fx.pan[0] * room[0] * 0.92 - (tf.x / 100) * crop.w, fx.shift[1] + fx.pan[1] * room[1] * 0.92 - (tf.y / 100) * crop.h];
        const r = renderer(i);
        if (r) {
            r.render(src, { w: W, h: H, p: fx.p, crop, zoom, shift, angle: fx.angle + (tf.rot * Math.PI) / 180, free, quarter: tf.quarter, flip: [tf.flipH ? -1 : 1, tf.flipV ? -1 : 1], time: T });
            g.drawImage(r.gl.canvas, 0, 0);
        } else g.drawImage(src, 0, 0, W, H);
        // fading in from black, and out to black
        const D = clipDur(c);
        const fade = Math.min(c.fadeIn ? clamp(u / c.fadeIn, 0, 1) : 1, c.fadeOut ? clamp((D - u) / c.fadeOut, 0, 1) : 1);
        if (fade < 1) {
            g.fillStyle = `rgba(0,0,0,${1 - fade})`;
            g.fillRect(0, 0, W, H);
        }
        return comp;
    }
    // which clips show at time t: one, or two during a transition
    function activeAt(t) {
        const on = [];
        for (let i = 0; i < P.clips.length; i++) {
            const s = starts[i];
            const e = s + clipDur(P.clips[i]);
            if (t >= s && t < e) on.push(i);
        }
        if (!on.length && P.clips.length && t >= total - 1e-6) on.push(P.clips.length - 1);
        return on.slice(-2);
    }
    function frame() {
        if (!out) return;
        const g = out.getContext('2d');
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, H);
        const on = activeAt(T);
        if (on.length === 1) {
            const i = on[0];
            g.drawImage(drawClip(P.clips[i], 0, T - starts[i]), 0, 0);
        } else if (on.length === 2) {
            const [a, b] = on;
            const k = clamp((T - starts[b]) / Math.max(0.01, trDur(a)), 0, 1);
            const A = drawClip(P.clips[a], 0, T - starts[a]);
            const B = drawClip(P.clips[b], 1, T - starts[b]);
            transition(g, P.clips[a].tr.type, k, A, B);
        }
        drawTexts(g);
        if (!exporting) {
            $('#time') && ($('#time').textContent = fmt(T));
            $('#dur') && ($('#dur').textContent = fmt(total));
            placePlayhead();
        }
    }
    // a soft or blocky copy of a picture, for the blur, whip and pixelate transitions
    const small = document.createElement('canvas');
    function reduced(src, kx, ky, blocky) {
        small.width = Math.max(1, Math.round(W / kx));
        small.height = Math.max(1, Math.round(H / ky));
        const s2 = small.getContext('2d');
        s2.imageSmoothingEnabled = true;
        s2.drawImage(src, 0, 0, small.width, small.height);
        return (g, x = 0, y = 0) => {
            g.save();
            g.imageSmoothingEnabled = !blocky;
            g.drawImage(small, x, y, W, H);
            g.restore();
        };
    }
    function transition(g, type, k, A, B) {
        const ease = x => x * x * (3 - 2 * x);
        const e = ease(k);
        g.save();
        switch (type) {
            case 'fade':
                g.drawImage(A, 0, 0);
                g.globalAlpha = e;
                g.drawImage(B, 0, 0);
                break;
            case 'dip_black':
            case 'dip_white':
                g.drawImage(k < 0.5 ? A : B, 0, 0);
                g.globalAlpha = k < 0.5 ? k * 2 : (1 - k) * 2;
                g.fillStyle = type === 'dip_white' ? '#fff' : '#000';
                g.fillRect(0, 0, W, H);
                break;
            case 'flash':
                g.drawImage(k < 0.5 ? A : B, 0, 0);
                g.globalAlpha = Math.pow(1 - Math.abs(k - 0.5) * 2, 2);
                g.fillStyle = '#fff';
                g.fillRect(0, 0, W, H);
                break;
            case 'slide_left':
                g.drawImage(A, -e * W, 0);
                g.drawImage(B, (1 - e) * W, 0);
                break;
            case 'slide_right':
                g.drawImage(A, e * W, 0);
                g.drawImage(B, -(1 - e) * W, 0);
                break;
            case 'slide_up':
                g.drawImage(A, 0, -e * H);
                g.drawImage(B, 0, (1 - e) * H);
                break;
            case 'slide_down':
                g.drawImage(A, 0, e * H);
                g.drawImage(B, 0, -(1 - e) * H);
                break;
            case 'cover':
                g.drawImage(A, 0, 0);
                g.shadowColor = 'rgba(0,0,0,.5)';
                g.shadowBlur = W * 0.03;
                g.drawImage(B, (1 - e) * W, 0);
                break;
            case 'zoom': {
                const za = 1 + e * 0.6;
                g.globalAlpha = 1 - e;
                g.drawImage(A, (W - W * za) / 2, (H - H * za) / 2, W * za, H * za);
                const zb = 1.4 - 0.4 * e;
                g.globalAlpha = e;
                g.drawImage(B, (W - W * zb) / 2, (H - H * zb) / 2, W * zb, H * zb);
                break;
            }
            case 'zoom_out': {
                g.drawImage(B, 0, 0);
                const za = 1 - e;
                g.globalAlpha = 1 - e * 0.6;
                g.drawImage(A, (W - W * za) / 2, (H - H * za) / 2, W * za, H * za);
                break;
            }
            case 'spin': {
                const half = k < 0.5;
                const x = half ? k * 2 : (k - 0.5) * 2;
                g.fillStyle = '#000';
                g.fillRect(0, 0, W, H);
                g.translate(W / 2, H / 2);
                g.rotate((half ? x : x - 1) * Math.PI * 0.5);
                const z = half ? 1 + x * 0.8 : 1.8 - x * 0.8;
                g.scale(z, z);
                g.globalAlpha = half ? 1 - x * 0.5 : 0.5 + x * 0.5;
                g.drawImage(half ? A : B, -W / 2, -H / 2);
                break;
            }
            case 'wipe':
            case 'wipe_up':
            case 'wipe_diag':
            case 'circle':
            case 'split':
                g.drawImage(A, 0, 0);
                g.beginPath();
                if (type === 'wipe') g.rect(0, 0, e * W, H);
                else if (type === 'wipe_up') g.rect(0, (1 - e) * H, W, e * H);
                else if (type === 'split') g.rect(((1 - e) * W) / 2, 0, e * W, H);
                else if (type === 'circle') g.arc(W / 2, H / 2, e * Math.hypot(W, H) * 0.52, 0, Math.PI * 2);
                else {
                    // a diagonal edge from the top left corner to the bottom right
                    const d = e * 2 * W;
                    g.moveTo(0, 0);
                    g.lineTo(d, 0);
                    g.lineTo(0, (d * H) / W);
                    g.closePath();
                }
                g.clip();
                g.drawImage(B, 0, 0);
                break;
            case 'blur': {
                const amount = 1 + 22 * (1 - Math.abs(k - 0.5) * 2);
                reduced(k < 0.5 ? A : B, amount, amount)(g);
                break;
            }
            case 'whip': {
                const amount = 1 + 40 * (1 - Math.abs(k - 0.5) * 2);
                const dx = (k < 0.5 ? -e : 1 - e) * W * 0.35;
                reduced(k < 0.5 ? A : B, amount, 1)(g, dx, 0);
                break;
            }
            case 'pixelate': {
                const amount = 1 + 60 * (1 - Math.abs(k - 0.5) * 2);
                reduced(k < 0.5 ? A : B, amount, amount, true)(g);
                break;
            }
            case 'glitch': {
                const pic = k < 0.5 ? A : B;
                g.drawImage(pic, 0, 0);
                const n = 10;
                const strength = 1 - Math.abs(k - 0.5) * 2;
                const seed = Math.floor(k * 20);
                for (let j = 0; j < n; j++) {
                    if (hash(seed * 31 + j) > 0.55) continue;
                    const y = Math.floor(hash(seed + j * 7) * H);
                    const h = Math.max(2, Math.floor(hash(seed * 3 + j) * H * 0.12));
                    const dx = (hash(seed * 5 + j) - 0.5) * W * 0.2 * strength;
                    g.drawImage(k < 0.5 ? B : A, 0, y, W, h, dx, y, W, h);
                }
                g.globalCompositeOperation = 'lighter';
                g.globalAlpha = 0.25 * strength;
                g.drawImage(pic, W * 0.012 * strength, 0);
                break;
            }
            default:
                g.drawImage(B, 0, 0);
        }
        g.restore();
    }
    // titles and captions, with their animations
    const lum = hex => {
        const n = parseInt(String(hex).slice(1), 16) || 0;
        return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    };
    function drawTexts(g) {
        for (const t of P.texts) {
            const u = T - t.start;
            if (u < 0 || u >= t.dur) continue;
            const inK = clamp(u / 0.4, 0, 1);
            const outK = clamp((t.dur - u) / 0.3, 0, 1);
            const easeOut = x => 1 - Math.pow(1 - x, 3);
            let alpha = Math.min(1, outK * 1.0);
            let scale = 1;
            let dx = 0;
            let dy = 0;
            let blur = 0;
            let text = t.text;
            switch (t.anim) {
                case 'fade':
                    alpha = Math.min(inK, outK);
                    break;
                case 'pop': {
                    const x = clamp(u / 0.35, 0, 1);
                    scale = x < 1 ? 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2) : 1;
                    alpha = Math.min(clamp(u / 0.15, 0, 1), outK);
                    break;
                }
                case 'slide':
                    dy = (1 - easeOut(inK)) * 0.08 * H;
                    alpha = Math.min(inK, outK);
                    break;
                case 'slide_left':
                    dx = -(1 - easeOut(clamp(u / 0.5, 0, 1))) * 0.5 * W;
                    alpha = Math.min(clamp(u / 0.25, 0, 1), outK);
                    break;
                case 'drop': {
                    const x = clamp(u / 0.55, 0, 1);
                    const back = 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
                    dy = -(1 - back) * 0.3 * H;
                    alpha = Math.min(clamp(u / 0.2, 0, 1), outK);
                    break;
                }
                case 'bounce': {
                    const x = clamp(u / 0.9, 0, 1);
                    dy = -Math.abs(Math.sin(x * Math.PI * 2.5)) * (1 - x) * 0.14 * H;
                    alpha = Math.min(clamp(u / 0.15, 0, 1), outK);
                    break;
                }
                case 'zoom':
                    scale = 2.2 - 1.2 * easeOut(clamp(u / 0.45, 0, 1));
                    alpha = Math.min(inK, outK);
                    break;
                case 'type':
                    text = t.text.slice(0, Math.ceil(t.text.length * clamp(u / Math.max(0.3, t.text.length * 0.045), 0, 1)));
                    break;
                case 'blur':
                    blur = (1 - easeOut(clamp(u / 0.6, 0, 1))) * 0.35;
                    alpha = Math.min(clamp(u / 0.3, 0, 1), outK);
                    break;
                case 'flicker':
                    alpha = u < 0.7 ? (hash(Math.floor(u * 20) + t.start * 7) > 0.45 ? 1 : 0.15) : outK;
                    break;
                default:
            }
            if (!text || alpha <= 0) continue;
            const title = t.style === 'title';
            const size = (t.size / 100) * H * (title ? 1.25 : 1);
            const lines = text.split('\n');
            g.save();
            g.globalAlpha = alpha;
            g.translate(t.x * W + dx, t.y * H + dy);
            g.scale(scale, scale);
            if (blur && 'filter' in g) g.filter = `blur(${(blur * size).toFixed(1)}px)`;
            g.font = `${title ? '400' : '700'} ${size}px ${FONTS[title ? 'Serif' : t.font] || FONTS.Geist}`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            const lh = size * 1.15;
            const bw = Math.max(...lines.map(l => g.measureText(l).width));
            const bh = lh * lines.length;
            if (t.style === 'box' || t.style === 'highlight') {
                const p = size * 0.3;
                g.fillStyle = t.style === 'box' ? 'rgba(0,0,0,.62)' : t.color;
                g.beginPath();
                (g.roundRect || g.rect).call(g, -bw / 2 - p, -bh / 2 - p * 0.55, bw + p * 2, bh + p * 1.1, size * 0.22);
                g.fill();
            }
            const fill = t.style === 'highlight' ? (lum(t.color) > 0.6 ? '#111111' : '#ffffff') : t.color;
            let paint = fill;
            if (t.style === 'gradient') {
                const gr = g.createLinearGradient(-bw / 2, 0, bw / 2, 0);
                const stops = t.color === '#ffffff' ? ['#ffd27a', '#ff6fb5', '#9b5de5'] : [t.color, '#ff6fb5', '#ffd27a'];
                stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
                paint = gr;
            }
            const drawLine = (l, y) => {
                if (t.anim === 'wave') {
                    // letter by letter, each on its own wave
                    let x = -g.measureText(l).width / 2;
                    g.textAlign = 'left';
                    [...l].forEach((ch, i) => {
                        g.fillText(ch, x, y + Math.sin(u * 6 - i * 0.55) * size * 0.12);
                        x += g.measureText(ch).width;
                    });
                    g.textAlign = 'center';
                } else g.fillText(l, 0, y);
            };
            lines.forEach((l, i) => {
                const y = -bh / 2 + lh * (i + 0.5);
                g.save();
                if (t.style === 'shadow' || title) {
                    g.shadowColor = 'rgba(0,0,0,.65)';
                    g.shadowBlur = size * 0.3;
                    g.shadowOffsetY = size * 0.05;
                }
                if (t.style === 'outline') {
                    g.lineWidth = Math.max(2, size * 0.14);
                    g.strokeStyle = t.color === '#111111' ? '#fff' : '#111';
                    g.lineJoin = 'round';
                    g.strokeText(l, 0, y);
                }
                if (t.style === 'retro') {
                    g.fillStyle = lum(t.color) > 0.5 ? '#e5484d' : '#ffd27a';
                    g.save();
                    g.translate(size * 0.07, size * 0.07);
                    drawLine(l, y);
                    g.restore();
                }
                if (t.style === 'neon') {
                    g.shadowColor = t.color;
                    g.shadowBlur = size * 0.6;
                    g.fillStyle = t.color;
                    drawLine(l, y);
                    g.shadowBlur = size * 0.25;
                    drawLine(l, y);
                    g.shadowBlur = 0;
                    g.globalAlpha *= 0.55;
                    paint = '#ffffff';
                }
                g.fillStyle = paint;
                drawLine(l, y);
                g.restore();
            });
            t._box = { x: t.x - bw / 2 / W, y: t.y - bh / 2 / H, w: bw / W, h: bh / H };
            g.restore();
        }
    }

    /* ---------- footage: one <video> per clip, kept in step with the playhead ---------- */
    function elFor(key, m) {
        let e = els.get(key);
        const src = srcOf(m);
        if (e && e.dataset.src === src) return e;
        if (e) e.pause();
        e = document.createElement(m.kind === 'audio' ? 'audio' : 'video');
        e.preload = 'auto';
        e.playsInline = true;
        e.muted = false;
        e.dataset.src = src;
        if (src) e.src = src;
        e.addEventListener('seeked', () => !playing && frameSoon());
        e.addEventListener('loadeddata', () => !playing && frameSoon());
        els.set(key, e);
        wire(e);
        return e;
    }
    function imageOf(m) {
        let im = imgs.get(m.id);
        const src = srcOf(m);
        if (im && im.dataset.src === src) return im;
        im = new Image();
        im.dataset.src = src;
        im.onload = frameSoon;
        im.src = src;
        imgs.set(m.id, im);
        return im;
    }
    const frameSoon = (() => {
        let q = false;
        return () => {
            if (q) return;
            q = true;
            requestAnimationFrame(() => {
                q = false;
                if (!playing) frame();
            });
        };
    })();
    // sound: every clip and song goes through one mix (so the export can record it)
    let ac = null;
    let master = null;
    function audioReady() {
        if (ac) return ac.state === 'suspended' ? ac.resume() : null;
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.connect(ac.destination);
        for (const e of els.values()) wire(e);
        return null;
    }
    function wire(e) {
        if (!ac || e._gain) return;
        try {
            e._node = ac.createMediaElementSource(e);
            e._gain = ac.createGain();
            e._node.connect(e._gain).connect(master);
        } catch {
            // already wired, or not allowed
        }
    }
    function sync(t, run) {
        const on = activeAt(t);
        let waiting = false;
        const want = []; // what should be playing now
        P.clips.forEach((c, i) => {
            const m = mediaOf(c.m);
            if (!m || m.kind === 'image') return;
            const e = elFor(c.id, m);
            const active = on.includes(i);
            // load the next clip a little early, so it starts on time
            const soon = !active && t >= starts[i] - 1.5 && t < starts[i];
            if (!active) {
                if (!e.paused) e.pause();
                if (soon && Math.abs(e.currentTime - c.in) > 0.05) e.currentTime = c.in;
                return;
            }
            // a freeze frame holds one moment, silently
            const lt = c.freeze ? c.in : clamp(c.in + (t - starts[i]) * c.speed, c.in, c.out - 0.01);
            if (e._gain) {
                const u = t - starts[i];
                const D = clipDur(c);
                const fade = Math.min(c.fadeIn ? clamp(u / c.fadeIn, 0, 1) : 1, c.fadeOut ? clamp((D - u) / c.fadeOut, 0, 1) : 1);
                const v = c.freeze ? 0 : (c.vol / 100) * fade * (on.length === 2 ? (i === on[1] ? clamp((t - starts[i]) / Math.max(0.01, trDur(on[0])), 0, 1) : 1 - clamp((t - starts[on[1]]) / Math.max(0.01, trDur(i)), 0, 1)) : 1);
                e._gain.gain.value = clamp(v, 0, 2);
            }
            if (run && c.freeze) {
                if (!e.paused) e.pause();
                if (Math.abs(e.currentTime - lt) > 0.02) e.currentTime = lt;
                if (e.readyState < 2 || e.seeking) waiting = true;
            } else if (run) {
                if (e.playbackRate !== c.speed) e.playbackRate = c.speed;
                if (Math.abs(e.currentTime - lt) > 0.3) e.currentTime = lt;
                if (e.readyState < 3 || e.seeking) waiting = true;
                want.push(e);
            } else {
                if (!e.paused) e.pause();
                if (Math.abs(e.currentTime - lt) > 0.02) e.currentTime = lt;
            }
        });
        for (const a of P.audio) {
            const m = mediaOf(a.m);
            if (!m) continue;
            const e = elFor(a.id, m);
            const d = a.out - a.in;
            const u = t - a.start;
            if (u < 0 || u >= d || !run) {
                if (!e.paused) e.pause();
                continue;
            }
            if (e._gain) e._gain.gain.value = clamp((a.vol / 100) * Math.min(1, a.fadeIn ? u / a.fadeIn : 1, a.fadeOut ? (d - u) / a.fadeOut : 1, t > total - 0.05 ? 0 : 1), 0, 2);
            const lt = a.in + u;
            if (Math.abs(e.currentTime - lt) > 0.3) e.currentTime = lt;
            if (e.readyState < 3 || e.seeking) waiting = true;
            want.push(e);
        }
        // while something is still loading, everything holds, so sound and picture stay together
        for (const e of want) {
            if (waiting) !e.paused && e.pause();
            else if (e.paused) e.play().catch(() => {});
        }
        return waiting;
    }
    let raf = 0;
    let last = 0;
    function play() {
        if (!P.clips.length) return;
        if (T >= total - 0.05) T = 0;
        audioReady();
        playing = true;
        last = performance.now();
        $('#play').innerHTML = `<span class="ve-pause"></span>`;
        sync(T, true);
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
    }
    function tick(now) {
        if (!playing) return;
        // while exporting, the clock follows real time (a slow computer drops frames rather than
        // stretching the video), and the recording pauses while footage is still loading
        const dt = Math.min(exporting ? 1 : 0.25, (now - last) / 1000);
        last = now;
        const waiting = sync(T, true);
        if (exporting) exporting.hold(waiting);
        if (!waiting) T += dt;
        if (T >= total) {
            T = total;
            frame();
            if (exporting) return finishExport();
            return pause();
        }
        frame();
        if (exporting) exporting.tick();
        raf = requestAnimationFrame(tick);
    }
    function pause() {
        playing = false;
        cancelAnimationFrame(raf);
        sync(T, false);
        if ($('#play')) $('#play').innerHTML = ic('play');
        frame();
    }
    function stopAll() {
        playing = false;
        cancelAnimationFrame(raf);
        for (const e of els.values()) e.pause();
    }
    function seek(t) {
        T = clamp(t, 0, total);
        if (playing) sync(T, true);
        else sync(T, false);
        frame();
    }

    /* ---------- the timeline ---------- */
    const thumbH = () => (phone() ? 40 : 52);
    function drawTimeline() {
        if (!$('#tlinner')) return;
        relayout();
        const width = Math.max(total * pps + 240, $('#tlscroll').clientWidth);
        $('#tlinner').style.width = `${width}px`;
        // the ruler: a tick every so often, labelled
        const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120].find(s => s * pps >= 70) || 300;
        let r = '';
        for (let s = 0; s <= total + step * 3; s += step) r += `<span style="left:${s * pps}px">${step < 1 ? fmt(s) : fmt(s).replace(/\.\d$/, '')}</span>`;
        $('#ruler').innerHTML = r;
        // the clips
        const th = thumbH();
        $('#tvideo').innerHTML =
            P.clips
                .map((c, i) => {
                    const m = mediaOf(c.m) || {};
                    const w = clipDur(c) * pps;
                    const pr = progress.get(m.id);
                    return `<div class="ve-clip${sel && sel.id === c.id ? ' on' : ''}${!srcOf(m) ? ' missing' : ''}" data-clip="${c.id}" style="left:${starts[i] * pps}px;width:${w}px">
                    <span class="ve-strip">${strip(c, m, w, th)}</span>
                    <span class="ve-cl">${m.kind === 'image' ? ic('image') : ''}${c.speed !== 1 ? `<i>${c.speed}×</i>` : ''}${c.effect !== 'none' ? `<i>${ic('zap')}</i>` : ''}${c.filter !== 'none' ? `<i>${ic('palette')}</i>` : ''}${secs(clipDur(c))}</span>
                    ${pr != null ? `<span class="ve-up"><i style="width:${pr * 100}%"></i></span>` : ''}${!srcOf(m) ? '<span class="ve-miss">Missing: import it again</span>' : ''}
                    ${doc.canEdit ? '<span class="ve-h l" data-h="l"></span><span class="ve-h r" data-h="r"></span>' : ''}</div>`;
                })
                .join('') +
            (doc.canEdit ? P.clips.slice(0, -1).map((c, i) => `<button class="ve-trbtn${c.tr.type !== 'none' ? ' on' : ''}${sel && (sel.id === c.id || sel.id === P.clips[i + 1].id) ? ' near' : ''}" data-tr="${c.id}" data-next="${P.clips[i + 1].id}" style="left:${(starts[i + 1] + (c.tr.type !== 'none' ? trDur(i) / 2 : 0)) * pps}px" title="Transition">${c.tr.type !== 'none' ? '⧓' : '+'}</button>`).join('') : '');
        // titles, in rows so they don't cover each other
        const rows = [];
        const place = t => {
            let r2 = rows.findIndex(end => end <= t.start + 1e-3);
            if (r2 < 0) r2 = rows.push(0) - 1;
            rows[r2] = t.start + t.dur;
            return r2;
        };
        const texts = [...P.texts].sort((a, b) => a.start - b.start).map(t => [t, place(t)]);
        $('#ttext').style.height = `${Math.max(1, rows.length) * 26 + 6}px`;
        $('#ttext').innerHTML = texts.map(([t, row]) => `<div class="ve-item ve-text${sel && sel.id === t.id ? ' on' : ''}" data-text="${t.id}" style="left:${t.start * pps}px;width:${Math.max(6, t.dur * pps)}px;top:${3 + row * 26}px">${ic('textbox')}<span>${esc(t.text)}</span>${doc.canEdit ? '<span class="ve-h l" data-h="l"></span><span class="ve-h r" data-h="r"></span>' : ''}</div>`).join('');
        $('#taudio').innerHTML = P.audio.map(a => {
            const m = mediaOf(a.m) || {};
            const pr = progress.get(m.id);
            return `<div class="ve-item ve-audio${sel && sel.id === a.id ? ' on' : ''}" data-audio="${a.id}" style="left:${a.start * pps}px;width:${Math.max(6, (a.out - a.in) * pps)}px">${ic('bell')}<span>${esc(m.name || 'Music')}</span>${pr != null ? `<span class="ve-up"><i style="width:${pr * 100}%"></i></span>` : ''}${doc.canEdit ? '<span class="ve-h l" data-h="l"></span><span class="ve-h r" data-h="r"></span>' : ''}</div>`;
        }).join('');
        placePlayhead();
        $('#empty') && ($('#empty').hidden = !!P.clips.length);
    }
    // little pictures along a clip
    function strip(c, m, w, th) {
        if (m.kind === 'image') {
            const tw = th * ((m.w || 16) / (m.h || 9));
            const n = Math.min(60, Math.ceil(w / tw));
            return Array.from({ length: n }, () => `<img alt="" src="${esc(srcOf(m))}" style="width:${tw}px">`).join('');
        }
        const list2 = thumbs.get(m.id);
        if (!list2 || !list2.length) return '';
        const tw = th * ((m.w || 16) / (m.h || 9));
        const n = Math.min(80, Math.ceil(w / tw));
        let h = '';
        for (let i = 0; i < n; i++) {
            const t = c.in + ((i * tw) / pps) * c.speed;
            let best = list2[0];
            for (const x of list2) if (Math.abs(x.t - t) < Math.abs(best.t - t)) best = x;
            h += `<img alt="" src="${best.url}" style="width:${tw}px">`;
        }
        return h;
    }
    function placePlayhead() {
        const ph = $('#ph');
        if (!ph) return;
        ph.style.left = `${T * pps}px`;
        // keep it in view while playing
        if (playing) {
            const sc = $('#tlscroll');
            const x = T * pps;
            if (x > sc.scrollLeft + sc.clientWidth - 60 || x < sc.scrollLeft) sc.scrollLeft = x - 60;
        }
    }
    // pointer on the timeline: scrub, select, move, trim
    let tdrag = null;
    function bindTimeline() {
        const sc = $('#tlscroll');
        const xOf = e => e.clientX - $('#tlinner').getBoundingClientRect().left;
        sc.addEventListener('pointerdown', e => {
            if (e.button) return;
            const x = xOf(e);
            const clipEl = e.target.closest('[data-clip]');
            const textEl = e.target.closest('[data-text]');
            const audioEl = e.target.closest('[data-audio]');
            const trb = e.target.closest('[data-tr]');
            if (trb) return trMenu(trb, P.clips.find(c => c.id === trb.dataset.tr));
            const el = clipEl || textEl || audioEl;
            if (!el) {
                // the ruler or an empty row: move the playhead
                if (playing) pause();
                seek(x / pps);
                tdrag = { kind: 'scrub' };
                sc.setPointerCapture(e.pointerId);
                return;
            }
            const kind = clipEl ? 'clip' : textEl ? 'text' : 'audio';
            const id = el.dataset.clip || el.dataset.text || el.dataset.audio;
            const changedSel = !sel || sel.id !== id;
            sel = { kind, id };
            if (changedSel) {
                $$('.ve-clip.on, .ve-item.on').forEach(x => x.classList.remove('on'));
                el.classList.add('on');
                $$('.ve-trbtn').forEach(x => x.classList.toggle('near', x.dataset.tr === id || x.dataset.next === id));
                inspector();
            }
            if (!doc.canEdit) return;
            const h = e.target.closest('[data-h]');
            const item = kind === 'clip' ? P.clips.find(c => c.id === id) : kind === 'text' ? P.texts.find(t => t.id === id) : P.audio.find(a => a.id === id);
            tdrag = { kind, id, item, edge: h && h.dataset.h, x0: x, start: JSON.parse(JSON.stringify(item)), moved: false, el };
            sc.setPointerCapture(e.pointerId);
        });
        sc.addEventListener('pointermove', e => {
            if (!tdrag) return;
            const x = xOf(e);
            if (tdrag.kind === 'scrub') return seek(x / pps);
            const dx = (x - tdrag.x0) / pps;
            if (!tdrag.moved && Math.abs(x - tdrag.x0) < 4) return;
            if (!tdrag.moved) {
                tdrag.moved = true;
                remember();
            }
            const it = tdrag.item;
            const s0 = tdrag.start;
            const snap = v => {
                // to the playhead, and to the ends of clips
                const marks = [T, 0, total, ...starts, ...P.clips.map((c, i) => starts[i] + clipDur(c))];
                for (const m of marks) if (Math.abs(m - v) * pps < 7) return m;
                return v;
            };
            if (tdrag.kind === 'clip') {
                const m = mediaOf(it.m) || {};
                const max = m.kind === 'image' || it.freeze ? s0.in + 3600 : m.dur || s0.out;
                if (tdrag.edge === 'l' && it.freeze) it.out = clamp(s0.out - dx, s0.in + 0.2, s0.in + 3600);
                else if (tdrag.edge === 'l') it.in = clamp(s0.in + dx * s0.speed, 0, s0.out - 0.2);
                else if (tdrag.edge === 'r') it.out = clamp(s0.out + dx * s0.speed, s0.in + 0.2, max);
                else {
                    // drag a clip to a new place: show where it would go
                    const i = P.clips.indexOf(it);
                    const centre = starts[i] + clipDur(it) / 2 + dx;
                    let to = P.clips.findIndex((c, j) => centre < starts[j] + clipDur(c) / 2);
                    if (to < 0) to = P.clips.length;
                    tdrag.to = to;
                    tdrag.el.style.transform = `translateX(${dx * pps}px)`;
                    tdrag.el.classList.add('dragging');
                    let mk = $('#tvideo .ve-mark');
                    if (!mk) {
                        mk = document.createElement('i');
                        mk.className = 've-mark';
                        $('#tvideo').append(mk);
                    }
                    mk.style.left = `${(to < P.clips.length ? starts[to] : total) * pps}px`;
                    return;
                }
            } else if (tdrag.kind === 'text') {
                if (tdrag.edge === 'l') {
                    const s = clamp(snap(s0.start + dx), 0, s0.start + s0.dur - 0.2);
                    it.dur = s0.dur + (s0.start - s);
                    it.start = s;
                } else if (tdrag.edge === 'r') it.dur = clamp(snap(s0.start + s0.dur + dx) - s0.start, 0.2, 3600);
                else it.start = clamp(snap(s0.start + dx), 0, 6 * 3600);
            } else {
                const m = mediaOf(it.m) || {};
                if (tdrag.edge === 'l') {
                    const d = clamp(dx, -s0.in, s0.out - s0.in - 0.2);
                    it.in = s0.in + d;
                    it.start = Math.max(0, s0.start + d);
                } else if (tdrag.edge === 'r') it.out = clamp(s0.out + dx, s0.in + 0.2, m.dur || s0.out);
                else it.start = clamp(snap(s0.start + dx), 0, 6 * 3600);
            }
            drawTimeline();
            if (tdrag.kind !== 'clip' || tdrag.edge) frame();
        });
        const end = () => {
            if (!tdrag) return;
            const d = tdrag;
            tdrag = null;
            if (d.kind === 'scrub' || !d.moved) return;
            if (d.kind === 'clip' && !d.edge && d.to != null) {
                const i = P.clips.indexOf(d.item);
                P.clips.splice(i, 1);
                P.clips.splice(d.to > i ? d.to - 1 : d.to, 0, d.item);
            }
            drawTimeline();
            inspector();
            frame();
            changed();
        };
        sc.addEventListener('pointerup', end);
        sc.addEventListener('pointercancel', end);
        sc.addEventListener('wheel', e => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            pps = clamp(pps * Math.exp(-e.deltaY * 0.002), 8, 300);
            if ($('#zoom')) $('#zoom').value = pps;
            drawTimeline();
        }, { passive: false });
    }
    function trMenu(anchor, c) {
        $$('.fl-pop').forEach(x => x.remove());
        const pop = document.createElement('div');
        pop.className = 'fl-pop ve-trpop';
        pop.innerHTML = `<p>Transition</p><div class="ve-trs">${TRANSITIONS.map(([k, l]) => `<button data-t="${k}" class="${c.tr.type === k ? 'on' : ''}"><span class="ve-tri tr-${k}"></span>${l}</button>`).join('')}</div><label class="pe-slider"><span><b>Length</b><i>${c.tr.dur.toFixed(1)} s</i></span><input type="range" min="0.2" max="2" step="0.1" value="${c.tr.dur}"></label>`;
        document.body.append(pop);
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${Math.max(8, r.top - pop.offsetHeight - 8)}px`;
        pop.style.left = `${clamp(r.left - pop.offsetWidth / 2, 8, innerWidth - pop.offsetWidth - 8)}px`;
        const off = e => !pop.contains(e.target) && (pop.remove(), removeEventListener('pointerdown', off, true));
        setTimeout(() => addEventListener('pointerdown', off, true));
        pop.addEventListener('click', e => {
            const b = e.target.closest('[data-t]');
            if (!b) return;
            remember();
            c.tr.type = b.dataset.t;
            $$('[data-t]', pop).forEach(x => x.classList.toggle('on', x === b));
            drawTimeline();
            // show it: play the moment it happens
            const i = P.clips.indexOf(c);
            seek(Math.max(0, starts[i + 1] - 0.6));
            changed();
        });
        $('input', pop).addEventListener('input', e => {
            c.tr.dur = +e.target.value;
            $('.pe-slider i', pop).textContent = `${c.tr.dur.toFixed(1)} s`;
            drawTimeline();
            frame();
        });
        $('input', pop).addEventListener('change', () => changed());
    }

    /* ---------- the inspector: what the selected thing can do ---------- */
    let tab = 'edit';
    const slider = (key, label, lo, hi, v, step = 1, unit = '') => `<label class="pe-slider"><span><b>${label}</b><i>${Math.round(v * 100) / 100}${unit}</i></span><input type="range" min="${lo}" max="${hi}" step="${step}" value="${v}" data-k="${key}"></label>`;
    function selected() {
        if (!sel) return null;
        const list2 = sel.kind === 'clip' ? P.clips : sel.kind === 'text' ? P.texts : P.audio;
        const it = list2.find(x => x.id === sel.id);
        if (!it) sel = null;
        return it || null;
    }
    function inspector() {
        const el = $('#insp');
        if (!el) return;
        const it = selected();
        const ro = !doc.canEdit;
        if (!it) {
            el.innerHTML = `<h3>Project</h3>
                <p class="ve-label">Shape</p><div class="pe-chips">${Object.entries(ASPECTS).map(([k]) => `<button class="pe-chip${P.aspect === k ? ' on' : ''}" data-aspect="${k}" ${ro ? 'disabled' : ''}>${k}</button>`).join('')}</div>
                <p class="ve-label">Background (for footage that doesn’t fill the frame)</p><div class="pe-chips">${[['blur', 'Blurred'], ['black', 'Black'], ['white', 'White']].map(([k, l]) => `<button class="pe-chip${P.bg === k ? ' on' : ''}" data-bg="${k}" ${ro ? 'disabled' : ''}>${l}</button>`).join('')}</div>
                <div class="pe-swatches">${BG_COLORS.map(c => `<button data-bg="${c}" class="${P.bg === c ? 'on' : ''}" style="background:${c}" aria-label="Background ${c}" ${ro ? 'disabled' : ''}></button>`).join('')}</div>
                <p class="ve-label">Media</p><div class="ve-media">${P.media.map(m => `<div class="ve-m" title="${esc(m.name)}">${m.kind === 'audio' ? ic('bell') : m.kind === 'image' ? `<img alt="" src="${esc(srcOf(m))}">` : thumbs.get(m.id) && thumbs.get(m.id)[0] ? `<img alt="" src="${thumbs.get(m.id)[0].url}">` : ic('play')}<span>${esc(m.name)}</span>${ro ? '' : `<button data-addmedia="${m.id}" title="Add to the timeline" aria-label="Add ${esc(m.name)} to the timeline">${ic('plus')}</button><button data-rmmedia="${m.id}" title="Remove from this project (it stays in Files)" aria-label="Remove ${esc(m.name)}">${ic('x')}</button>`}</div>`).join('') || '<p class="ad-muted">Nothing imported yet.</p>'}</div>
                ${ro ? '' : `<p class="ve-label">This project</p><div class="ve-acts"><button class="btn" data-dupproject>${ic('copy')}<span>Duplicate</span></button><button class="btn" data-clear>${ic('eraser')}<span>Clear timeline…</span></button>${doc.mine ? `<button class="btn btn-danger" data-delproject>${ic('trash')}<span>Delete project</span></button>` : ''}</div>`}
                <p class="ad-muted ve-tip">Space plays and pauses. Click a clip to edit it, drag it to move it, drag its ends to trim. S splits at the playhead, F adds a freeze frame, Ctrl Z / Ctrl Y undo and redo.</p>`;
            return;
        }
        if (sel.kind === 'clip') {
            const c = it;
            const m = mediaOf(c.m) || {};
            const tabs = [['edit', 'Edit'], ['looks', 'Looks'], ['adjust', 'Adjust'], ['effects', 'Effects']];
            let body = '';
            if (tab === 'edit') {
                const tf = tfOf(c);
                body = `${c.freeze ? `<p class="ve-freeze">${ic('clock')}<span>Freeze frame of ${esc(m.name || '')} at ${fmt(c.in)}</span></p>${slider('fdur', 'Shows for', 0.2, 20, Math.round(clipDur(c) * 10) / 10, 0.1, ' s')}` : `<p class="ve-label">Speed</p><div class="pe-chips">${SPEEDS.map(s => `<button class="pe-chip${c.speed === s ? ' on' : ''}" data-speed="${s}">${s}×</button>`).join('')}</div>
                    ${slider('speed', 'Exact speed', 0.25, 4, c.speed, 0.05, '×')}
                    ${m.kind === 'video' ? slider('vol', 'Volume', 0, 200, c.vol, 1, '%') : ''}`}
                    <p class="ve-label">Frame</p><div class="pe-chips"><button class="pe-chip${c.fit === 'cover' ? ' on' : ''}" data-fit="cover">Fill</button><button class="pe-chip${c.fit === 'contain' ? ' on' : ''}" data-fit="contain">Fit</button></div>
                    <p class="ve-label">Position <small>(or drag the picture)</small></p>
                    ${slider('tf.scale', 'Size', 10, 400, tf.scale, 1, '%')}${slider('tf.x', 'Left – right', -100, 100, tf.x, 1, '%')}${slider('tf.y', 'Up – down', -100, 100, tf.y, 1, '%')}${slider('tf.rot', 'Rotate', -180, 180, tf.rot, 1, '°')}
                    <div class="pe-row"><button class="btn" data-quarter title="Turn 90°">${ic('redo')}<span>90°</span></button><button class="btn${tf.flipH ? ' on' : ''}" data-fliph title="Mirror">⇋<span>Mirror</span></button><button class="btn${tf.flipV ? ' on' : ''}" data-flipv title="Upside down">⇵<span>Flip</span></button><button class="btn btn-ghost" data-resettf title="Reset position">${ic('refresh')}</button></div>
                    <p class="ve-label">Fade</p>${slider('fadeIn', 'Fade in from black', 0, 3, c.fadeIn || 0, 0.1, ' s')}${slider('fadeOut', 'Fade out to black', 0, 3, c.fadeOut || 0, 0.1, ' s')}
                    <p class="ve-label">Transition to the next clip</p><div class="ve-trgrid">${TRANSITIONS.map(([k, l]) => `<button class="${c.tr.type === k ? 'on' : ''}" data-trk="${k}"><span class="ve-tri tr-${k}"></span>${l}</button>`).join('')}</div>
                    ${c.tr.type !== 'none' ? slider('trdur', 'Transition length', 0.2, 2, c.tr.dur, 0.1, ' s') : ''}
                    <p class="ad-muted">${esc(m.name || '')} · from ${fmt(c.in)}${c.freeze ? '' : ` to ${fmt(c.out)}`}</p>`;
            } else if (tab === 'looks') {
                body = `<div class="pe-looks">${Object.entries(FX.FILTERS).map(([k, [l]]) => `<button class="pe-look${c.filter === k ? ' on' : ''}" data-filter="${k}"><canvas width="120" height="68" data-thumb="${k}"></canvas><span>${l}</span></button>`).join('')}</div>${c.filter !== 'none' ? slider('strength', 'Strength', 0, 100, c.strength) : ''}`;
            } else if (tab === 'adjust') {
                body = `${FX.PARAMS.map(([k, l, lo, hi]) => slider(`a.${k}`, l, lo, hi, c.adjust[k] || 0)).join('')}<button class="btn btn-ghost pe-wide" data-resetadj>Reset</button>`;
            } else {
                body = `${EFFECT_GROUPS.map(([gname, list2]) => `<p class="ve-label">${gname}</p><div class="ve-effects">${list2.map(([k, l]) => `<button class="ve-eff${c.effect === k ? ' on' : ''}" data-effect="${k}"><span class="ve-effi fx-${k}"></span>${l}</button>`).join('')}</div>`).join('')}<p class="ve-label">Always on</p>${FX.EFFECTS.map(([k, l, lo, hi]) => slider(`a.${k}`, l, lo, hi, c.adjust[k] || 0)).join('')}`;
            }
            el.innerHTML = `<h3>Clip</h3><nav class="ve-tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav><div class="${ro ? 've-ro' : ''}">${body}</div>`;
            if (tab === 'looks') lookThumbs(c);
        } else if (sel.kind === 'text') {
            const t = it;
            el.innerHTML = `<h3>Text</h3><div class="${ro ? 've-ro' : ''}"><textarea class="input pe-ta" id="vtext" rows="2" maxlength="400">${esc(t.text)}</textarea>
                <p class="ve-label">Style</p><div class="pe-chips">${STYLES.map(([k, l]) => `<button class="pe-chip${t.style === k ? ' on' : ''}" data-style="${k}">${l}</button>`).join('')}</div>
                <p class="ve-label">Animation</p><div class="pe-chips">${ANIMS.map(([k, l]) => `<button class="pe-chip${t.anim === k ? ' on' : ''}" data-anim="${k}">${l}</button>`).join('')}</div>
                <div class="pe-chips">${Object.keys(FONTS).map(f => `<button class="pe-chip${t.font === f ? ' on' : ''}" data-font="${f}" style="font-family:${esc(FONTS[f])}">${f}</button>`).join('')}</div>
                <div class="pe-swatches">${COLORS.map(c => `<button data-color="${c}" class="${t.color === c ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
                ${slider('size', 'Size', 2, 30, t.size, 0.5)}
                <p class="ve-label">Place</p><div class="pe-chips"><button class="pe-chip" data-y="0.14">Top</button><button class="pe-chip" data-y="0.5">Middle</button><button class="pe-chip" data-y="0.84">Bottom</button></div>
                ${slider('dur', 'Shows for', 0.5, 30, t.dur, 0.1, ' s')}
                <p class="ad-muted">Or drag the text on the video.</p></div>`;
        } else {
            const a = it;
            const m = mediaOf(a.m) || {};
            el.innerHTML = `<h3>Music</h3><p class="ad-muted">${esc(m.name || '')} · ${fmt(a.out - a.in)}</p><div class="${ro ? 've-ro' : ''}">
                ${slider('vol', 'Volume', 0, 200, a.vol, 1, '%')}${slider('fadeIn', 'Fade in', 0, 5, a.fadeIn, 0.1, ' s')}${slider('fadeOut', 'Fade out', 0, 5, a.fadeOut, 0.1, ' s')}
                <button class="btn pe-wide" data-fitmusic>${ic('maximize')}<span>Make it as long as the video</span></button>
                ${slider('clipsvol', 'Clips’ own sound (all clips)', 0, 200, P.clips.length ? P.clips[0].vol : 100, 1, '%')}</div>`;
        }
    }
    let lookFx = null;
    function lookThumbs(c) {
        const src = sourceOf(c);
        if (!src) return;
        lookFx = lookFx || FX.create(document.createElement('canvas'));
        if (!lookFx) return;
        const sw = src.videoWidth || src.naturalWidth;
        const sh = src.videoHeight || src.naturalHeight;
        if (!sw) return;
        $$('[data-thumb]').forEach(cv => {
            lookFx.render(src, { w: cv.width, h: cv.height, p: FX.merge(cv.dataset.thumb, 100, c.adjust), crop: (() => { const sa = sw / sh, oa = cv.width / cv.height; return sa > oa ? { x: (1 - oa / sa) / 2, y: 0, w: oa / sa, h: 1 } : { x: 0, y: (1 - sa / oa) / 2, w: 1, h: sa / oa }; })() });
            cv.getContext('2d').drawImage(lookFx.gl.canvas, 0, 0);
        });
    }
    root.addEventListener('click', e => {
        if (!doc) {
            const n = e.target.closest('[data-new]');
            if (n) return create(n.dataset.new);
            const mb = e.target.closest('[data-menu]');
            if (mb) return cardMenu(mb, list.find(x => x.id === mb.dataset.menu));
            const c = e.target.closest('.ve-card');
            if (c) openProject(c.dataset.id);
            return;
        }
        if (e.target.closest('[data-fromfiles]')) return fromFiles();
        const t = e.target.closest('#insp [data-tab]');
        if (t) {
            tab = t.dataset.tab;
            return inspector();
        }
        if (!doc.canEdit) return;
        const b = e.target.closest('#bar [data-addtext], #bar [data-music], #bar [data-split], #bar [data-freeze], #bar [data-dup], #bar [data-del], #bar [data-undo], #bar [data-redo]');
        if (b) {
            const d = b.dataset;
            if (d.addtext !== undefined) return addText();
            if (d.freeze !== undefined) return freezeFrame();
            if (d.music !== undefined) return $('#musicfile').click();
            if (d.split !== undefined) return split();
            if (d.dup !== undefined) return duplicate();
            if (d.del !== undefined) return removeSel();
            if (d.undo !== undefined) return step(undo, redo);
            if (d.redo !== undefined) return step(redo, undo);
        }
        const x = e.target.closest('#insp button');
        if (!x) return;
        const d = x.dataset;
        const it = selected();
        if (d.aspect) return change(() => (P.aspect = d.aspect), true);
        if (d.bg) return change(() => (P.bg = d.bg));
        if (d.rmmedia) return removeMedia(d.rmmedia);
        if (d.dupproject !== undefined) return duplicateProject();
        if (d.clear !== undefined) return clearDialog();
        if (d.delproject !== undefined) return deleteProject(doc);
        if (d.addmedia) {
            const m = mediaOf(d.addmedia);
            if (m.kind === 'audio') return change(() => P.audio.push({ id: uid(), m: m.id, start: T, in: 0, out: Math.min(m.dur, Math.max(1, total - T) || m.dur), vol: 100, fadeIn: 0, fadeOut: 1 }));
            return change(() => P.clips.push(newClip(m)));
        }
        if (!it) return;
        if (d.speed) return change(() => (it.speed = +d.speed));
        if (d.fit) return change(() => (it.fit = d.fit));
        if (d.trk) return change(() => (it.tr.type = d.trk));
        if (d.quarter !== undefined) return change(() => (it.tf = { ...tfOf(it), quarter: (tfOf(it).quarter + 1) % 4 }));
        if (d.fliph !== undefined) return change(() => (it.tf = { ...tfOf(it), flipH: !tfOf(it).flipH }));
        if (d.flipv !== undefined) return change(() => (it.tf = { ...tfOf(it), flipV: !tfOf(it).flipV }));
        if (d.resettf !== undefined) return change(() => delete it.tf);
        if (d.filter) return change(() => (it.filter = d.filter));
        if (d.effect) return change(() => (it.effect = d.effect));
        if (d.resetadj !== undefined) return change(() => (it.adjust = {}));
        if (d.style) return change(() => (it.style = d.style));
        if (d.anim) return change(() => (it.anim = d.anim));
        if (d.font) return change(() => (it.font = d.font));
        if (d.color) return change(() => (it.color = d.color));
        if (d.y) return change(() => ((it.y = +d.y), (it.x = 0.5)));
        if (d.fitmusic !== undefined) {
            const m = mediaOf(it.m);
            return change(() => ((it.start = 0), (it.out = Math.min(m.dur, it.in + total))));
        }
    });
    function change(fn, size) {
        remember();
        fn();
        drawTimeline();
        inspector();
        if (size) sizeStage();
        else frame();
        changed();
    }
    root.addEventListener('input', e => {
        if (!doc || !e.target.closest('#insp')) return;
        const it = selected();
        if (e.target.id === 'vtext' && it) {
            if (!e.target.dataset.touched) (remember(), (e.target.dataset.touched = '1'));
            it.text = e.target.value || ' ';
            drawTimeline();
            frame();
            return changed();
        }
        const k = e.target.dataset.k;
        if (!k) return;
        if (!e.target.dataset.touched) (remember(), (e.target.dataset.touched = '1'));
        const v = +e.target.value;
        const o = e.target.closest('.pe-slider').querySelector('i');
        if (o) o.textContent = o.textContent.replace(/^-?[\d.]+/, String(Math.round(v * 100) / 100));
        if (k === 'clipsvol') P.clips.forEach(c => (c.vol = v));
        else if (!it) return;
        else if (k.startsWith('a.')) it.adjust[k.slice(2)] = v;
        else if (k.startsWith('tf.')) it.tf = { ...tfOf(it), [k.slice(3)]: v };
        else if (k === 'fdur') it.out = it.in + v;
        else if (k === 'trdur') it.tr.dur = v;
        else it[k] = v;
        if (['speed', 'dur', 'fdur', 'trdur'].includes(k)) drawTimeline();
        frame();
        changed();
    });
    root.addEventListener('change', e => e.target.dataset && delete e.target.dataset.touched);
    // drag text on the video
    let pdrag = null;
    root.addEventListener('pointerdown', e => {
        if (!doc || !doc.canEdit || e.target.id !== 'out') return;
        const r = e.target.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const hit = [...P.texts].reverse().find(t => T >= t.start && T < t.start + t.dur && t._box && x >= t._box.x - 0.02 && x <= t._box.x + t._box.w + 0.02 && y >= t._box.y - 0.03 && y <= t._box.y + t._box.h + 0.03);
        if (!hit) {
            // the selected clip, when it's on screen: drag to move it in the frame
            const ci = sel && sel.kind === 'clip' ? P.clips.findIndex(c => c.id === sel.id) : -1;
            if (ci < 0 || !activeAt(T).includes(ci)) return;
            remember();
            pdrag = { clip: P.clips[ci], x0: x, y0: y, tf0: tfOf(P.clips[ci]), r };
            e.target.setPointerCapture(e.pointerId);
            return;
        }
        sel = { kind: 'text', id: hit.id };
        remember();
        pdrag = { t: hit, dx: x - hit.x, dy: y - hit.y, r };
        e.target.setPointerCapture(e.pointerId);
        drawTimeline();
        inspector();
    });
    root.addEventListener('pointermove', e => {
        if (!pdrag) return;
        if (pdrag.clip) {
            const px = (e.clientX - pdrag.r.left) / pdrag.r.width;
            const py = (e.clientY - pdrag.r.top) / pdrag.r.height;
            pdrag.clip.tf = { ...pdrag.tf0, x: Math.round(clamp(pdrag.tf0.x + (px - pdrag.x0) * 100, -100, 100)), y: Math.round(clamp(pdrag.tf0.y + (py - pdrag.y0) * 100, -100, 100)) };
            return frame();
        }
        pdrag.t.x = clamp((e.clientX - pdrag.r.left) / pdrag.r.width - pdrag.dx, 0.05, 0.95);
        pdrag.t.y = clamp((e.clientY - pdrag.r.top) / pdrag.r.height - pdrag.dy, 0.05, 0.95);
        frame();
    });
    root.addEventListener('pointerup', () => {
        if (pdrag) {
            const moved = pdrag.clip;
            pdrag = null;
            if (moved) inspector();
            changed();
        }
    });

    /* ---------- edits ---------- */
    const across = m => {
        const [a, b] = ASPECTS[P.aspect] || ASPECTS['16:9'];
        return m.w && m.h && m.h > m.w !== b > a && m.w !== m.h && a !== b;
    };
    const newClip = m => ({ id: uid(), m: m.id, in: 0, out: m.kind === 'image' ? 4 : m.dur || 5, speed: 1, vol: 100, filter: 'none', strength: 100, adjust: {}, effect: m.kind === 'image' ? 'zoom_in' : 'none', fit: m.kind === 'image' || across(m) ? 'contain' : 'cover', tr: { type: 'none', dur: 0.5 } });
    function addText() {
        remember();
        const t = { id: uid(), text: 'Your title', start: T, dur: Math.min(3, Math.max(1, total - T) || 3), x: 0.5, y: 0.5, size: 7, color: '#ffffff', font: 'Geist', style: 'shadow', anim: 'pop' };
        P.texts.push(t);
        sel = { kind: 'text', id: t.id };
        drawTimeline();
        inspector();
        frame();
        changed();
        setTimeout(() => {
            const ta = $('#vtext');
            if (ta) (ta.focus(), ta.select());
        }, 30);
    }
    function split() {
        const it = selected();
        if (!it) return toast('Select a clip, title or song first');
        remember();
        if (sel.kind === 'clip') {
            const i = P.clips.indexOf(it);
            const at = it.in + (T - starts[i]) * it.speed;
            if (at <= it.in + 0.1 || at >= it.out - 0.1) return (undo.pop(), toast('Move the playhead into the clip to split it'));
            const b = { ...JSON.parse(JSON.stringify(it)), id: uid(), in: at };
            it.out = at;
            b.tr = { ...it.tr };
            it.tr = { type: 'none', dur: 0.5 };
            P.clips.splice(i + 1, 0, b);
        } else if (sel.kind === 'text') {
            const u = T - it.start;
            if (u <= 0.1 || u >= it.dur - 0.1) return (undo.pop(), toast('Move the playhead into the title to split it'));
            P.texts.push({ ...JSON.parse(JSON.stringify(it)), id: uid(), start: T, dur: it.dur - u });
            it.dur = u;
        } else {
            const u = T - it.start;
            if (u <= 0.1 || u >= it.out - it.in - 0.1) return (undo.pop(), toast('Move the playhead into the song to split it'));
            P.audio.push({ ...JSON.parse(JSON.stringify(it)), id: uid(), start: T, in: it.in + u });
            it.out = it.in + u;
        }
        drawTimeline();
        frame();
        changed();
    }
    function duplicate() {
        const it = selected();
        if (!it) return;
        remember();
        const copy = { ...JSON.parse(JSON.stringify(it)), id: uid() };
        if (sel.kind === 'clip') P.clips.splice(P.clips.indexOf(it) + 1, 0, copy);
        else if (sel.kind === 'text') P.texts.push({ ...copy, start: it.start + it.dur });
        else P.audio.push({ ...copy, start: it.start + (it.out - it.in) });
        sel = { kind: sel.kind, id: copy.id };
        drawTimeline();
        inspector();
        frame();
        changed();
    }
    function removeSel() {
        const it = selected();
        if (!it) return;
        remember();
        if (sel.kind === 'clip') P.clips = P.clips.filter(x => x !== it);
        else if (sel.kind === 'text') P.texts = P.texts.filter(x => x !== it);
        else P.audio = P.audio.filter(x => x !== it);
        sel = null;
        drawTimeline();
        inspector();
        frame();
        changed();
    }

    // a still of the frame at the playhead, held for 2 seconds (the clip is split around it)
    function freezeFrame() {
        let i = sel && sel.kind === 'clip' ? P.clips.findIndex(c => c.id === sel.id) : -1;
        if (i < 0 || T < starts[i] || T >= starts[i] + clipDur(P.clips[i])) i = activeAt(T).slice(-1)[0] ?? -1;
        const c = P.clips[i];
        if (!c) return toast('Move the playhead onto a clip first');
        const m = mediaOf(c.m);
        if (!m || m.kind !== 'video' || c.freeze) return toast('Freeze frames are made from video clips');
        remember();
        const at = clamp(c.in + (T - starts[i]) * c.speed, c.in, Math.max(c.in, c.out - 0.05));
        const still = { ...JSON.parse(JSON.stringify(c)), id: uid(), in: at, out: at + 2, speed: 1, freeze: true, effect: 'none', tr: { type: 'none', dur: 0.5 }, fadeIn: 0, fadeOut: 0 };
        if (at > c.in + 0.1 && at < c.out - 0.1) {
            const rest = { ...JSON.parse(JSON.stringify(c)), id: uid(), in: at, fadeIn: 0 };
            c.out = at;
            c.tr = { type: 'none', dur: 0.5 };
            c.fadeOut = 0;
            P.clips.splice(i + 1, 0, still, rest);
        } else P.clips.splice(at <= c.in + 0.1 ? i : i + 1, 0, still);
        sel = { kind: 'clip', id: still.id };
        tab = 'edit';
        drawTimeline();
        inspector();
        frame();
        changed();
        toast('Freeze frame added. Drag its end to hold it longer.');
    }
    // take footage out of the project (it stays in Files), with its clips and songs
    function removeMedia(id) {
        const m = mediaOf(id);
        if (!m) return;
        const n = P.clips.filter(c => c.m === id).length + P.audio.filter(a => a.m === id).length;
        remember();
        P.media = P.media.filter(x => x.id !== id);
        P.clips = P.clips.filter(c => c.m !== id);
        P.audio = P.audio.filter(a => a.m !== id);
        if (sel && !selected()) sel = null;
        drawTimeline();
        inspector();
        sizeStage();
        changed();
        toast(`${m.name} is out of this project${n ? ` (with ${n} clip${n === 1 ? '' : 's'})` : ''}. It’s still in Files.`, { action: 'Undo', onAction: () => step(undo, redo) });
    }
    // start over: take clips, titles and music off the timeline (Undo brings them back)
    function clearDialog() {
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        const row = (k, label, n) => `<label class="ve-check"><input type="checkbox" data-c="${k}" ${n ? 'checked' : 'disabled'}> ${label} <small>${n}</small></label>`;
        back.innerHTML = `<div class="pf-crop ve-clear" role="dialog" aria-modal="true"><h2>Clear the timeline</h2><p class="ad-muted">What should go? Undo (Ctrl Z) brings it back.</p>
            <div class="ve-clist">${row('clips', 'All clips', P.clips.length)}${row('texts', 'All titles and captions', P.texts.length)}${row('audio', 'All music', P.audio.length)}${row('media', 'The imported footage list (it stays in Files)', P.media.length)}</div>
            <div class="pf-crop-acts"><button class="btn" data-x>Cancel</button><button class="btn btn-danger-solid" data-ok>${ic('eraser')}<span>Clear</span></button></div></div>`;
        document.body.append(back);
        const done = () => back.remove();
        $('[data-x]', back).onclick = done;
        back.addEventListener('click', e => e.target === back && done());
        back.addEventListener('keydown', e => e.key === 'Escape' && done());
        $('[data-ok]', back).onclick = () => {
            const on = k => $(`[data-c="${k}"]`, back).checked;
            done();
            if (!['clips', 'texts', 'audio', 'media'].some(on)) return;
            remember();
            if (on('clips') || on('media')) P.clips = [];
            if (on('texts')) P.texts = [];
            if (on('audio') || on('media')) P.audio = [];
            if (on('media')) P.media = [];
            sel = null;
            T = 0;
            drawTimeline();
            inspector();
            sizeStage();
            changed();
            toast('Timeline cleared', { action: 'Undo', onAction: () => step(undo, redo) });
        };
    }
    async function duplicateProject(d = doc) {
        if (doc && dirty) await saveNow();
        try {
            const copy = await call(`/api/docs/${d.id}/copy`, { method: 'POST' });
            list.unshift(copy);
            toast('Copied. You’re now in the copy.');
            await openProject(copy.id);
        } catch (e) {
            toast(e.message, { bad: true });
        }
    }
    async function deleteProject(d) {
        if (!(await ask({ title: `Delete “${d.title || 'Untitled video'}”?`, text: `The edit is deleted${d.share !== 'private' ? ', also for everyone it’s shared with' : ''}. Your footage stays in Files → Video Editor. This can’t be undone.`, ok: 'Delete project', danger: true }))) return;
        try {
            await call(`/api/docs/${d.id}`, { method: 'DELETE' });
        } catch (e) {
            return toast(e.message, { bad: true });
        }
        list = list.filter(x => x.id !== d.id);
        if (doc && doc.id === d.id) {
            dirty = false;
            undo = [];
            redo = [];
            gallery();
        } else if (!doc) gallery();
        toast('Project deleted');
    }

    /* ---------- bringing footage in ---------- */
    function probe(url, kind) {
        return new Promise(resolve => {
            if (kind === 'image') {
                const im = new Image();
                im.onload = () => resolve({ dur: 4, w: im.naturalWidth, h: im.naturalHeight });
                im.onerror = () => resolve(null);
                im.src = url;
                return;
            }
            const e = document.createElement(kind === 'audio' ? 'audio' : 'video');
            e.preload = 'metadata';
            e.muted = true;
            e.onloadedmetadata = () => {
                // some files only know their length after a seek to the end
                if (!isFinite(e.duration)) {
                    e.currentTime = 1e9;
                    e.ondurationchange = () => isFinite(e.duration) && resolve({ dur: e.duration, w: e.videoWidth || 0, h: e.videoHeight || 0 });
                    return;
                }
                resolve({ dur: e.duration, w: e.videoWidth || 0, h: e.videoHeight || 0 });
            };
            e.onerror = () => resolve(null);
            e.src = url;
        });
    }
    let folderPromise = null;
    const folder = () =>
        (folderPromise = folderPromise ||
            call('/api/files').then(r => {
                const f = r.items.find(x => x.kind === 'folder' && x.name === 'Video Editor' && !x.folder);
                return f ? f.id : call('/api/files/folders', { method: 'POST', body: { name: 'Video Editor', folder: '' } }).then(x => x.id);
            }));
    async function importFiles(files) {
        const kinds = f => (f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('video/') ? 'video' : null);
        for (const f of files) {
            const kind = kinds(f);
            if (!kind) {
                toast(`${f.name} isn’t a video, photo or song`, { bad: true });
                continue;
            }
            const id = uid();
            const url = URL.createObjectURL(f);
            const meta = await probe(url, kind);
            if (!meta) {
                toast(`${f.name} can’t be played in this browser`, { bad: true });
                continue;
            }
            remember();
            const m = { id, file: '', name: f.name, kind, dur: Math.round(meta.dur * 1000) / 1000, w: meta.w, h: meta.h };
            blobs.set(id, url);
            P.media.push(m);
            if (kind === 'audio') P.audio.push({ id: uid(), m: id, start: 0, in: 0, out: Math.min(m.dur, total > 1 ? total : m.dur), vol: 100, fadeIn: 0, fadeOut: 1.5 });
            else P.clips.push(newClip(m));
            relayout();
            fitTimeline();
            inspector();
            sizeStage();
            if (kind === 'video') makeThumbs(m);
            // the footage is kept in Files, so the project opens anywhere
            progress.set(id, 0);
            folder()
                .then(fid => upload(f, { folder: fid, onProgress: p => (progress.set(id, p), drawTimelineSoon()) }))
                .then(file => {
                    m.file = file.id;
                    progress.delete(id);
                    drawTimeline();
                    changed();
                })
                .catch(err => {
                    progress.delete(id);
                    drawTimeline();
                    toast(`${f.name} wasn’t saved to Files: ${err.message}`, { bad: true });
                });
        }
        changed();
    }
    const drawTimelineSoon = debounce(() => doc && drawTimeline(), 300);
    // zoom so the whole project fits, when it doesn't
    function fitTimeline(always) {
        relayout();
        const w = $('#tlscroll').clientWidth - 120;
        if (always || total * pps > w || total * pps < w / 3) pps = clamp(w / Math.max(1, total), 8, 200);
        if ($('#zoom')) $('#zoom').value = pps;
        drawTimeline();
    }
    async function fromFiles() {
        const r = await call('/api/files');
        const items = r.items.filter(f => f.kind === 'file' && /^(video|image|audio)\//.test(f.type)).sort((a, b) => (b.taken || b.createdAt) - (a.taken || a.createdAt)).slice(0, 200);
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        back.innerHTML = `<div class="pf-crop ve-pick" role="dialog" aria-modal="true"><h2>Add from Files</h2><div class="ve-pgrid">${items.map(f => `<label class="ve-pitem"><input type="checkbox" value="${esc(f.id)}"><span class="ve-pth">${f.type.startsWith('audio/') ? ic('bell') : f.thumb ? `<img alt="" loading="lazy" src="/api/files/${encodeURIComponent(f.id)}/thumb">` : f.type.startsWith('image/') ? `<img alt="" loading="lazy" src="/api/files/${encodeURIComponent(f.id)}/content?inline=1">` : ic('play')}</span><small>${esc(f.name)}</small></label>`).join('') || '<p class="ad-muted">No videos, photos or music in Files yet.</p>'}</div><div class="pf-crop-acts"><button class="btn" data-x>Cancel</button><button class="btn btn-primary" data-ok>Add</button></div></div>`;
        document.body.append(back);
        const done = () => back.remove();
        $('[data-x]', back).onclick = done;
        back.addEventListener('click', e => e.target === back && done());
        $('[data-ok]', back).onclick = async () => {
            const ids = $$('input:checked', back).map(x => x.value);
            done();
            for (const fid of ids) {
                const f = items.find(x => x.id === fid);
                const kind = f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : 'video';
                const meta = await probe(`/api/files/${encodeURIComponent(fid)}/content?inline=1`, kind);
                if (!meta) {
                    toast(`${f.name} can’t be played in this browser`, { bad: true });
                    continue;
                }
                remember();
                const m = { id: uid(), file: fid, name: f.name, kind, dur: Math.round(meta.dur * 1000) / 1000, w: meta.w, h: meta.h };
                P.media.push(m);
                if (kind === 'audio') P.audio.push({ id: uid(), m: m.id, start: 0, in: 0, out: Math.min(m.dur, total > 1 ? total : m.dur), vol: 100, fadeIn: 0, fadeOut: 1.5 });
                else P.clips.push(newClip(m));
                if (kind === 'video') makeThumbs(m);
            }
            fitTimeline(true);
            inspector();
            sizeStage();
            changed();
        };
    }
    // the little pictures of a video, taken one after another from a hidden copy
    const thumbQueue = [];
    let thumbing = false;
    function makeThumbs(m) {
        if (thumbs.has(m.id) || !srcOf(m)) return;
        thumbs.set(m.id, []);
        thumbQueue.push(m);
        if (!thumbing) nextThumbs();
    }
    async function nextThumbs() {
        const m = thumbQueue.shift();
        if (!m) return void (thumbing = false);
        thumbing = true;
        const v = document.createElement('video');
        v.muted = true;
        v.preload = 'auto';
        v.src = srcOf(m);
        await new Promise(r => ((v.onloadeddata = r), (v.onerror = r)));
        const n = clamp(Math.ceil(m.dur / 2), 2, 40);
        const cv = document.createElement('canvas');
        cv.height = 64;
        cv.width = Math.round(64 * ((v.videoWidth || 16) / (v.videoHeight || 9)));
        const list2 = thumbs.get(m.id);
        for (let i = 0; i < n && v.videoWidth; i++) {
            const t = ((i + 0.5) * m.dur) / n;
            await new Promise(r => {
                v.onseeked = r;
                v.currentTime = t;
                setTimeout(r, 1500);
            });
            cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
            list2.push({ t, url: cv.toDataURL('image/jpeg', 0.6) });
            if (i % 4 === 3) drawTimelineSoon();
        }
        v.removeAttribute('src');
        v.load();
        if (doc) drawTimeline();
        nextThumbs();
    }

    /* ---------- export: the timeline played into a video file ---------- */
    const MIMES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    function exportDialog() {
        if (!P.clips.length) return toast('Add some clips first');
        if (!window.MediaRecorder) return toast('This browser can’t make video files. Try Chrome, Edge, Safari or Firefox.', { bad: true });
        const mime = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || '';
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        back.innerHTML = `<div class="pf-crop ve-exp" role="dialog" aria-modal="true"><h2>Export video</h2>
            <p class="ad-muted">${fmt(total).replace(/\.\d$/, '')} · ${esc(P.aspect)} · ${mime.includes('mp4') ? 'MP4' : 'WebM'}</p>
            <div class="pe-chips"><button class="pe-chip on" data-res="1080">1080p (best)</button><button class="pe-chip" data-res="720">720p (smaller, faster on older devices)</button></div>
            <p class="ad-muted">The video is played once while it’s recorded, so exporting takes as long as the video. Keep this tab in front until it’s done.</p>
            <div class="pf-crop-acts"><button class="btn" data-x>Cancel</button><button class="btn btn-primary" data-go>${ic('download')}<span>Export</span></button></div></div>`;
        document.body.append(back);
        let res = 1080;
        $$('[data-res]', back).forEach(b => (b.onclick = () => ((res = +b.dataset.res), $$('[data-res]', back).forEach(x => x.classList.toggle('on', x === b)))));
        $('[data-x]', back).onclick = () => back.remove();
        $('[data-go]', back).onclick = () => (back.remove(), runExport(res, mime));
    }
    async function runExport(res, mime) {
        pause();
        audioReady();
        const [w, h] = outSize(res);
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const back = document.createElement('div');
        back.className = 'pf-crop-back ve-expback';
        back.innerHTML = `<div class="pf-crop ve-exp"><h2>Exporting…</h2><div class="ve-expview"></div><div class="ve-bar2"><i id="expbar"></i></div><p class="ad-muted" id="expnote">0%</p><div class="pf-crop-acts"><button class="btn" data-x>Stop</button></div></div>`;
        $('.ve-expview', back).append(cv);
        document.body.append(back);
        target(cv);
        const dest = ac.createMediaStreamDestination();
        master.connect(dest);
        const vtrack = cv.captureStream(0).getVideoTracks()[0];
        const stream = new MediaStream([vtrack, ...dest.stream.getAudioTracks()]);
        const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: res >= 1080 ? 10e6 : 5e6, audioBitsPerSecond: 192000 });
        const chunks = [];
        rec.ondataavailable = e => e.data.size && chunks.push(e.data);
        let lastFrame = 0;
        exporting = {
            rec,
            back,
            flush: () => vtrack.requestFrame && vtrack.requestFrame(),
            hold(wait) {
                if (wait && rec.state === 'recording') rec.pause();
                else if (!wait && rec.state === 'paused') rec.resume();
            },
            tick() {
                if (rec.state !== 'recording') return;
                // a frame for the file, at most 30 a second
                const now = performance.now();
                if (now - lastFrame >= 1000 / 31) {
                    lastFrame = now;
                    vtrack.requestFrame && vtrack.requestFrame();
                }
                const k = total ? T / total : 1;
                $('#expbar').style.width = `${k * 100}%`;
                $('#expnote').textContent = `${Math.round(k * 100)}%`;
            }
        };
        const stopped = new Promise(r => (rec.onstop = r));
        $('[data-x]', back).onclick = () => {
            exporting.cancelled = true;
            finishExport();
        };
        // start from the beginning, with the first clip ready
        T = 0;
        sync(0, false);
        const first = P.clips[0] && sourceOf(P.clips[0]);
        if (first && first.readyState < 2) await new Promise(r => ((first.onloadeddata = r), setTimeout(r, 4000)));
        frame();
        rec.start(1000);
        vtrack.requestFrame && vtrack.requestFrame();
        exporting.stopped = stopped;
        playing = true;
        last = performance.now();
        sync(0, true);
        raf = requestAnimationFrame(tick);
        await stopped;
        master.disconnect(dest);
        const cancelled = exporting.cancelled;
        exporting = null;
        back.remove();
        target($('#out'));
        sizeStage();
        if (cancelled) return toast('Export stopped');
        const type = rec.mimeType || mime || 'video/webm';
        const blob = new Blob(chunks, { type });
        exportDone(blob, type.includes('mp4') ? 'mp4' : 'webm');
    }
    function finishExport() {
        playing = false;
        cancelAnimationFrame(raf);
        for (const e of els.values()) e.pause();
        if (exporting && exporting.rec.state !== 'inactive') {
            // the last frame, then a moment for the encoder before the file is closed
            if (exporting.flush) exporting.flush();
            setTimeout(() => exporting && exporting.rec.state !== 'inactive' && exporting.rec.stop(), 150);
        }
    }
    function exportDone(blob, ext) {
        const name = `${(doc.title || 'Video').replace(/[\\/:*?"<>|]+/g, '-')}.${ext}`;
        const url = URL.createObjectURL(blob);
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        back.innerHTML = `<div class="pf-crop ve-exp"><h2>Your video is ready</h2><video class="ve-result" src="${url}" controls playsinline></video><p class="ad-muted">${esc(name)} · ${(blob.size / 1048576).toFixed(1)} MB</p><div class="pf-crop-acts"><button class="btn" data-x>Close</button><button class="btn" data-files>${ic('folder')}<span>Save to Files</span></button><a class="btn btn-primary" href="${url}" download="${esc(name)}">${ic('download')}<span>Download</span></a></div></div>`;
        document.body.append(back);
        $('[data-x]', back).onclick = () => back.remove();
        $('[data-files]', back).onclick = async e => {
            const b = e.currentTarget;
            b.disabled = true;
            try {
                await upload(new File([blob], name, { type: blob.type }), { folder: await folder() });
                toast('Saved in Files → Video Editor');
            } catch (err) {
                toast(err.message, { bad: true });
                b.disabled = false;
            }
        };
    }

    /* ---------- Auto edit: the AI (Claude, or the service chosen in Admin → AI) makes the edit (admins) ---------- */
    function autoDialog() {
        const visual = P.media.filter(m => m.kind !== 'audio' && srcOf(m));
        const songs = P.media.filter(m => m.kind === 'audio' && srcOf(m));
        if (!visual.length) return toast(`Import your clips first, then let ${aiName} edit them`);
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        back.innerHTML = `<div class="pf-crop ve-auto" role="dialog" aria-modal="true"><h2>${ic('zap')} Auto edit</h2>
            <p class="ad-muted">${esc(aiName)} watches your clips, picks the best moments and builds the edit: cuts, order, speed, looks, effects, transitions, titles and music. You can change everything afterwards, and Undo takes it all back.</p>
            <textarea class="input pe-ta" id="brief" rows="3" placeholder="What should it be? e.g. “a fast, upbeat 30-second recap of our holiday for Instagram, with a title”"></textarea>
            <div class="pe-chips">${['Travel recap', 'Birthday', 'Highlight reel', 'Calm vlog', 'Funny moments', 'Product video'].map(x => `<button class="pe-chip" data-idea="${x}">${x}</button>`).join('')}</div>
            <div class="ve-arow"><label>Length <select class="input" id="alen"><option value="0">${esc(aiName)} decides</option><option value="15">15 s</option><option value="30" selected>30 s</option><option value="60">1 min</option><option value="90">1.5 min</option><option value="180">3 min</option></select></label>
            <label>Shape <select class="input" id="aasp">${Object.keys(ASPECTS).map(k => `<option${P.aspect === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
            <label class="ve-check"><input type="checkbox" id="acap" checked> Titles &amp; captions</label></div>
            <p class="ve-label">Clips to use (${visual.length})</p><div class="ve-amedia">${visual.map(m => `<label><input type="checkbox" value="${m.id}" checked><span>${esc(m.name)}</span></label>`).join('')}</div>
            ${songs.length ? `<p class="ve-label">Music</p><div class="ve-amedia">${songs.map(m => `<label><input type="checkbox" data-song value="${m.id}" checked><span>${esc(m.name)}</span></label>`).join('')}</div>` : `<p class="ad-muted">Tip: import a song first and ${esc(aiName)} cuts to its beat.</p>`}
            <p class="ve-astatus" id="astatus" hidden></p>
            <div class="pf-crop-acts"><button class="btn" data-x>Cancel</button><button class="btn btn-primary" data-go>${ic('zap')}<span>Edit with ${esc(aiName)}</span></button></div></div>`;
        document.body.append(back);
        $$('[data-idea]', back).forEach(b => (b.onclick = () => ($('#brief', back).value = `${b.dataset.idea}: ${$('#brief', back).value}`.replace(/: $/, ''))));
        $('[data-x]', back).onclick = () => back.remove();
        $('[data-go]', back).onclick = async e => {
            const btn = e.currentTarget;
            const st = $('#astatus', back);
            const ids = $$('.ve-amedia input:not([data-song]):checked', back).map(x => x.value);
            const songIds = $$('[data-song]:checked', back).map(x => x.value);
            if (!ids.length) return toast('Pick at least one clip');
            btn.disabled = true;
            st.hidden = false;
            try {
                const media = [];
                let i = 0;
                for (const id of ids) {
                    const m = mediaOf(id);
                    st.textContent = `Looking at ${m.name} (${++i} of ${ids.length})…`;
                    media.push(await analyse(m));
                }
                const music = [];
                for (const id of songIds) {
                    const m = mediaOf(id);
                    st.textContent = `Listening to ${m.name} for the beat…`;
                    music.push(await beats(m));
                }
                st.textContent = `${aiName} is editing your video… this can take a minute or two.`;
                const r = await call('/api/ai/video', { method: 'POST', body: { brief: $('#brief', back).value, length: +$('#alen', back).value, aspect: $('#aasp', back).value, captions: $('#acap', back).checked, media, music } });
                applyPlan(r.plan);
                back.remove();
                summary(r.plan, r.model);
            } catch (err) {
                st.textContent = err.message;
                btn.disabled = false;
            }
        };
    }
    // frames and loudness of one clip, for the AI to look at
    async function analyse(m) {
        const out2 = { id: m.id, name: m.name, kind: m.kind, dur: m.dur, w: m.w, h: m.h, frames: [], loud: [] };
        const cv = document.createElement('canvas');
        const k = Math.min(1, 512 / Math.max(m.w || 512, m.h || 512));
        cv.width = Math.max(16, Math.round((m.w || 512) * k));
        cv.height = Math.max(16, Math.round((m.h || 288) * k));
        const g = cv.getContext('2d');
        if (m.kind === 'image') {
            const im = imageOf(m);
            if (!im.complete) await new Promise(r => ((im.onload = r), (im.onerror = r)));
            g.drawImage(im, 0, 0, cv.width, cv.height);
            out2.frames.push({ t: 0, data: cv.toDataURL('image/jpeg', 0.72) });
            return out2;
        }
        const v = document.createElement('video');
        v.muted = true;
        v.preload = 'auto';
        v.src = srcOf(m);
        await new Promise(r => ((v.onloadeddata = r), (v.onerror = r), setTimeout(r, 8000)));
        const n = clamp(Math.round(m.dur / 2.5), 3, 12);
        for (let i = 0; i < n; i++) {
            const t = ((i + 0.5) * m.dur) / n;
            await new Promise(r => ((v.onseeked = r), (v.currentTime = t), setTimeout(r, 3000)));
            g.drawImage(v, 0, 0, cv.width, cv.height);
            out2.frames.push({ t: Math.round(t * 10) / 10, data: cv.toDataURL('image/jpeg', 0.72) });
        }
        v.removeAttribute('src');
        v.load();
        // how loud each second is (speech, laughter, cheering), for files up to 150 MB
        try {
            const buf = await (await fetch(srcOf(m))).arrayBuffer();
            if (buf.byteLength < 150 * 1048576) {
                audioReady();
                const a = await ac.decodeAudioData(buf);
                const ch = a.getChannelData(0);
                const per = a.sampleRate;
                let peak = 1e-6;
                const rms = [];
                for (let s = 0; s < ch.length; s += per) {
                    let sum = 0;
                    const end = Math.min(ch.length, s + per);
                    for (let j = s; j < end; j += 4) sum += ch[j] * ch[j];
                    const r2 = Math.sqrt(sum / Math.max(1, (end - s) / 4));
                    rms.push(r2);
                    peak = Math.max(peak, r2);
                }
                out2.loud = rms.map(x => Math.round((x / peak) * 9));
            }
        } catch {
            // no sound track
        }
        return out2;
    }
    // the beat of a song: onsets in its loudness, and the tempo from how they repeat
    async function beats(m) {
        const buf = await (await fetch(srcOf(m))).arrayBuffer();
        audioReady();
        const a = await ac.decodeAudioData(buf);
        const ch = a.getChannelData(0);
        const hop = 512;
        const env = [];
        for (let s = 0; s + hop < ch.length; s += hop) {
            let e = 0;
            for (let j = s; j < s + hop; j++) e += ch[j] * ch[j];
            env.push(e);
        }
        const flux = env.map((e, i) => Math.max(0, e - (env[i - 1] || 0)));
        const rate = a.sampleRate / hop;
        // tempo between 70 and 180 BPM by autocorrelation
        let best = 0;
        let bestLag = 0;
        for (let bpm = 70; bpm <= 180; bpm++) {
            const lag = Math.round((60 / bpm) * rate);
            let s = 0;
            for (let i = lag; i < flux.length; i++) s += flux[i] * flux[i - lag];
            if (s > best) (best = s), (bestLag = lag);
        }
        const bpm = bestLag ? (60 * rate) / bestLag : 0;
        const peaks = [];
        const win = Math.round(rate * 0.15);
        for (let i = 1; i < flux.length - 1; i++) {
            let avg = 0;
            for (let j = Math.max(0, i - win * 3); j < Math.min(flux.length, i + win * 3); j++) avg += flux[j];
            avg /= Math.min(flux.length, i + win * 3) - Math.max(0, i - win * 3);
            if (flux[i] > avg * 1.6 && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1] && (!peaks.length || i / rate - peaks[peaks.length - 1] > 0.2)) peaks.push(Math.round((i / rate) * 100) / 100);
        }
        return { id: m.id, name: m.name, dur: a.duration, bpm: Math.round(bpm), beats: peaks.slice(0, 400) };
    }
    function applyPlan(plan) {
        remember();
        P.aspect = plan.aspect;
        P.clips = plan.clips.map(c => {
            const m = mediaOf(c.media);
            return { ...newClip(m), in: c.in, out: c.out, speed: c.speed, filter: c.filter, effect: c.effect, vol: plan.clipVolume, tr: { type: c.transition, dur: 0.5 } };
        });
        const y = { top: 0.14, center: 0.5, bottom: 0.84 };
        P.texts = plan.texts.map(t => ({ id: uid(), text: t.text, start: t.start, dur: t.duration, x: 0.5, y: y[t.position], size: t.style === 'title' ? 8 : 5.5, color: '#ffffff', font: 'Geist', style: t.style, anim: t.animation }));
        relayout();
        if (plan.music) {
            const m = mediaOf(plan.music.media);
            P.audio = m ? [{ id: uid(), m: m.id, start: 0, in: plan.music.offset, out: Math.min(m.dur, plan.music.offset + total), vol: plan.music.volume, fadeIn: 0.3, fadeOut: 1.5 }] : P.audio;
        }
        if (plan.title && (!doc.title || /^untitled/i.test(doc.title))) {
            doc.title = plan.title;
            $('#name').value = plan.title;
        }
        T = 0;
        sel = null;
        fitTimeline(true);
        inspector();
        sizeStage();
        changed();
    }
    function summary(plan, model) {
        const back = document.createElement('div');
        back.className = 'pf-crop-back';
        back.innerHTML = `<div class="pf-crop ve-auto"><h2>${ic('zap')} ${esc(plan.title || 'Your edit')}</h2><p>${esc(plan.summary || 'Done.')}</p><p class="ad-muted">${plan.clips.length} cuts · ${fmt(total).replace(/\.\d$/, '')} · edited by ${esc(model || aiName)}</p><div class="pf-crop-acts"><button class="btn" data-undo>Undo it</button><button class="btn btn-primary" data-play>${ic('play')}<span>Watch it</span></button></div></div>`;
        document.body.append(back);
        $('[data-undo]', back).onclick = () => (back.remove(), step(undo, redo));
        $('[data-play]', back).onclick = () => (back.remove(), seek(0), play());
    }

    /* ---------- undo, keys, saving ---------- */
    function remember() {
        undo.push(JSON.stringify(P, (k, v) => (k === '_box' ? undefined : v)));
        if (undo.length > 100) undo.shift();
        redo = [];
        syncUndo();
    }
    function syncUndo() {
        const u = $('#bar [data-undo]');
        const r = $('#bar [data-redo]');
        if (u) u.disabled = !undo.length;
        if (r) r.disabled = !redo.length;
    }
    function step(from, to) {
        if (!from.length) return;
        to.push(JSON.stringify(P, (k, v) => (k === '_box' ? undefined : v)));
        P = doc.body = JSON.parse(from.pop());
        if (sel && !selected()) sel = null;
        syncUndo();
        drawTimeline();
        inspector();
        sizeStage();
        changed();
    }
    addEventListener('keydown', e => {
        if (!doc || !$('#out') || exporting || $('.pf-crop-back')) return;
        // undo and redo work everywhere, also right after moving a slider (not while typing in a box)
        const u = undoKey(e);
        if (u && doc.canEdit && !textBox(e)) return (e.preventDefault(), u === 'undo' ? step(undo, redo) : step(redo, undo));
        if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
        const k = e.key.toLowerCase();
        const mod = e.ctrlKey || e.metaKey;
        if (k === ' ') return (e.preventDefault(), playing ? pause() : play());
        if (k === 'arrowleft' || k === 'arrowright') return (e.preventDefault(), pause(), seek(T + (k === 'arrowright' ? 1 : -1) * (e.shiftKey ? 1 : 1 / 30)));
        if (k === 'home') return seek(0);
        if (k === 'end') return seek(total);
        if (!doc.canEdit) return;
        if (mod && k === 'd') return (e.preventDefault(), duplicate());
        if (k === 's' && !mod) return split();
        if (k === 'f' && !mod) return freezeFrame();
        if (k === 't' && !mod) return addText();
        if (k === 'delete' || k === 'backspace') return (e.preventDefault(), removeSel());
        if (k === 'escape') {
            sel = null;
            drawTimeline();
            inspector();
        }
    });
    function changed() {
        if (!doc || !doc.canEdit) return;
        dirty = true;
        $('#saved') && ($('#saved').textContent = 'Saving…');
        save();
    }
    async function saveNow() {
        if (!doc || !dirty) return;
        dirty = false;
        const d = doc;
        try {
            const r = await call(`/api/docs/${d.id}`, { method: 'PUT', body: { title: (d.title || '').trim(), body: JSON.parse(JSON.stringify(d.body, (k, v) => (k === '_box' ? undefined : v))), version: d.version } });
            d.version = r.version;
            if ($('#saved') && doc === d) $('#saved').textContent = 'Saved';
        } catch (e) {
            dirty = true;
            if ($('#saved')) $('#saved').textContent = 'Not saved';
            toast(e.message, { bad: true });
        }
    }
    const save = debounce(saveNow, 900);
    addEventListener('beforeunload', e => {
        if (dirty) saveNow();
        if (progress.size || exporting) e.preventDefault();
    });

    Promise.all([call('/api/docs?kind=video'), call('/api/ai/status').catch(() => ({ on: false }))])
        .then(([r, s]) => {
            list = r;
            aiOn = !!s.on;
            aiName = s.name || 'AI';
            const want = location.hash.slice(1);
            // from Photos or Files: /videoedit/#file=<id> starts a project with it
            const f = /^file=([A-Za-z0-9_-]+)$/.exec(want);
            if (f) {
                return call('/api/files').then(async fr => {
                    const item = fr.items.find(x => x.id === f[1]);
                    if (!item) return gallery();
                    const meta = await probe(`/api/files/${encodeURIComponent(item.id)}/content?inline=1`, item.type.startsWith('image/') ? 'image' : 'video');
                    const aspect = meta && meta.h > meta.w ? '9:16' : '16:9';
                    const d = await call('/api/docs', { method: 'POST', body: { kind: 'video', title: '', body: { aspect, bg: 'blur' } } });
                    list.unshift(d);
                    await openProject(d.id, () => {
                        const m = { id: uid(), file: item.id, name: item.name, kind: item.type.startsWith('image/') ? 'image' : 'video', dur: meta ? meta.dur : 5, w: meta ? meta.w : 0, h: meta ? meta.h : 0 };
                        P.media.push(m);
                        P.clips.push(newClip(m));
                        fitTimeline(true);
                        inspector();
                        sizeStage();
                        if (m.kind === 'video') makeThumbs(m);
                        changed();
                    });
                });
            }
            if (want && list.some(d => d.id === want)) openProject(want);
            else gallery();
        })
        .catch(e => (root.innerHTML = `<div class="pf-empty"><h1>Couldn’t load your projects</h1><p>${esc(e.message)}</p></div>`));
})();
