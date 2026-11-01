'use strict';

// Exports in Microsoft's file types (and PDF) for Spreadsheets, Docs and Slides, and imports
// from Excel and CSV. Everything runs on the server with plain JavaScript libraries
// (exceljs, docx, pptxgenjs, pdfkit), so the files are real .xlsx/.docx/.pptx files.

const F = require('../public/js/formula');

const hex = c => (/^#[0-9a-f]{6}$/i.test(String(c || '')) ? String(c).slice(1).toUpperCase() : null);
const NUMFMT = { number: '#,##0.00', currency: '"€" #,##0.00', percent: '0%', date: 'dd-mm-yyyy', text: '@' };
const numFmt = s => {
    if (!s || !s.fmt || s.fmt === 'general') return s && s.dec != null ? (s.dec ? `0.${'0'.repeat(s.dec)}` : '0') : undefined;
    if (s.dec != null && ['number', 'currency', 'percent'].includes(s.fmt)) {
        const dec = s.dec ? `.${'0'.repeat(s.dec)}` : '';
        return s.fmt === 'number' ? `#,##0${dec}` : s.fmt === 'currency' ? `"€" #,##0${dec}` : `0${dec}%`;
    }
    return NUMFMT[s.fmt];
};

/* ---------- spreadsheets ---------- */

/** the used part of a sheet: rows 1..r, columns 1..c */
function usedRange(sheet) {
    let r = 0;
    let c = 0;
    for (const a of Object.keys(sheet.cells || {})) {
        const p = F.parseAddr(a);
        const cell = sheet.cells[a];
        if (!p || (!String(cell.v || '') && !cell.s)) continue;
        r = Math.max(r, p.r);
        c = Math.max(c, p.c);
    }
    return { rows: r, cols: c };
}

async function sheetToXlsx(title, book) {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'EderveenGroup';
    wb.title = title;
    const ev = F.evaluator(book);
    const names = new Set();
    book.sheets.forEach((sh, si) => {
        let name = String(sh.name || `Sheet${si + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Sheet${si + 1}`;
        while (names.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${si + 1}`;
        names.add(name.toLowerCase());
        const ws = wb.addWorksheet(name);
        for (const [col, w] of Object.entries(sh.cols || {})) ws.getColumn(col).width = Math.max(4, Math.round(w / 7));
        for (const [a, cell] of Object.entries(sh.cells || {})) {
            if (!F.parseAddr(a)) continue;
            const c = ws.getCell(a);
            const raw = String(cell.v == null ? '' : cell.v);
            const val = ev.get(si, a);
            const s = cell.s || {};
            if (raw.startsWith('=') && raw.length > 1) {
                let formula;
                try {
                    formula = F.toExcel(raw);
                } catch {
                    formula = null;
                }
                c.value = formula ? { formula, result: F.isErr(val) ? { error: val } : val } : raw;
            } else if (raw !== '') {
                c.value = s.fmt === 'date' && typeof val === 'number' ? F.fromSerial(val) : val;
            }
            const font = {};
            if (s.b) font.bold = true;
            if (s.i) font.italic = true;
            if (s.u) font.underline = true;
            if (s.st) font.strike = true;
            if (hex(s.color)) font.color = { argb: 'FF' + hex(s.color) };
            if (Object.keys(font).length) c.font = font;
            if (hex(s.fill)) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex(s.fill) } };
            if (s.align || s.wrap) c.alignment = { ...(s.align ? { horizontal: s.align } : {}), ...(s.wrap ? { wrapText: true, vertical: 'top' } : {}) };
            const nf = numFmt(s);
            if (nf) c.numFmt = nf;
        }
        if (sh.freeze) ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
}

function sheetToCsv(book, si = 0) {
    const sh = book.sheets[si] || book.sheets[0];
    const ev = F.evaluator(book);
    const { rows, cols } = usedRange(sh);
    const q = v => (/[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const out = [];
    for (let r = 1; r <= rows; r++) {
        const line = [];
        for (let c = 1; c <= cols; c++) {
            const v = ev.get(book.sheets.indexOf(sh), F.addr(c, r));
            line.push(q(v === null ? '' : typeof v === 'number' ? String(Math.round(v * 1e10) / 1e10) : F.format(v)));
        }
        out.push(line.join(','));
    }
    return '﻿' + out.join('\r\n') + '\r\n'; // the BOM makes Excel read it as UTF-8
}

function pdfDoc(opts) {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, info: { Producer: 'EderveenGroup', Creator: 'EderveenGroup', Title: opts.title || '' }, ...opts.pdf });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    const done = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));
    return { doc, done };
}
// pdfkit's built-in fonts only know Western characters: anything else becomes a plain stand-in
const safe = s => String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff€]/g, '?');

async function sheetToPdf(title, book, { locale } = {}) {
    const { doc, done } = pdfDoc({ title, pdf: { size: 'A4', layout: 'landscape', margin: 36 } });
    const ev = F.evaluator(book);
    book.sheets.forEach((sh, si) => {
        const { rows, cols } = usedRange(sh);
        doc.addPage();
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#111').text(safe(book.sheets.length > 1 ? `${title} · ${sh.name}` : title), 36, 30);
        if (!rows) return void doc.font('Helvetica').fontSize(10).fillColor('#666').text('(empty)', 36, 56);
        const pageW = doc.page.width - 72;
        const widths = [];
        for (let c = 1; c <= cols; c++) widths.push(((sh.cols && sh.cols[F.colName(c)]) || 96) * 0.75);
        const scale = Math.min(1, pageW / widths.reduce((a, b) => a + b, 0));
        const w = widths.map(x => x * scale);
        const fs = Math.max(6, 9 * scale);
        const rowH = Math.max(11, 16 * scale);
        let y = 54;
        for (let r = 1; r <= rows; r++) {
            if (y + rowH > doc.page.height - 30) {
                doc.addPage();
                y = 30;
            }
            let x = 36;
            for (let c = 1; c <= cols; c++) {
                const a = F.addr(c, r);
                const cell = (sh.cells || {})[a] || {};
                const s = cell.s || {};
                const v = ev.get(si, a);
                if (hex(s.fill)) doc.rect(x, y, w[c - 1], rowH).fill('#' + hex(s.fill));
                doc.lineWidth(0.4).rect(x, y, w[c - 1], rowH).stroke('#d0d4dc');
                const text = safe(F.format(v, { ...s, locale }));
                if (text) {
                    doc.font(s.b && s.i ? 'Helvetica-BoldOblique' : s.b ? 'Helvetica-Bold' : s.i ? 'Helvetica-Oblique' : 'Helvetica').fontSize(fs).fillColor(hex(s.color) ? '#' + hex(s.color) : F.isErr(v) ? '#c0392b' : '#111');
                    const align = s.align || (typeof v === 'number' ? 'right' : 'left');
                    doc.text(text, x + 3, y + (rowH - fs) / 2 + 0.5, { width: w[c - 1] - 6, height: rowH, align, lineBreak: false, ellipsis: true, underline: !!s.u, strike: !!s.st });
                }
                x += w[c - 1];
            }
            y += rowH;
        }
    });
    doc.end();
    return done;
}

/** a workbook from an .xlsx file or CSV text */
async function importSheet(buffer, name) {
    if (/\.csv$/i.test(name) || !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
        const text = buffer.toString('utf8').replace(/^﻿/, '');
        const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
        const cells = {};
        let r = 1;
        let c = 1;
        let cur = '';
        let quoted = false;
        const push = () => {
            if (cur !== '') cells[F.addr(c, r)] = { v: cur };
            cur = '';
        };
        for (let i = 0; i < text.length && r <= 5000; i++) {
            const ch = text[i];
            if (quoted) {
                if (ch === '"' && text[i + 1] === '"') (cur += '"'), i++;
                else if (ch === '"') quoted = false;
                else cur += ch;
            } else if (ch === '"') quoted = true;
            else if (ch === sep) (push(), c++);
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                push();
                r++;
                c = 1;
            } else cur += ch;
        }
        push();
        return { sheets: [{ id: 's1', name: 'Sheet1', cells, cols: {} }], active: 0 };
    }
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheets = [];
    wb.eachSheet(ws => {
        if (sheets.length >= 20) return;
        const cells = {};
        const cols = {};
        ws.columns && ws.columns.forEach((col, i) => col && col.width && (cols[F.colName(i + 1)] = Math.round(Math.min(80, col.width) * 7)));
        ws.eachRow({ includeEmpty: false }, (row, r) => {
            if (r > 5000) return;
            row.eachCell({ includeEmpty: false }, (cell, c) => {
                if (c > 200) return;
                const v = cell.value;
                let raw;
                if (v && typeof v === 'object' && v.formula) raw = '=' + v.formula;
                else if (v && typeof v === 'object' && v.sharedFormula) raw = v.result != null ? String(v.result) : '';
                else if (v instanceof Date) raw = String(F.toSerial(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate())));
                else if (v && typeof v === 'object' && v.richText) raw = v.richText.map(t => t.text).join('');
                else if (v && typeof v === 'object' && v.text) raw = String(v.text);
                else if (v && typeof v === 'object' && 'result' in v) raw = String(v.result);
                else raw = v == null ? '' : String(v);
                const s = {};
                if (cell.font) {
                    if (cell.font.bold) s.b = true;
                    if (cell.font.italic) s.i = true;
                    if (cell.font.underline) s.u = true;
                    if (cell.font.strike) s.st = true;
                    if (cell.font.color && cell.font.color.argb) s.color = '#' + cell.font.color.argb.slice(-6).toLowerCase();
                }
                if (cell.fill && cell.fill.fgColor && cell.fill.fgColor.argb) s.fill = '#' + cell.fill.fgColor.argb.slice(-6).toLowerCase();
                if (cell.alignment && ['left', 'center', 'right'].includes(cell.alignment.horizontal)) s.align = cell.alignment.horizontal;
                const nf = String(cell.numFmt || '');
                if (v instanceof Date || /[dy]{2}/i.test(nf)) s.fmt = 'date';
                else if (/%/.test(nf)) s.fmt = 'percent';
                else if (/€|\$|£/.test(nf)) s.fmt = 'currency';
                else if (/0\.0/.test(nf)) s.fmt = 'number';
                cells[F.addr(c, r)] = { v: raw.slice(0, 5000), ...(Object.keys(s).length ? { s } : {}) };
            });
        });
        sheets.push({ id: `s${sheets.length + 1}`, name: ws.name.slice(0, 31), cells, cols });
    });
    if (!sheets.length) sheets.push({ id: 's1', name: 'Sheet1', cells: {}, cols: {} });
    return { sheets, active: 0 };
}

module.exports = { sheetToXlsx, sheetToCsv, sheetToPdf, importSheet, usedRange, pdfDoc, safe, hex };

/* ---------- documents (Docs) ---------- */

const PAGE = {
    A4: { w: 11906, h: 16838, pdf: 'A4' },
    Letter: { w: 12240, h: 15840, pdf: 'LETTER' }
};
const MARGINS = { normal: { tb: 1440, lr: 1440 }, narrow: { tb: 720, lr: 720 }, wide: { tb: 1440, lr: 2880 } };
const pageOf = body => {
    const p = (body && body.page) || {};
    return { size: PAGE[p.size] ? p.size : 'A4', landscape: p.orient === 'landscape', margins: MARGINS[p.margins] ? p.margins : 'normal' };
};

function cssOf(style) {
    const out = {};
    for (const part of String(style || '').split(';')) {
        const i = part.indexOf(':');
        if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
    }
    return out;
}
function colorHex(v) {
    if (!v) return null;
    const s = String(v).trim();
    let m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return m[1].split('').map(c => c + c).join('').toUpperCase();
    m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) return m[1].toUpperCase();
    m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(s);
    return m ? [m[1], m[2], m[3]].map(n => Math.min(255, +n).toString(16).padStart(2, '0')).join('').toUpperCase() : null;
}
const fontFamily = v => (v ? String(v).split(',')[0].replace(/["']/g, '').trim() : null);
function imageInfo(src) {
    const m = /^data:image\/(png|jpeg|gif|webp);base64,(.+)$/.exec(String(src || ''));
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    let size = { width: 400, height: 300 };
    try {
        const { imageSize } = require('image-size');
        size = imageSize(buf);
    } catch {
        // unreadable size: a sensible default
    }
    return { type: m[1] === 'jpeg' ? 'jpg' : m[1], buf, w: size.width || 400, h: size.height || 300 };
}

/** sanitized HTML → a list of blocks (paragraphs, headings, list items, pictures, tables…) with formatted runs */
function htmlToBlocks(html) {
    const { parseDocument } = require('htmlparser2');
    const dom = parseDocument(String(html || ''), { decodeEntities: true });
    const blocks = [];
    let pending = null;
    let olInstance = 0;
    const flush = () => {
        if (pending && pending.runs.some(r => r.img || r.br || r.text.trim())) blocks.push(pending);
        pending = null;
    };
    function runsOf(node, f, out) {
        if (node.type === 'text') {
            if (node.data) out.push({ ...f, text: node.data.replace(/\s+/g, ' ') });
            return out;
        }
        if (node.type !== 'tag') return out;
        const n = node.name;
        const g = { ...f };
        const css = cssOf(node.attribs.style);
        if (n === 'b' || n === 'strong' || /^(bold|700)$/.test(css['font-weight'] || '')) g.b = true;
        if (n === 'i' || n === 'em' || css['font-style'] === 'italic') g.i = true;
        if (n === 'u' || /underline/.test(css['text-decoration'] || '')) g.u = true;
        if (n === 's' || n === 'strike' || n === 'del' || /line-through/.test(css['text-decoration'] || '')) g.s = true;
        if (n === 'sub') g.sub = true;
        if (n === 'sup') g.sup = true;
        if (n === 'code') g.font = 'Courier New';
        if (n === 'mark') g.bg = 'FFF59D';
        if (n === 'a' && /^(https?:|mailto:)/.test(node.attribs.href || '')) g.link = node.attribs.href;
        if (colorHex(css.color)) g.color = colorHex(css.color);
        if (colorHex(css['background-color'])) g.bg = colorHex(css['background-color']);
        if (/^\d+(\.\d)?pt$/.test(css['font-size'] || '')) g.size = parseFloat(css['font-size']);
        if (fontFamily(css['font-family'])) g.font = fontFamily(css['font-family']);
        if (n === 'br') return out.push({ ...f, text: '', br: true }), out;
        if (n === 'img') {
            const img = imageInfo(node.attribs.src);
            if (img) out.push({ text: '', img, width: Number(node.attribs.width) || null });
            return out;
        }
        for (const c of node.children || []) runsOf(c, g, out);
        return out;
    }
    const paraStyle = node => {
        const css = cssOf(node.attribs && node.attribs.style);
        return { align: ['left', 'center', 'right', 'justify'].includes(css['text-align']) ? css['text-align'] : null, indent: /^\d+px$/.test(css['margin-left'] || '') ? parseInt(css['margin-left'], 10) : 0 };
    };
    // a paragraph's runs, split around pictures (each picture becomes its own block)
    function pushPara(base, runs) {
        let cur = [];
        const out = () => {
            if (cur.some(r => r.br || r.text.trim())) blocks.push({ ...base, runs: trimRuns(cur) });
            cur = [];
        };
        for (const r of runs) {
            if (r.img) {
                out();
                blocks.push({ type: 'img', img: r.img, width: r.width, align: base.align });
            } else cur.push(r);
        }
        out();
        if (!runs.length) blocks.push({ ...base, runs: [] });
    }
    const trimRuns = runs => {
        const rs = runs.map(r => ({ ...r }));
        if (rs[0] && !rs[0].br) rs[0].text = rs[0].text.replace(/^\s+/, '');
        const last = rs[rs.length - 1];
        if (last && !last.br) last.text = last.text.replace(/\s+$/, '');
        return rs.filter(r => r.br || r.text !== '');
    };
    function walk(nodes, ctx) {
        for (const node of nodes) {
            if (node.type === 'text') {
                if (!node.data.trim()) continue;
                pending = pending || { type: 'p', runs: [] };
                runsOf(node, {}, pending.runs);
                continue;
            }
            if (node.type !== 'tag') continue;
            const n = node.name;
            if (/^(p|div|h1|h2|h3|figcaption)$/.test(n)) {
                flush();
                const st = paraStyle(node);
                pushPara({ type: n === 'div' ? 'p' : n === 'figcaption' ? 'caption' : n, ...st, quote: ctx.quote }, runsOf(node, {}, []));
            } else if (n === 'blockquote') {
                flush();
                const inner = (node.children || []).some(c => c.type === 'tag' && /^(p|div|h[1-3]|ul|ol)$/.test(c.name));
                if (inner) walk(node.children, { ...ctx, quote: true });
                else pushPara({ type: 'p', quote: true, ...paraStyle(node) }, runsOf(node, {}, []));
            } else if (n === 'pre') {
                flush();
                const text = [];
                const collect = x => (x.type === 'text' ? text.push(x.data) : x.name === 'br' ? text.push('\n') : (x.children || []).forEach(collect));
                (node.children || []).forEach(collect);
                blocks.push({ type: 'pre', text: text.join('').replace(/\n$/, '') });
            } else if (n === 'ul' || n === 'ol') {
                flush();
                const kind = n === 'ol' ? 'number' : node.attribs && 'data-checklist' in node.attribs ? 'check' : 'bullet';
                const inst = n === 'ol' ? ++olInstance : 0;
                for (const li of node.children || []) {
                    if (li.type !== 'tag' || li.name !== 'li') continue;
                    const inline = (li.children || []).filter(c => !(c.type === 'tag' && /^(ul|ol)$/.test(c.name)));
                    const runs = [];
                    inline.forEach(c => runsOf(c, {}, runs));
                    pushPara({ type: 'li', list: { kind, level: ctx.level || 0, instance: inst, checked: li.attribs && li.attribs['data-checked'] === 'true' }, ...paraStyle(li) }, runs);
                    for (const c of li.children || []) if (c.type === 'tag' && /^(ul|ol)$/.test(c.name)) walk([c], { ...ctx, level: (ctx.level || 0) + 1 });
                }
            } else if (n === 'hr') {
                flush();
                blocks.push({ type: node.attribs && 'data-page-break' in node.attribs ? 'pagebreak' : 'hr' });
            } else if (n === 'table') {
                flush();
                const rows = [];
                const findRows = x => (x.type === 'tag' && x.name === 'tr' ? rows.push(x) : (x.children || []).forEach(findRows));
                (node.children || []).forEach(findRows);
                blocks.push({
                    type: 'table',
                    rows: rows.slice(0, 500).map(tr => (tr.children || []).filter(c => c.type === 'tag' && /^(td|th)$/.test(c.name)).slice(0, 30).map(cell => ({ header: cell.name === 'th', bg: colorHex(cssOf(cell.attribs.style)['background-color']), runs: trimRuns(runsOf(cell, cell.name === 'th' ? { b: true } : {}, [])).filter(r => !r.img) })))
                });
            } else if (n === 'figure') {
                flush();
                walk(node.children || [], ctx);
            } else if (n === 'img') {
                flush();
                const img = imageInfo(node.attribs.src);
                if (img) blocks.push({ type: 'img', img, width: Number(node.attribs.width) || null });
            } else {
                // inline content between blocks
                pending = pending || { type: 'p', runs: [] };
                runsOf(node, {}, pending.runs);
            }
        }
        flush();
    }
    walk(dom.children, {});
    return blocks;
}

async function docToDocx(title, body) {
    const D = require('docx');
    const page = pageOf(body);
    const blocks = htmlToBlocks(body.html);
    const contentPx = ((page.landscape ? PAGE[page.size].h : PAGE[page.size].w) - 2 * MARGINS[page.margins].lr) / 15;
    const ALIGN = { left: D.AlignmentType.LEFT, center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT, justify: D.AlignmentType.JUSTIFIED };
    const run = r => {
        if (r.br) return new D.TextRun({ break: 1 });
        const props = {
            text: r.text,
            bold: r.b || undefined,
            italics: r.i || undefined,
            underline: r.u ? {} : undefined,
            strike: r.s || undefined,
            color: r.color || undefined,
            shading: r.bg ? { type: D.ShadingType.CLEAR, color: 'auto', fill: r.bg } : undefined,
            font: r.font || undefined,
            size: r.size ? Math.round(r.size * 2) : undefined,
            superScript: r.sup || undefined,
            subScript: r.sub || undefined
        };
        return r.link ? new D.ExternalHyperlink({ link: r.link, children: [new D.TextRun({ ...props, style: 'Hyperlink' })] }) : new D.TextRun(props);
    };
    const children = [];
    if (title) children.push(new D.Paragraph({ heading: D.HeadingLevel.TITLE, children: [new D.TextRun(title)] }));
    for (const b of blocks) {
        const common = { alignment: b.align ? ALIGN[b.align] : undefined, indent: b.indent ? { left: b.indent * 15 } : undefined };
        if (b.type === 'pagebreak') children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
        else if (b.type === 'hr') children.push(new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: 'BFBFBF', space: 1 } }, children: [] }));
        else if (b.type === 'pre') {
            for (const l of b.text.split('\n')) children.push(new D.Paragraph({ shading: { type: D.ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }, spacing: { after: 0 }, children: [new D.TextRun({ text: l || ' ', font: 'Courier New', size: 19 })] }));
            children.push(new D.Paragraph({ children: [] }));
        } else if (b.type === 'img') {
            const w = Math.min(b.width || b.img.w, contentPx);
            const h = Math.round((w / b.img.w) * b.img.h);
            children.push(new D.Paragraph({ ...common, children: [new D.ImageRun({ type: b.img.type === 'webp' ? 'png' : b.img.type, data: b.img.buf, transformation: { width: Math.round(w), height: h } })] }));
        } else if (b.type === 'table') {
            if (!b.rows.length) continue;
            const cols = Math.max(...b.rows.map(r => r.length));
            children.push(new D.Table({
                width: { size: 100, type: D.WidthType.PERCENTAGE },
                rows: b.rows.map(r => new D.TableRow({ children: Array.from({ length: cols }, (_, i) => r[i] || { runs: [] }).map(c => new D.TableCell({ shading: c.bg ? { type: D.ShadingType.CLEAR, color: 'auto', fill: c.bg } : undefined, children: [new D.Paragraph({ children: c.runs.map(run) })] })) }))
            }));
            children.push(new D.Paragraph({ children: [] }));
        } else {
            const runs = b.runs.map(run);
            const opts = { ...common, children: runs };
            if (b.type === 'h1') opts.heading = D.HeadingLevel.HEADING_1;
            else if (b.type === 'h2') opts.heading = D.HeadingLevel.HEADING_2;
            else if (b.type === 'h3') opts.heading = D.HeadingLevel.HEADING_3;
            if (b.type === 'caption') opts.children = b.runs.map(r => run({ ...r, i: true, color: r.color || '595959' }));
            if (b.quote) Object.assign(opts, { indent: { left: 720 }, border: { left: { style: D.BorderStyle.SINGLE, size: 18, color: '4C8DFF', space: 8 } }, children: b.runs.map(r => run({ ...r, i: true, color: r.color || '404040' })) });
            if (b.type === 'li') {
                if (b.list.kind === 'number') opts.numbering = { reference: 'eg-numbers', level: Math.min(8, b.list.level), instance: b.list.instance };
                else if (b.list.kind === 'bullet') opts.bullet = { level: Math.min(8, b.list.level) };
                else opts.children = [new D.TextRun({ text: b.list.checked ? '☑ ' : '☐ ', font: 'Segoe UI Symbol' }), ...b.runs.map(r => run(b.list.checked ? { ...r, s: true, color: r.color || '808080' } : r))];
                if (b.list.kind === 'check') opts.indent = { left: 360 + 360 * b.list.level };
            }
            children.push(new D.Paragraph(opts));
        }
    }
    const m = MARGINS[page.margins];
    const doc = new D.Document({
        creator: 'EderveenGroup',
        title,
        styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
        numbering: { config: [{ reference: 'eg-numbers', levels: Array.from({ length: 9 }, (_, l) => ({ level: l, format: [D.LevelFormat.DECIMAL, D.LevelFormat.LOWER_LETTER, D.LevelFormat.LOWER_ROMAN][l % 3], text: `%${l + 1}.`, alignment: D.AlignmentType.START, style: { paragraph: { indent: { left: 720 * (l + 1), hanging: 360 } } } })) }] },
        sections: [{ properties: { page: { size: { width: PAGE[page.size].w, height: PAGE[page.size].h, orientation: page.landscape ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT }, margin: { top: m.tb, bottom: m.tb, left: m.lr, right: m.lr } } }, children }]
    });
    return D.Packer.toBuffer(doc);
}

async function docToPdf(title, body) {
    const page = pageOf(body);
    const m = MARGINS[page.margins];
    const margin = { top: m.tb / 20, bottom: m.tb / 20, left: m.lr / 20, right: m.lr / 20 };
    const { doc, done } = pdfDoc({ title, pdf: { size: PAGE[page.size].pdf, layout: page.landscape ? 'landscape' : 'portrait', margins: margin } });
    doc.addPage();
    const left = margin.left;
    const width = () => doc.page.width - margin.left - margin.right;
    const FAM = f => (/georgia|times|garamond/i.test(f || '') ? 'Times' : /courier|mono/i.test(f || '') ? 'Courier' : 'Helvetica');
    const fontName = r => {
        const fam = FAM(r.font);
        const bi = r.b && r.i ? 'BoldOblique' : r.b ? 'Bold' : r.i ? 'Oblique' : '';
        if (fam === 'Times') return { BoldOblique: 'Times-BoldItalic', Bold: 'Times-Bold', Oblique: 'Times-Italic', '': 'Times-Roman' }[bi];
        return bi ? `${fam}-${bi}` : fam;
    };
    const ensure = h => doc.y + h > doc.page.height - margin.bottom && doc.addPage();
    function para(runs, { size = 11, x = left, w = width(), align = 'left', bold = false, gap = 6, color } = {}) {
        if (!runs.length) return void (doc.y += size * 0.9);
        ensure(size * 1.4);
        const startY = doc.y;
        runs.forEach((r, i) => {
            const text = r.br ? '\n' : safe(r.text);
            doc.font(fontName({ ...r, b: r.b || bold })).fontSize(r.size || size).fillColor(r.link ? '#1f5fbf' : r.color ? '#' + r.color : color || '#111111');
            const opts = { width: w, align, continued: i < runs.length - 1, underline: !!(r.u || r.link), strike: !!r.s, link: r.link || null, lineGap: 2 };
            if (i === 0) doc.text(text, x, startY, opts);
            else doc.text(text, opts);
        });
        doc.y += gap;
    }
    if (title) {
        doc.font('Helvetica').fontSize(26).fillColor('#111111').text(safe(title), left, doc.y, { width: width() });
        doc.moveDown(0.4);
    }
    const counters = {};
    for (const b of htmlToBlocks(body.html)) {
        const indent = (b.indent || 0) * 0.75;
        if (b.type === 'pagebreak') doc.addPage();
        else if (b.type === 'hr') {
            ensure(14);
            doc.moveTo(left, doc.y + 6).lineTo(left + width(), doc.y + 6).lineWidth(0.7).stroke('#bfbfbf');
            doc.y += 14;
        } else if (b.type === 'pre') {
            doc.font('Courier').fontSize(9.5);
            const h = doc.heightOfString(safe(b.text), { width: width() - 16 }) + 12;
            ensure(h);
            doc.rect(left, doc.y, width(), h).fill('#f2f2f2');
            doc.fillColor('#222').text(safe(b.text), left + 8, doc.y + 6, { width: width() - 16 });
            doc.y += 10;
        } else if (b.type === 'img') {
            if (!/^(png|jpg)$/.test(b.img.type)) {
                para([{ text: '[picture]', i: true, color: '808080' }]);
                continue;
            }
            const w = Math.min(width(), (b.width || b.img.w) * 0.75);
            const h = (w / b.img.w) * b.img.h;
            ensure(Math.min(h, doc.page.height - margin.top - margin.bottom));
            const x = b.align === 'center' ? left + (width() - w) / 2 : b.align === 'right' ? left + width() - w : left;
            try {
                doc.image(b.img.buf, x, doc.y, { fit: [w, Math.min(h, doc.page.height - margin.top - margin.bottom)] });
                doc.y += Math.min(h, doc.page.height - margin.top - margin.bottom) + 8;
            } catch {
                para([{ text: '[picture that couldn’t be read]', i: true, color: '808080' }]); // a damaged picture doesn't spoil the rest
            }
        } else if (b.type === 'table') {
            const cols = Math.max(1, ...b.rows.map(r => r.length));
            const cw = width() / cols;
            for (const r of b.rows) {
                const heights = Array.from({ length: cols }, (_, i) => {
                    const c = r[i];
                    if (!c) return 18;
                    doc.font(c.header ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
                    return doc.heightOfString(safe(c.runs.map(x => x.text).join('')) || ' ', { width: cw - 10 }) + 10;
                });
                const rh = Math.max(...heights);
                ensure(rh);
                const y = doc.y;
                for (let i = 0; i < cols; i++) {
                    const c = r[i] || { runs: [] };
                    if (c.bg) doc.rect(left + i * cw, y, cw, rh).fill('#' + c.bg);
                    doc.lineWidth(0.5).rect(left + i * cw, y, cw, rh).stroke('#bfbfbf');
                    doc.font(c.header ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#111');
                    doc.text(safe(c.runs.map(x => x.text).join('')), left + i * cw + 5, y + 5, { width: cw - 10 });
                }
                doc.y = y + rh;
            }
            doc.y += 8;
        } else if (b.type === 'li') {
            const lv = b.list.level;
            const key = `${b.list.instance}:${lv}`;
            counters[key] = (counters[key] || 0) + 1;
            const mark = b.list.kind === 'number' ? `${counters[key]}.` : b.list.kind === 'check' ? (b.list.checked ? '[x]' : '[ ]') : lv % 2 ? '-' : '•';
            const x = left + indent + 18 + lv * 18;
            ensure(16);
            const y = doc.y;
            doc.font('Helvetica').fontSize(11).fillColor('#111').text(mark, x - 16, y, { width: 16, lineBreak: false });
            doc.y = y;
            para(b.list.kind === 'check' && b.list.checked ? b.runs.map(r => ({ ...r, s: true, color: '808080' })) : b.runs, { x, w: width() - (x - left), align: b.align || 'left', gap: 3 });
        } else {
            const H = { h1: 20, h2: 15.5, h3: 13 };
            const size = H[b.type] || (b.type === 'caption' ? 9.5 : 11);
            if (H[b.type]) doc.y += 6;
            const x = left + indent + (b.quote ? 14 : 0);
            const y0 = doc.y;
            para(b.quote || b.type === 'caption' ? b.runs.map(r => ({ ...r, i: true, color: r.color || '555555' })) : b.runs, { size, x, w: width() - (x - left), align: b.align || 'left', bold: !!H[b.type], gap: H[b.type] ? 4 : 6, color: H[b.type] ? '#1f3864' : null });
            if (b.quote) doc.moveTo(left + indent + 4, y0).lineTo(left + indent + 4, doc.y - 6).lineWidth(2.5).stroke('#4c8dff');
        }
    }
    doc.end();
    return done;
}

/** a Word file → HTML for Docs (pictures embedded) */
async function importDocx(buffer) {
    const mammoth = require('mammoth');
    const r = await mammoth.convertToHtml({ buffer }, { convertImage: mammoth.images.imgElement(img => img.read('base64').then(b64 => ({ src: `data:${img.contentType};base64,${b64}` }))) });
    return r.value;
}

module.exports.docToDocx = docToDocx;
module.exports.docToPdf = docToPdf;
module.exports.importDocx = importDocx;
module.exports.htmlToBlocks = htmlToBlocks;
