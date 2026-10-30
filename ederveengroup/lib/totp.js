'use strict';

// Time-based one-time passwords (RFC 6238 / RFC 4226): the 6-digit codes
// authenticator apps show. HMAC-SHA1, 30-second steps.

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;

function base32Encode(buf) {
    let bits = 0, value = 0, out = '';
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
    return out;
}

function base32Decode(str) {
    let bits = 0, value = 0;
    const out = [];
    for (const ch of str.replace(/[\s=-]/g, '').toUpperCase()) {
        const idx = ALPHABET.indexOf(ch);
        if (idx < 0) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

function hotp(secret, counter) {
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(counter));
    const mac = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
    const off = mac[mac.length - 1] & 15;
    const code = (mac.readUInt32BE(off) & 0x7fffffff) % 1e6;
    return String(code).padStart(6, '0');
}

const generateSecret = () => base32Encode(crypto.randomBytes(20));

// Returns the matching time step (to block replays) or null. Allows one step of clock drift.
function verify(secret, code, now = Date.now()) {
    code = String(code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) return null;
    const step = Math.floor(now / 1000 / STEP);
    for (const d of [0, -1, 1]) {
        const expected = hotp(secret, step + d);
        if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return step + d;
    }
    return null;
}

function otpauthUri(secret, account, issuer = 'EderveenGroup') {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;
}

module.exports = { generateSecret, verify, otpauthUri, hotp, base32Encode, base32Decode };
