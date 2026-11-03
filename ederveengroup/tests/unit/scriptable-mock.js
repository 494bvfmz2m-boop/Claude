'use strict';

// A strict stand-in for Scriptable's API (scriptable.app), for testing the widget scripts:
// properties or methods Scriptable doesn't have throw, so a mistake shows up here and not on a phone.

const PROPS = {
    ListWidget: ['backgroundColor', 'backgroundImage', 'backgroundGradient', 'addAccessoryWidgetBackground', 'spacing', 'url', 'refreshAfterDate'],
    WidgetStack: ['backgroundColor', 'backgroundImage', 'backgroundGradient', 'spacing', 'size', 'cornerRadius', 'borderWidth', 'borderColor', 'url'],
    WidgetText: ['text', 'textColor', 'font', 'textOpacity', 'lineLimit', 'minimumScaleFactor', 'shadowColor', 'shadowRadius', 'shadowOffset', 'url'],
    WidgetDate: ['date', 'textColor', 'font', 'textOpacity', 'lineLimit', 'minimumScaleFactor', 'shadowColor', 'shadowRadius', 'shadowOffset', 'url'],
    WidgetImage: ['image', 'resizable', 'imageSize', 'imageOpacity', 'cornerRadius', 'borderWidth', 'borderColor', 'containerRelativeShape', 'tintColor', 'url'],
    WidgetSpacer: ['length'],
    LinearGradient: ['colors', 'locations', 'startPoint', 'endPoint'],
    DateFormatter: ['dateFormat', 'locale'],
    Request: ['url', 'method', 'headers', 'body', 'timeoutInterval', 'response'],
    DrawContext: ['size', 'opaque', 'respectScreenScale'],
    Alert: ['title', 'message']
};
function strict(kind, methods, target = {}) {
    const props = PROPS[kind] || [];
    Object.assign(target, methods);
    return new Proxy(target, {
        set(t, k, v) {
            if (typeof k === 'string' && !k.startsWith('_') && !props.includes(k)) throw new Error(`${kind}.${k} is not a Scriptable property`);
            t[k] = v;
            return true;
        },
        get(t, k) {
            if (typeof k !== 'string' || k.startsWith('_') || k === 'then' || k === 'toJSON' || k === 'constructor') return t[k];
            if (!(k in methods) && !props.includes(k)) throw new Error(`${kind}.${k} is not in Scriptable`);
            return t[k];
        }
    });
}
const need = (cond, what) => {
    if (!cond) throw new Error(what);
};

/**
 * Scriptable's globals for one run. `fetchJSON(url)` answers Request.loadJSON (status + body),
 * `files` is the FileManager's storage (kept between runs if you pass the same object).
 */
