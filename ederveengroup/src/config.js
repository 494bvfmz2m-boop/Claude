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
        db: env.DB_HOST
            ? { host: env.DB_HOST, port: Number(env.DB_PORT) || 3306, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD || '', ssl: env.DB_SSL === '1' ? 'verify' : env.DB_SSL === 'insecure' ? 'insecure' : '' }
            : null
    };
}

module.exports = { loadConfig, trustSetting };
