// Formulas for Spreadsheets, the same in the browser and on the server (exports):
// =A1+B2*3, =SUM(A1:A10), =IF(B2>10;"big";"small"), =Sheet2!C4, ='My sheet'!A1:B3 …
// Excel's function names, plus the Dutch ones (SOM, GEMIDDELDE, ALS…); ; and , both separate.
(function (root) {
    'use strict';

    const ERR = { div0: '#DIV/0!', value: '#VALUE!', ref: '#REF!', name: '#NAME?', na: '#N/A', num: '#NUM!', circ: '#CIRC!' };
    const isErr = v => typeof v === 'string' && /^#(DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!|CIRC!)$/.test(v);
    class FErr extends Error {
        constructor(code) {
            super(code);
            this.code = code;
        }
    }

    /* ---------- cell addresses ---------- */
    const colNum = s => [...s.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0); // A=1
    const colName = n => {
        let s = '';
        for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
        return s;
    };
    const parseAddr = a => {
        const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,6})$/.exec(a);
        return m ? { c: colNum(m[1]), r: +m[2] } : null;
    };
    const addr = (c, r) => colName(c) + r;

    /* ---------- reading a formula ---------- */
    function tokenize(src) {
        const t = [];
        let i = 0;
        // Dutch style (=ALS(A1>2,5;"ja";"nee")): ; separates and , is the decimal comma
        const dutch = /;/.test(src.replace(/"(?:[^"]|"")*"/g, ''));
        const NUM = dutch ? /^(\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?|[.,]\d+)/ : /^(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)/;
        while (i < src.length) {
            const ch = src[i];
            if (/\s/.test(ch)) {
                i++;
                continue;
            }
            let m;
            const rest = src.slice(i);
            if ((m = /^"((?:[^"]|"")*)"/.exec(rest))) t.push({ k: 'str', v: m[1].replace(/""/g, '"') });
            else if ((m = /^(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!(\$?[A-Za-z]{1,3}\$?\d{1,6})(?::(\$?[A-Za-z]{1,3}\$?\d{1,6}))?/.exec(rest)))
                t.push({ k: 'ref', sheet: (m[1] || m[2]).replace(/''/g, "'"), a: m[3], b: m[4] || null });
            else if ((m = /^(\$?[A-Za-z]{1,3}\$?\d{1,6})(?::(\$?[A-Za-z]{1,3}\$?\d{1,6}))?(?![\w(])/.exec(rest))) t.push({ k: 'ref', sheet: null, a: m[1], b: m[2] || null });
            else if ((m = NUM.exec(rest))) t.push({ k: 'num', v: parseFloat(m[1].replace(',', '.')) });
            else if ((m = /^(TRUE|FALSE|WAAR|ONWAAR)(?![\w(.])/i.exec(rest))) t.push({ k: 'bool', v: /^(TRUE|WAAR)$/i.test(m[1]) });
            else if ((m = /^([A-Za-z_][\w.]*)\s*(?=\()/.exec(rest))) t.push({ k: 'fn', v: m[1].toUpperCase() });
            else if ((m = /^(<>|<=|>=|[-+*/^&=<>%(),;:])/.exec(rest))) t.push({ k: 'op', v: m[1] === ';' ? ',' : m[1] });
            else throw new FErr(ERR.name);
            i += m[0].length;
        }
        return t;
    }
    // precedence climbing: comparison < & < +- < */ < ^ < unary < %
    function parse(src) {
        const t = tokenize(src);
        let p = 0;
        const peek = () => t[p];
        const take = () => t[p++];
        const isOp = (v, tok = peek()) => tok && tok.k === 'op' && tok.v === v;
        const BIN = [['=', '<>', '<', '>', '<=', '>='], ['&'], ['+', '-'], ['*', '/'], ['^']];
        function level(n) {
            if (n === BIN.length) return unary();
            let left = level(n + 1);
            while (peek() && peek().k === 'op' && BIN[n].includes(peek().v)) {
                const op = take().v;
                left = { k: 'bin', op, a: left, b: level(n + 1) };
            }
            return left;
        }
        function unary() {
            if (isOp('-')) return take(), { k: 'neg', a: unary() };
            if (isOp('+')) return take(), unary();
            let e = primary();
            while (isOp('%')) take(), (e = { k: 'pct', a: e });
            return e;
        }
        function primary() {
            const tok = take();
            if (!tok) throw new FErr(ERR.value);
            if (tok.k === 'num' || tok.k === 'str' || tok.k === 'bool') return { k: 'lit', v: tok.v };
            if (tok.k === 'ref') return { k: 'ref', sheet: tok.sheet, a: tok.a, b: tok.b };
            if (tok.k === 'fn') {
                const args = [];
                take(); // (
                if (!isOp(')')) {
                    for (;;) {
                        args.push(isOp(',') || isOp(')') ? { k: 'lit', v: null } : level(0));
                        if (isOp(',')) take();
                        else break;
                    }
                }
                if (!isOp(')')) throw new FErr(ERR.value);
                take();
                return { k: 'fn', name: tok.v, args };
            }
            if (isOp('(', tok)) {
                const e = level(0);
                if (!isOp(')')) throw new FErr(ERR.value);
                take();
                return e;
            }
            throw new FErr(ERR.value);
        }
        const e = level(0);
        if (p < t.length) throw new FErr(ERR.value);
        return e;
    }

    /* ---------- values ---------- */
    const num = v => {
        if (isErr(v)) throw new FErr(v);
        if (v === null || v === undefined || v === '') return 0;
        if (typeof v === 'boolean') return v ? 1 : 0;
        if (typeof v === 'number') return v;
        const n = Number(String(v).replace(',', '.'));
        if (String(v).trim() === '' || Number.isNaN(n)) throw new FErr(ERR.value);
        return n;
    };
    const str = v => {
        if (isErr(v)) throw new FErr(v);
        if (v === null || v === undefined) return '';
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10);
        return String(v);
    };
    const bool = v => {
        if (isErr(v)) throw new FErr(v);
        if (typeof v === 'string') {
            if (/^(true|waar)$/i.test(v)) return true;
            if (/^(false|onwaar)$/i.test(v) || v === '') return false;
            throw new FErr(ERR.value);
        }
        return !!v;
    };
    const flat = args => args.flatMap(a => (Array.isArray(a) ? a.flat() : [a]));
    const numbers = args => flat(args).filter(v => typeof v === 'number'); // ranges: numbers only, like Excel
    const numbersStrict = args =>
        args.flatMap(a => (Array.isArray(a) ? a.flat().filter(v => typeof v === 'number') : a === null ? [] : [num(a)]));
    // "criteria" for COUNTIF/SUMIF: ">10", "<>x", "apple", 5
    function matcher(c) {
        if (typeof c === 'number') return v => v === c;
        const m = /^(<=|>=|<>|=|<|>)?(.*)$/.exec(str(c));
        const op = m[1] || '=';
        const raw = m[2];
        const n = raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : null;
        const re = new RegExp('^' + raw.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
        return v => {
            if (n !== null && typeof v === 'number') return { '=': v === n, '<>': v !== n, '<': v < n, '>': v > n, '<=': v <= n, '>=': v >= n }[op];
            const s = v === null || v === undefined ? '' : String(v);
            if (op === '=') return re.test(s);
            if (op === '<>') return !re.test(s);
            return n === null ? { '<': s < raw, '>': s > raw, '<=': s <= raw, '>=': s >= raw }[op] : false;
        };
    }
    const round = (x, d, mode) => {
        const f = Math.pow(10, d);
        const y = x * f;
        const r = mode === 'up' ? Math.sign(y) * Math.ceil(Math.abs(y) - 1e-9) : mode === 'down' ? Math.trunc(y) : Math.sign(y) * Math.round(Math.abs(y) + 1e-9);
        return r / f;
    };
    // dates are day numbers, like Excel (1 = 1900-01-01, with Excel's 1900 leap-year quirk)
    const EPOCH = Date.UTC(1899, 11, 30);
    const toSerial = d => Math.round((d - EPOCH) / 864e5);
    const fromSerial = s => new Date(EPOCH + Math.floor(s) * 864e5);
    const today = () => {
        const d = new Date();
        return toSerial(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    };

    const F = {
        SUM: a => numbersStrict(a).reduce((s, x) => s + x, 0),
        AVERAGE: a => {
            const n = numbersStrict(a);
            if (!n.length) throw new FErr(ERR.div0);
            return n.reduce((s, x) => s + x, 0) / n.length;
        },
        MIN: a => (numbersStrict(a).length ? Math.min(...numbersStrict(a)) : 0),
        MAX: a => (numbersStrict(a).length ? Math.max(...numbersStrict(a)) : 0),
        COUNT: a => numbers(a).length,
        COUNTA: a => flat(a).filter(v => v !== null && v !== '').length,
        COUNTBLANK: a => flat(a).filter(v => v === null || v === '').length,
        PRODUCT: a => numbersStrict(a).reduce((s, x) => s * x, 1),
        MEDIAN: a => {
            const n = numbersStrict(a).sort((x, y) => x - y);
            if (!n.length) throw new FErr(ERR.num);
            return n.length % 2 ? n[(n.length - 1) / 2] : (n[n.length / 2 - 1] + n[n.length / 2]) / 2;
        },
        COUNTIF: ([range, c]) => flat([range]).filter(matcher(c)).length,
        SUMIF: ([range, c, sumRange]) => {
            const r = flat([range]);
            const s = sumRange ? flat([sumRange]) : r;
            const m = matcher(c);
            return r.reduce((t, v, i) => t + (m(v) && typeof s[i] === 'number' ? s[i] : 0), 0);
        },
        AVERAGEIF: ([range, c, avgRange]) => {
            const r = flat([range]);
            const s = avgRange ? flat([avgRange]) : r;
            const m = matcher(c);
            const hits = r.map((v, i) => (m(v) && typeof s[i] === 'number' ? s[i] : null)).filter(x => x !== null);
            if (!hits.length) throw new FErr(ERR.div0);
            return hits.reduce((t, x) => t + x, 0) / hits.length;
        },
        IF: ([c, a, b]) => (bool(c) ? (a === undefined ? true : a) : b === undefined ? false : b),
        IFERROR: () => null, // handled lazily in the evaluator
        AND: a => flat(a).filter(v => v !== null).every(bool),
        OR: a => flat(a).filter(v => v !== null).some(bool),
        NOT: ([a]) => !bool(a),
        ROUND: ([x, d]) => round(num(x), num(d || 0)),
        ROUNDUP: ([x, d]) => round(num(x), num(d || 0), 'up'),
        ROUNDDOWN: ([x, d]) => round(num(x), num(d || 0), 'down'),
        INT: ([x]) => Math.floor(num(x)),
        ABS: ([x]) => Math.abs(num(x)),
        SQRT: ([x]) => {
            if (num(x) < 0) throw new FErr(ERR.num);
            return Math.sqrt(num(x));
        },
        POWER: ([x, y]) => Math.pow(num(x), num(y)),
        MOD: ([x, y]) => {
            if (num(y) === 0) throw new FErr(ERR.div0);
            return num(x) - num(y) * Math.floor(num(x) / num(y));
        },
        PI: () => Math.PI,
        LEN: ([s]) => str(s).length,
        UPPER: ([s]) => str(s).toUpperCase(),
        LOWER: ([s]) => str(s).toLowerCase(),
        PROPER: ([s]) => str(s).toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
        TRIM: ([s]) => str(s).trim().replace(/\s+/g, ' '),
        LEFT: ([s, n]) => str(s).slice(0, n === undefined ? 1 : num(n)),
        RIGHT: ([s, n]) => (n !== undefined && num(n) === 0 ? '' : str(s).slice(-(n === undefined ? 1 : num(n)))),
        MID: ([s, a, n]) => str(s).substr(num(a) - 1, num(n)),
        CONCATENATE: a => flat(a).map(str).join(''),
        CONCAT: a => flat(a).map(str).join(''),
        TEXTJOIN: ([sep, skip, ...a]) => flat(a).filter(v => !bool(skip) || (v !== null && v !== '')).map(str).join(str(sep)),
        SUBSTITUTE: ([s, a, b]) => str(s).split(str(a)).join(str(b)),
        FIND: ([a, s, from]) => {
            const i = str(s).indexOf(str(a), from ? num(from) - 1 : 0);
            if (i < 0) throw new FErr(ERR.value);
            return i + 1;
        },
        VALUE: ([s]) => num(s),
        TEXT: ([v, f]) => format(num(v), { fmt: /%/.test(str(f)) ? 'percent' : /[dmyjMY]/.test(str(f)) ? 'date' : /0[.,]00/.test(str(f)) ? 'number' : 'general' }),
        ISBLANK: ([v]) => v === null || v === '',
        ISNUMBER: ([v]) => typeof v === 'number',
        ISTEXT: ([v]) => typeof v === 'string' && !isErr(v),
        TODAY: () => today(),
        NOW: () => today() + (Date.now() % 864e5) / 864e5,
        DATE: ([y, m, d]) => toSerial(Date.UTC(num(y), num(m) - 1, num(d))),
        YEAR: ([s]) => fromSerial(num(s)).getUTCFullYear(),
        MONTH: ([s]) => fromSerial(num(s)).getUTCMonth() + 1,
        DAY: ([s]) => fromSerial(num(s)).getUTCDate(),
        WEEKDAY: ([s]) => fromSerial(num(s)).getUTCDay() + 1,
        VLOOKUP: ([key, table, col, approx]) => {
            if (!Array.isArray(table)) throw new FErr(ERR.na);
            const c = num(col) - 1;
            if (c < 0 || c >= (table[0] || []).length) throw new FErr(ERR.ref);
            const exact = approx !== undefined && !bool(approx);
            let hit = -1;
            for (let i = 0; i < table.length; i++) {
                const v = table[i][0];
                if (exact || typeof key !== 'number') {
                    if (String(v).toLowerCase() === str(key).toLowerCase() || v === key) return table[i][c];
                } else if (typeof v === 'number' && v <= key) hit = i;
            }
            if (hit < 0) throw new FErr(ERR.na);
            return table[hit][c];
        },
        HLOOKUP: ([key, table, row, approx]) => F.VLOOKUP([key, table[0].map((_, i) => table.map(r => r[i])), row, approx]),
        INDEX: ([table, r, c]) => {
            const rows = Array.isArray(table) ? table : [[table]];
            const row = rows.length === 1 && c === undefined ? 0 : num(r) - 1;
            const col = rows.length === 1 && c === undefined ? num(r) - 1 : c === undefined ? 0 : num(c) - 1;
            if (!rows[row] || rows[row][col] === undefined) throw new FErr(ERR.ref);
            return rows[row][col];
        },
        MATCH: ([key, range, type]) => {
            const list = flat([range]);
            const exact = type !== undefined && num(type) === 0;
            for (let i = 0; i < list.length; i++) if (exact ? String(list[i]).toLowerCase() === str(key).toLowerCase() || list[i] === key : list[i] === key) return i + 1;
            throw new FErr(ERR.na);
        },
        RAND: () => Math.random()
    };
    // Dutch function names, as in Dutch Excel
    const NL = { SOM: 'SUM', GEMIDDELDE: 'AVERAGE', AANTAL: 'COUNT', AANTALARG: 'COUNTA', AANTAL_LEGE_CELLEN: 'COUNTBLANK', ALS: 'IF', ALS_FOUT: 'IFERROR', EN: 'AND', OF: 'OR', NIET: 'NOT', AFRONDEN: 'ROUND', AFRONDEN_NAAR_BOVEN: 'ROUNDUP', AFRONDEN_NAAR_BENEDEN: 'ROUNDDOWN', INTEGER: 'INT', WORTEL: 'SQRT', MACHT: 'POWER', REST: 'MOD', LENGTE: 'LEN', HOOFDLETTERS: 'UPPER', KLEINE_LETTERS: 'LOWER', BEGINLETTERS: 'PROPER', SPATIES_WISSEN: 'TRIM', LINKS: 'LEFT', RECHTS: 'RIGHT', DEEL: 'MID', TEKST_SAMENVOEGEN: 'CONCATENATE', SUBSTITUEREN: 'SUBSTITUTE', VIND_ALLES: 'FIND', WAARDE: 'VALUE', TEKST: 'TEXT', VANDAAG: 'TODAY', NU: 'NOW', DATUM: 'DATE', JAAR: 'YEAR', MAAND: 'MONTH', DAG: 'DAY', WEEKDAG: 'WEEKDAY', VERT_ZOEKEN: 'VLOOKUP', HORIZ_ZOEKEN: 'HLOOKUP', INDEX: 'INDEX', VERGELIJKEN: 'MATCH', PRODUCT: 'PRODUCT', MEDIAAN: 'MEDIAN', AANTAL_ALS: 'COUNTIF', SOM_ALS: 'SUMIF', GEMIDDELDE_ALS: 'AVERAGEIF', ASELECT: 'RAND', ABS: 'ABS', MIN: 'MIN', MAX: 'MAX', PI: 'PI', TEKST_COMBINEREN: 'TEXTJOIN', ISLEEG: 'ISBLANK', ISGETAL: 'ISNUMBER', ISTEKST: 'ISTEXT', SAMENVOEGEN: 'CONCAT' };
    const FUNCTIONS = Object.keys(F).sort();

    /**
     * A workbook: { sheets: [{ name, cells: { A1: { v: 'what was typed', s: {…} } } }] }.
     * Returns get(sheetIndex, 'A1') → the value (number, text, boolean, null or an error code).
     */
    function evaluator(book) {
        const cache = new Map();
        const busy = new Set();
        const sheetIndex = name => book.sheets.findIndex(s => s.name.toLowerCase() === String(name).toLowerCase());
        function literal(raw) {
            const s = String(raw);
            if (s.trim() === '') return null;
            if (/^[-+]?(\d+[.,]?\d*|[.,]\d+)([eE][-+]?\d+)?%?$/.test(s.trim())) {
                const pct = s.trim().endsWith('%');
                const n = parseFloat(s.trim().replace('%', '').replace(',', '.'));
                return pct ? n / 100 : n;
            }
            if (/^(true|waar)$/i.test(s.trim())) return true;
            if (/^(false|onwaar)$/i.test(s.trim())) return false;
            return s;
        }
        function get(si, a) {
            const key = si + '!' + a;
            if (cache.has(key)) return cache.get(key);
            const sheet = book.sheets[si];
            const cell = sheet && sheet.cells[a];
            if (!cell || cell.v === undefined || cell.v === '') return null;
            const raw = String(cell.v);
            if (!raw.startsWith('=') || raw.length === 1) {
                const v = literal(raw);
                cache.set(key, v);
                return v;
            }
            if (busy.has(key)) throw new FErr(ERR.circ);
            busy.add(key);
            let v;
            try {
                v = ev(parse(raw.slice(1)), si);
                if (Array.isArray(v)) v = v[0] ? v[0][0] : null; // a range on its own: its first cell
                if (typeof v === 'number' && !Number.isFinite(v)) v = ERR.num;
                if (v === null) v = 0;
            } catch (err) {
                v = err instanceof FErr ? err.code : ERR.value;
            } finally {
                busy.delete(key);
            }
            cache.set(key, v);
            return v;
        }
        function range(si, ref) {
            const sheet = ref.sheet ? sheetIndex(ref.sheet) : si;
            if (sheet < 0) throw new FErr(ERR.ref);
            const a = parseAddr(ref.a);
            const b = ref.b ? parseAddr(ref.b) : a;
            if (!a || !b) throw new FErr(ERR.ref);
            const out = [];
            for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
                const row = [];
                for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) {
                    const v = get(sheet, addr(c, r));
                    if (isErr(v) && v === ERR.circ) throw new FErr(v);
                    row.push(v);
                }
                out.push(row);
                if (out.length > 100000) throw new FErr(ERR.ref);
            }
            return out;
        }
        function ev(n, si) {
            switch (n.k) {
                case 'lit':
                    return n.v;
                case 'ref': {
                    const r = range(si, n);
                    if (!n.b) {
                        if (isErr(r[0][0])) throw new FErr(r[0][0]);
                        return r[0][0];
                    }
                    return r;
                }
                case 'neg':
                    return -num(scalar(ev(n.a, si)));
                case 'pct':
                    return num(scalar(ev(n.a, si))) / 100;
                case 'bin': {
                    const a = scalar(ev(n.a, si));
                    const b = scalar(ev(n.b, si));
                    switch (n.op) {
                        case '+': return num(a) + num(b);
                        case '-': return num(a) - num(b);
                        case '*': return num(a) * num(b);
                        case '/':
                            if (num(b) === 0) throw new FErr(ERR.div0);
                            return num(a) / num(b);
                        case '^': return Math.pow(num(a), num(b));
                        case '&': return str(a) + str(b);
                        default: {
                            if (isErr(a)) throw new FErr(a);
                            if (isErr(b)) throw new FErr(b);
                            const x = typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() : a === null ? (typeof b === 'string' ? '' : 0) : a;
                            const y = typeof a === 'string' && typeof b === 'string' ? b.toLowerCase() : b === null ? (typeof a === 'string' ? '' : 0) : b;
                            return { '=': x === y, '<>': x !== y, '<': x < y, '>': x > y, '<=': x <= y, '>=': x >= y }[n.op];
                        }
                    }
                }
                case 'fn': {
                    const name = NL[n.name] || n.name.replace(/^_XLFN\./, '');
                    if (name === 'IFERROR') {
                        try {
                            const v = scalar(ev(n.args[0], si));
                            if (isErr(v)) throw new FErr(v);
                            return v;
                        } catch (err) {
                            if (!(err instanceof FErr)) throw err;
                            return n.args[1] ? scalar(ev(n.args[1], si)) : '';
                        }
                    }
                    if (name === 'IF') {
                        // only the branch that's chosen is worked out
                        const c = bool(scalar(ev(n.args[0], si)));
                        const pick = c ? n.args[1] : n.args[2];
                        return pick ? ev(pick, si) : c;
                    }
                    const fn = F[name];
                    if (!fn) throw new FErr(ERR.name);
                    return fn(n.args.map(x => ev(x, si)));
                }
            }
            throw new FErr(ERR.value);
        }
        const scalar = v => (Array.isArray(v) ? (v.length === 1 && v[0].length === 1 ? v[0][0] : (() => { throw new FErr(ERR.value); })()) : v);
        return { get, sheetIndex };
    }

    /* ---------- showing values ---------- */
    function format(v, style = {}) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (typeof v !== 'number') return String(v);
        const d = style.dec != null ? style.dec : null;
        const fixed = (x, n) => x.toLocaleString(style.locale || undefined, { minimumFractionDigits: n, maximumFractionDigits: n });
        switch (style.fmt) {
            case 'number': return fixed(v, d == null ? 2 : d);
            case 'currency': return (v < 0 ? '-' : '') + '€ ' + fixed(Math.abs(v), d == null ? 2 : d);
            case 'percent': return fixed(v * 100, d == null ? 0 : d) + '%';
            case 'date': {
                const t = fromSerial(v);
                return `${pad(t.getUTCDate())}-${pad(t.getUTCMonth() + 1)}-${t.getUTCFullYear()}`;
            }
            default: {
                if (d != null) return fixed(v, d);
                const r = Math.round(v * 1e10) / 1e10;
                return Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-6 && r !== 0) ? r.toExponential(4) : String(r);
            }
        }
    }
    const pad = n => String(n).padStart(2, '0');

    /** a formula with references moved by (dr, dc), as when copying or filling a cell */
    function shift(raw, dr, dc) {
        if (!String(raw).startsWith('=')) return raw;
        return String(raw).replace(/("(?:[^"]|"")*")|(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})(?![\w(])/g, (m, s, d1, c, d2, r) => {
            if (s) return s;
            const col = d1 ? c.toUpperCase() : colName(Math.max(1, colNum(c) + dc));
            const row = d2 ? r : String(Math.max(1, +r + dr));
            return `${d1}${col}${d2}${row}`;
        });
    }

    /** a formula as Excel stores it: English names, "," between arguments, "." in numbers */
    function toExcel(src) {
        const t = tokenize(String(src).replace(/^=/, ''));
        const q = name => (/^[A-Za-z_][\w.]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`);
        return t
            .map(x => {
                if (x.k === 'num') return String(x.v);
                if (x.k === 'str') return `"${x.v.replace(/"/g, '""')}"`;
                if (x.k === 'bool') return x.v ? 'TRUE' : 'FALSE';
                if (x.k === 'ref') return (x.sheet ? `${q(x.sheet)}!` : '') + x.a.toUpperCase() + (x.b ? ':' + x.b.toUpperCase() : '');
                if (x.k === 'fn') return NL[x.v] || x.v;
                return x.v;
            })
            .join('');
    }

    const api = { evaluator, format, parse, shift, toExcel, colName, colNum, parseAddr, addr, isErr, FUNCTIONS, NL, ERR, toSerial, fromSerial };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.EGFormula = api;
})(typeof window !== 'undefined' ? window : globalThis);