function makeGlobals({ family, param, runsInWidget = true, fetchJSON, files = new Map() }) {
    const tree = { kind: 'widget', items: [] };
    let shown = null;
    const isColor = c => c && c.__color;
    const isImage = i => i && i.__image;
    const isSize = s => s && typeof s.width === 'number' && typeof s.height === 'number';
    const container = node => ({
        addText(s) {
            need(s !== undefined, 'addText needs a string');
            const n = { kind: 'text', text: String(s) };
            node.items.push(n);
            return strict('WidgetText', { leftAlignText() {}, centerAlignText() {}, rightAlignText() {} }, n);
        },
        addDate(d) {
            need(d instanceof Date && !isNaN(d), 'addDate needs a Date');
            const n = { kind: 'date', date: d };
            node.items.push(n);
            return strict('WidgetDate', { applyTimeStyle() {}, applyDateStyle() {}, applyRelativeStyle() {}, applyOffsetStyle() {}, applyTimerStyle() {}, leftAlignText() {}, centerAlignText() {}, rightAlignText() {} }, n);
        },
        addImage(img) {
            need(isImage(img), 'addImage needs an Image');
            const n = { kind: 'image', sym: img.__sym || 'drawing' };
            node.items.push(n);
            return strict('WidgetImage', { leftAlignImage() {}, centerAlignImage() {}, rightAlignImage() {}, applyFittingContentMode() {}, applyFillingContentMode() {} }, n);
        },
        addSpacer(len) {
            need(len === undefined || len === null || typeof len === 'number', 'addSpacer takes a number');
            node.items.push({ kind: 'spacer', len });
            return strict('WidgetSpacer', {}, {});
        },
        addStack() {
            const n = { kind: 'stack', dir: 'h', items: [] };
            node.items.push(n);
            return strict('WidgetStack', { ...container(n), topAlignContent() {}, centerAlignContent() {}, bottomAlignContent() {}, layoutHorizontally() { n.dir = 'h'; }, layoutVertically() { n.dir = 'v'; } }, n);
        },
        setPadding(...a) {
            need(a.length === 4 && a.every(x => typeof x === 'number'), 'setPadding takes 4 numbers');
        },
        useDefaultPadding() {}
    });
    function Color(hex, alpha) {
        need(/^#?[0-9a-f]{6}$/i.test(hex), `bad colour ${hex}`);
        this.__color = true;
        this.hex = hex;
        this.alpha = alpha;
    }
    Color.white = () => new Color('#ffffff');
    Color.black = () => new Color('#000000');
    Color.clear = () => new Color('#000000', 0);
    const fontFn = s => {
        need(typeof s === 'number', 'a font needs a size');
        return { __font: true, size: s };
    };
    const Font = {};
    for (const n of ['systemFont', 'regularSystemFont', 'mediumSystemFont', 'semiboldSystemFont', 'boldSystemFont', 'heavySystemFont', 'blackSystemFont', 'lightSystemFont', 'boldRoundedSystemFont', 'heavyRoundedSystemFont', 'semiboldRoundedSystemFont', 'mediumRoundedSystemFont', 'regularRoundedSystemFont', 'boldMonospacedSystemFont']) Font[n] = fontFn;
    function Size(w, h) {
        need(typeof w === 'number' && typeof h === 'number' && isFinite(w) && isFinite(h), 'Size needs numbers');
        this.width = w;
        this.height = h;
    }
    function Point(x, y) {
        need(isFinite(x) && isFinite(y), 'Point needs numbers');
        this.x = x;
        this.y = y;
    }
    function Rect(x, y, w, h) {
        need([x, y, w, h].every(n => typeof n === 'number' && isFinite(n)), 'Rect needs numbers');
        Object.assign(this, { x, y, width: w, height: h });
    }
    function LinearGradient() {
        return strict('LinearGradient', {}, {});
    }
    const SFSymbol = { named: name => strict('SFSymbol', { image: { __image: true, __sym: name }, applyFont(f) { need(f && f.__font, 'applyFont needs a Font'); } }, {}) };
    function Path() {
        const self = { _isPath: true };
        const pt = p => need(p instanceof Point, 'a Path needs Points');
        return strict('Path', { move(p) { pt(p); }, addLine(p) { pt(p); }, addRect(r) { need(r instanceof Rect, 'addRect needs a Rect'); }, addEllipse(r) { need(r instanceof Rect, 'addEllipse needs a Rect'); }, addRoundedRect(r, a, b) { need(r instanceof Rect && typeof a === 'number' && typeof b === 'number', 'addRoundedRect needs a Rect and two numbers'); }, addCurve() {}, addQuadCurve() {}, addLines() {}, closeSubpath() {} }, self);
    }
    function DrawContext() {
        const self = {};
        const col = c => need(isColor(c), 'DrawContext needs a Color');
        const rect = r => need(r instanceof Rect, 'DrawContext needs a Rect');
        return strict('DrawContext', { setFillColor: col, setStrokeColor: col, setLineWidth(n) { need(typeof n === 'number', 'setLineWidth needs a number'); }, fillRect: rect, fillEllipse: rect, strokeRect: rect, strokeEllipse: rect, fill: rect, stroke: rect, addPath(p) { need(p && p._isPath, 'addPath needs a Path'); }, strokePath() {}, fillPath() {}, setFont(f) { need(f && f.__font, 'setFont needs a Font'); }, setTextColor: col, setTextAlignedLeft() {}, setTextAlignedCenter() {}, setTextAlignedRight() {}, drawText(t, p) { need(typeof t === 'string' && p instanceof Point, 'drawText needs text and a Point'); }, drawTextInRect(t, r) { need(typeof t === 'string', 'drawTextInRect needs text'); rect(r); }, drawImageInRect() {}, drawImageAtPoint() {}, getImage() { need(isSize(self.size), 'set the DrawContext size first'); return { __image: true, __sym: 'drawing' }; } }, self);
    }
    function DateFormatter() {
        const self = {};
        return strict('DateFormatter', { string(d) { need(d instanceof Date && !isNaN(d), 'DateFormatter.string needs a Date'); return `${d.toISOString().slice(0, 10)}|${self.dateFormat}`; } }, self);
    }
    function Request(url) {
        need(typeof url === 'string' && /^https?:\/\//.test(url), 'Request needs a web address');
        const self = { url };
        return strict('Request', {
            async loadJSON() {
                const r = await fetchJSON(self.url);
                self.response = { statusCode: r.status };
                return r.body;
            },
            async loadImage() {
                const r = await fetchJSON(self.url, true);
                self.response = { statusCode: r.status };
                if (r.status !== 200) throw new Error('no image');
                return { __image: true, __sym: 'photo' };
            },
            async loadString() {
                return JSON.stringify((await fetchJSON(self.url)).body);
            }
        }, self);
    }
    const FileManager = { local: () => ({ cacheDirectory: () => '/cache', documentsDirectory: () => '/docs', joinPath: (a, b) => `${a}/${b}`, writeString: (p, s) => files.set(p, String(s)), readString: p => files.get(p), fileExists: p => files.has(p) }) };
    function Alert() {
        return strict('Alert', { addAction() {}, addCancelAction() {}, async presentSheet() { return 1; }, async presentAlert() { return 0; } }, {});
    }
    function ListWidget() {
        tree.items = [];
        tree._isWidget = true;
        return strict('ListWidget', { ...container(tree), async presentSmall() { shown = 'small'; }, async presentMedium() { shown = 'medium'; }, async presentLarge() { shown = 'large'; }, async presentExtraLarge() { shown = 'extraLarge'; } }, tree);
    }
    const g = {
        ListWidget,
        Color,
        Font,
        Size,
        Point,
        Rect,
        LinearGradient,
        SFSymbol,
        DrawContext,
        Path,
        Image: { fromData: () => ({ __image: true }) },
        Request,
        FileManager,
        DateFormatter,
        Location: { setAccuracyToThreeKilometers() {}, setAccuracyToKilometer() {}, async current() { return { latitude: 52.07, longitude: 5.65 }; }, async reverseGeocode() { return [{ locality: 'Ederveen' }]; } },
        Alert,
        Script: { setWidget(w) { shown = 'widget'; need(w && w._isWidget, 'setWidget needs a ListWidget'); }, complete() {} },
        Device: { locale: () => 'nl_NL', screenSize: () => new Size(390, 844), isPad: () => false },
        config: { widgetFamily: runsInWidget ? family : null, runsInWidget },
        args: { widgetParameter: param || null }
    };
    return { g, tree, shown: () => shown };
}

/** run a script (the text Scriptable gets) once; resolves to the widget it made */
async function runScript(src, globalsOrder, opts) {
    const m = makeGlobals(opts);
    const fn = new (Object.getPrototypeOf(async function () {}).constructor)(...globalsOrder, src);
    await fn(...globalsOrder.map(k => m.g[k]));
    return { tree: m.tree, shown: m.shown() };
}

/** the widget as indented text, to read */
function render(node, depth = 0) {
    const pad = '  '.repeat(depth);
    let out = '';
    for (const it of node.items || []) {
        if (it.kind === 'text') out += `${pad}"${it.text}"\n`;
        else if (it.kind === 'date') out += `${pad}<date ${it.date.toISOString()}>\n`;
        else if (it.kind === 'image') out += `${pad}[${it.sym}]\n`;
        else if (it.kind === 'stack') out += `${pad}<${it.dir === 'v' ? 'col' : 'row'}${it.url ? ` → ${it.url.replace(/^https?:\/\/[^/]+/, '')}` : ''}>\n${render(it, depth + 1)}`;
    }
    return out;
}
const textOf = node => (node.items || []).map(it => (it.kind === 'text' ? it.text : it.items ? textOf(it) : '')).join(' ');

module.exports = { runScript, render, textOf };
