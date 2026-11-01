'use strict';

// Where EderveenGroup keeps its data.
//
//   MySQL / MariaDB   when DB_HOST is set (the normal setup): every account, username, profile,
//                     profile photo and the mail-server registry live in four tables, created
//                     automatically on first start.
//   JSON files        otherwise (the double-click zip): the data/ folder, as before.
//
// Private account data (settings, 2FA, devices, sign-in activity, contacts, snoozes, the hub
// apps' data), shared documents (chat, short links) and uploaded files are stored encrypted
// (AES-256-GCM, key derived from the server's secret), so the database host never sees them in
// the clear. Usernames and public profiles are stored readable: they're public.
//
// Besides accounts, both backends keep
//   documents   named JSON documents shared by everyone (chat conversations, short links…)
//   blobs       file contents (the Files app), by random id

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const norm = email => String(email || '').trim().toLowerCase();
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

/* ---------- encryption of private blobs ---------- */
function sealer(key) {
    return {
        seal(obj) {
            const iv = crypto.randomBytes(12);
            const c = crypto.createCipheriv('aes-256-gcm', key, iv);
            const body = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
            return 'v1.' + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64');
        },
        open(text) {
            if (!text) return null;
            if (!text.startsWith('v1.')) return JSON.parse(text); // plain JSON (written before encryption)
            const raw = Buffer.from(text.slice(3), 'base64');
            const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
            d.setAuthTag(raw.subarray(12, 28));
            return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
        }
    };
}

const BLOB_ID = /^[A-Za-z0-9_-]{16,40}$/;
const blobId = id => {
    if (!BLOB_ID.test(String(id))) throw new Error('bad blob id');
    return String(id);
};
// file contents are encrypted in pieces of 1 MB, so any MySQL/MariaDB (max_allowed_packet 4 MB on old ones) takes them
const CHUNK = 1024 * 1024;
function sealBytes(key, buf) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([c.update(buf), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), body]);
}
function openBytes(key, raw) {
    const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
}

/* ---------- files (no database configured) ---------- */
function createFileBackend(dataDir) {
    const users = path.join(dataDir, 'users');
    const photos = path.join(dataDir, 'avatars');
    const indexFile = path.join(dataDir, 'usernames.json');
    const registryFile = path.join(dataDir, 'servers.json');
    const docs = path.join(dataDir, 'docs');
    const blobs = path.join(dataDir, 'blobs');
    fs.mkdirSync(users, { recursive: true, mode: 0o700 });
    fs.mkdirSync(photos, { recursive: true, mode: 0o700 });
    fs.mkdirSync(docs, { recursive: true, mode: 0o700 });
    fs.mkdirSync(blobs, { recursive: true, mode: 0o700 });
    const docFile = name => path.join(docs, sha(String(name)) + '.json');
    try {
        fs.chmodSync(dataDir, 0o700);
    } catch {
        // best effort (e.g. Windows)
    }
    const userFile = email => path.join(users, sha(norm(email)) + '.json');
    const photoFile = email => path.join(photos, sha(norm(email)));
    const write = (file, text) => {
        fs.writeFileSync(file + '.tmp', text, { mode: 0o600 });
        fs.renameSync(file + '.tmp', file);
    };
    const readJson = file => {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            return null;
        }
    };
    let index = readJson(indexFile) || {}; // username -> email
    return {
        kind: 'files',
        async init() {},
        async close() {},
        // everything is synchronous underneath, so writes land before the call returns
        loadUserSync(email) {
            const data = readJson(userFile(email));
            return data ? { data, username: data.username || null, profile: data.profile || null } : null;
        },
        async loadUser(email) {
            return this.loadUserSync(email);
        },
        async saveUser(email, { data, username, profile }) {
            write(userFile(email), JSON.stringify({ ...data, email: norm(email), username, profile }, null, 2));
        },
        /** everyone who has a username and a profile (public or not; the caller filters) */
        async listProfiles() {
            const out = [];
            for (const [username, email] of Object.entries(index)) {
                const d = readJson(userFile(email));
                if (d && d.profile) out.push({ email, username, profile: d.profile });
            }
            return out;
        },
        /** everyone with an account (files written before addresses were stored are skipped) */
        async listUsers() {
            return fs.readdirSync(users).filter(f => f.endsWith('.json')).map(f => readJson(path.join(users, f))).filter(d => d && d.email).map(d => ({ email: d.email }));
        },
        async claimUsername(email, username, previous) {
            const owner = index[username];
            if (owner && owner !== norm(email)) return false;
            if (previous && index[previous] === norm(email)) delete index[previous];
            index[username] = norm(email);
            write(indexFile, JSON.stringify(index, null, 2));
            return true;
        },
        async emailForUsername(username) {
            return index[username] || null;
        },
        async getPhoto(email) {
            try {
                const buf = fs.readFileSync(photoFile(email));
                return { buf, version: Math.floor(fs.statSync(photoFile(email)).mtimeMs) };
            } catch {
                return null;
            }
        },
        async setPhoto(email, buf) {
            write(photoFile(email), buf);
            return Math.floor(fs.statSync(photoFile(email)).mtimeMs);
        },
        async removePhoto(email) {
            fs.rmSync(photoFile(email), { force: true });
        },
        async loadRegistry() {
            return readJson(registryFile);
        },
        async saveRegistry(doc) {
            write(registryFile, JSON.stringify(doc, null, 2));
        },
        async loadDoc(name) {
            return readJson(docFile(name));
        },
        async saveDoc(name, doc) {
            write(docFile(name), JSON.stringify(doc));
        },
        async deleteDoc(name) {
            fs.rmSync(docFile(name), { force: true });
        },
        async putBlob(id, buf) {
            write(path.join(blobs, blobId(id)), buf);
        },
        async getBlob(id) {
            try {
                return fs.readFileSync(path.join(blobs, blobId(id)));
            } catch {
                return null;
            }
        },
        async deleteBlob(id) {
            fs.rmSync(path.join(blobs, blobId(id)), { force: true });
        }
    };
}

