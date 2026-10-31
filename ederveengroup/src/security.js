'use strict';

const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "frame-src 'self' about:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
].join('; ');

function securityHeaders(req, res, next) {
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
        'Content-Security-Policy': CSP
    });
    next();
}

// Every state-changing API call must carry X-EG: browsers won't send a custom header
// cross-site without a CORS preflight, which we never approve. A browser-sent Origin must
// also be this host (compared by host, so it holds behind proxies that speak plain http to us).
function csrfGuard(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (req.get('X-EG') !== '1') return res.status(403).json({ error: 'Bad request origin' });
    const origin = req.get('Origin');
    if (origin) {
        let host = 'invalid';
        try {
            host = new URL(origin).host;
        } catch {
            // keep 'invalid'
        }
        if (host !== req.get('host')) return res.status(403).json({ error: 'Bad request origin' });
    }
    next();
}

// Sliding-window counter: "at most `max` events per `windowMs` for this key".
function createLimiter({ max, windowMs }) {
    const hits = new Map();
    const recent = key => (hits.get(key) || []).filter(t => Date.now() - t < windowMs);
    setInterval(() => {
        for (const key of hits.keys()) if (!recent(key).length) hits.delete(key);
    }, Math.min(windowMs, 5 * 60 * 1000)).unref();
    return {
        blocked: key => recent(key).length >= max,
        hit(key) {
            const list = recent(key);
            list.push(Date.now());
            hits.set(key, list);
        },
        reset: key => hits.delete(key),
        count: key => recent(key).length
    };
}

module.exports = { securityHeaders, csrfGuard, createLimiter, CSP };
