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
    const base = ('/' + (env.BASE_PATH ?? '/mail')).replace(/\/+/g, '/').replace(/\/$/, '');
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
        openBrowser: !!env.OPEN_BROWSER
    };
}

module.exports = { loadConfig, trustSetting };
