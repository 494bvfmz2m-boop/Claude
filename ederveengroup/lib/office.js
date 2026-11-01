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
