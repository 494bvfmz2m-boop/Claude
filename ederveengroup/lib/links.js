'use strict';

// Opaque links for every conversation and folder, e.g. /mail/inbox/x7Kq2pW9aZc
//
// A conversation token is a keyed 64-bit permutation (a 4-round Feistel network with
// HMAC-SHA256 as the round function) of [uid | folder tag]. That makes it short, stable for
// a message, impossible to guess or enumerate, and it needs no lookup table: the server
// turns it back into a uid and checks the folder tag. Keys are derived per account, so the
// same message has different links for different people. Links only work when signed in.

const crypto = require('crypto');

const b64 = buf => buf.toString('base64url');

function createLinks(secret) {
    const keys = new Map();
    const keyOf = email => {
        const e = String(email).toLowerCase();
        if (!keys.has(e)) keys.set(e, crypto.createHmac('sha256', secret).update(`links\0${e}`).digest());
        return keys.get(e);
    };
    const mac = (key, label, value) => crypto.createHmac('sha256', key).update(`${label}\0${value}`).digest();
    const round = (key, r, half) => {
        const b = Buffer.alloc(5);
        b[0] = r;
        b.writeUInt32BE(half >>> 0, 1);
        return crypto.createHmac('sha256', key).update(b).digest().readUInt32BE(0);
    };
    function feistel(key, hi, lo, decrypt) {
        for (let i = 0; i < 4; i++) {
            const r = decrypt ? 3 - i : i;
            if (!decrypt) [hi, lo] = [lo, (hi ^ round(key, r, lo)) >>> 0];
            else [hi, lo] = [(lo ^ round(key, r, hi)) >>> 0, hi];
        }
        return [hi, lo];
    }
    const tagOf = (key, folder) => mac(key, 'folder', folder).readUInt32BE(0);

    return {
        /** short public id for a folder (used in URLs for your own folders) */
        folderId: (email, folder) => b64(mac(keyOf(email), 'fid', folder).subarray(0, 6)),

        /** link token for a message in a folder */
        encode(email, folder, uid) {
            const key = keyOf(email);
            const [hi, lo] = feistel(key, Number(uid) >>> 0, tagOf(key, folder), false);
            const out = Buffer.alloc(8);
            out.writeUInt32BE(hi, 0);
            out.writeUInt32BE(lo, 4);
            return b64(out);
        },

        /** uid for a token in that folder, or null if the token isn't valid there */
        decode(email, folder, token) {
            if (!/^[A-Za-z0-9_-]{11}$/.test(String(token || ''))) return null;
            const buf = Buffer.from(token, 'base64url');
            if (buf.length !== 8) return null;
            const key = keyOf(email);
            const [uid, tag] = feistel(key, buf.readUInt32BE(0), buf.readUInt32BE(4), true);
            return tag === tagOf(key, folder) && uid > 0 ? uid : null;
        }
    };
}

module.exports = { createLinks };
