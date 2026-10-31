'use strict';

const path = require('path');

const ROOT = path.join(__dirname, '..');

// Which reverse proxies to believe for X-Forwarded-* (client IP, https). Default: only one on
// this machine (e.g. Caddy). Behind Coolify/Traefik or another single proxy use TRUST_PROXY=1.
function trustSetting(v) {
    if (!v) return 'loopback';
    if (/^\d+$/.test(v)) return Number(v); // number of proxy hops
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v; // IPs / subnets / 'loopback', comma separated
}

// The database: either one connection URL (DATABASE_URL, e.g. Coolify's "Internal URL"
// mysql://user:pass@host:3306/name), or DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD.
function dbSetting(env) {
    const ssl = env.DB_SSL === '1' ? 'verify' : env.DB_SSL === 'insecure' ? 'insecure' : '';
    const url = env.DATABASE_URL || env.DB_URL;
    if (url) {
        // parsed by hand: passwords often contain characters (? # @ !) that break URL parsing
        const m = /^(mysql|mariadb):\/\/([^:@/]*)(?::(.*))?@([^@/:]+)(?::(\d+))?\/([^?#]*)/.exec(String(url).trim());
        if (!m) throw new Error('DATABASE_URL should look like mysql://user:password@host:3306/database');
        const dec = s => {
            try {
                return decodeURIComponent(s || '');
            } catch {
                return s || '';
            }
        };
        return { host: m[4], port: Number(m[5]) || 3306, database: dec(m[6]), user: dec(m[2]), password: dec(m[3]), ssl };
    }
    if (!env.DB_HOST) return null;
    return { host: env.DB_HOST, port: Number(env.DB_PORT) || 3306, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD || '', ssl };
}

function loadConfig(env = process.env) {
    // Where the webmail lives: /mail by default; BASE_PATH=/ serves it at the root instead.
    // The hub (sign-in and your apps) lives at "/", Mail at BASE_PATH (default /mail).
    const base = ('/' + (env.BASE_PATH ?? '/mail')).replace(/\/+/g, '/').replace(/\/$/, '') || '/mail';
    return {
        port: Number(env.PORT) || 3000,
        dataDir: env.DATA_DIR || path.join(ROOT, 'data'),
        publicDir: path.join(ROOT, 'public'),
        viewsDir: path.join(ROOT, 'views'),
        base,
        baseUrl: base + '/',
        trustProxy: trustSetting(env.TRUST_PROXY),
        // cookies are marked Secure whenever the request arrived over HTTPS; this forces it always
        secureCookies: env.SECURE_COOKIES === 'true',
        openBrowser: !!env.OPEN_BROWSER,
        // who can accept or reject requests to add other mail servers (comma-separated addresses)
        adminEmails: String(env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
        // testing only: let requests point at mail servers on private networks
        allowPrivateMailHosts: env.ALLOW_PRIVATE_MAIL_HOSTS === '1',
        // MySQL / MariaDB; without DB_HOST everything is kept in files in the data folder
        db: dbSetting(env)
    };
}

module.exports = { loadConfig, trustSetting };
