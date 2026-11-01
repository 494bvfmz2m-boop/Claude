'use strict';

// Forms: the questions (cleaned when saved), answers checked when someone sends them, and
// the responses as a table for Excel (.xlsx), CSV or the Spreadsheets app.

const crypto = require('crypto');

const TYPES = ['short', 'long', 'choice', 'checks', 'dropdown', 'scale', 'rating', 'date', 'time', 'email', 'number', 'section'];
const CHOICES = ['choice', 'checks', 'dropdown'];
const HEX = /^#[0-9a-f]{6}$/i;
const line = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, max);
const newId = () => crypto.randomBytes(5).toString('base64url');

function cleanQuestion(q) {
    q = q && typeof q === 'object' ? q : {};
    const type = TYPES.includes(q.type) ? q.type : 'short';
    const out = { id: /^[A-Za-z0-9_-]{4,24}$/.test(String(q.id || '')) ? q.id : newId(), type, title: line(q.title, 300), help: text(q.help, 600) };
    if (type === 'section') return out;
    if (q.required) out.required = true;
    if (CHOICES.includes(type)) {
        const seen = new Set();
        out.options = [].concat(q.options || []).map(o => line(o, 200)).filter(o => o && !seen.has(o) && seen.add(o)).slice(0, 60);
        if (!out.options.length) out.options = ['Option 1'];
        if (q.other && type !== 'dropdown') out.other = true;
    }
    if (type === 'scale') {
        out.low = q.low === 0 || q.low === '0' ? 0 : 1;
        out.high = Math.max(2, Math.min(10, Math.round(Number(q.high)) || 5));
        out.lowLabel = line(q.lowLabel, 60);
        out.highLabel = line(q.highLabel, 60);
    }
    if (type === 'rating') out.high = Math.max(3, Math.min(10, Math.round(Number(q.high)) || 5));
    return out;
}

function cleanForm(b) {
    b = b && typeof b === 'object' ? b : {};
    const s = b.settings && typeof b.settings === 'object' ? b.settings : {};
    const questions = [].concat(b.questions || []).slice(0, 200).map(cleanQuestion);
    const ids = new Set();
    for (const q of questions) {
        while (ids.has(q.id)) q.id = newId();
        ids.add(q.id);
    }
    return {
        desc: text(b.desc, 4000),
        color: HEX.test(b.color || '') ? b.color.toLowerCase() : '#0f7b6c',
        questions,
        settings: {
            open: s.open !== false,
            who: s.who === 'members' ? 'members' : 'anyone',
            once: !!s.once,
            thanks: text(s.thanks, 1000)
        }
    };
}

