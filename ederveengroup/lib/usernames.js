'use strict';

// Usernames: how people find each other (ederveengroup.net/profile/#/ava.chen).
// 3–30 characters: lowercase letters, digits, dots, underscores and hyphens; starts with a
// letter; no doubled or trailing dots. Some names are kept for the site itself.

const RESERVED = new Set(
    ('admin administrator root system support help info contact about team staff mod moderator ederveen ederveengroup ' +
        'mail email inbox profile profiles hub app apps api login logout signin signup register welcome settings account accounts ' +
        'security privacy terms legal www web site home edit new me you null undefined test official abuse noreply no-reply postmaster webmaster')
        .split(/\s+/)
);

const clean = v => String(v == null ? '' : v).trim().toLowerCase().replace(/^@/, '');

/** null when the name is fine, otherwise a short reason */
function problem(name) {
    if (name.length < 3) return 'At least 3 characters';
    if (name.length > 30) return 'At most 30 characters';
    if (!/^[a-z]/.test(name)) return 'Start with a letter';
    if (!/^[a-z0-9._-]+$/.test(name)) return 'Only letters, numbers, dots, underscores and hyphens';
    if (/\.\./.test(name) || /\.$/.test(name)) return 'No double dots, and no dot at the end';
    if (RESERVED.has(name)) return 'That name is reserved';
    return null;
}

/** a starting suggestion from an email address: "Ava.Chen+news@x.com" -> "ava.chen" */
function fromEmail(email) {
    let s = clean(String(email).split('@')[0].split('+')[0]).replace(/[^a-z0-9._-]/g, '').replace(/\.{2,}/g, '.').replace(/^[^a-z]+/, '').replace(/\.$/, '');
    if (s.length < 3) s = (s + 'user').slice(0, 8);
    return s.slice(0, 30);
}

/** a few free alternatives when a name is taken */
async function alternatives(name, isFree, count = 3) {
    const base = name.replace(/[._-]?\d+$/, '').slice(0, 24) || 'user';
    const out = [];
    const tries = [`${base}.eg`, ...Array.from({ length: 8 }, () => `${base}${Math.floor(10 + Math.random() * 990)}`)];
    for (const t of tries) {
        if (out.length >= count) break;
        if (!problem(t) && !out.includes(t) && (await isFree(t))) out.push(t);
    }
    return out;
}

module.exports = { alternatives, clean, fromEmail, problem, RESERVED };
