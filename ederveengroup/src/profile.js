'use strict';

// Profiles: a contact card people can share at /profile/#/<username>.
// Everything here is shown publicly when the profile is visible, so it's validated tightly.

const LINKS = {
    linkedin: { label: 'LinkedIn', host: /(^|\.)linkedin\.com$/, prefix: 'https://www.linkedin.com/in/' },
    x: { label: 'X', host: /(^|\.)(x|twitter)\.com$/, prefix: 'https://x.com/' },
    instagram: { label: 'Instagram', host: /(^|\.)instagram\.com$/, prefix: 'https://www.instagram.com/' },
    github: { label: 'GitHub', host: /(^|\.)github\.com$/, prefix: 'https://github.com/' },
    tiktok: { label: 'TikTok', host: /(^|\.)tiktok\.com$/, prefix: 'https://www.tiktok.com/@' },
    youtube: { label: 'YouTube', host: /(^|\.)youtube\.com$/, prefix: 'https://www.youtube.com/@' }
};

const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
const bad = message => Object.assign(new Error(message), { status: 400 });

/** an http(s) URL, adding https:// when the scheme was left off; '' when empty */
function url(v, what) {
    const s = text(v, 300);
    if (!s) return '';
    let u;
    try {
        u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    } catch {
        throw bad(`${what} doesn’t look like a web address`);
    }
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw bad(`${what} doesn’t look like a web address`);
    return u.href;
}

/** a social link from a full URL or just a handle ("@ava", "ava") */
function social(key, v) {
    const s = text(v, 300);
    if (!s) return '';
    const def = LINKS[key];
    const handle = s.replace(/^@/, '');
    if (/^[\w.-]{1,60}$/.test(handle) && !handle.includes('.com')) return def.prefix + handle;
    const href = url(s, def.label);
    if (!def.host.test(new URL(href).hostname)) throw bad(`That isn’t a ${def.label} link`);
    return href;
}

function cleanProfile(input = {}) {
    const email = text(input.email, 254).toLowerCase();
    if (email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) throw bad('The contact email doesn’t look right');
    const phone = text(input.phone, 40);
    if (phone && !/^\+?[0-9 ()./-]{5,40}$/.test(phone)) throw bad('Use only numbers, spaces, + ( ) - . in the phone number');
    const links = {};
    for (const key of Object.keys(LINKS)) {
        const v = social(key, input.links && input.links[key]);
        if (v) links[key] = v;
    }
    return {
        visible: input.visible !== false,
        name: text(input.name, 80),
        headline: text(input.headline, 100),
        company: text(input.company, 100),
        location: text(input.location, 100),
        bio: text(input.bio, 500),
        email,
        showEmail: input.showEmail !== false,
        phone,
        website: url(input.website, 'The website'),
        links,
        updatedAt: Date.now()
    };
}

/** what anyone may see (no hidden email, nothing internal) */
function publicView(profile, { username, photo }) {
    const p = profile || {};
    return {
        username,
        name: p.name || '',
        headline: p.headline || '',
        company: p.company || '',
        location: p.location || '',
        bio: p.bio || '',
        email: p.showEmail === false ? '' : p.email || '',
        phone: p.phone || '',
        website: p.website || '',
        links: p.links || {},
        photo: photo || null
    };
}

// vCard 3.0, so "Save contact" puts the person straight into the phone's address book
function vcard(view, { url: profileUrl, photo } = {}) {
    const esc = s => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const name = view.name || view.username;
    const parts = name.split(/\s+/);
    const last = parts.length > 1 ? parts.pop() : '';
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${esc(last)};${esc(parts.join(' '))};;;`, `FN:${esc(name)}`];
    if (view.company) lines.push(`ORG:${esc(view.company)}`);
    if (view.headline) lines.push(`TITLE:${esc(view.headline)}`);
    if (view.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(view.email)}`);
    if (view.phone) lines.push(`TEL;TYPE=CELL:${esc(view.phone)}`);
    if (view.website) lines.push(`URL:${esc(view.website)}`);
    if (view.location) lines.push(`ADR;TYPE=HOME:;;;${esc(view.location)};;;`);
    for (const [k, v] of Object.entries(view.links || {})) lines.push(`X-SOCIALPROFILE;TYPE=${k}:${esc(v)}`);
    if (profileUrl) lines.push(`URL;TYPE=EderveenGroup:${esc(profileUrl)}`);
    if (view.bio) lines.push(`NOTE:${esc(view.bio)}`);
    if (photo) lines.push(`PHOTO;ENCODING=b;TYPE=${photo.type === 'image/png' ? 'PNG' : 'JPEG'}:${photo.buf.toString('base64')}`);
    lines.push('END:VCARD');
    // lines longer than 75 octets are folded, as the format asks
    return lines.map(l => l.replace(/(.{74})(?=.)/g, '$1\r\n ')).join('\r\n') + '\r\n';
}

module.exports = { LINKS, cleanProfile, publicView, vcard };