/** What a respondent sees: the questions, nothing else. */
function publicForm(title, form) {
    return { title, desc: form.desc, color: form.color, questions: form.questions, who: form.settings.who, once: form.settings.once };
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
/** Check the answers to a form; returns the clean answers, or throws a message to show. */
function checkAnswers(form, answers) {
    answers = answers && typeof answers === 'object' ? answers : {};
    const out = {};
    for (const q of form.questions) {
        if (q.type === 'section') continue;
        let v = answers[q.id];
        const name = q.title || 'This question';
        const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
        if (empty) {
            if (q.required) throw new Error(`“${name}” needs an answer`);
            continue;
        }
        if (q.type === 'checks') {
            const list = [].concat(v).map(x => line(x, 300)).filter(Boolean);
            const bad = list.filter(x => !q.options.includes(x));
            if (bad.length > (q.other ? 1 : 0)) throw new Error(`Pick from the choices for “${name}”`);
            v = [...new Set(list)].slice(0, 60);
            if (!v.length && q.required) throw new Error(`“${name}” needs an answer`);
            if (!v.length) continue;
        } else if (q.type === 'choice' || q.type === 'dropdown') {
            v = line(v, 300);
            if (!q.options.includes(v) && !(q.other && v)) throw new Error(`Pick from the choices for “${name}”`);
        } else if (q.type === 'scale' || q.type === 'rating') {
            v = Number(v);
            const lo = q.type === 'scale' ? q.low : 1;
            if (!Number.isInteger(v) || v < lo || v > q.high) throw new Error(`Pick a number from ${lo} to ${q.high} for “${name}”`);
        } else if (q.type === 'number') {
            const n = Number(String(v).replace(',', '.'));
            if (!Number.isFinite(n)) throw new Error(`“${name}” needs a number`);
            v = n;
        } else if (q.type === 'email') {
            v = line(v, 254);
            if (!EMAIL.test(v)) throw new Error(`“${name}” needs an email address`);
        } else if (q.type === 'date') {
            v = line(v, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new Error(`“${name}” needs a date`);
        } else if (q.type === 'time') {
            v = line(v, 5);
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error(`“${name}” needs a time`);
        } else if (q.type === 'long') v = text(v, 8000).trim();
        else v = line(v, 1000);
        if (v === '' && q.required) throw new Error(`“${name}” needs an answer`);
        if (v !== '') out[q.id] = v;
    }
    return out;
}

/** All responses as rows: a header, then one row per response (oldest first). */
function table(form, items) {
    const qs = form.questions.filter(q => q.type !== 'section');
    const header = ['Submitted', 'By', ...qs.map((q, i) => q.title || `Question ${i + 1}`)];
    const rows = items.map(r => [new Date(r.at), r.by || 'Anonymous', ...qs.map(q => {
        const v = r.a[q.id];
        return v == null ? '' : Array.isArray(v) ? v.join('; ') : v;
    })]);
    return { header, rows };
}

async function responsesToXlsx(title, form, items) {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'EderveenGroup';
    const ws = wb.addWorksheet('Responses', { views: [{ state: 'frozen', ySplit: 1 }] });
    const { header, rows } = table(form, items);
    ws.addRow(header);
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${form.color.slice(1).toUpperCase()}` } };
    // answers go in as values (text stays text, so nothing typed into a form becomes a formula)
    for (const r of rows) ws.addRow(r);
    ws.getColumn(1).numFmt = 'dd-mm-yyyy hh:mm';
    header.forEach((h, i) => (ws.getColumn(i + 1).width = Math.min(60, Math.max(12, String(h).length + 4, ...rows.slice(0, 200).map(r => String(r[i] instanceof Date ? '00-00-0000 00:00' : r[i]).length + 2)))));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
    return Buffer.from(await wb.xlsx.writeBuffer());
}

// a cell starting with = + - @ would be run as a formula by Excel: CSV gets a ' in front
const unformula = v => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
function responsesToCsv(form, items) {
    const { header, rows } = table(form, items);
    const q = v => {
        const s = String(v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : v == null ? '' : unformula(v));
        return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return '﻿' + [header, ...rows].map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}

/** The responses as a workbook for the Spreadsheets app. */
function responsesToBook(form, items) {
    const F = require('../public/js/formula');
    const { header, rows } = table(form, items);
    const cells = {};
    header.forEach((h, c) => (cells[F.addr(c + 1, 1)] = { v: String(h), s: { b: true, fill: form.color, color: '#ffffff' } }));
    rows.slice(0, 9990).forEach((r, i) =>
        r.forEach((v, c) => {
            if (v === '' || v == null) return;
            const val = v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : typeof v === 'string' && v.startsWith('=') ? `'${v}` : String(v);
            cells[F.addr(c + 1, i + 2)] = { v: val };
        })
    );
    const cols = {};
    header.forEach((h, c) => (cols[F.colName(c + 1)] = c < 2 ? 140 : 180));
    return { sheets: [{ id: 's1', name: 'Responses', cells, cols, freeze: true }], active: 0 };
}

module.exports = { TYPES, cleanForm, cleanQuestion, publicForm, checkAnswers, table, responsesToXlsx, responsesToCsv, responsesToBook };
