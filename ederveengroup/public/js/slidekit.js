// What a slide looks like: themes, layouts and shapes. Shared by the Slides app and the
// server's PowerPoint and PDF exports, so what you see is what you download.
// Positions are in % of the slide (x and w of its width, y and h of its height);
// text sizes are in points on a 13.33 × 7.5 inch slide, like PowerPoint's 16:9.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SlideKit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const W = 13.333;
    const H = 7.5;
    const PT = 100 / (W * 72); // one point in % of the slide's width

    const SERIF = { css: "'Instrument Serif', Georgia, 'Times New Roman', serif", office: 'Georgia', lh: 1.08 };
    const SANS = { css: "Geist, Calibri, Carlito, 'Segoe UI', system-ui, sans-serif", office: 'Calibri', lh: 1.2 };
    const LIGHT = { css: "'Calibri Light', Carlito, Calibri, 'Segoe UI', system-ui, sans-serif", office: 'Calibri Light', lh: 1.08 };
    const BODY = { css: "Calibri, Carlito, 'Segoe UI', system-ui, sans-serif", office: 'Calibri', lh: 1.2 };
    const solid = color => ({ kind: 'solid', color });
    const linear = (angle, stops) => ({ kind: 'linear', angle, stops });
    const THEMES = {
        office: { name: 'Office', bg: solid('#ffffff'), ink: '#262626', soft: '#595959', accent: '#156082', head: LIGHT, body: BODY },
        midnight: { name: 'Midnight', bg: { kind: 'radial', cx: 15, cy: 0, rx: 120, ry: 90, stops: [[0, '#233a8a'], [55, '#0b1024'], [100, '#05070d']] }, ink: '#f2f5ff', soft: '#a9b5d6', accent: '#7aa7ff', head: SERIF, body: SANS },
        paper: { name: 'Paper', bg: solid('#fbfaf6'), ink: '#1d1d1f', soft: '#5c5c66', accent: '#c2410c', head: SERIF, body: SANS },
        slate: { name: 'Slate', bg: solid('#23272f'), ink: '#f3f4f6', soft: '#aab0bc', accent: '#f59e0b', head: LIGHT, body: BODY },
        mint: { name: 'Mint', bg: linear(180, [[0, '#f4fbf7'], [100, '#d9f0e4']]), ink: '#12372a', soft: '#3f6a5a', accent: '#0f9d6e', head: SERIF, body: SANS },
        sunset: { name: 'Sunset', bg: linear(135, [[0, '#ff7a59'], [45, '#ff4f81'], [100, '#7a3cff']]), ink: '#ffffff', soft: '#fde7ef', accent: '#fff3b0', head: SERIF, body: SANS },
        ocean: { name: 'Ocean', bg: linear(160, [[0, '#0ea5e9'], [60, '#0e7490'], [100, '#164e63']]), ink: '#ffffff', soft: '#cdeefb', accent: '#fde68a', head: SERIF, body: SANS },
        forest: { name: 'Forest', bg: linear(160, [[0, '#1f5135'], [100, '#10261a']]), ink: '#f1f7ee', soft: '#b9d2b8', accent: '#f4c95d', head: SERIF, body: SANS }
    };
    const theme = name => THEMES[name] || THEMES.office;
    function cssBg(spec) {
        const stops = () => spec.stops.map(([at, c]) => `${c} ${at}%`).join(', ');
        if (spec.kind === 'linear') return `linear-gradient(${spec.angle}deg, ${stops()})`;
        if (spec.kind === 'radial') return `radial-gradient(${spec.rx}% ${spec.ry}% at ${spec.cx}% ${spec.cy}%, ${stops()})`;
        return spec.color;
    }

    // the placeholders of each layout; f is the slide field the text lives in
    const TITLE = { f: 'title', x: 6.75, y: 5.5, w: 86.5, h: 17.5, v: 'middle', size: 40, role: 'head', ph: 'Click to add title' };
    const CONTENT = { f: 'body', x: 6.75, y: 26.5, w: 86.5, h: 65, v: 'top', size: 24, role: 'body', bullets: true, ph: 'Click to add text' };
    const LAYOUTS = {
        title: { name: 'Title Slide', boxes: [{ f: 'title', x: 6.75, y: 20, w: 86.5, h: 33, v: 'bottom', size: 54, role: 'head', ph: 'Click to add title' }, { f: 'body', x: 6.75, y: 56, w: 86.5, h: 18, v: 'top', size: 24, role: 'body', tone: 'soft', ph: 'Click to add subtitle' }] },
        bullets: { name: 'Title and Content', boxes: [TITLE, CONTENT] },
        section: { name: 'Section Header', boxes: [{ f: 'title', x: 6.75, y: 28, w: 86.5, h: 28, v: 'bottom', size: 48, role: 'head', ph: 'Click to add title' }, { kind: 'bar', x: 6.75, y: 58.5, w: 8, h: 1 }, { f: 'body', x: 6.75, y: 62, w: 86.5, h: 16, v: 'top', size: 20, role: 'body', tone: 'soft', ph: 'Click to add text' }] },
        columns: { name: 'Two Content', boxes: [TITLE, { ...CONTENT, w: 41.75 }, { ...CONTENT, f: 'body2', x: 51.5, w: 41.75 }] },
        titleonly: { name: 'Title Only', boxes: [TITLE] },
        statement: { name: 'Big Statement', boxes: [{ f: 'title', x: 6.75, y: 10, w: 86.5, h: 80, v: 'middle', align: 'center', size: 48, role: 'head', ph: 'Click to add a statement' }] },
        image: { name: 'Picture with Caption', boxes: [{ kind: 'picture', x: 0, y: 0, w: 100, h: 100 }, { kind: 'shade', x: 0, y: 55, w: 100, h: 45 }, { f: 'title', x: 6.75, y: 74, w: 86.5, h: 19, v: 'bottom', size: 24, role: 'body', color: '#ffffff', ph: 'Click to add a caption' }] },
        blank: { name: 'Blank', boxes: [] }
    };
    // the boxes of one slide: Title and Content makes room for a picture when it has one
    function boxes(s) {
        const L = LAYOUTS[s.layout] || LAYOUTS.bullets;
        if (s.layout === 'bullets' && s.image) return [TITLE, { ...CONTENT, w: 49 }, { kind: 'picture', x: 59.5, y: 26.5, w: 33.75, h: 65, round: true }];
        return L.boxes;
    }

    const FONTS = ['Calibri', 'Calibri Light', 'Aptos', 'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Trebuchet MS', 'Garamond', 'Segoe UI', 'Courier New', 'Comic Sans MS'];
    const fontCss = f => `'${f}', ${/Calibri/.test(f) ? 'Carlito, ' : ''}${/Georgia|Times|Garamond/.test(f) ? 'serif' : /Courier/.test(f) ? 'monospace' : "'Segoe UI', system-ui, sans-serif"}`;
    // shapes: how PowerPoint calls them, and their outline on a 100 × 100 grid
    const star = [];
    for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 19.1 : 50;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        star.push([+(50 + r * Math.cos(a)).toFixed(2), +(52.5 + r * Math.sin(a) * 1.05).toFixed(2)]);
    }
    const SHAPES = {
        rect: { name: 'Rectangle', office: 'rect' },
        round: { name: 'Rounded rectangle', office: 'roundRect' },
        ellipse: { name: 'Oval', office: 'ellipse' },
        triangle: { name: 'Triangle', office: 'triangle', poly: [[50, 0], [100, 100], [0, 100]] },
        arrow: { name: 'Arrow', office: 'rightArrow', poly: [[0, 25], [60, 25], [60, 0], [100, 50], [60, 100], [60, 75], [0, 75]] },
        star: { name: 'Star', office: 'star5', poly: star }
    };
    const TRANSITIONS = { none: 'None', fade: 'Fade', push: 'Push', wipe: 'Wipe', zoom: 'Zoom' };

    // the look of a text box: its own settings over the layout's and the theme's
    function look(box, fmt, th) {
        const role = box.role === 'head' ? th.head : th.body;
        const f = fmt || {};
        return {
            font: f.font || role.office,
            css: f.font ? fontCss(f.font) : role.css,
            lh: f.font ? (box.role === 'head' ? 1.08 : 1.2) : role.lh,
            size: f.size || box.size || 18,
            b: !!f.b,
            i: !!f.i,
            u: !!f.u,
            color: f.color || box.color || (box.tone === 'soft' ? th.soft : th.ink),
            align: f.align || box.align || 'left',
            v: box.v || 'top',
            bullets: box.bullets && !f.nob
        };
    }
    // how light a colour is (0 dark … 1 light), to pick readable text on a shape
    const light = c => {
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(c || ''));
        return m ? (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255 : 0.5;
    };
    // the look of a text box, shape or picture put on a slide
    function objLook(o, th) {
        const shape = o.t !== 'text' && o.t !== 'img';
        const fill = o.fill === 'none' ? '' : o.fill || (shape ? th.accent : '');
        return {
            ...look({ size: 18, role: 'body', v: o.v || (shape ? 'middle' : 'top'), align: shape ? 'center' : 'left', color: shape ? (light(fill || th.accent) > 0.62 ? '#1f1f1f' : '#ffffff') : null }, o, th),
            fill,
            line: o.line === 'none' ? '' : o.line || ''
        };
    }
    // deeper bullet levels are a little smaller, as in PowerPoint
    const LV = [1, 0.9, 0.82, 0.8, 0.8];
    // body text: one paragraph per line, tabs in front for deeper levels
    const paras = t =>
        String(t || '')
            .split('\n')
            .map(l => {
                const m = /^\t*/.exec(l);
                return { lv: Math.min(4, m[0].length), text: l.slice(m[0].length) };
            });

    return { W, H, PT, LV, THEMES, theme, cssBg, LAYOUTS, boxes, FONTS, fontCss, SHAPES, TRANSITIONS, look, objLook, light, paras };
});
