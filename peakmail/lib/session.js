'use strict';

// Encrypted, stateless client sessions (the "client-sessions" pattern).
// The whole session lives in an AES-256-GCM encrypted cookie, so the server
// keeps no session table and users stay signed in across restarts.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COOKIE = 'pm_session';
const LONG_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days ("remember me")
const SHORT_TTL = 12 * 60 * 60 * 1000; // 12 hours otherwise
const RENEW_AFTER = 24 * 60 * 60 * 1000; // slide the 30-day window once a day

function loadKey(dataDir) {
    if (process.env.SESSION_SECRET) {
        return crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
    }
    const file = path.join(dataDir, 'session.key');
    try {
        const buf = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
        if (buf.length === 32) return buf;
    } catch {
        // fall through and create one
    }
    const key = crypto.randomBytes(32);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, key.toString('base64'), { mode: 0o600 });
    return key;
}

function seal(key, payload) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}

function unseal(key, token) {
    try {
        const buf = Buffer.from(token, 'base64url');
        if (buf.length < 29) return null;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
        decipher.setAuthTag(buf.subarray(12, 28));
        const dec = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
        return JSON.parse(dec.toString('utf8'));
    } catch {
        return null;
    }
}

function parseCookies(header) {
    const out = {};
    for (const part of (header || '').split(';')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
}

function createSessions({ dataDir, secureCookies }) {
    const key = loadKey(dataDir);

    function write(res, session) {
        const parts = [`${COOKIE}=${seal(key, session)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
        if (session.remember) {
            parts.push(`Max-Age=${Math.floor((session.exp - Date.now()) / 1000)}`);
        }
        if (secureCookies) parts.push('Secure');
        res.append('Set-Cookie', parts.join('; '));
    }

    return {
        start(res, { email, password, remember }) {
            const now = Date.now();
            const session = { email, password, remember: !!remember, iat: now, exp: now + (remember ? LONG_TTL : SHORT_TTL) };
            write(res, session);
            return session;
        },

        clear(res) {
            res.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookies ? '; Secure' : ''}`);
        },

        // Express middleware: attaches req.session (or null) and slides long sessions.
        middleware() {
            return (req, res, next) => {
                const token = parseCookies(req.headers.cookie)[COOKIE];
                let session = token ? unseal(key, token) : null;
                if (session && (!session.exp || session.exp < Date.now())) session = null;
                if (session && session.remember && Date.now() - session.iat > RENEW_AFTER) {
                    session.iat = Date.now();
                    session.exp = session.iat + LONG_TTL;
                    write(res, session);
                }
                req.session = session;
                next();
            };
        }
    };
}

module.exports = { createSessions };
