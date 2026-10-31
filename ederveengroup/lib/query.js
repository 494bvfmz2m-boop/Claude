'use strict';

// Turns a Gmail-style search box query into an IMAP SEARCH criteria object (imapflow format).
//
//   from:marcus  to:jo@x.com  cc:team  subject:"friday plans"  has:attachment
//   is:unread  is:read  is:starred  is:answered  before:2026-10-01  after:2026-09-01
//   larger:5M  smaller:200K  plus any free text (matched in subject, from, to or body)

const SIZE = { K: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024 };

function tokenize(q) {
    const out = [];
    const re = /(\w+):"([^"]*)"|(\w+):(\S+)|"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(q))) {
        if (m[1]) out.push({ key: m[1].toLowerCase(), value: m[2] });
        else if (m[3]) out.push({ key: m[3].toLowerCase(), value: m[4] });
        else out.push({ text: m[5] !== undefined ? m[5] : m[6] });
    }
    return out;
}

function parseDate(v) {
    const d = /^\d{4}-\d{1,2}-\d{1,2}$/.test(v) ? new Date(v + 'T00:00:00') : /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(v) ? new Date(v.replaceAll('/', '-') + 'T00:00:00') : null;
    return d && !isNaN(d) ? d : null;
}

function parseSize(v) {
    const m = /^(\d+(?:\.\d+)?)([KMG])?B?$/i.exec(v);
    return m ? Math.round(Number(m[1]) * (m[2] ? SIZE[m[2].toUpperCase()] : 1)) : null;
}

/** Returns { criteria, text, used } where `used` lists the recognised operators. */
function parseQuery(q = '') {
    const criteria = {};
    const words = [];
    const used = [];
    for (const t of tokenize(String(q).slice(0, 300))) {
        if (t.text !== undefined) {
            if (t.text) words.push(t.text);
            continue;
        }
        const v = t.value.trim();
        let ok = true;
        switch (t.key) {
            case 'from':
            case 'to':
            case 'cc':
            case 'bcc':
            case 'subject':
                if (v) criteria[t.key] = v;
                break;
            case 'has':
                if (/^attachments?$/i.test(v)) criteria.header = { 'content-type': 'multipart/mixed' };
                else ok = false;
                break;
            case 'is':
                if (/^unread$/i.test(v)) criteria.seen = false;
                else if (/^read$/i.test(v)) criteria.seen = true;
                else if (/^(starred|flagged)$/i.test(v)) criteria.flagged = true;
                else if (/^answered$/i.test(v)) criteria.answered = true;
                else ok = false;
                break;
            case 'before':
            case 'after': {
                const d = parseDate(v);
                if (!d) ok = false;
                else if (t.key === 'before') criteria.before = d;
                else criteria.since = d;
                break;
            }
            case 'larger':
            case 'smaller': {
                const n = parseSize(v);
                if (n === null) ok = false;
                else criteria[t.key] = n;
                break;
            }
            default:
                ok = false;
        }
        if (ok) used.push(t.key);
        else words.push(`${t.key}:${t.value}`); // not an operator after all: search for it as text
    }
    const text = words.join(' ').trim();
    if (text) criteria.or = [{ subject: text }, { from: text }, { to: text }, { body: text }];
    return { criteria, text, used };
}

module.exports = { parseQuery };
