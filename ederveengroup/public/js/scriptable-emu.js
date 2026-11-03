// A small Scriptable look-alike for the Widgets page: it runs the real widget scripts (from
// /api/widget/previews.js) and draws what they build with HTML, the way iOS would show the widget.
// Only for previews; the real thing runs in Scriptable on the iPhone.
(function () {
    const SIZES = { small: [170, 170], medium: [364, 170], large: [364, 382], extraLarge: [364, 382], accessoryCircular: [72, 72], accessoryRectangular: [172, 76], accessoryInline: [240, 22] };
    // SF Symbols the widgets use, drawn with the site's own icons (or a close emoji)
    const SYMBOLS = { 'envelope.fill': 'mail', checklist: 'check', 'checkmark.circle.fill': 'check', 'bubble.left.and.bubble.right.fill': 'reply', 'rectangle.split.3x1.fill': 'grid', 'megaphone.fill': 'bell', calendar: 'calendar', timer: 'clock', hourglass: 'clock', 'note.text': 'note', 'pin.fill': 'pin', 'photo.on.rectangle': 'image', 'photo.fill': 'image', 'doc.fill': 'file', 'video.fill': 'play', 'externaldrive.fill': 'folder', 'tray.full.fill': 'inbox', 'chart.pie.fill': 'chart', 'arrow.turn.down.right': 'right', star: 'star', 'exclamationmark.circle': 'alert', 'wifi.slash': 'alert' };
    const EMOJI = { 'sun.max.fill': '☀️', 'moon.stars.fill': '🌙', 'cloud.sun.fill': '⛅', 'cloud.moon.fill': '☁️', 'cloud.fill': '☁️', 'cloud.fog.fill': '🌫️', 'cloud.drizzle.fill': '🌦️', 'cloud.rain.fill': '🌧️', 'cloud.snow.fill': '🌨️', 'cloud.bolt.rain.fill': '⛈️', 'sunrise.fill': '🌅', 'sunset.fill': '🌇', sparkles: '✨', 'quote.opening': '“' };
    const WEATHER = () => {
        const days = [];
        const t = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
            days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        return { current: { temperature_2m: 11.4, apparent_temperature: 9.6, weather_code: 2, is_day: 1, wind_speed_10m: 14 }, daily: { time: days, weather_code: [2, 61, 3, 0, 80, 1, 95], temperature_2m_max: [12, 10, 11, 13, 9, 12, 8], temperature_2m_min: [6, 5, 4, 3, 2, 4, 1], precipitation_probability_max: [10, 80, 30, 0, 60, 10, 70] } };
    };
    const files = new Map();

    function makeGlobals(family, param, done) {
        const rgba = c => (c ? c.css : 'transparent');
        function Color(hex, alpha = 1) {
            const h = String(hex).replace('#', '');
            const n = parseInt(h, 16);
            this.hex = `#${h}`;
            this.alpha = alpha;
            this.css = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
        }
        Color.white = () => new Color('#ffffff');
        Color.black = () => new Color('#000000');
        Color.clear = () => new Color('#000000', 0);
        const font = (weight, rounded) => size => ({ size, weight, rounded });
        const Font = { systemFont: font(400), regularSystemFont: font(400), mediumSystemFont: font(500), semiboldSystemFont: font(600), boldSystemFont: font(700), heavySystemFont: font(800), blackSystemFont: font(900), lightSystemFont: font(300), boldRoundedSystemFont: font(700, true), heavyRoundedSystemFont: font(800, true), semiboldRoundedSystemFont: font(600, true) };
        function Size(w, h) {
            this.width = w;
            this.height = h;
        }
        function Point(x, y) {
            this.x = x;
            this.y = y;
        }
        function Rect(x, y, w, h) {
            Object.assign(this, { x, y, width: w, height: h });
        }
        function LinearGradient() {}
        const node = (type, extra) => ({ type, items: [], ...extra });
        const textNode = (n, value) => {
            n.text = String(value);
            return {
                set font(f) { n.font = f; },
                set textColor(c) { n.color = c; },
                set lineLimit(v) { n.lines = v; },
                set minimumScaleFactor(v) { n.scale = v; },
                set textOpacity(v) { n.opacity = v; },
                set shadowColor(c) { n.shadow = c; },
                set shadowRadius(v) { n.shadowRadius = v; },
                set shadowOffset(p) { n.shadowOffset = p; },
                set url(u) { n.url = u; },
                leftAlignText() { n.align = 'left'; },
                centerAlignText() { n.align = 'center'; },
                rightAlignText() { n.align = 'right'; },
                applyTimerStyle() { n.style = 'timer'; },
                applyRelativeStyle() { n.style = 'relative'; },
                applyTimeStyle() { n.style = 'time'; },
                applyDateStyle() { n.style = 'date'; },
                applyOffsetStyle() { n.style = 'offset'; }
            };
        };
        const container = n => ({
            addText(v) {
                const t = node('text');
                n.items.push(t);
                return textNode(t, v);
            },
            addDate(d) {
                const t = node('date', { date: d, style: 'date' });
                n.items.push(t);
                return textNode(t, '');
            },
            addImage(img) {
                const i = node('image', { img });
                n.items.push(i);
                return {
                    set imageSize(s) { i.size = s; },
                    set tintColor(c) { i.tint = c; },
                    set imageOpacity(v) { i.opacity = v; },
                    set cornerRadius(v) { i.radius = v; },
                    set resizable(v) { i.resizable = v; },
                    set url(u) { i.url = u; },
                    set containerRelativeShape(v) {},
                    set borderWidth(v) {},
                    set borderColor(v) {},
                    leftAlignImage() {},
                    centerAlignImage() {},
                    rightAlignImage() {},
                    applyFittingContentMode() {},
                    applyFillingContentMode() {}
                };
            },
            addSpacer(len) {
                n.items.push(node('spacer', { len }));
            },
            addStack() {
                const s = node('stack', { dir: 'h', align: 'center' });
                n.items.push(s);
                return stackApi(s);
            },
            setPadding(t, l, b, r) {
                n.padding = [t, l, b, r];
            },
            useDefaultPadding() {
                n.padding = null;
            }
        });
        const look = n => ({
            set backgroundColor(c) { n.bg = c; },
            set backgroundGradient(g) { n.gradient = g; },
            set backgroundImage(i) { n.bgImage = i; },
            set spacing(v) { n.spacing = v; },
            set url(u) { n.url = u; },
            set cornerRadius(v) { n.radius = v; },
            set size(s) { n.size = s; },
            set borderWidth(v) { n.borderWidth = v; },
            set borderColor(c) { n.borderColor = c; }
        });
        const stackApi = s => {
            const api = { ...container(s), layoutHorizontally() { s.dir = 'h'; s.align = 'center'; }, layoutVertically() { s.dir = 'v'; s.align = 'start'; }, topAlignContent() { s.align = 'start'; }, centerAlignContent() { s.align = 'center'; }, bottomAlignContent() { s.align = 'end'; } };
            Object.defineProperties(api, Object.getOwnPropertyDescriptors(look(s)));
            return api;
        };
        function ListWidget() {
            const w = node('widget', { padding: null });
            const api = { ...container(w), async presentSmall() {}, async presentMedium() {}, async presentLarge() {}, __node: w };
            Object.defineProperties(api, Object.getOwnPropertyDescriptors(look(w)));
            Object.defineProperty(api, 'addAccessoryWidgetBackground', { set(v) { w.accessoryBg = v; } });
            Object.defineProperty(api, 'refreshAfterDate', { set() {} });
            return api;
        }
        const SFSymbol = { named: name => ({ image: { sym: name }, applyFont() {} }) };
        function Path() {
            this.cmds = [];
            this.move = p => this.cmds.push(['M', p.x, p.y]);
            this.addLine = p => this.cmds.push(['L', p.x, p.y]);
            this.addRect = r => this.cmds.push(['R', r.x, r.y, r.width, r.height, 0]);
            this.addRoundedRect = (r, a) => this.cmds.push(['R', r.x, r.y, r.width, r.height, a]);
            this.addEllipse = r => this.cmds.push(['E', r.x, r.y, r.width, r.height]);
            this.closeSubpath = () => this.cmds.push(['Z']);
        }
        function DrawContext() {
            let cv = null;
            let g = null;
            let path = null;
            let fontSize = 12;
            let align = 'left';
            const ready = () => {
                if (cv) return;
                cv = document.createElement('canvas');
                const k = 2;
                cv.width = Math.max(1, Math.round(this.size.width * k));
                cv.height = Math.max(1, Math.round(this.size.height * k));
                g = cv.getContext('2d');
                g.scale(k, k);
                g.lineJoin = 'round';
            };
            this.size = new Size(100, 100);
            this.setFillColor = c => (ready(), (g.fillStyle = c.css));
            this.setStrokeColor = c => (ready(), (g.strokeStyle = c.css));
            this.setLineWidth = v => (ready(), (g.lineWidth = v));
            this.fillRect = r => (ready(), g.fillRect(r.x, r.y, r.width, r.height));
            this.fillEllipse = r => (ready(), g.beginPath(), g.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2), g.fill());
            this.strokeEllipse = r => (ready(), g.beginPath(), g.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2), g.stroke());
            this.addPath = p => (path = p);
            const trace = () => {
                g.beginPath();
                for (const c of path ? path.cmds : []) {
                    if (c[0] === 'M') g.moveTo(c[1], c[2]);
                    else if (c[0] === 'L') g.lineTo(c[1], c[2]);
                    else if (c[0] === 'R') g.roundRect ? g.roundRect(c[1], c[2], c[3], c[4], c[5]) : g.rect(c[1], c[2], c[3], c[4]);
                    else if (c[0] === 'E') g.ellipse(c[1] + c[3] / 2, c[2] + c[4] / 2, c[3] / 2, c[4] / 2, 0, 0, Math.PI * 2);
                    else g.closePath();
                }
            };
            this.strokePath = () => (ready(), trace(), g.stroke());
            this.fillPath = () => (ready(), trace(), g.fill());
            this.setFont = f => (ready(), (fontSize = f.size), (g.font = `${f.weight || 400} ${f.size}px -apple-system, system-ui, sans-serif`));
            this.setTextColor = c => (ready(), (g.fillStyle = c.css));
            this.setTextAlignedCenter = () => (align = 'center');
            this.setTextAlignedLeft = () => (align = 'left');
            this.setTextAlignedRight = () => (align = 'right');
            this.drawTextInRect = (t, r) => {
                ready();
                g.textAlign = align;
                g.textBaseline = 'top';
                g.fillText(t, align === 'center' ? r.x + r.width / 2 : align === 'right' ? r.x + r.width : r.x, r.y + Math.max(0, (r.height - fontSize) / 2));
            };
            this.drawText = (t, p) => (ready(), (g.textAlign = 'left'), (g.textBaseline = 'top'), g.fillText(t, p.x, p.y));
            this.getImage = () => (ready(), { src: cv.toDataURL() });
        }
        function DateFormatter() {
            this.locale = 'en_GB';
            this.dateFormat = 'd MMM yyyy';
            this.string = d => {
                const p = opts => new Intl.DateTimeFormat('en-GB', opts).format(d);
                return this.dateFormat.replace(/EEEEE|EEEE|EEE|MMMM|MMM|yyyy|dd|d|HH|mm/g, t => ({ EEEEE: p({ weekday: 'narrow' }), EEEE: p({ weekday: 'long' }), EEE: p({ weekday: 'short' }), MMMM: p({ month: 'long' }), MMM: p({ month: 'short' }), yyyy: String(d.getFullYear()), dd: String(d.getDate()).padStart(2, '0'), d: String(d.getDate()), HH: String(d.getHours()).padStart(2, '0'), mm: String(d.getMinutes()).padStart(2, '0') })[t]);
            };
        }
        function Request(url) {
            this.url = url;
            this.timeoutInterval = 30;
            this.response = null;
            this.loadJSON = async () => {
                if (/^https:\/\/api\.open-meteo\.com\//.test(this.url)) {
                    this.response = { statusCode: 200 };
                    return WEATHER();
                }
                const r = await fetch(this.url, { credentials: 'omit' });
                this.response = { statusCode: r.status };
                return r.json();
            };
            this.loadImage = async () => {
                const r = await fetch(this.url, { credentials: 'omit' });
                this.response = { statusCode: r.status };
                if (!r.ok) throw new Error('no image');
                return { src: URL.createObjectURL(await r.blob()) };
            };
        }
        const FileManager = { local: () => ({ cacheDirectory: () => 'cache', documentsDirectory: () => 'docs', joinPath: (a, b) => `${a}/${b}`, writeString: (p, s) => files.set(p, s), readString: p => files.get(p), fileExists: p => files.has(p) }) };
        const Location = { setAccuracyToThreeKilometers() {}, setAccuracyToKilometer() {}, async current() { return { latitude: 52.06, longitude: 5.62 }; }, async reverseGeocode() { return [{ locality: 'Ederveen' }]; } };
        function Alert() {
            this.addAction = () => {};
            this.addCancelAction = () => {};
            this.presentSheet = async () => -1;
        }
        return {
            ListWidget, Color, Font, Size, Point, Rect, LinearGradient, SFSymbol, DrawContext, Path, Image: { fromData: () => ({}) }, Request, FileManager, DateFormatter, Location, Alert,
            Script: { setWidget: w => done(w.__node), complete() {} },
            Device: { locale: () => 'en_GB' },
            config: { widgetFamily: family, runsInWidget: true },
            args: { widgetParameter: param || null },
            rgba
        };
    }

    /* ---------- drawing what the script built ---------- */
    const css = c => (c ? c.css : '');
    const grad = g => (g && g.colors ? `linear-gradient(${Math.round((Math.atan2((g.endPoint.y - g.startPoint.y), (g.endPoint.x - g.startPoint.x)) * 180) / Math.PI + 90)}deg, ${g.colors.map((c, i) => `${c.css} ${Math.round((g.locations ? g.locations[i] : i / (g.colors.length - 1)) * 100)}%`).join(', ')})` : '');
    const clock = n => {
        const pad = x => String(x).padStart(2, '0');
        const s = Math.abs(Math.round(n / 1000));
        const h = Math.floor(s / 3600);
        return `${h ? `${h}:` : ''}${h ? pad(Math.floor((s % 3600) / 60)) : Math.floor((s % 3600) / 60)}:${pad(s % 60)}`;
    };
    const relative = d => {
        const m = Math.round((d - Date.now()) / 60000);
        const a = Math.abs(m);
        const v = a < 60 ? `${a} min` : a < 1440 ? `${Math.round(a / 60)} hr` : `${Math.round(a / 1440)} days`;
        return m >= 0 ? `in ${v}` : `${v} ago`;
    };
    function dateText(n) {
        if (n.style === 'timer') return clock(n.date - Date.now());
        if (n.style === 'relative') return relative(n.date);
        if (n.style === 'time') return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(n.date);
        return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(n.date);
    }
    function draw(n, parentDir) {
        if (n.type === 'spacer') {
            const el = document.createElement('i');
            el.className = 'sw-spacer';
            el.style.flex = n.len == null ? '1 1 0' : `0 0 ${n.len}px`;
            return el;
        }
        if (n.type === 'text' || n.type === 'date') {
            const el = document.createElement('span');
            el.className = 'sw-text';
            const f = n.font || { size: 14, weight: 400 };
            el.style.fontSize = `${f.size}px`;
            el.style.fontWeight = f.weight;
            if (f.rounded) el.classList.add('round');
            if (n.color) el.style.color = css(n.color);
            if (n.opacity != null) el.style.opacity = n.opacity;
            if (n.shadow) el.style.textShadow = `${n.shadowOffset ? n.shadowOffset.x : 0}px ${n.shadowOffset ? n.shadowOffset.y : 0}px ${n.shadowRadius || 2}px ${css(n.shadow)}`;
            const lines = n.lines || 0;
            if (lines === 1) el.classList.add('one');
            else if (lines > 1) (el.classList.add('clamp'), (el.style.webkitLineClamp = lines));
            if (n.align) el.style.textAlign = n.align;
            if (n.type === 'date') {
                el.textContent = dateText(n);
                if (n.style === 'timer') el.dataset.timer = n.date.getTime();
            } else el.textContent = n.text;
            return el;
        }
        if (n.type === 'image') {
            const s = n.size || { width: 20, height: 20 };
            const box = document.createElement('span');
            box.className = 'sw-img';
            box.style.width = `${s.width}px`;
            box.style.height = `${s.height}px`;
            if (n.img && n.img.src) {
                const im = document.createElement('img');
                im.src = n.img.src;
                im.alt = '';
                box.append(im);
            } else if (n.img && n.img.sym) {
                if (SYMBOLS[n.img.sym] && window.icon) box.innerHTML = window.icon(SYMBOLS[n.img.sym]);
                else if (n.img.sym === 'circle') box.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>';
                else box.textContent = EMOJI[n.img.sym] || '•';
                box.style.fontSize = `${s.height * 0.9}px`;
            }
            if (n.tint) box.style.color = css(n.tint);
            if (n.opacity != null) box.style.opacity = n.opacity;
            return box;
        }
        // a stack (or the widget itself)
        const el = document.createElement('div');
        const dir = n.type === 'widget' ? 'v' : n.dir;
        el.className = n.type === 'widget' ? 'sw-body' : `sw-stack ${dir === 'v' ? 'v' : 'h'}`;
        if (n.type !== 'widget') {
            el.style.alignItems = { start: 'flex-start', center: 'center', end: 'flex-end' }[n.align || (dir === 'v' ? 'start' : 'center')];
            if (n.size && n.size.width) (el.style.width = `${n.size.width}px`), (el.style.flex = 'none');
            if (n.size && n.size.height) (el.style.height = `${n.size.height}px`), (el.style.justifyContent = 'center');
            if (n.radius) el.style.borderRadius = `${n.radius}px`;
            if (n.bg) el.style.background = css(n.bg);
            if (n.gradient) el.style.background = grad(n.gradient);
            if (n.bgImage && n.bgImage.src) el.style.background = `url(${n.bgImage.src}) center / cover no-repeat`;
            if (n.padding) el.style.padding = n.padding.map(x => `${x}px`).join(' ');
        }
        if (n.spacing) el.style.gap = `${n.spacing}px`;
        for (const c of n.items) el.append(draw(c, dir));
        void parentDir;
        return el;
    }
    function drawWidget(w, family) {
        const [width, height] = SIZES[family] || SIZES.medium;
        const lock = family.startsWith('accessory');
        const el = document.createElement('div');
        el.className = `sw sw-${family}${lock ? ' sw-lock' : ''}`;
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
        if (!lock) {
            el.style.background = w.bgImage && w.bgImage.src ? `url(${w.bgImage.src}) center / cover no-repeat` : w.gradient ? grad(w.gradient) : css(w.bg) || '#1c1c1e';
        } else if (w.accessoryBg) el.classList.add('sw-acc-bg');
        const body = draw(w);
        const pad = w.padding || (lock ? [0, 0, 0, 0] : [16, 16, 16, 16]);
        body.style.padding = pad.map(x => `${x}px`).join(' ');
        el.append(body);
        return el;
    }
    // timers tick, like they do on the phone
    setInterval(() => document.querySelectorAll('[data-timer]').forEach(t => (t.textContent = clock(+t.dataset.timer - Date.now()))), 1000);

    /** run one widget's script and draw it; resolves to an element */
    async function render(kind, family, param) {
        const fn = window.EGWidgetScripts && window.EGWidgetScripts[kind];
        if (!fn) throw new Error(`No widget called ${kind}`);
        let built = null;
        const G = makeGlobals(family, param, w => (built = w));
        await fn(...window.EGWidgetGlobals.map(k => G[k]));
        if (!built) throw new Error('The widget script made no widget');
        return drawWidget(built, family);
    }
    window.EGScriptable = { render, SIZES };
})();