/* ---------- MySQL / MariaDB ---------- */
const SCHEMA = [
    `CREATE TABLE IF NOT EXISTS eg_users (
        email VARCHAR(254) NOT NULL PRIMARY KEY,
        username VARCHAR(30) NULL,
        data MEDIUMTEXT NOT NULL,
        profile TEXT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        UNIQUE KEY eg_users_username (username)
    ) DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS eg_photos (
        email VARCHAR(254) NOT NULL PRIMARY KEY,
        bytes MEDIUMBLOB NOT NULL,
        version BIGINT NOT NULL
    ) DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS eg_registry (
        name VARCHAR(40) NOT NULL PRIMARY KEY,
        doc MEDIUMTEXT NOT NULL,
        updated_at BIGINT NOT NULL
    ) DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS eg_blobs (
        id VARCHAR(40) NOT NULL,
        part INT NOT NULL,
        bytes MEDIUMBLOB NOT NULL,
        PRIMARY KEY (id, part)
    ) DEFAULT CHARSET=utf8mb4`
];

function createMysqlBackend({ host, port = 3306, database, user, password, ssl = '' }, { key, legacy }) {
    const mysql = require('mysql2/promise');
    const box = sealer(key);
    const pool = mysql.createPool({
        host, port: Number(port) || 3306, database, user, password,
        charset: 'utf8mb4', connectionLimit: 6, connectTimeout: 10000, enableKeepAlive: true, supportBigNumbers: true,
        ...(ssl ? { ssl: { rejectUnauthorized: ssl !== 'insecure' } } : {})
    });
    const q = async (sql, args = []) => (await pool.execute(sql, args))[0];
    return {
        kind: 'mysql',
        async init() {
            for (const sql of SCHEMA) await pool.query(sql);
        },
        close: () => pool.end(),
        async loadUser(email) {
            const [row] = await q('SELECT data, username, profile FROM eg_users WHERE email = ?', [norm(email)]);
            if (row) return { data: box.open(row.data), username: row.username || null, profile: row.profile ? JSON.parse(row.profile) : null };
            // first time we see this account in the database: bring over what the files had
            const old = legacy && (await legacy.loadUser(email));
            return old ? { ...old, migrated: true } : null;
        },
        async saveUser(email, { data, profile }) {
            const now = Date.now();
            await q(
                `INSERT INTO eg_users (email, data, profile, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE data = VALUES(data), profile = VALUES(profile), updated_at = VALUES(updated_at)`,
                [norm(email), box.seal(data), profile ? JSON.stringify(profile) : null, now, now]
            );
        },
        async claimUsername(email, username) {
            try {
                // the row exists already (saved before claiming); the unique key settles races
                const res = await q('UPDATE eg_users SET username = ?, updated_at = ? WHERE email = ?', [username, Date.now(), norm(email)]);
                return res.affectedRows === 1;
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY') return false;
                throw err;
            }
        },
        async emailForUsername(username) {
            const [row] = await q('SELECT email FROM eg_users WHERE username = ?', [username]);
            return row ? row.email : null;
        },
        async listUsers() {
            return (await q('SELECT email FROM eg_users ORDER BY updated_at DESC LIMIT 2000')).map(r => ({ email: r.email }));
        },
        async listProfiles() {
            return (await q('SELECT email, username, profile FROM eg_users WHERE username IS NOT NULL AND profile IS NOT NULL LIMIT 2000')).map(r => ({ email: r.email, username: r.username, profile: JSON.parse(r.profile) }));
        },
        async getPhoto(email) {
            const [row] = await q('SELECT bytes, version FROM eg_photos WHERE email = ?', [norm(email)]);
            if (row) return { buf: Buffer.from(row.bytes), version: Number(row.version) };
            const old = legacy && (await legacy.getPhoto(email));
            if (old) await this.setPhoto(email, old.buf);
            return old;
        },
        async setPhoto(email, buf) {
            const version = Date.now();
            await q('INSERT INTO eg_photos (email, bytes, version) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE bytes = VALUES(bytes), version = VALUES(version)', [norm(email), buf, version]);
            return version;
        },
        async removePhoto(email) {
            await q('DELETE FROM eg_photos WHERE email = ?', [norm(email)]);
            if (legacy) await legacy.removePhoto(email);
        },
        async loadRegistry() {
            const [row] = await q("SELECT doc FROM eg_registry WHERE name = 'servers'");
            if (row) return JSON.parse(row.doc);
            return legacy ? legacy.loadRegistry() : null;
        },
        async saveRegistry(doc) {
            await q("INSERT INTO eg_registry (name, doc, updated_at) VALUES ('servers', ?, ?) ON DUPLICATE KEY UPDATE doc = VALUES(doc), updated_at = VALUES(updated_at)", [JSON.stringify(doc), Date.now()]);
        },
        // shared documents live next to the registry, under "doc:<name>", encrypted
        async loadDoc(name) {
            const [row] = await q('SELECT doc FROM eg_registry WHERE name = ?', ['doc:' + name]);
            return row ? box.open(row.doc) : null;
        },
        async saveDoc(name, doc) {
            await q('INSERT INTO eg_registry (name, doc, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE doc = VALUES(doc), updated_at = VALUES(updated_at)', ['doc:' + name, box.seal(doc), Date.now()]);
        },
        async deleteDoc(name) {
            await q('DELETE FROM eg_registry WHERE name = ?', ['doc:' + name]);
        },
        async putBlob(id, buf) {
            id = blobId(id);
            // no transaction or up-front delete: those take range locks that make parallel
            // uploads deadlock. Ids are new random ones; replacing one just trims leftover pieces.
            const parts = Math.max(1, Math.ceil(buf.length / CHUNK));
            const retry = async fn => {
                for (let i = 0; ; i++) {
                    try {
                        return await fn();
                    } catch (err) {
                        if (err.errno !== 1213 || i >= 3) throw err; // deadlock: try again
                        await new Promise(r => setTimeout(r, 30 * (i + 1)));
                    }
                }
            };
            for (let part = 0; part < parts; part++) {
                const bytes = sealBytes(key, buf.subarray(part * CHUNK, (part + 1) * CHUNK));
                await retry(() => q('INSERT INTO eg_blobs (id, part, bytes) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE bytes = VALUES(bytes)', [id, part, bytes]));
            }
            const [{ n }] = await q('SELECT COUNT(*) AS n FROM eg_blobs WHERE id = ?', [id]);
            if (Number(n) > parts) await retry(() => q('DELETE FROM eg_blobs WHERE id = ? AND part >= ?', [id, parts]));
        },
        async getBlob(id) {
            const rows = await q('SELECT bytes FROM eg_blobs WHERE id = ? ORDER BY part', [blobId(id)]);
            return rows.length ? Buffer.concat(rows.map(r => openBytes(key, Buffer.from(r.bytes)))) : null;
        },
        async deleteBlob(id) {
            await q('DELETE FROM eg_blobs WHERE id = ?', [blobId(id)]);
        }
    };
}

/** picks the backend from the config; the files are kept as a read-only source for migration */
function createBackend(config, { key }) {
    const files = createFileBackend(config.dataDir);
    if (!config.db) return files;
    return createMysqlBackend(config.db, { key, legacy: files });
}

module.exports = { createBackend, createFileBackend, createMysqlBackend, sealer };
