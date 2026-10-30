'use strict';

// Profile pictures: photos users upload here, plus (optionally) Gravatar and
// company logos fetched server-side so the browser never talks to third parties.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_PHOTO_BYTES = 1024 * 1024;
const HIT_TTL = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL = 24 * 60 * 60 * 1000;

// Personal mailbox providers: their logo says nothing about the sender.
const FREEMAIL = new Set([
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com', 'icloud.com',
    'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'gmx.de', 'web.de', 'mail.com',
    'zoho.com', 'yandex.com', 'yandex.ru', 'fastmail.com', 'hey.com', 'purelymail.com', 'ziggo.nl', 'kpnmail.nl', 'hotmail.nl',
    'live.nl', 'outlook.nl', 'xs4all.nl', 'planet.nl', 'home.nl', 'hetnet.nl', 'tutanota.com', 'tuta.io', 'qq.com', '163.com'
]);
const SECOND_LEVEL = new Set(['co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'co.nz', 'co.jp', 'com.br', 'co.za', 'com.mx', 'co.in']);

function sniffType(buf) {
    if (buf.length > 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png';
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    if (buf.length > 6 && buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
    return null;
}

function pngWidth(buf) {
    return buf.length > 24 && sniffType(buf) === 'image/png' ? buf.readUInt32BE(16) : null;
}

function brandDomain(address) {
    const host = (address.split('@')[1] || '').toLowerCase();
    if (!host || FREEMAIL.has(host)) return null;
    const parts = host.split('.');
    const n = SECOND_LEVEL.has(parts.slice(-2).join('.')) ? 3 : 2;
    const domain = parts.slice(-n).join('.');
    return FREEMAIL.has(domain) ? null : domain;
}

// Resolves to an image Buffer, null when the service says there is none,
// or undefined when the lookup itself failed (so we don't cache the miss).
async function fetchImage(url) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'EderveenGroup-Mail/1.0' } });
        if (!res.ok) return res.status >= 500 || res.status === 429 ? undefined : null;
        const buf = Buffer.from(await res.arrayBuffer());
        return sniffType(buf) && buf.length < 2 * MAX_PHOTO_BYTES ? buf : null;
    } catch {
        return undefined;
    }
}

function createAvatars(dataDir) {
    const photos = path.join(dataDir, 'avatars');
    const cache = path.join(dataDir, 'avatar-cache');
    fs.mkdirSync(photos, { recursive: true });
    fs.mkdirSync(cache, { recursive: true });
    const keyOf = email => crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
    const photoFile = email => path.join(photos, keyOf(email));
    const inflight = new Map();

    function readFresh(file, ttl) {
        try {
            const st = fs.statSync(file);
            if (Date.now() - st.mtimeMs < ttl) return fs.readFileSync(file);
        } catch {
            // not cached
        }
        return undefined;
    }

    async function remoteLookup(email) {
        const key = keyOf(email);
        const hit = readFresh(path.join(cache, key), HIT_TTL);
        if (hit) return hit;
        if (readFresh(path.join(cache, key + '.miss'), MISS_TTL) !== undefined) return null;

        const md5 = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
        let buf = await fetchImage(`https://www.gravatar.com/avatar/${md5}?s=160&d=404`);
        let failed = buf === undefined;
        const domain = !buf && brandDomain(email);
        if (domain) {
            const logo = await fetchImage(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
            if (logo === undefined) failed = true;
            // tiny favicons look blurry when scaled up, so only accept real-size logos
            const w = logo && pngWidth(logo);
            if (logo && (w === null || w >= 48)) buf = logo;
        }
        if (buf) fs.writeFileSync(path.join(cache, key), buf);
        else if (!failed) fs.writeFileSync(path.join(cache, key + '.miss'), '');
        return buf || null;
    }

    return {
        photoVersion(email) {
            try {
                return Math.floor(fs.statSync(photoFile(email)).mtimeMs);
            } catch {
                return null;
            }
        },

        savePhoto(email, dataUrl) {
            const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
            if (!m) throw Object.assign(new Error('Upload a PNG, JPEG or WebP image'), { status: 400 });
            const buf = Buffer.from(m[2], 'base64');
            if (buf.length > MAX_PHOTO_BYTES) throw Object.assign(new Error('That photo is too large (max 1 MB after cropping)'), { status: 413 });
            if (!sniffType(buf)) throw Object.assign(new Error('That file is not a valid image'), { status: 400 });
            fs.writeFileSync(photoFile(email), buf, { mode: 0o600 });
            return this.photoVersion(email);
        },

        removePhoto(email) {
            fs.rmSync(photoFile(email), { force: true });
        },

        // Returns { buf, type } or null. Uploaded photos win; then Gravatar / company logo.
        async lookup(email, { remote = true } = {}) {
            let buf = null;
            try {
                buf = fs.readFileSync(photoFile(email));
            } catch {
                // no uploaded photo
            }
            if (!buf && remote) {
                const key = keyOf(email);
                if (!inflight.has(key)) inflight.set(key, remoteLookup(email).finally(() => inflight.delete(key)));
                buf = await inflight.get(key);
            }
            return buf ? { buf, type: sniffType(buf) } : null;
        }
    };
}

module.exports = { createAvatars, brandDomain };
