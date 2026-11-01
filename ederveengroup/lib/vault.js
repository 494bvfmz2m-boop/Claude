'use strict';

// The vault: file contents for Files and Photos, kept on disk (FILES_DIR, which can be a big
// mounted disk such as a storage VPS or a Hetzner Storage Box), encrypted.
//
// Each file is split into 4 MB pieces, each sealed on its own (AES-256-GCM, with a key made for
// that file and the piece's number bound in), so
//   - any part can be read without the rest: video seeking, resumed downloads (HTTP Range)
//   - big files never have to fit in memory, going in or out
//   - an upload sent in parts can carry on where it stopped, even after a restart
//
// On disk: "EGV1" + 4 bytes piece size, then per piece: 12-byte IV, 16-byte tag, ciphertext.

const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { Readable } = require('stream');

const MAGIC = Buffer.from('EGV1');
const HEAD = 8;
const PIECE = 4 * 1024 * 1024;
const OVER = 28; // iv + tag per piece
const ID = /^[A-Za-z0-9_-]{16,64}$/;

function createVault({ dir, key }) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const fileOf = id => {
        if (!ID.test(String(id))) throw new Error('bad file id');
        return path.join(dir, id.slice(0, 2), id.slice(2, 4), id);
    };
    const keyOf = id => crypto.createHmac('sha256', key).update(`vault\0${id}`).digest();
    const aad = n => {
        const b = Buffer.alloc(8);
        b.writeBigUInt64BE(BigInt(n));
        return b;
    };
    function seal(k, n, plain) {
        const iv = crypto.randomBytes(12);
        const c = crypto.createCipheriv('aes-256-gcm', k, iv);
        c.setAAD(aad(n));
        const body = Buffer.concat([c.update(plain), c.final()]);
        return Buffer.concat([iv, c.getAuthTag(), body]);
    }
    function open(k, n, raw) {
        const d = crypto.createDecipheriv('aes-256-gcm', k, raw.subarray(0, 12));
        d.setAAD(aad(n));
        d.setAuthTag(raw.subarray(12, 28));
        return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
    }
    // plain size from the size on disk
    const plainSize = disk => {
        const enc = disk - HEAD;
        if (enc <= 0) return 0;
        const n = Math.ceil(enc / (PIECE + OVER));
        return (n - 1) * PIECE + (enc - (n - 1) * (PIECE + OVER) - OVER);
    };

    /**
     * Write a file. Data can arrive in any sizes; full pieces are sealed and written as they fill.
     * With resume: true an unfinished file is continued (it must have stopped on a piece boundary,
     * which uploads in parts of whole pieces always do).
     */
    async function writer(id, { resume = false } = {}) {
        const final = fileOf(id);
        const part = final + '.part';
        await fsp.mkdir(path.dirname(final), { recursive: true, mode: 0o700 });
        const k = keyOf(id);
        let n = 0;
        if (resume && fs.existsSync(part)) {
            const disk = (await fsp.stat(part)).size;
            if (disk < HEAD || (disk - HEAD) % (PIECE + OVER) !== 0) throw Object.assign(new Error('That upload can’t be continued; start it again'), { status: 409 });
            n = (disk - HEAD) / (PIECE + OVER);
        } else {
            const h = Buffer.alloc(HEAD);
            MAGIC.copy(h);
            h.writeUInt32BE(PIECE, 4);
            await fsp.writeFile(part, h, { mode: 0o600 });
        }
        const fh = await fsp.open(part, 'a');
        let held = [];
        let heldLen = 0;
        const flushFull = async () => {
            while (heldLen >= PIECE) {
                const all = Buffer.concat(held);
                await fh.write(seal(k, n++, all.subarray(0, PIECE)));
                held = [all.subarray(PIECE)];
                heldLen = held[0].length;
            }
        };
        return {
            get written() {
                return n * PIECE + heldLen;
            },
            async write(buf) {
                held.push(buf);
                heldLen += buf.length;
                await flushFull();
            },
            /** stop here, keeping what's sealed so far (whole pieces only) for a later resume */
            async pause() {
                await fh.close();
                // what's held in memory isn't kept; the whole pieces on disk are
                if (heldLen) throw Object.assign(new Error('Parts must be a multiple of 4 MB, except the last'), { status: 400 });
                return n * PIECE;
            },
            /** the last bit, then the file is complete; returns its size */
            async end() {
                if (heldLen) await fh.write(seal(k, n++, Buffer.concat(held)));
                held = [];
                const size = (n - (heldLen ? 1 : 0)) * PIECE + heldLen;
                heldLen = 0;
                await fh.close();
                await fsp.rename(part, final);
                return size;
            },
            async abort() {
                await fh.close().catch(() => {});
                await fsp.rm(part, { force: true });
            }
        };
    }

    /** how far an unfinished upload got (0 when there's nothing) */
    async function partial(id) {
        try {
            const disk = (await fsp.stat(fileOf(id) + '.part')).size;
            return Math.floor(Math.max(0, disk - HEAD) / (PIECE + OVER)) * PIECE;
        } catch {
            return 0;
        }
    }

    async function size(id) {
        try {
            return plainSize((await fsp.stat(fileOf(id))).size);
        } catch {
            return null;
        }
    }

    /** a stream of bytes start..end (inclusive), decrypted piece by piece */
    async function read(id, { start = 0, end } = {}) {
        const file = fileOf(id);
        const total = plainSize((await fsp.stat(file)).size);
        if (end == null || end >= total) end = total - 1;
        const k = keyOf(id);
        const fh = await fsp.open(file, 'r');
        let n = Math.floor(start / PIECE);
        const last = Math.floor(end / PIECE);
        let done = end < start;
        return new Readable({
            async read() {
                if (done || n > last) {
                    done = true;
                    await fh.close().catch(() => {});
                    return this.push(null);
                }
                try {
                    const pieceLen = Math.min(PIECE, total - n * PIECE);
                    const raw = Buffer.alloc(pieceLen + OVER);
                    await fh.read(raw, 0, raw.length, HEAD + n * (PIECE + OVER));
                    let plain = open(k, n, raw);
                    const from = n === Math.floor(start / PIECE) ? start - n * PIECE : 0;
                    const to = n === last ? end - n * PIECE + 1 : plain.length;
                    plain = plain.subarray(from, to);
                    n++;
                    this.push(plain);
                } catch (err) {
                    await fh.close().catch(() => {});
                    this.destroy(Object.assign(new Error('This file is damaged or was stored with another secret key'), { cause: err }));
                }
            },
            async destroy(err, cb) {
                await fh.close().catch(() => {});
                cb(err);
            }
        });
    }

    async function readAll(id) {
        const chunks = [];
        for await (const c of await read(id)) chunks.push(c);
        return Buffer.concat(chunks);
    }

    async function put(id, buf) {
        const w = await writer(id);
        await w.write(buf);
        return w.end();
    }

    async function remove(id) {
        const f = fileOf(id);
        await fsp.rm(f, { force: true });
        await fsp.rm(f + '.part', { force: true });
    }

    /** free and total room on the disk the vault is on */
    async function disk() {
        try {
            const s = await fsp.statfs(dir);
            return { free: s.bavail * s.bsize, total: s.blocks * s.bsize };
        } catch {
            return null;
        }
    }

    return { PIECE, writer, partial, size, read, readAll, put, remove, disk, dir };
}

module.exports = { createVault, PIECE };
