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
    const dataDir = env.DATA_DIR || path.join(ROOT, 'data');
    return {
        port: Number(env.PORT) || 3000,
        dataDir,
        publicDir: path.join(ROOT, 'public'),
        viewsDir: path.join(ROOT, 'views'),
        base,
        baseUrl: base + '/',
        trustProxy: trustSetting(env.TRUST_PROXY),
        // cookies are marked Secure whenever the request arrived over HTTPS; this forces it always
        secureCookies: env.SECURE_COOKIES === 'true',
        openBrowser: !!env.OPEN_BROWSER,
        // who can accept or reject requests to add other mail servers (comma-separated addresses)
        // auto editing with Claude (the default AI): a key can also be pasted into Admin → AI
        anthropicApiKey: String(env.ANTHROPIC_API_KEY || '').trim(),
        anthropicBaseUrl: String(env.ANTHROPIC_BASE_URL || '').trim(),
        // other AI services for auto editing (also pasted into Admin → AI); AI_API_KEY + AI_BASE_URL for any OpenAI-compatible one
        aiKeys: { gemini: env.GEMINI_API_KEY || env.GOOGLE_API_KEY, groq: env.GROQ_API_KEY, openai: env.OPENAI_API_KEY, openrouter: env.OPENROUTER_API_KEY, mistral: env.MISTRAL_API_KEY, xai: env.XAI_API_KEY, custom: env.AI_API_KEY },
        aiBaseUrl: String(env.AI_BASE_URL || '').trim(),
        adminEmails: String(env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
        // testing only: let requests point at mail servers on private networks
        allowPrivateMailHosts: env.ALLOW_PRIVATE_MAIL_HOSTS === '1',
        // MySQL / MariaDB; without DB_HOST everything is kept in files in the data folder
        db: dbSetting(env),
        // Files and Photos: where the contents live (any big disk, e.g. a mounted storage VPS),
        // and optional limits in MB (room per person, biggest single file; 0 = only the disk limits)
        files: {
            dir: env.FILES_DIR ? path.resolve(env.FILES_DIR) : path.join(dataDir, 'files'),
            quota: Math.max(0, Number(env.FILES_QUOTA_MB) || 0) * 1024 * 1024,
            maxFile: Math.max(0, Number(env.FILES_MAX_MB) || 0) * 1024 * 1024
        },
        // "Sign in with Microsoft / Google": set the client ID and secret from each provider's console
        oauth: {
            google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : null,
            microsoft: env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET ? { clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET, tenant: env.MICROSOFT_TENANT || 'common' } : null,
            // the address people reach the site at, for the sign-in return address (else taken from the request)
            publicUrl: (env.PUBLIC_URL || '').replace(/\/$/, ''),
            // testing only: a stand-in sign-in service and mail server
            devIssuer: env.OAUTH_DEV_ISSUER || '',
            devMailHost: env.OAUTH_DEV_MAIL_HOST || ''
        }
    };
}

module.exports = { loadConfig, trustSetting };
